const app = getApp()
const diaryApi = require('../../api/diary')
const { optimisticLike, optimisticFav } = require('../../utils/optimistic')
const mapper = require('../../utils/mapper')
const cache = require('../../utils/cache')
const filterUtil = require('../../utils/filter')
const { ensureLogin, ensureMember, handleLoginSuccess } = require('../../utils/auth-guard')
const { lock, throttle } = require('../../utils/guard')

Page({
  data: {
    diaries: [],
    search: '',
    page: 1,
    hasMore: true,
    refreshing: false,
    showFilterSheet: false,
    showPosterSheet: false,
    posterDiary: null,
    showMemberGuard: false,
    showLoginSheet: false,
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
    actBannerCount: 0, // 近期活动轮播场次数（act-banner 组件回报，用于列表让位/FAB 上移）
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
    this._loadActBanner()
    this.setData({ userIdentity: (app.globalData.user || {}).identity || 'guest' })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },

  // 近期活动轮播由 act-banner 组件自管（数据/缓存/跳转）；此处透传刷新，数量经 change 事件回来做布局让位
  _loadActBanner(force) {
    const banner = this.selectComponent('#actBanner')
    if (banner) banner.load(force)
  },

  onActBannerChange(e) {
    this.setData({ actBannerCount: e.detail.count })
  },

  // 轮播点击（组件抛事件，本页守卫）：未登录先弹登录窗，登录成功自动进该活动详情
  onActBannerOpen(e) {
    const id = e.detail.id
    const open = () => throttle(this, 'actbanner', () => wx.navigateTo({ url: `/pages/activity-detail/index?id=${id}` }))
    if (!ensureLogin(this, open)) return
    open()
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
      ...filterUtil.listQuery(this.data.filters),
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

  // 弹层打开时隐藏自定义 tab-bar，避免其独立层遮挡弹层底部按钮
  _tabBar(hidden) { const tb = this.getTabBar && this.getTabBar(); if (tb) tb.setData({ hidden }) },
  onOpenFilter() { this.setData({ showFilterSheet: true, allTags: app.globalData.tags }); this._tabBar(true) },
  onCloseFilter() { this.setData({ showFilterSheet: false }); this._tabBar(false) },
  onApplyFilter(e) {
    this._tabBar(false)
    this.setData({ filters: e.detail.filters, showFilterSheet: false }, () => this._loadDiaries(true))
  },

  // v2.3：guest 点卡片先拉起微信登录弹窗，登录成功后直达该日记；authed 看会员日记走详情页渐隐
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
    this.setData({ showMemberGuard: false })
    ensureLogin(this)
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
    return lock(this, 'fav' + id, () => optimisticFav(this, id))
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

  onFabTap() {
    // 写日记为会员专享：非有效会员弹窗引导开通
    ensureMember(this, () => throttle(this, 'fab', () => wx.navigateTo({ url: '/pages/compose/index' })))
  },
  onReachBottom() { if (this.data.hasMore) this._loadDiaries(false) },

  // 顶部下拉刷新：重载第一页 + 强刷活动预告（scroll-view 自带 refresher，非页面级 onPullDownRefresh）
  async onRefresh() {
    this.setData({ refreshing: true })
    try {
      await Promise.all([this._loadDiaries(true), this._loadActBanner(true)])
    } finally {
      this.setData({ refreshing: false })
    }
  },

  // 微信「…」菜单转发/分享朋友圈：分享醒书日记入口，带分享人 ID（s=）延续推荐人机制
  onShareAppMessage() {
    const sharerId = (app.globalData.user || {}).id
    return {
      title: '醒书日记 · 认真生活的人都在这里记录',
      path: `/pages/square/index${sharerId ? '?s=' + sharerId : ''}`,
    }
  },
  onShareTimeline() {
    const sharerId = (app.globalData.user || {}).id
    return { title: '醒书日记 · 认真生活的人都在这里记录', query: sharerId ? 's=' + sharerId : '' }
  },
})
