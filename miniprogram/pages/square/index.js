const app = getApp()
const storyApi = require('../../api/story')
const { optimisticLike, optimisticFav } = require('../../utils/optimistic')
const mapper = require('../../utils/mapper')
const cache = require('../../utils/cache')
const filterUtil = require('../../utils/filter')
const { ensureLogin, ensureMember, isValidMember, handleLoginSuccess } = require('../../utils/auth-guard')
const { lock, throttle } = require('../../utils/guard')

Page({
  data: {
    stories: [],
    search: '',
    page: 1,
    hasMore: true,
    refreshing: false,
    showFilterSheet: false,
    showPosterSheet: false,
    posterStory: null,
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
    // v2.0 精选筛选：点亮则只看精选故事（公众版副本、无评论）。
    // 仅会员可见——非会员本来就只能看精选，给他们切换开关没有意义。
    isMember: false,
    featuredOnly: false,
  },

  onLoad() {
    const info = wx.getWindowInfo()
    this.setData({
      statusBarHeight: info.statusBarHeight || 0,
      allTags: app.globalData.tags,
    })
  },

  onShow() {
    this._loadStories(true)
    this.setData({
      userIdentity: (app.globalData.user || {}).identity || 'guest',
      isMember: isValidMember(app.globalData.user),
    })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().refresh('pages/square/index')
    }
  },

  // 精选筛选开关：切换后重载列表（后端按 featuredOnly 走善选副本视图）
  onToggleFeatured() {
    this.setData({ featuredOnly: !this.data.featuredOnly }, () => this._loadStories(true))
  },

  async _loadStories(reset) {
    // 防重入：缓存使首屏瞬间可滚动，网络返回前触底会用未自增的 page 重复请求
    if (this._loading) return
    this._loading = true
    const page = reset ? 1 : this.data.page
    // 精选筛选态另算一份"素列表"，避免与常规列表共用同一份首屏缓存
    const plain = !this.data.search && !this._isFiltersActive() && !this.data.featuredOnly
    // 冷启动首屏：无搜索/筛选时先展示缓存的第一页，网络返回后覆盖
    if (reset && plain && !this.data.stories.length) {
      const cached = cache.get('square:first')
      if (cached) this.setData({ stories: cached })
    }
    const data = await storyApi.getList({
      mode: 'square',
      page,
      keyword: this.data.search || undefined,
      featuredOnly: this.data.featuredOnly || undefined,
      ...filterUtil.listQuery(this.data.filters),
    })
    if (data) {
      const active = this._isFiltersActive()
      const mapped = data.list.map(mapper.story)
      if (reset && plain) cache.set('square:first', mapped, 10)
      this.setData({
        stories: reset ? mapped : [...this.data.stories, ...mapped],
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
  onSearchClear() { this.setData({ search: '' }, () => this._loadStories(true)) },
  onSearchConfirm() { this._loadStories(true) },

  // 弹层打开时隐藏自定义 tab-bar，避免其独立层遮挡弹层底部按钮
  _tabBar(hidden) { const tb = this.getTabBar && this.getTabBar(); if (tb) tb.setData({ hidden }) },
  onOpenFilter() { this.setData({ showFilterSheet: true, allTags: app.globalData.tags }); this._tabBar(true) },
  onCloseFilter() { this.setData({ showFilterSheet: false }); this._tabBar(false) },
  onApplyFilter(e) {
    this._tabBar(false)
    this.setData({ filters: e.detail.filters, showFilterSheet: false }, () => this._loadStories(true))
  },

  // v3.0：精选故事对公众开放，未登录也可直接进详情读全文（互动在详情页内触发登录）
  // v2.0：会员在精选筛选态打开详情时带 featured=1，详情页取公众版副本并隐藏评论区
  onCardOpen(e) {
    const { id } = e.detail
    const suffix = this.data.featuredOnly ? '&featured=1' : ''
    throttle(this, 'open', () => wx.navigateTo({ url: `/pages/detail/index?id=${id}${suffix}` }))
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
    // 海报含分享人推荐码，需登录后再生成
    if (!ensureLogin(this, () => this.onCardShare(e))) return
    const story = this.data.stories.find(d => d.id === id)
    if (story) { this.setData({ showPosterSheet: true, posterStory: story }); this._tabBar(true) }
  },
  onClosePoster() { this.setData({ showPosterSheet: false, posterStory: null }); this._tabBar(false) },
  // 分享成功后列表卡片的分享数即时 +1（保留 share_count 兼容旧字段读取）
  onShared(e) {
    const { id, shares } = e.detail
    this.setData({
      stories: this.data.stories.map(d => d.id === id ? { ...d, shares, share_count: shares } : d)
    })
  },

  onFabTap() {
    // 写故事为会员专享：非有效会员弹窗引导开通
    ensureMember(this, () => throttle(this, 'fab', () => wx.navigateTo({ url: '/pages/compose/index' })))
  },
  onReachBottom() { if (this.data.hasMore) this._loadStories(false) },

  // 顶部下拉刷新：重载第一页（scroll-view 自带 refresher，非页面级 onPullDownRefresh）
  async onRefresh() {
    this.setData({ refreshing: true })
    try {
      await this._loadStories(true)
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
