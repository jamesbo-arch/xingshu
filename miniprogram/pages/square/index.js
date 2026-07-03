const app = getApp()
const diaryApi = require('../../api/diary')
const socialApi = require('../../api/social')
const mapper = require('../../utils/mapper')
const cache = require('../../utils/cache')
const { requireAuth } = require('../../utils/auth-guard')

Page({
  data: {
    diaries: [],
    search: '',
    page: 1,
    hasMore: true,
    showFilterSheet: false,
    showPosterSheet: false,
    posterDiary: null,
    showMemberGuard: false,
    userIdentity: 'guest',
    filters: {
      tags: [],
      author: '',
      timeMode: 'quick',
      quickRange: 'all',
      dateFrom: '',
      dateTo: '',
      years: [],
      months: [],
    },
    filtersActive: false,
    allTags: [],
    statusBarHeight: 0,
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: info.statusBarHeight || 0,
      allTags: app.globalData.tags,
    })
  },

  onShow() {
    this._loadDiaries(true)
    this.setData({ userIdentity: (app.globalData.user || {}).identity || 'guest' })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },

  async _loadDiaries(reset) {
    // 防重入：缓存使首屏瞬间可滚动，网络返回前触底会用未自增的 page 重复请求
    if (this._loading) return
    this._loading = true
    const page = reset ? 1 : this.data.page
    const plain = !this.data.search && !this._isFiltersActive()
    // 冷启动首屏：无搜索/筛选时先展示缓存的第一页，网络返回后覆盖
    if (reset && plain && !this.data.diaries.length) {
      const cached = cache.get('square:first')
      if (cached) this.setData({ diaries: cached })
    }
    const data = await diaryApi.getList({
      mode: 'square',
      page,
      keyword: this.data.search || undefined,
      tag: this.data.filters.tags[0] || undefined,
      author: this.data.filters.author || undefined,
    })
    if (data) {
      const active = this._isFiltersActive()
      const mapped = data.list.map(mapper.diary)
      if (reset && plain) cache.set('square:first', mapped, 10)
      this.setData({
        diaries: reset ? mapped : [...this.data.diaries, ...mapped],
        page: page + 1,
        hasMore: data.list.length >= data.pageSize,
        filtersActive: active,
      })
    }
    this._loading = false
  },

  _isFiltersActive() {
    const f = this.data.filters
    return (f.tags.length > 0 || f.author || f.quickRange !== 'all' || f.dateFrom || f.dateTo || f.years.length || f.months.length)
  },

  onSearchInput(e) { this.setData({ search: e.detail.value }) },
  onSearchClear() { this.setData({ search: '' }, () => this._loadDiaries(true)) },
  onSearchConfirm() { this._loadDiaries(true) },

  onOpenFilter() { this.setData({ showFilterSheet: true }) },
  onCloseFilter() { this.setData({ showFilterSheet: false }) },
  onApplyFilter(e) {
    this.setData({ filters: e.detail.filters, showFilterSheet: false }, () => this._loadDiaries(true))
  },

  // v2.1：guest 点卡片进入验证引导（验证后直达该日记）；authed 看会员日记走详情页渐隐
  onCardOpen(e) {
    const { id } = e.detail
    if (!requireAuth('/pages/detail/index?id=' + id)) return
    wx.navigateTo({ url: '/pages/detail/index?id=' + id })
  },

  onCloseMemberGuard() { this.setData({ showMemberGuard: false }) },
  onGuardAuthorize() {
    wx.showModal({
      title: '微信授权', content: '授权后可获得完整账号功能，包括发布日记与查看会员内容。',
      confirmText: '授权', cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          app.updateUser({ identity: 'authed' })
          this.setData({ showMemberGuard: false, userIdentity: 'authed' })
        }
      },
    })
  },
  onGuardJoinMember() { this.setData({ showMemberGuard: false }); wx.switchTab({ url: '/pages/member/index' }) },

  async onCardLike(e) {
    if (!requireAuth()) return
    const { id } = e.detail
    const result = await socialApi.toggleLike(id, 'diary')
    if (result) {
      const diaries = this.data.diaries.map(d => {
        if (d.id === id) {
          return { ...d, isLiked: result.liked, likes: d.likes + (result.liked ? 1 : -1) }
        }
        return d
      })
      this.setData({ diaries })
    }
  },

  async onCardFav(e) {
    if (!requireAuth()) return
    const { id } = e.detail
    const result = await socialApi.toggleFav(id)
    if (result) {
      const msg = result.favorited ? '已收藏' : '已取消收藏'
      wx.showToast({ title: msg, icon: 'none', duration: 1500 })
    }
  },

  onCardShare(e) {
    const { id } = e.detail
    const diary = this.data.diaries.find(d => d.id === id)
    if (diary) this.setData({ showPosterSheet: true, posterDiary: diary })
  },
  onClosePoster() { this.setData({ showPosterSheet: false, posterDiary: null }) },

  onFabTap() {
    if (!requireAuth('/pages/compose/index')) return
    wx.navigateTo({ url: '/pages/compose/index' })
  },
  onReachBottom() { if (this.data.hasMore) this._loadDiaries(false) },
})
