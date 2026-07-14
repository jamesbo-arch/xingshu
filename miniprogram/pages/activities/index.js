// 醒书活动页（重构版）：双页签——「活动分享」跨活动瀑布流（默认）+「全部活动」简洁列表（时间倒序）
const activityApi = require('../../api/activity')
const toast = require('../../utils/toast')
const { throttle, lock } = require('../../utils/guard')
const { ensureLogin, handleLoginSuccess } = require('../../utils/auth-guard')
const { hueToColor, getInitial } = require('../../utils/color')
const { formatTime } = require('../../utils/mapper')

const CN_DIGIT = '〇一二三四五六七八九'
const CN_MONTH = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']

Page({
  data: {
    statusBarHeight: 0,
    tab: 'share',       // share=活动分享（默认） | all=全部活动
    refreshing: false,
    actBannerCount: 0,  // 预告轮播场次数（组件回报，控制容器显隐与让位）
    // 活动分享瀑布流（双列 JS 分配）
    colL: [],
    colR: [],
    feedPage: 1,
    feedHasMore: false,
    feedLoaded: false,
    // 全部活动
    actItems: [],       // 平铺行 + 月份分隔（kind: 'month' | 'act'）
    allLoaded: false,
    types: [],
    activeTypeId: 0,    // 0 = 全部
    // FAB 直达发布分享（带场次选择）
    showLoginSheet: false,
    showPostSheet: false,
    _postShow: false,
    postContent: '',
    postImages: [],
    postables: [],       // 可分享场次：已报名且已开始，按活动时间倒序
    postableTitles: [],
    postActIndex: 0,
  },

  onLoad() {
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 0 })
    this._loadTypes()
    this._loadFeed(true)
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    // 轻量刷新预告轮播：同步手动关闭状态（组件内命中关闭标记即自清；正常路径走缓存）
    const banner = this.selectComponent('#actBanner')
    if (banner) banner.load()
    // 从活动详情返回时同步报名状态（详情内报名/取消报名后，列表「已报名/报名中」需重新派生）
    if (this.data.tab === 'all' && this.data.allLoaded) this._loadAll()
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab })
    // 全部活动首次进入才拉取
    if (tab === 'all' && !this.data.allLoaded) this._loadAll()
  },

  onActBannerChange(e) {
    this.setData({ actBannerCount: e.detail.count })
  },

  async onRefresh() {
    this.setData({ refreshing: true })
    try {
      if (this.data.tab === 'share') {
        const banner = this.selectComponent('#actBanner')
        await Promise.all([this._loadFeed(true), banner ? banner.load(true) : null])
      } else {
        await Promise.all([this._loadAll(), this._loadTypes()])
      }
    } finally {
      this.setData({ refreshing: false })
    }
  },

  // ── 页签一：活动分享瀑布流 ──

  async _loadFeed(reset) {
    if (this._feedLoading) return
    this._feedLoading = true
    try {
      const page = reset ? 1 : this.data.feedPage
      const data = await activityApi.getFeed(page)
      if (!data) return
      if (reset) { this._hL = 0; this._hR = 0 }
      const colL = reset ? [] : this.data.colL
      const colR = reset ? [] : this.data.colR
      for (const p of data.list.map(this._mapPost)) {
        // 估高分列：累计高度短的一列插入（图卡按固定档位高，文本卡按行数估）
        const h = this._estHeight(p)
        if (this._hL <= this._hR) { colL.push(p); this._hL += h } else { colR.push(p); this._hR += h }
      }
      this.setData({
        colL, colR,
        feedPage: page + 1,
        feedHasMore: page * data.pageSize < data.total,
        feedLoaded: true,
      })
    } finally {
      this._feedLoading = false
    }
  },

  _mapPost(p) {
    const images = p.images || []
    return {
      id: p.id,
      activityId: p.activity_id,
      image: images[0] || '',
      // 图卡高度取三档（按 id 稳定散布），瀑布流有节奏且估高准确
      imgH: [260, 320, 380][p.id % 3],
      imgCount: images.length,
      text: p.content || '',
      nickname: p.nickname,
      avatarUrl: p.avatar_url || '',
      avatarColor: hueToColor(p.avatar_hue),
      initial: getInitial(p.nickname),
      actLabel: p.type_name || p.activity_title,
      timeText: formatTime(p.created_at),
      likeCount: p.like_count || 0,
      isLiked: !!p.isLiked,
    }
  },

  // 分享点赞：乐观翻转（双列各自定位补丁），失败回滚，成功用后端权威值校准
  onLikePost(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (!ensureLogin(this, () => this.onLikePost(e))) return
    return lock(this, 'plike' + id, async () => {
      const flip = (p) => ({ ...p, isLiked: !p.isLiked, likeCount: Math.max(0, p.likeCount + (p.isLiked ? -1 : 1)) })
      this._patchPost(id, flip)
      const r = await activityApi.likePost(id)
      if (!r) { this._patchPost(id, flip); return }
      this._patchPost(id, p => ({ ...p, isLiked: r.liked, likeCount: r.likeCount }))
    })
  },

  _patchPost(id, fn) {
    const patch = {}
    ;['colL', 'colR'].forEach(col => {
      const i = this.data[col].findIndex(p => p.id === id)
      if (i >= 0) patch[`${col}[${i}]`] = fn(this.data[col][i])
    })
    if (Object.keys(patch).length) this.setData(patch)
  },

  _estHeight(p) {
    let h = 90 // 底部作者栏 + 边距
    if (p.image) h += p.imgH
    if (p.text) {
      const lines = Math.min(Math.ceil(p.text.length / 13), p.image ? 2 : 6)
      h += lines * 34 + 20
    }
    return h
  },

  onFeedMore() {
    if (this.data.feedHasMore) this._loadFeed(false)
  },

  // 分享卡点击 → 该活动详情并定位到现场分享区
  onOpenPost(e) {
    const id = Number(e.currentTarget.dataset.aid)
    if (id) throttle(this, 'open', () => wx.navigateTo({ url: `/pages/activity-detail/index?id=${id}&to=posts` }))
  },

  onGoAll() {
    this.setData({ tab: 'all' })
    if (!this.data.allLoaded) this._loadAll()
  },

  // ── 页签二：全部活动 ──

  async _loadTypes() {
    const types = await activityApi.getTypes()
    if (types) this.setData({ types })
  },

  async _loadAll() {
    const data = await activityApi.getList(this.data.activeTypeId || undefined, 'all')
    if (!data) return
    const now = Date.now()
    const items = []
    let lastMonth = ''
    for (const a of data.list) {
      const month = String(a.start_time).slice(0, 7)
      if (month !== lastMonth) {
        items.push({ kind: 'month', key: 'm' + month, label: this._cnMonth(month) })
        lastMonth = month
      }
      items.push({ kind: 'act', key: 'a' + a.id, ...this._decorateAct(a, now) })
    }
    this.setData({ actItems: items, allLoaded: true })
  },

  // 状态：已报名（未开始且本人已报）> 报名中（未开始）/ 进行中（已开始未结束，无 end_time 按开始后 24h 内）/ 已结束
  _decorateAct(a, now) {
    const start = new Date(String(a.start_time).replace(/-/g, '/')).getTime()
    const end = a.end_time
      ? new Date(String(a.end_time).replace(/-/g, '/')).getTime()
      : start + 24 * 3600 * 1000
    let st = 'done', stLabel = '已结束'
    if (a.status !== 'finished') {
      if (now < start) {
        if (a.isSignedUp) { st = 'signed'; stLabel = '已报名' }
        else { st = 'open'; stLabel = '报名中' }
      }
      else if (now <= end) { st = 'live'; stLabel = '进行中' }
    }
    const full = st === 'open' && a.capacity > 0 && a.signup_count >= a.capacity
    const type = this._typeStyle(a.type_name, a.type)
    return {
      id: a.id,
      title: a.title,
      st, stLabel, full,
      timeText: this._rowTime(a.start_time),
      place: a.type === 'online' ? '线上' : (a.city || '线下'),
      typeName: a.type_name || (a.type === 'online' ? '线上活动' : '线下活动'),
      tico: type.ico,
      tcls: type.cls,
    }
  },

  // 类型 → 图标/配色（按名称关键词，兜底按渠道：线上→月牙、线下→篝火）
  _typeStyle(name, channel) {
    const n = name || ''
    if (n.indexOf('咖啡') >= 0) return { ico: 'coffee', cls: 'tc-brown' }
    if (n.indexOf('观影') >= 0 || n.indexOf('电影') >= 0) return { ico: 'film', cls: 'tc-blue' }
    if (n.indexOf('巧克力') >= 0) return { ico: 'choco', cls: 'tc-cocoa' }
    if (n.indexOf('厨房') >= 0 || n.indexOf('餐') >= 0) return { ico: 'pot', cls: 'tc-gold' }
    if (n.indexOf('故事') >= 0) {
      return channel === 'online' ? { ico: 'moon', cls: 'tc-blue' } : { ico: 'fire', cls: 'tc-red' }
    }
    return channel === 'online' ? { ico: 'moon', cls: 'tc-blue' } : { ico: 'fire', cls: 'tc-red' }
  },

  // "2026-07-15 08:30" → "07-15 周三 08:30"
  _rowTime(t) {
    const s = String(t)
    const d = new Date(s.replace(/-/g, '/'))
    const week = isNaN(d.getTime()) ? '' : ' 周' + '日一二三四五六'[d.getDay()]
    return s.slice(5, 10) + week + ' ' + s.slice(11, 16)
  },

  // "2026-07" → "二〇二六 · 七月"
  _cnMonth(ym) {
    const [y, m] = ym.split('-')
    const yCn = y.split('').map(c => CN_DIGIT[+c]).join('')
    return `${yCn} · ${CN_MONTH[+m - 1]}月`
  },

  onTypeTap(e) {
    const id = Number(e.currentTarget.dataset.id) || 0
    if (id === this.data.activeTypeId) return
    this.setData({ activeTypeId: id }, () => this._loadAll())
  },

  onOpen(e) {
    const id = e.currentTarget.dataset.id
    throttle(this, 'open', () => wx.navigateTo({ url: `/pages/activity-detail/index?id=${id}` }))
  },

  // ── FAB 直达发布分享 ──

  _tabBar(hidden) { const tb = this.getTabBar && this.getTabBar(); if (tb) tb.setData({ hidden }) },

  onLoginClose() {
    this.setData({ showLoginSheet: false })
    this._tabBar(false)
    this._pendingLoginAction = null
  },
  onLoginSuccess() { handleLoginSuccess(this) },

  // FAB：登录 → 取可分享场次（已报名且已开始，list mode:all 已按时间倒序）→ 打开发布弹窗
  onShareFab() {
    if (!ensureLogin(this, () => this.onShareFab())) return
    return lock(this, 'sharefab', async () => {
      const data = await activityApi.getList(undefined, 'all')
      if (!data) return
      const now = Date.now()
      const postables = (data.list || []).filter(a =>
        a.isSignedUp && new Date(String(a.start_time).replace(/-/g, '/')).getTime() <= now)
      if (!postables.length) {
        wx.showModal({
          title: '暂无可分享的活动',
          content: '报名参加活动、活动开始后即可分享现场。去「全部活动」看看近期场次吧。',
          showCancel: false,
          confirmText: '知道了',
        })
        return
      }
      this.setData({
        postables,
        postableTitles: postables.map(a => `${a.title}（${String(a.start_time).slice(5, 16)}）`),
        postActIndex: 0,
        postContent: '',
        postImages: [],
        showPostSheet: true,
      })
      this._tabBar(true)
      setTimeout(() => this.setData({ _postShow: true }), 20)
    })
  },

  onPostActChange(e) { this.setData({ postActIndex: Number(e.detail.value) || 0 }) },
  onClosePostSheet() {
    this.setData({ _postShow: false })
    this._tabBar(false)
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
      const act = this.data.postables[this.data.postActIndex]
      if (!act) return
      const content = this.data.postContent.trim()
      if (!content && !this.data.postImages.length) { toast.info('写点文字或选张照片吧'); return }
      // 本地图上传云存储换 fileID（同活动详情发布弹层，前缀 activity-posts/）
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
      const r = await activityApi.createPost(act.id, { content, images })
      if (r) {
        toast.success('已分享')
        this.onClosePostSheet()
        this._loadFeed(true)
      }
    })
  },
})
