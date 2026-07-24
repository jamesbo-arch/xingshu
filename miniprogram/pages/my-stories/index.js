const app = getApp()
const storyApi = require('../../api/story')
const mapper = require('../../utils/mapper')
const { lock, throttle } = require('../../utils/guard')
const { ensureLogin, ensureMember, handleLoginSuccess } = require('../../utils/auth-guard')

Page({
  data: {
    stories: [],
    refreshing: false,
    search: '',
    page: 1,
    hasMore: true,
    showFilterSheet: false,
    showLoginSheet: false,
    audienceVisible: false,
    audienceType: 'read',
    audienceTitle: '',
    audienceStoryId: null,
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
    this._loadStories(true)
  },

  // v2.0 起本页不再是页签（入口移入醒书会员），需自带返回
  onBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/member/index' }) })
  },

  async _loadStories(reset) {
    const page = reset ? 1 : this.data.page
    const data = await storyApi.getList({ mode: 'mine', page, keyword: this.data.search || undefined })
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
  onSearchClear() { this.setData({ search: '' }, () => this._loadStories(true)) },
  onSearchConfirm() { this._loadStories(true) },
  onOpenFilter() { this.setData({ showFilterSheet: true }) },
  onCloseFilter() { this.setData({ showFilterSheet: false }) },
  onApplyFilter(e) { this.setData({ filters: e.detail.filters, showFilterSheet: false }, () => this._loadStories(true)) },

  // v2.3：guest（含退出登录的曾会员）点卡片/互动先拉起登录弹窗，与广场页口径一致
  onCardOpen(e) {
    const open = () => throttle(this, 'open', () => wx.navigateTo({ url: '/pages/story-detail/index?id=' + e.detail.id }))
    if (!ensureLogin(this, open)) return
    open()
  },

  onLoginClose() {
    this.setData({ showLoginSheet: false })
    this._pendingLoginAction = null
  },
  onLoginSuccess() { handleLoginSuccess(this) },

  // 作者数据视角：点击卡片统计项查看人员清单（不做互动）
  // 本页已非 tab 页，底部弹层无 custom-tab-bar 遮挡问题，无需再收放 tab-bar
  _openAudience(type, title, id) {
    this.setData({ audienceStoryId: id, audienceType: type, audienceTitle: title, audienceVisible: true })
  },
  onViewRead(e) { this._openAudience('read', '阅读的人', e.detail.id) },
  onViewLike(e) { this._openAudience('like', '点赞的人', e.detail.id) },
  onViewFav(e) { this._openAudience('favorite', '收藏的人', e.detail.id) },
  onViewComment(e) { this._openAudience('comment', '评论', e.detail.id) },
  onAudienceClose() { this.setData({ audienceVisible: false }) },

  onCardEdit(e) { ensureMember(this, () => throttle(this, 'edit', () => wx.navigateTo({ url: '/pages/story-compose/index?storyId=' + e.detail.id }))) },
  onCardDelete(e) {
    if (!ensureLogin(this, () => this.onCardDelete(e))) return
    const { id } = e.detail
    return lock(this, 'del' + id, async () => {
      const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '删除后不可恢复', success: r }))
      if (res.confirm) {
        await storyApi.remove(id)
        this.setData({ stories: this.data.stories.filter(d => d.id !== id) })
        wx.showToast({ title: '删除成功', icon: 'none', duration: 1500 })
      }
    })
  },

  onFabTap() { ensureMember(this, () => throttle(this, 'fab', () => wx.navigateTo({ url: '/pages/story-compose/index' }))) },
  onReachBottom() { if (this.data.hasMore) this._loadStories(false) },

  async onRefresh() {
    this.setData({ refreshing: true })
    try { await this._loadStories(true) } finally { this.setData({ refreshing: false }) }
  },
})
