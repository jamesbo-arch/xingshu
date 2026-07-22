// 醒书问答（页签）：会员发问、公众读精选、授权用户可赞可藏
const app = getApp()
const qaApi = require('../../api/qa')
const { ensureLogin, ensureMember, handleLoginSuccess } = require('../../utils/auth-guard')
const { lock, throttle } = require('../../utils/guard')

Page({
  data: {
    questions: [],
    search: '',
    page: 1,
    hasMore: true,
    refreshing: false,
    loaded: false,
    showLoginSheet: false,
    statusBarHeight: 0,
  },

  onLoad() {
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 0 })
  },

  onShow() {
    this._load(true)
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().refresh('pages/qa/index')
    }
  },

  async _load(reset) {
    // 防重入：网络返回前触底会用未自增的 page 重复请求
    if (this._loading) return
    this._loading = true
    const page = reset ? 1 : this.data.page
    const data = await qaApi.getList({
      mode: 'all',
      page,
      keyword: this.data.search || undefined,
    })
    if (data) {
      this.setData({
        questions: reset ? data.list : [...this.data.questions, ...data.list],
        page: page + 1,
        hasMore: data.list.length >= data.pageSize,
        loaded: true,
      })
    }
    this._loading = false
  },

  onSearchInput(e) { this.setData({ search: e.detail.value }) },
  onSearchClear() { this.setData({ search: '' }, () => this._load(true)) },
  onSearchConfirm() { this._load(true) },

  onCardOpen(e) {
    const { id } = e.detail
    throttle(this, 'open', () => wx.navigateTo({ url: '/pages/qa-detail/index?id=' + id }))
  },

  // 点赞/收藏：乐观翻转，失败回滚（问答量级小，直接改本行）
  onCardLike(e) {
    if (!ensureLogin(this, () => this.onCardLike(e))) return
    const { id } = e.detail
    return lock(this, 'like' + id, () => this._toggle(id, 'isLiked', qaApi.toggleLike))
  },

  onCardFav(e) {
    if (!ensureLogin(this, () => this.onCardFav(e))) return
    const { id } = e.detail
    return lock(this, 'fav' + id, () => this._toggle(id, 'isFavorited', qaApi.toggleFav))
  },

  async _toggle(id, field, fn) {
    const i = this.data.questions.findIndex(q => q.id === id)
    if (i < 0) return
    const flip = v => this.setData({ [`questions[${i}].${field}`]: v })
    const before = this.data.questions[i][field]
    flip(!before)
    const r = await fn(id)
    if (!r) flip(before)                 // 失败回滚
    else flip(r.active)                  // 用后端权威值校准
  },

  onLoginClose() {
    this.setData({ showLoginSheet: false })
    const tb = this.getTabBar && this.getTabBar()
    if (tb) tb.setData({ hidden: false })
    this._pendingLoginAction = null
  },
  onLoginSuccess() {
    handleLoginSuccess(this)
    this._load(true)   // 身份变化后列表口径不同（会员见全部原文），需重拉
  },

  // 发问为会员专享：非有效会员弹窗引导开通
  onFabTap() {
    ensureMember(this, () => throttle(this, 'fab', () => wx.navigateTo({ url: '/pages/qa-compose/index' })))
  },

  onReachBottom() { if (this.data.hasMore) this._load(false) },

  async onRefresh() {
    this.setData({ refreshing: true })
    try { await this._load(true) } finally { this.setData({ refreshing: false }) }
  },

  onShareAppMessage() {
    const sharerId = (app.globalData.user || {}).id
    return {
      title: '醒书问答 · 把经典读进日常生活',
      path: `/pages/qa/index${sharerId ? '?s=' + sharerId : ''}`,
    }
  },
})
