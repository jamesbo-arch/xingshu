const app = getApp()
const diaryApi = require('../../api/diary')
const { optimisticLike, optimisticFav } = require('../../utils/optimistic')
const mapper = require('../../utils/mapper')
const { lock, throttle } = require('../../utils/guard')
const { ensureMember } = require('../../utils/auth-guard')

Page({
  data: {
    diaries: [],
    refreshing: false,
    search: '',
    page: 1,
    hasMore: true,
    showFilterSheet: false,
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
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
  },

  async _loadDiaries(reset) {
    const page = reset ? 1 : this.data.page
    const data = await diaryApi.getList({ mode: 'mine', page, keyword: this.data.search || undefined })
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
  onOpenFilter() { this.setData({ showFilterSheet: true }) },
  onCloseFilter() { this.setData({ showFilterSheet: false }) },
  onApplyFilter(e) { this.setData({ filters: e.detail.filters, showFilterSheet: false }, () => this._loadDiaries(true)) },

  onCardOpen(e) { throttle(this, 'open', () => wx.navigateTo({ url: '/pages/detail/index?id=' + e.detail.id })) },
  onCardLike(e) {
    const { id } = e.detail
    // 乐观更新：立即翻转 UI，后台失败自动回滚
    return lock(this, 'like' + id, () => optimisticLike(this, id))
  },
  onCardFav(e) {
    const { id } = e.detail
    return lock(this, 'fav' + id, () => optimisticFav(this, id))
  },
  onCardEdit(e) { ensureMember(this, () => throttle(this, 'edit', () => wx.navigateTo({ url: '/pages/compose/index?diaryId=' + e.detail.id }))) },
  onCardDelete(e) {
    const { id } = e.detail
    return lock(this, 'del' + id, async () => {
      const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '删除后不可恢复', success: r }))
      if (res.confirm) {
        await diaryApi.remove(id)
        this.setData({ diaries: this.data.diaries.filter(d => d.id !== id) })
        wx.showToast({ title: '删除成功', icon: 'none', duration: 1500 })
      }
    })
  },

  onFabTap() { ensureMember(this, () => throttle(this, 'fab', () => wx.navigateTo({ url: '/pages/compose/index' }))) },
  onReachBottom() { if (this.data.hasMore) this._loadDiaries(false) },

  async onRefresh() {
    this.setData({ refreshing: true })
    try { await this._loadDiaries(true) } finally { this.setData({ refreshing: false }) }
  },
})
