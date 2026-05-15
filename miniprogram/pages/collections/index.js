const app = getApp()
const { applyFilters } = require('../../utils/filter')

Page({
  data: {
    diaries: [],
    search: '',
    showFilterSheet: false,
    showMemberGuard: false,
    userIdentity: 'authed',
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
    this._loadDiaries()
    this.setData({ userIdentity: app.globalData.user.identity })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  _loadDiaries() {
    const all = app.globalData.diaries
    const filtered = applyFilters(all, 'collections', this.data.search, this.data.filters)
    const active = this._isFiltersActive(this.data.filters)
    this.setData({ diaries: filtered, filtersActive: active })
  },

  _isFiltersActive(f) {
    return (
      (f.tags && f.tags.length > 0) ||
      (f.author && f.author.trim()) ||
      (f.timeMode === 'quick' && f.quickRange && f.quickRange !== 'all') ||
      (f.timeMode === 'range' && (f.dateFrom || f.dateTo)) ||
      (f.timeMode === 'ym' && ((f.years && f.years.length) || (f.months && f.months.length)))
    )
  },

  onSearchInput(e) {
    this.setData({ search: e.detail.value }, () => {
      this._loadDiaries()
    })
  },

  onSearchClear() {
    this.setData({ search: '' }, () => {
      this._loadDiaries()
    })
  },

  onOpenFilter() {
    this.setData({ showFilterSheet: true })
  },

  onCloseFilter() {
    this.setData({ showFilterSheet: false })
  },

  onApplyFilter(e) {
    const filters = e.detail.filters
    this.setData({ filters, showFilterSheet: false }, () => {
      this._loadDiaries()
    })
  },

  onCardOpen(e) {
    const { id } = e.detail
    const diary = app.globalData.diaries.find(d => d.id === id)
    const identity = app.globalData.user.identity
    if (diary && diary.permission === 'member' && identity !== 'member') {
      this.setData({ showMemberGuard: true, userIdentity: identity })
      return
    }
    wx.navigateTo({ url: '/pages/detail/index?id=' + id })
  },

  onCloseMemberGuard() {
    this.setData({ showMemberGuard: false })
  },

  onGuardAuthorize() {
    wx.showModal({
      title: '微信授权',
      content: '授权后可获得完整账号功能，包括发布日记与查看会员内容。',
      confirmText: '授权',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          app.updateUser({ identity: 'authed' })
          this.setData({ showMemberGuard: false, userIdentity: 'authed' })
          wx.showToast({ title: '授权成功', icon: 'success', duration: 1500 })
        }
      },
    })
  },

  onGuardJoinMember() {
    this.setData({ showMemberGuard: false })
    wx.switchTab({ url: '/pages/member/index' })
  },

  onCardLike(e) {
    const { id } = e.detail
    app.toggleLike(id)
    this._loadDiaries()
  },

  onCardFav(e) {
    const { id } = e.detail
    const nowFav = app.toggleFav(id)
    wx.showToast({
      title: nowFav ? '已收藏' : '已取消收藏',
      icon: 'none',
      duration: 1500,
    })
    this._loadDiaries()
  },
})
