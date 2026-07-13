const activityApi = require('../../api/activity')
const userApi = require('../../api/user')
const toast = require('../../utils/toast')
const { call } = require('../../api/request')
const { ensureLogin } = require('../../utils/auth-guard')
const { lock, throttle } = require('../../utils/guard')
const { formatTime } = require('../../utils/mapper')
const { hueToColor, getInitial } = require('../../utils/color')

Page({
  data: {
    activity: null,
    isPast: false,
    isFull: false,
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
  },

  onLoad(options) {
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 0 })
    let id = options.id ? (parseInt(options.id, 10) || options.id) : null
    // 扫码/转发以本页为启动页时，id 藏在 scene（"a=3&s=8"）里
    if (!id && options.scene) {
      const m = decodeURIComponent(options.scene).match(/(?:^|&)a=(\d+)/)
      if (m) id = parseInt(m[1], 10)
    }
    this._id = id
    // 活动页分享瀑布流跳入：加载后定位到現場分享区
    this._scrollToPosts = options.to === 'posts'
    // v2.3：活动详情需微信登录（轻授权），未登录先拉起登录弹窗，取消则返回列表
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
  onShareTimeline() {
    const a = this.data.activity || {}
    const sharerId = (getApp().globalData.user || {}).id
    return {
      title: a.title || '醒书活动',
      query: `id=${this._id}${sharerId ? '&s=' + sharerId : ''}`,
    }
  },

  onLoginClose() {
    this.setData({ showLoginSheet: false })
    if (!this.data.activity) this._goBack()
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
    this.setData({
      activity: a,
      isPast: a.status === 'finished',
      isFull: a.capacity > 0 && a.signup_count >= a.capacity && !a.isSignedUp,
      pct: a.capacity > 0 ? Math.min(100, Math.round(a.signup_count / a.capacity * 100)) : 0,
    })
    this._loadPosts(true)
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
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/activities/index' })
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

  onPreviewImage(e) {
    const images = this.data.activity.images || []
    wx.previewImage({ current: images[e.currentTarget.dataset.index], urls: images })
  },

  // v2.2 活动海报：带参小程序码（scene 携带活动 ID + 分享人 ID，推荐参数不展示在画面上）
  async onOpenPoster() {
    this.setData({ showPoster: true })
    setTimeout(() => this.setData({ _posterShow: true }), 20)
    if (!this.data.qrFileID) {
      const app = getApp()
      const sharerId = (app.globalData.user || {}).id
      const res = await call('generateMiniCode', { activityId: this._id, sharerId }, { showError: false })
      if (res && res.fileID) this.setData({ qrFileID: res.fileID })
    }
  },
  onClosePoster() {
    this.setData({ _posterShow: false })
    setTimeout(() => this.setData({ showPoster: false }), 300)
  },
  onSaveQr() {
    if (!this.data.qrFileID) { toast.info('小程序码生成中，稍候再试'); return }
    return lock(this, 'saveQr', async () => {
      try {
        const dl = await wx.cloud.downloadFile({ fileID: this.data.qrFileID })
        await new Promise((resolve, reject) => wx.saveImageToPhotosAlbum({
          filePath: dl.tempFilePath, success: resolve, fail: reject,
        }))
        toast.success('已保存到相册')
      } catch (err) {
        if (err.errMsg && err.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({
            title: '需要相册权限', content: '请在设置中允许访问相册',
            confirmText: '去设置',
            success: (r) => { if (r.confirm) wx.openSetting() },
          })
        } else {
          toast.error('保存失败，请重试')
        }
      }
    })
  },
})
