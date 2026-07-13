const activityApi = require('../../api/activity')
const { throttle } = require('../../utils/guard')

Page({
  data: {
    refreshing: false,
    upcoming: [],
    past: [],
    loaded: false,
    statusBarHeight: 0,
    types: [],        // 活动类型 chips（「全部」+ 启用类型）
    activeTypeId: 0,  // 0 = 全部
  },

  onLoad() {
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 0 })
    this._loadTypes()
  },

  onShow() {
    this._load()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
  },

  async _loadTypes() {
    const types = await activityApi.getTypes()
    if (types) this.setData({ types })
  },

  async _load() {
    const data = await activityApi.getList(this.data.activeTypeId || undefined)
    if (data) {
      this.setData({
        upcoming: data.upcoming.map(this._decorate),
        past: data.past.map(this._decorate),
        loaded: true,
      })
    }
  },

  onTypeTap(e) {
    const id = Number(e.currentTarget.dataset.id) || 0
    if (id === this.data.activeTypeId) return
    this.setData({ activeTypeId: id }, () => this._load())
  },

  // 角标状态：回顾 > 名额已满 > 即将开始(48h 内) > 报名中
  _decorate(a) {
    let badge = '报名中', badgeType = 'open'
    if (a.status === 'finished') { badge = '回顾'; badgeType = 'past' }
    else if (a.capacity > 0 && a.signup_count >= a.capacity) { badge = '名额已满'; badgeType = 'full' }
    else {
      // start_time 为 "YYYY-MM-DD HH:mm"（DB 北京时间），/ 分隔保证 iOS 可解析
      const start = new Date(String(a.start_time).replace(/-/g, '/')).getTime()
      const diff = start - Date.now()
      if (diff > 0 && diff <= 48 * 3600 * 1000) { badge = '即将开始'; badgeType = 'soon' }
    }
    const pct = a.capacity > 0 ? Math.min(100, Math.round(a.signup_count / a.capacity * 100)) : 0
    return { ...a, badge, badgeType, pct }
  },

  onOpen(e) {
    const id = e.currentTarget.dataset.id
    throttle(this, 'open', () => wx.navigateTo({ url: `/pages/activity-detail/index?id=${id}` }))
  },

  async onRefresh() {
    this.setData({ refreshing: true })
    try { await this._load() } finally { this.setData({ refreshing: false }) }
  },
})
