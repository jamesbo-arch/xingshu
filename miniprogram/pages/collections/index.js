const app = getApp()
const diaryApi = require('../../api/diary')
const socialApi = require('../../api/social')
const mapper = require('../../utils/mapper')

Page({
  data: {
    diaries: [],
    search: '',
    page: 1,
    hasMore: true,
    showFilterSheet: false,
    showMemberGuard: false,
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
    const info = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: info.statusBarHeight || 0,
      allTags: app.globalData.tags,
    })
  },

  onShow() {
    this._loadDiaries(true)
    this.setData({ userIdentity: (app.globalData.user || {}).identity || 'authed' })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
  },

  async _loadDiaries(reset) {
    const page = reset ? 1 : this.data.page
    const data = await diaryApi.getList({
      mode: 'collections', page,
      keyword: this.data.search || undefined,
      tag: this.data.filters.tags[0] || undefined,
      author: this.data.filters.author || undefined,
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
  onOpenFilter() { this.setData({ showFilterSheet: true }) },
  onCloseFilter() { this.setData({ showFilterSheet: false }) },
  onApplyFilter(e) { this.setData({ filters: e.detail.filters, showFilterSheet: false }, () => this._loadDiaries(true)) },

  // v2.1：会员日记直接进详情（非会员见 30% 渐隐），不再弹窗拦截
  onCardOpen(e) {
    const { id } = e.detail
    wx.navigateTo({ url: '/pages/detail/index?id=' + id })
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

  async onCardLike(e) {
    const { id } = e.detail
    const result = await socialApi.toggleLike(id, 'diary')
    if (result) {
      this.setData({
        diaries: this.data.diaries.map(d => d.id === id ? { ...d, isLiked: result.liked, likes: d.likes + (result.liked ? 1 : -1) } : d)
      })
    }
  },
  async onCardFav(e) {
    const { id } = e.detail
    const result = await socialApi.toggleFav(id)
    if (result) wx.showToast({ title: result.favorited ? '已收藏' : '已取消收藏', icon: 'none', duration: 1500 })
  },
  onCardShare(e) {
    const { id } = e.detail
    const diary = this.data.diaries.find(d => d.id === id)
    if (diary) this.setData({ showPosterSheet: true, posterDiary: diary })
  },
  onClosePoster() { this.setData({ showPosterSheet: false, posterDiary: null }) },
  onReachBottom() { if (this.data.hasMore) this._loadDiaries(false) },
})
