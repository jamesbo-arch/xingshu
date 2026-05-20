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
    const page = reset ? 1 : this.data.page
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
      this.setData({
        diaries: reset ? mapped : [...this.data.diaries, ...mapped],
        page: page + 1,
        hasMore: data.list.length >= data.pageSize,
        filtersActive: active,
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
  onApplyFilter(e) {
    this.setData({ filters: e.detail.filters, showFilterSheet: false }, () => this._loadDiaries(true))
  },

  onCardOpen(e) {
    const { id } = e.detail
    const diary = this.data.diaries.find(d => d.id === id)
    const identity = (app.globalData.user || {}).identity || 'guest'
    if (diary && diary.permission === 'member' && identity !== 'member') {
      this.setData({ showMemberGuard: true, userIdentity: identity })
      return
    }
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

  onFabTap() { wx.navigateTo({ url: '/pages/compose/index' }) },
  onReachBottom() { if (this.data.hasMore) this._loadDiaries(false) },
})
