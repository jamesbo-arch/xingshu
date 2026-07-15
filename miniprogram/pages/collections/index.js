const app = getApp()
const diaryApi = require('../../api/diary')
const { optimisticLike, optimisticFav } = require('../../utils/optimistic')
const mapper = require('../../utils/mapper')
const filterUtil = require('../../utils/filter')
const { lock, throttle } = require('../../utils/guard')
const { ensureLogin, handleLoginSuccess } = require('../../utils/auth-guard')

Page({
  data: {
    diaries: [],
    refreshing: false,
    search: '',
    page: 1,
    hasMore: true,
    showFilterSheet: false,
    showMemberGuard: false,
    showLoginSheet: false,
    showPosterSheet: false,
    posterDiary: null,
    userIdentity: 'authed',
    filters: {
      tags: [], author: '', timeMode: 'quick', quickRange: 'all',
      dateFrom: '', dateTo: '', years: [], months: [],
    },
    filtersActive: false,
    allTags: [],
    statusBarHeight: 0,
  },

  onLoad() {
    const info = wx.getWindowInfo()
    this.setData({
      statusBarHeight: info.statusBarHeight || 0,
      allTags: app.globalData.tags,
    })
  },

  onShow() {
    this._loadDiaries(true)
    this.setData({ userIdentity: (app.globalData.user || {}).identity || 'authed' })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  async _loadDiaries(reset) {
    const page = reset ? 1 : this.data.page
    const data = await diaryApi.getList({
      mode: 'collections', page,
      keyword: this.data.search || undefined,
      ...filterUtil.listQuery(this.data.filters),
    })
    if (data) {
      const active = this._isFiltersActive()
      const mapped = data.list.map(mapper.diary)
      this.setData({
        diaries: reset ? mapped : [...this.data.diaries, ...mapped],
        page: page + 1, hasMore: data.list.length >= data.pageSize, filtersActive: active,
      })
    }
  },

  _isFiltersActive() {
    const f = this.data.filters
    return (f.tags.length > 0 || f.author || f.quickRange !== 'all' || f.dateFrom || f.dateTo || f.years.length || f.months.length)
  },

  onSearchInput(e) { this.setData({ search: e.detail.value }) },
  onSearchClear() { this.setData({ search: '' }, () => this._loadDiaries(true)) },
  onSearchConfirm() { this._loadDiaries(true) },
  _tabBar(hidden) { const tb = this.getTabBar && this.getTabBar(); if (tb) tb.setData({ hidden }) },
  onOpenFilter() { this.setData({ showFilterSheet: true, allTags: app.globalData.tags }); this._tabBar(true) },
  onCloseFilter() { this.setData({ showFilterSheet: false }); this._tabBar(false) },
  onApplyFilter(e) { this._tabBar(false); this.setData({ filters: e.detail.filters, showFilterSheet: false }, () => this._loadDiaries(true)) },

  // v2.1：会员日记直接进详情（非会员见 30% 渐隐），不再弹窗拦截
  // v2.3：guest（含退出登录的曾会员）点卡片先拉起登录弹窗，与广场页口径一致
  onCardOpen(e) {
    const { id } = e.detail
    const open = () => throttle(this, 'open', () => wx.navigateTo({ url: '/pages/detail/index?id=' + id }))
    if (!ensureLogin(this, open)) return
    open()
  },

  onLoginClose() {
    this.setData({ showLoginSheet: false })
    this._tabBar(false)
    this._pendingLoginAction = null
  },
  onLoginSuccess() {
    this.setData({ userIdentity: (app.globalData.user || {}).identity || 'guest' })
    handleLoginSuccess(this)
  },
  onCloseMemberGuard() { this.setData({ showMemberGuard: false }) },
  onGuardAuthorize() {
    wx.showModal({
      title: '微信授权', content: '授权后可获得完整账号功能。',
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

  onCardLike(e) {
    if (!ensureLogin(this, () => this.onCardLike(e))) return
    const { id } = e.detail
    // 乐观更新：立即翻转 UI，后台失败自动回滚
    return lock(this, 'like' + id, () => optimisticLike(this, id))
  },
  onCardFav(e) {
    if (!ensureLogin(this, () => this.onCardFav(e))) return
    const { id } = e.detail
    // 「我的收藏」里取消收藏 → 卡片立即移除，后台失败原位恢复
    return lock(this, 'fav' + id, () => optimisticFav(this, id, { removeOnUnfav: true }))
  },
  onCardShare(e) {
    const { id } = e.detail
    const diary = this.data.diaries.find(d => d.id === id)
    if (diary) { this.setData({ showPosterSheet: true, posterDiary: diary }); this._tabBar(true) }
  },
  onClosePoster() { this.setData({ showPosterSheet: false, posterDiary: null }); this._tabBar(false) },
  // 分享成功后列表卡片的分享数即时 +1（保留 share_count 兼容旧字段读取）
  onShared(e) {
    const { id, shares } = e.detail
    this.setData({
      diaries: this.data.diaries.map(d => d.id === id ? { ...d, shares, share_count: shares } : d)
    })
  },
  onReachBottom() { if (this.data.hasMore) this._loadDiaries(false) },

  async onRefresh() {
    this.setData({ refreshing: true })
    try { await this._loadDiaries(true) } finally { this.setData({ refreshing: false }) }
  },
})
