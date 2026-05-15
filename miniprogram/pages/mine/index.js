const app = getApp()
const { applyFilters } = require('../../utils/filter')

Page({
  data: {
    diaries: [],
    search: '',
    showFilterSheet: false,
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
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
  },

  _loadDiaries() {
    const all = app.globalData.diaries
    const filtered = applyFilters(all, 'mine', this.data.search, this.data.filters)
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
    wx.navigateTo({ url: '/pages/detail/index?id=' + id })
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

  onCardEdit(e) {
    const { id } = e.detail
    wx.navigateTo({ url: '/pages/compose/index?diaryId=' + id })
  },

  onCardDelete(e) {
    const { id } = e.detail
    wx.showModal({
      title: '删除日记',
      content: '确定要删除这篇日记吗？此操作不可撤销。',
      confirmText: '删除',
      confirmColor: '#B6452F',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          app.deleteDiary(id)
          this._loadDiaries()
          wx.showToast({ title: '已删除', icon: 'none', duration: 1500 })
        }
      },
    })
  },

  onFabTap() {
    wx.navigateTo({ url: '/pages/compose/index' })
  },
})
