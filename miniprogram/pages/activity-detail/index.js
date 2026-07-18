const activityApi = require('../../api/activity')
const userApi = require('../../api/user')
const toast = require('../../utils/toast')
const { call } = require('../../api/request')
const { ensureLogin } = require('../../utils/auth-guard')
const { lock, throttle } = require('../../utils/guard')
const { formatTime } = require('../../utils/mapper')
const { hueToColor, getInitial } = require('../../utils/color')

// 邀请函六类主题（与管理后台/设计稿同一体系）：背景渐变/文字/点缀色 + 英文小字
const INV_THEMES = {
  story:  { bg: ['#1F3450', '#3A6B9E'], fg: '#F2EFE6', accent: '#F8E9BE', kicker: 'XINGSHU MONTHLY STORY' },
  coffee: { bg: ['#F6EDDC', '#DEC79A'], fg: '#4A3A28', accent: '#8A6E4B', kicker: 'SATURDAY MORNING COFFEE' },
  film:   { bg: ['#26232B', '#4A4256'], fg: '#EDE8F2', accent: '#C9B8E8', kicker: 'XINGSHU CINEMA CLUB' },
  fire:   { bg: ['#8C2F1E', '#C2563F'], fg: '#FBEFE3', accent: '#FFD9A0', kicker: 'XINGSHU CAMPFIRE STORIES' },
  choco:  { bg: ['#3E2A20', '#6B4A3A'], fg: '#F2E4D4', accent: '#E8C39A', kicker: 'BEAN TO BAR WORKSHOP' },
  pot:    { bg: ['#B8860B', '#D8A93C'], fg: '#FFF9EA', accent: '#FFF3D0', kicker: 'XINGSHU KITCHEN TABLE' },
}

Page({
  data: {
    activity: null,
    isPast: false,
    isFull: false,
    signupClosed: false,
    feeText: '',
    pct: 0,
    statusBarHeight: 0,
    showSignup: false,
    signupName: '',
    signupContact: '',
    _sheetShow: false,
    showProfileComplete: false,
    _pcShow: false,
    pcName: '',
    pcPhone: '',
    showLoginSheet: false,
    needLogin: false,   // 登录墙拦截中 → 显示未登录占位页（杜绝白屏）
    // 现场分享
    posts: [],
    postsTotal: 0,
    postsPage: 1,
    postsHasMore: false,
    showPostSheet: false,
    _postShow: false,
    postContent: '',
    postImages: [],
    scrollInto: '', // 定位锚点（feed 跳入时滚到現場分享区）
    invite: null,   // 邀请函展示数据（主题/标签/时间/参与方式/限额）
    // 报名名单弹层
    showSignups: false,
    _suShow: false,
    signups: [],
  },

  onLoad(options) {
    const info = wx.getWindowInfo()
    // 导航栏右侧让出微信胶囊按钮的宽度，避免分享按钮被胶囊盖住
    let capsulePad = 96
    try {
      const mb = wx.getMenuButtonBoundingClientRect()
      if (mb && mb.left) capsulePad = info.windowWidth - mb.left + 6
    } catch (e) { /* 兜底固定让位 */ }
    this.setData({ statusBarHeight: info.statusBarHeight || 0, capsulePad })
    let id = options.id ? (parseInt(options.id, 10) || options.id) : null
    // 扫码/转发以本页为启动页时，id 藏在 scene（"a=3&s=8"）里
    if (!id && options.scene) {
      const m = decodeURIComponent(options.scene).match(/(?:^|&)a=(\d+)/)
      if (m) id = parseInt(m[1], 10)
    }
    this._id = id
    // 活动页分享瀑布流跳入：加载后定位到現場分享区
    this._scrollToPosts = options.to === 'posts'
  },

  // v2.3：活动详情需微信登录（轻授权），未登录先拉起登录弹窗。
  // 登录墙放 onReady（首渲染后）而非 onLoad：onLoad 同步置 visible=true 会成为组件初始属性，
  // observer 不触发致弹窗不挂载（真机白屏）；onReady 时是 false→true 常规更新，必然触发（同故事详情路径）。
  // needLogin 同时点亮未登录占位页（wxml wx:else 分支），自动弹窗失效也有可点的登录按钮，杜绝白屏。
  onReady() {
    if (!ensureLogin(this, () => this._load())) { this.setData({ needLogin: true }); return }
    this._load()
  },

  // 占位页「微信登录」按钮：点击时触发（与广场页同一条已验证路径）
  onWallLogin() {
    if (!ensureLogin(this, () => this._load())) return
    this._load()
  },

  // 微信「…」菜单转发/分享朋友圈：分享当前活动，带分享人 ID（s=）延续推荐人机制
  onShareAppMessage() {
    const a = this.data.activity || {}
    const sharerId = (getApp().globalData.user || {}).id
    return {
      title: a.title || '醒书活动',
      path: `/pages/activity-detail/index?id=${this._id}${sharerId ? '&s=' + sharerId : ''}`,
    }
  },
  // 报名数据页（主理人/工作人员专用，后端二次鉴权）
  onOpenStats() {
    wx.navigateTo({ url: '/pages/activity-stats/index?id=' + this._id })
  },

  onShareTimeline() {
    const a = this.data.activity || {}
    const sharerId = (getApp().globalData.user || {}).id
    return {
      title: a.title || '醒书活动',
      query: `id=${this._id}${sharerId ? '&s=' + sharerId : ''}`,
    }
  },

  onLoginClose() {
    // 取消登录不再强制返回：停留在登录占位页，可再点「微信登录」或自行返回
    this.setData({ showLoginSheet: false })
  },
  onLoginSuccess() {
    this.setData({ showLoginSheet: false })
    const action = this._pendingLoginAction
    this._pendingLoginAction = null
    if (typeof action === 'function') action()
  },

  async _load() {
    const a = await activityApi.getDetail(this._id)
    if (!a) {
      toast.info('活动不存在')
      setTimeout(() => this._goBack(), 1200)
      return
    }
    // 报名是否已关闭：已结束 / 已开始 / 已过报名截止——任一成立即不再显示报名·取消按钮
    const now = Date.now()
    const parseTs = s => (s ? new Date(String(s).replace(/-/g, '/') + ':00').getTime() : null)
    const deadlineTs = parseTs(a.signup_deadline)
    const startTs = parseTs(a.start_time)
    const deadlinePassed = deadlineTs ? now > deadlineTs : (startTs ? now > startTs : false)
    const signupClosed = a.status === 'finished' || Number(a.started) === 1 || deadlinePassed
    const price = Number(a.price) || 0
    this.setData({
      activity: a,
      isPast: a.status === 'finished',
      isFull: a.capacity > 0 && a.signup_count >= a.capacity && !a.isSignedUp,
      pct: a.capacity > 0 ? Math.min(100, Math.round(a.signup_count / a.capacity * 100)) : 0,
      signupClosed,
      feeText: price > 0 ? price + ' 元' : '免费',
      invite: this._buildInvite(a),
    })
    this._invPath = '' // 活动数据变化后邀请函图需重绘
    this._loadPosts(true)
  },

  // ── 邀请函：主题映射与展示数据 ──
  _inviteThemeKey(a) {
    const n = a.type_name || ''
    if (n.indexOf('咖啡') >= 0) return 'coffee'
    if (n.indexOf('观影') >= 0 || n.indexOf('电影') >= 0) return 'film'
    if (n.indexOf('巧克力') >= 0) return 'choco'
    if (n.indexOf('厨房') >= 0 || n.indexOf('餐') >= 0) return 'pot'
    return a.type === 'online' ? 'story' : 'fire'
  },

  _buildInvite(a) {
    const key = this._inviteThemeKey(a)
    const wd = (s) => {
      const d = new Date(String(s).replace(/-/g, '/'))
      return isNaN(d.getTime()) ? '' : '（周' + '日一二三四五六'[d.getDay()] + '）'
    }
    // 时分去掉前导 0（08:30 → 8:30）
    const fmtHM = (s) => {
      const m = String(s).match(/(\d{2}):(\d{2})/)
      return m ? Number(m[1]) + ':' + m[2] : ''
    }
    // 格式：2026-08-01（周六） 8:30 ~ 9:30（跨日则结束带日期）
    const datePart = String(a.start_time).slice(0, 10)
    let timeText = `${datePart}${wd(a.start_time)} ${fmtHM(String(a.start_time).slice(11, 16))}`
    if (a.end_time) {
      const sameDay = String(a.end_time).slice(0, 10) === datePart
      const endHM = fmtHM(String(a.end_time).slice(11, 16))
      timeText += sameDay ? ` ~ ${endHM}` : ` ~ ${String(a.end_time).slice(0, 10)} ${endHM}`
    }
    // 保留原文分段（\n）：行内多空格压一个、连续空行压成一个，仅去首尾空白
    const content = (a.content || '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    const price = Number(a.price) || 0
    return {
      key,
      kicker: INV_THEMES[key].kicker,
      tagText: `${a.type_name || '醒書活動'} · ${a.type === 'online' ? '線上' : '線下'}`,
      intro: content,   // 海报完整展现介绍全文（按段落，画布高度动态）
      timeText,
      // 线上不泄露会议号，口径与详情可见性规则一致
      joinText: a.type === 'online' ? '线上 · 腾讯会议（会议号报名后可见）' : `线下 · ${a.city || ''} · ${a.location || ''}`,
      quotaText: a.capacity > 0 ? `${a.capacity} 人 · 先到先得` : '不限名额',
      feeText: price > 0 ? price + ' 元' : '免费',
    }
  },

  // ── 现场分享 ──
  async _loadPosts(reset) {
    if (this._postsLoading) return
    this._postsLoading = true
    try {
      const page = reset ? 1 : this.data.postsPage
      const data = await activityApi.getPosts(this._id, page)
      if (!data) return
      const mapped = data.list.map(p => ({
        ...p,
        timeText: formatTime(p.created_at) || p.created_at,
        avatarColor: hueToColor(p.avatar_hue),
        initial: getInitial(p.nickname),
        likeCount: p.like_count || 0,
        isLiked: !!p.isLiked,
      }))
      this.setData({
        posts: reset ? mapped : [...this.data.posts, ...mapped],
        postsTotal: data.total,
        postsPage: page + 1,
        postsHasMore: page * data.pageSize < data.total,
      })
      // 瀑布流跳入：分享区渲染完成后滚动定位（仅首次）
      if (reset && this._scrollToPosts) {
        this._scrollToPosts = false
        setTimeout(() => this.setData({ scrollInto: 'postsAnchor' }), 200)
      }
    } finally {
      this._postsLoading = false
    }
  },

  onPostsMore() {
    if (this.data.postsHasMore) this._loadPosts(false)
  },

  onPreviewPostImage(e) {
    const { pidx, idx } = e.currentTarget.dataset
    const images = (this.data.posts[Number(pidx)] || {}).images || []
    wx.previewImage({ current: images[Number(idx)], urls: images })
  },

  // 分享点赞：乐观翻转，失败回滚，成功用后端权威值校准（本页已登录，无需再拦）
  onLikePost(e) {
    const id = Number(e.currentTarget.dataset.id)
    return lock(this, 'plike' + id, async () => {
      const flip = (p) => ({ ...p, isLiked: !p.isLiked, likeCount: Math.max(0, p.likeCount + (p.isLiked ? -1 : 1)) })
      this._patchPost(id, flip)
      const r = await activityApi.likePost(id)
      if (!r) { this._patchPost(id, flip); return }
      this._patchPost(id, p => ({ ...p, isLiked: r.liked, likeCount: r.likeCount }))
    })
  },

  _patchPost(id, fn) {
    const i = this.data.posts.findIndex(p => p.id === id)
    if (i >= 0) this.setData({ [`posts[${i}]`]: fn(this.data.posts[i]) })
  },

  onDeletePost(e) {
    const id = Number(e.currentTarget.dataset.id)
    return lock(this, 'delpost' + id, async () => {
      const res = await new Promise(resolve => wx.showModal({
        title: '删除这条分享？', content: '删除后不可恢复',
        confirmText: '删除', confirmColor: '#B23B3B', cancelText: '再想想', success: resolve,
      }))
      if (!res.confirm) return
      const r = await activityApi.deletePost(id)
      if (r) { toast.info('已删除'); this._loadPosts(true) }
    })
  },

  // 报名名单：点「已报名」徽章打开（仅已报名可见入口，后端二次校验）
  onShowSignups() {
    return lock(this, 'signups', async () => {
      const list = await activityApi.getSignups(this._id)
      if (!list) return
      this.setData({
        signups: list.map(s => ({ ...s, avatarColor: hueToColor(s.avatar_hue), initial: getInitial(s.name) })),
        showSignups: true,
      })
      setTimeout(() => this.setData({ _suShow: true }), 20)
    })
  },
  onCloseSignups() {
    this.setData({ _suShow: false })
    setTimeout(() => this.setData({ showSignups: false }), 300)
  },

  // 发布弹层
  onOpenPostSheet() {
    this.setData({ showPostSheet: true })
    setTimeout(() => this.setData({ _postShow: true }), 20)
  },
  onClosePostSheet() {
    this.setData({ _postShow: false })
    setTimeout(() => this.setData({ showPostSheet: false }), 300)
  },
  onPostInput(e) { this.setData({ postContent: e.detail.value }) },
  onAddPostImage() {
    const remaining = 9 - this.data.postImages.length
    if (remaining <= 0) return
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: res => {
        const paths = res.tempFiles.map(f => f.tempFilePath)
        this.setData({ postImages: [...this.data.postImages, ...paths] })
      },
    })
  },
  onRemovePostImage(e) {
    const images = [...this.data.postImages]
    images.splice(Number(e.currentTarget.dataset.index), 1)
    this.setData({ postImages: images })
  },
  onPreviewPickImage(e) {
    wx.previewImage({
      current: this.data.postImages[Number(e.currentTarget.dataset.index)],
      urls: this.data.postImages,
    })
  },

  async onSubmitPost() {
    return lock(this, 'submitPost', async () => {
      const content = this.data.postContent.trim()
      if (!content && !this.data.postImages.length) { toast.info('写点文字或选张照片吧'); return }
      // 本地图上传云存储换 fileID（同 compose 模式，前缀 activity-posts/）
      let images = []
      try {
        if (this.data.postImages.length) wx.showLoading({ title: '上传照片中…', mask: true })
        for (const img of this.data.postImages) {
          if (img.indexOf('cloud://') === 0) { images.push(img); continue }
          const extMatch = img.match(/\.(\w+)$/)
          const ext = extMatch ? extMatch[1] : 'jpg'
          const cloudPath = `activity-posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
          const res = await wx.cloud.uploadFile({ cloudPath, filePath: img })
          images.push(res.fileID)
        }
      } catch (err) {
        wx.hideLoading()
        toast.error('照片上传失败，请重试')
        return
      }
      if (this.data.postImages.length) wx.hideLoading()
      const r = await activityApi.createPost(this._id, { content, images })
      if (r) {
        toast.success('已分享')
        this.setData({ postContent: '', postImages: [] })
        this.onClosePostSheet()
        this._loadPosts(true)
      }
    })
  },

  // 若本页是启动页（转发/扫码直达，栈内仅本页），navigateBack 无上一页会报错 → 改回活动列表
  _goBack() {
    // 页面入场动画未结束时 navigateBack 会静默失败（如登录墙秒关的场景）——失败兜底跳活动 tab，避免卡在空白详情页
    if (getCurrentPages().length > 1) {
      wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/activities/index' }) })
    } else {
      wx.switchTab({ url: '/pages/activities/index' })
    }
  },
  onBack() { throttle(this, 'nav', () => this._goBack()) },

  // 报名入口：未登录先登录；缺关键资料（姓名/电话）先弹完善弹窗，齐了才进报名
  onOpenSignup() {
    if (!ensureLogin(this, () => this.onOpenSignup())) return
    const u = getApp().globalData.user || {}
    const name = (u.real_name || '').trim()
    const phone = (u.phone || '').trim()
    if (!name || !phone) {
      this.setData({ pcName: name, pcPhone: phone, showProfileComplete: true })
      setTimeout(() => this.setData({ _pcShow: true }), 20)
      return
    }
    this._openSignupSheet(u)
  },
  // 打开报名弹窗并从资料自动带出（称呼取真实姓名→昵称，联系方式取手机号）
  _openSignupSheet(u) {
    this.setData({
      signupName: (u.real_name || u.nickname || '').trim(),
      signupContact: (u.phone || '').trim(),
      showSignup: true,
    })
    setTimeout(() => this.setData({ _sheetShow: true }), 20)
  },

  // 完善资料弹层（报名前若缺姓名/电话）
  onPcNameInput(e) { this.setData({ pcName: e.detail.value }) },
  onPcPhoneInput(e) { this.setData({ pcPhone: e.detail.value }) },
  onClosePc() {
    this.setData({ _pcShow: false })
    setTimeout(() => this.setData({ showProfileComplete: false }), 300)
  },
  async onSavePcAndSignup() {
    if (this._pcSaving) return
    const name = this.data.pcName.trim()
    const phone = this.data.pcPhone.trim()
    if (!name) { toast.info('请填写姓名'); return }
    if (!/^1\d{10}$/.test(phone)) { toast.info('请填写正确的手机号'); return }
    this._pcSaving = true
    try {
      const result = await userApi.updateProfile({ realName: name, phone })
      if (result) {
        getApp().setUser(result)
        this.onClosePc()
        // 完善后自动继续报名
        setTimeout(() => this._openSignupSheet(result), 320)
      }
    } finally { this._pcSaving = false }
  },
  onCloseSignup() {
    this.setData({ _sheetShow: false })
    setTimeout(() => this.setData({ showSignup: false }), 300)
  },

  async onSubmitSignup() {
    if (this._submitting) return
    const name = this.data.signupName.trim()
    if (!name) { toast.info('请留下你的称呼'); return }
    this._submitting = true
    try {
      const r = await activityApi.signup(this._id, { name, contact: this.data.signupContact.trim() })
      if (r) {
        this.onCloseSignup()
        toast.success('报名成功，期待相见')
        this._load()
      }
    } finally {
      this._submitting = false
    }
  },

  onCancelSignup() {
    return lock(this, 'cancelSignup', async () => {
      const res = await new Promise(resolve => wx.showModal({
        title: '取消报名？',
        content: '取消后名额将释放给其他醒书人',
        confirmText: '取消报名',
        cancelText: '再想想',
        success: resolve,
      }))
      if (!res.confirm) return
      const r = await activityApi.cancelSignup(this._id)
      if (r) {
        toast.info('已取消报名')
        this._load()
      }
    })
  },

  // 线下活动地址：后台经地图选点存了坐标时，点击打开地图（导航/查看位置）
  onOpenMap() {
    const a = this.data.activity
    if (!a || !a.latitude) return
    wx.openLocation({
      latitude: Number(a.latitude),
      longitude: Number(a.longitude),
      name: a.title,
      address: (a.city ? a.city + ' · ' : '') + (a.location || ''),
    })
  },

  onPreviewImage(e) {
    const images = this.data.activity.images || []
    wx.previewImage({ current: images[e.currentTarget.dataset.index], urls: images })
  },

  // 活动邀请函：带参小程序码（scene 携带活动 ID + 分享人 ID——扫码进来授权的新用户推荐人即分享人）
  async onOpenPoster() {
    this.setData({ showPoster: true })
    setTimeout(() => this.setData({ _posterShow: true }), 20)
    if (!this.data.qrFileID) {
      const app = getApp()
      const sharerId = (app.globalData.user || {}).id
      const res = await call('generateMiniCode', { activityId: this._id, sharerId }, { showError: false })
      if (res && res.fileID) {
        this.setData({ qrFileID: res.fileID })
        try {
          const dl = await wx.cloud.downloadFile({ fileID: res.fileID })
          this._qrTempPath = dl.tempFilePath
          this._invPath = '' // 码就绪后重绘
        } catch (e) { /* 码下载失败时画占位块 */ }
      }
    }
  },
  onClosePoster() {
    this.setData({ _posterShow: false })
    setTimeout(() => this.setData({ showPoster: false }), 300)
  },

  // 保存邀请函图片（相册授权流程同 poster-sheet）
  onSaveInvite() {
    return lock(this, 'saveInvite', () => new Promise((resolve) => {
      wx.getSetting({
        success: (res) => {
          const scope = res.authSetting['scope.writePhotosAlbum']
          if (scope === true) { this._saveInviteImage(resolve); return }
          if (scope === false) { this._openAlbumSetting(); resolve(); return }
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => this._saveInviteImage(resolve),
            fail: () => { this._openAlbumSetting(); resolve() },
          })
        },
        fail: () => this._saveInviteImage(resolve),
      })
    }))
  },

  _saveInviteImage(done) {
    this._ensureInvite((path) => {
      if (!path) { done(); return }
      wx.saveImageToPhotosAlbum({
        filePath: path,
        success: () => { toast.success('已保存到相册'); done() },
        fail: (err) => {
          const msg = (err && err.errMsg) || ''
          if (/deny|denied|authorize|cancel|auth/i.test(msg)) this._openAlbumSetting()
          else toast.error('保存失败，请重试')
          done()
        },
      })
    })
  },

  _openAlbumSetting() {
    wx.showModal({
      title: '需要相册权限', content: '请在设置中允许"醒书日记"访问你的相册',
      confirmText: '去设置', cancelText: '取消',
      success: (r) => { if (r.confirm) wx.openSetting() },
    })
  },

  // 分享邀请函图片给朋友（系统分享面板）
  onShareInvite() {
    return lock(this, 'shareInvite', () => new Promise((resolve) => {
      this._ensureInvite((path) => {
        if (!path) { resolve(); return }
        wx.showShareImageMenu({
          path,
          fail: () => toast.info('可先保存到相册再分享', 2000),
          complete: resolve,
        })
      })
    }))
  },

  // cloud:// / http(s) / 本地路径统一加载为可绘制 image（失败返回 null）
  _loadImageForCanvas(canvas, src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null)
      const draw = (path) => {
        const img = canvas.createImage()
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = path
      }
      if (src.startsWith('cloud://')) {
        wx.cloud.downloadFile({ fileID: src }).then(r => draw(r.tempFilePath)).catch(() => resolve(null))
      } else if (/^https?:\/\//.test(src)) {
        wx.downloadFile({ url: src, success: r => (r.statusCode === 200 ? draw(r.tempFilePath) : resolve(null)), fail: () => resolve(null) })
      } else {
        draw(src)
      }
    })
  },

  // 取邀请函成图（带缓存）：Canvas 2D 按主题绘制，高度随介绍全文 + 配图动态计算，导出临时文件
  _ensureInvite(cb) {
    if (this._invPath) { cb(this._invPath); return }
    const a = this.data.activity
    const inv = this.data.invite
    if (!a || !inv) { cb(''); return }
    wx.showLoading({ title: '生成邀请函…', mask: true })
    const query = wx.createSelectorQuery()
    query.select('#inv-canvas').fields({ node: true }).exec(async (res) => {
      if (!res || !res[0] || !res[0].node) { wx.hideLoading(); toast.error('图片生成失败'); cb(''); return }
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const t = INV_THEMES[inv.key]
      const W = 750, PX = 56, CW = W - PX * 2

      // ── 预加载配图（最多 6 张）与小程序码，拿真实尺寸供动态布局 ──
      const imgSrcs = (a.images || []).slice(0, 6)
      const imgs = await Promise.all(imgSrcs.map(s => this._loadImageForCanvas(canvas, s)))
      const qrImg = this._qrTempPath ? await this._loadImageForCanvas(canvas, this._qrTempPath) : null

      // ── 第一遍测量：算各区高度累加总高（measureText 只依赖 font，不依赖画布尺寸）──
      ctx.font = 'bold 54px serif'
      const titleLines = this._splitText(ctx, a.title || '', CW).slice(0, 3)
      ctx.font = '28px sans-serif'
      // 介绍按原文段落（\n）分段，每段独立折行、段间留间距
      const introBlocks = String(inv.intro).split('\n').map(p => (p.trim() ? this._splitText(ctx, p.trim(), CW) : []))
      let introH = 0
      introBlocks.forEach((lines, i) => { introH += lines.length * 46; if (i < introBlocks.length - 1) introH += 16 })
      const imgHeights = imgs.map(im => (im ? Math.round(CW * im.height / im.width) : 0))
      const rows = [['活动时间', inv.timeText], ['参与方式', inv.joinText], ['报名限额', inv.quotaText], ['活动费用', inv.feeText]]

      let y = 60
      y += 52 + 30                                   // tag
      y += 34                                         // kicker
      const titleTop = y
      y = titleTop + titleLines.length * 72 + 28      // 标题
      const introTop = y
      y = introTop + introH + 24                      // 介绍全文（分段）
      const imgTop = y
      imgHeights.forEach(h => { if (h) y += h + 16 }) // 配图
      y += 8
      const dividerY = y
      y += 44                                         // 分隔线后间距
      const infoTop = y
      y += rows.length * 64 + 20                       // 信息区
      const ctaY = y
      const ctaH = 168
      y = ctaY + ctaH + 40
      const footH = 118
      const H = y + footH

      canvas.width = W
      canvas.height = H

      // ── 第二遍绘制 ──
      const g = ctx.createLinearGradient(0, 0, W * 0.3, H)
      g.addColorStop(0, t.bg[0]); g.addColorStop(1, t.bg[1])
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      ctx.textAlign = 'left'

      // 类型印章标签
      ctx.font = '26px sans-serif'
      const tagW = ctx.measureText(inv.tagText).width + 44
      ctx.strokeStyle = t.accent; ctx.lineWidth = 2.5
      this._roundRect(ctx, PX, 60, tagW, 52, 8); ctx.stroke()
      ctx.fillStyle = t.accent; ctx.fillText(inv.tagText, PX + 22, 94)

      // 英文小字
      ctx.globalAlpha = 0.7; ctx.fillStyle = t.fg; ctx.font = '20px sans-serif'
      ctx.fillText(inv.kicker.split('').join(' '), PX, 150); ctx.globalAlpha = 1

      // 主题标题（衬线）
      ctx.fillStyle = t.fg; ctx.font = 'bold 54px serif'
      let ty = titleTop + 54
      titleLines.forEach(line => { ctx.fillText(line, PX, ty); ty += 72 })

      // 活动介绍全文（按段落绘制，段间留间距）
      ctx.globalAlpha = 0.9; ctx.font = '28px sans-serif'; ctx.fillStyle = t.fg
      let iy = introTop + 28
      introBlocks.forEach(lines => {
        lines.forEach(line => { ctx.fillText(line, PX, iy); iy += 46 })
        iy += 16
      })
      ctx.globalAlpha = 1

      // 配图（介绍下方逐张等比）
      let imgy = imgTop
      imgs.forEach((im, k) => {
        if (im && imgHeights[k]) { ctx.drawImage(im, PX, imgy, CW, imgHeights[k]); imgy += imgHeights[k] + 16 }
      })

      // 分隔线
      ctx.globalAlpha = 0.28; ctx.strokeStyle = t.fg; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(PX, dividerY); ctx.lineTo(W - PX, dividerY); ctx.stroke(); ctx.globalAlpha = 1

      // 信息区三行（值自适应字号，保证单行不换行）
      let infoY = infoTop + 20
      const valX = 180, valMaxW = W - PX - valX
      rows.forEach(([label, val]) => {
        ctx.globalAlpha = 0.72; ctx.font = '22px sans-serif'; ctx.fillStyle = t.fg
        ctx.fillText(label, PX, infoY + 22); ctx.globalAlpha = 1
        let fs = 28
        ctx.font = `${fs}px sans-serif`
        while (ctx.measureText(val).width > valMaxW && fs > 17) { fs -= 1; ctx.font = `${fs}px sans-serif` }
        ctx.fillText(val, valX, infoY + 22)
        infoY += 64
      })

      // CTA：虚线框 + 文案 + 小程序码（白底）
      ctx.strokeStyle = t.accent; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8])
      this._roundRect(ctx, PX, ctaY, CW, ctaH, 16); ctx.stroke(); ctx.setLineDash([])
      ctx.fillStyle = t.accent; ctx.font = '26px sans-serif'
      ctx.fillText('长按识别小程序码', PX + 32, ctaY + 74)
      ctx.fillText('报名参加', PX + 32, ctaY + 116)
      const qsize = 128
      const qx = W - PX - 32 - qsize, qy = ctaY + (ctaH - qsize) / 2
      ctx.fillStyle = '#FFFFFF'
      this._roundRect(ctx, qx - 8, qy - 8, qsize + 16, qsize + 16, 10); ctx.fill()
      if (qrImg) {
        ctx.drawImage(qrImg, qx, qy, qsize, qsize)
      } else {
        ctx.fillStyle = '#2A2723'
        const c = qsize / 3
        ;[[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]].forEach(([r, col]) => {
          ctx.fillRect(qx + col * c, qy + r * c, c - 3, c - 3)
        })
      }

      // 品牌页脚
      const fy = H - footH
      ctx.fillStyle = '#A08A63'; ctx.fillRect(0, fy, W, footH)
      ctx.fillStyle = '#FDF9F0'; ctx.font = 'bold 30px serif'; ctx.fillText('醒书咨询', PX, fy + 56)
      ctx.font = '12px sans-serif'; ctx.globalAlpha = 0.85; ctx.fillText('XINGSHU CONSULTING', PX, fy + 84)
      ctx.globalAlpha = 0.35; ctx.fillRect(228, fy + 26, 2, 66)
      ctx.globalAlpha = 0.92; ctx.font = '19px sans-serif'
      const desc = '醒书咨询，一家专注经典文化与现代生活深度对话的机构，为中小企业和个人提供发展咨询服务。'
      this._splitText(ctx, desc, W - 254 - PX).slice(0, 3).forEach((line, i) => {
        ctx.fillText(line, 254, fy + 44 + i * 30)
      })
      ctx.globalAlpha = 1

      wx.canvasToTempFilePath({
        canvas,
        success: (r) => { wx.hideLoading(); this._invPath = r.tempFilePath; cb(r.tempFilePath) },
        fail: () => { wx.hideLoading(); toast.error('图片生成失败'); cb('') },
      }, this)
    })
  },

  _splitText(ctx, text, maxWidth) {
    if (!text) return ['']
    const lines = []
    let line = ''
    for (const char of text) {
      const test = line + char
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = char
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines.length ? lines : ['']
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  },
})
