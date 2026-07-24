// 我的收藏（非页签，入口在醒书会员）：v2.0 起分故事 / 问答 / 活动三段
const app = getApp()
const storyApi = require('../../api/story')
const qaApi = require('../../api/qa')
const activityApi = require('../../api/activity')
const { optimisticLike, optimisticFav } = require('../../utils/optimistic')
const mapper = require('../../utils/mapper')
const filterUtil = require('../../utils/filter')
const { lock, throttle } = require('../../utils/guard')
const { ensureLogin, handleLoginSuccess } = require('../../utils/auth-guard')

Page({
  data: {
    seg: 'story',      // story | qa | activity
    stories: [],
    questions: [],
    activities: [],
    refreshing: false,
    search: '',
    page: 1,
    hasMore: true,
    showFilterSheet: false,
    showMemberGuard: false,
    showLoginSheet: false,
    showPosterSheet: false,
    posterStory: null,
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
    this._loadSeg(true)
    this.setData({ userIdentity: (app.globalData.user || {}).identity || 'authed' })
  },

  onSegTap(e) {
    const seg = e.currentTarget.dataset.seg
    if (seg === this.data.seg) return
    // 切段即重置分页与搜索（三段的搜索/筛选语义不同，不做跨段沿用）
    this.setData({ seg, page: 1, hasMore: true, search: '' }, () => this._loadSeg(true))
  },

  _loadSeg(reset) {
    if (this.data.seg === 'story') return this._loadStories(reset)
    if (this.data.seg === 'qa') return this._loadQuestions(reset)
    return this._loadActivities()
  },

  async _loadQuestions(reset) {
    const page = reset ? 1 : this.data.page
    const data = await qaApi.getList({ mode: 'collections', page, keyword: this.data.search || undefined })
    if (data) {
      this.setData({
        questions: reset ? data.list : [...this.data.questions, ...data.list],
        page: page + 1,
        hasMore: data.list.length >= data.pageSize,
      })
    }
  },

  // 收藏的活动不分页（量小），一次取回
  async _loadActivities() {
    const data = await activityApi.getFavList()
    if (data) this.setData({ activities: data.list.map(a => this._decorateAct(a)), hasMore: false })
  },

  // 列表行展示用：时间 + 地点 + 状态（与活动页「全部活动」同口径的简化版）
  _decorateAct(a) {
    const s = String(a.start_time)
    const d = new Date(s.replace(/-/g, '/'))
    const week = isNaN(d.getTime()) ? '' : ' 周' + '日一二三四五六'[d.getDay()]
    return {
      ...a,
      timeText: s.slice(5, 10) + week + ' ' + s.slice(11, 16),
      place: a.type === 'online' ? '线上' : (a.city || '线下'),
      isPast: a.status === 'finished' || d.getTime() < Date.now(),
    }
  },

  onQaOpen(e) {
    throttle(this, 'openqa', () => wx.navigateTo({ url: '/pages/qa-detail/index?id=' + e.detail.id }))
  },

  // 收藏页里取消收藏 → 卡片立即移除（与故事段一致）
  onQaFav(e) {
    const { id } = e.detail
    return lock(this, 'qafav' + id, async () => {
      const before = this.data.questions
      this.setData({ questions: before.filter(q => q.id !== id) })
      const r = await qaApi.toggleFav(id)
      if (!r) this.setData({ questions: before })
    })
  },

  onQaLike(e) {
    const { id } = e.detail
    const i = this.data.questions.findIndex(q => q.id === id)
    if (i < 0) return
    return lock(this, 'qalike' + id, async () => {
      const before = this.data.questions[i].isLiked
      this.setData({ [`questions[${i}].isLiked`]: !before })
      const r = await qaApi.toggleLike(id)
      this.setData({ [`questions[${i}].isLiked`]: r ? r.active : before })
    })
  },

  onActOpen(e) {
    const id = Number(e.currentTarget.dataset.id)
    throttle(this, 'openact', () => wx.navigateTo({ url: '/pages/activity-detail/index?id=' + id }))
  },

  onActUnfav(e) {
    const id = Number(e.currentTarget.dataset.id)
    return lock(this, 'actfav' + id, async () => {
      const before = this.data.activities
      this.setData({ activities: before.filter(a => a.id !== id) })
      const r = await activityApi.toggleFav(id)
      if (!r) this.setData({ activities: before })
    })
  },

  // 非 tab 页，自带返回（栈空时兜底回会员中心——本页入口在会员中心）
  onBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/member/index' }) })
  },

  async _loadStories(reset) {
    const page = reset ? 1 : this.data.page
    const data = await storyApi.getList({
      mode: 'collections', page,
      keyword: this.data.search || undefined,
      ...filterUtil.listQuery(this.data.filters),
    })
    if (data) {
      const active = this._isFiltersActive()
      const mapped = data.list.map(mapper.story)
      this.setData({
        stories: reset ? mapped : [...this.data.stories, ...mapped],
        page: page + 1, hasMore: data.list.length >= data.pageSize, filtersActive: active,
      })
    }
  },

  _isFiltersActive() {
    const f = this.data.filters
    return (f.tags.length > 0 || f.author || f.quickRange !== 'all' || f.dateFrom || f.dateTo || f.years.length || f.months.length)
  },

  onSearchInput(e) { this.setData({ search: e.detail.value }) },
  onSearchClear() { this.setData({ search: '' }, () => this._loadSeg(true)) },
  onSearchConfirm() { this._loadSeg(true) },
  onOpenFilter() { this.setData({ showFilterSheet: true, allTags: app.globalData.tags }) },
  onCloseFilter() { this.setData({ showFilterSheet: false }) },
  onApplyFilter(e) { this.setData({ filters: e.detail.filters, showFilterSheet: false }, () => this._loadStories(true)) },

  // v2.1：会员故事直接进详情（非会员见 30% 渐隐），不再弹窗拦截
  // v2.3：guest（含退出登录的曾会员）点卡片先拉起登录弹窗，与广场页口径一致
  onCardOpen(e) {
    const { id } = e.detail
    const open = () => throttle(this, 'open', () => wx.navigateTo({ url: '/pages/story-detail/index?id=' + id }))
    if (!ensureLogin(this, open)) return
    open()
  },

  onLoginClose() {
    this.setData({ showLoginSheet: false })
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
  // 本页由会员中心进入，去开通即返回上一页；栈空兜底 switchTab
  onGuardJoinMember() {
    this.setData({ showMemberGuard: false })
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/member/index' }) })
  },

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
    const story = this.data.stories.find(d => d.id === id)
    if (story) this.setData({ showPosterSheet: true, posterStory: story })
  },
  onClosePoster() { this.setData({ showPosterSheet: false, posterStory: null }) },
  // 分享成功后列表卡片的分享数即时 +1（保留 share_count 兼容旧字段读取）
  onShared(e) {
    const { id, shares } = e.detail
    this.setData({
      stories: this.data.stories.map(d => d.id === id ? { ...d, shares, share_count: shares } : d)
    })
  },
  onReachBottom() { if (this.data.hasMore) this._loadSeg(false) },

  async onRefresh() {
    this.setData({ refreshing: true })
    try { await this._loadSeg(true) } finally { this.setData({ refreshing: false }) }
  },
})
