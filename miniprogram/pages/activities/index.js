const activityApi = require('../../api/activity')
const { throttle } = require('../../utils/guard')

Page({
  data: {
    upcoming: [],
    past: [],
    loaded: false,
    statusBarHeight: 0,
  },

  onLoad() {
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 0 })
  },

  onShow() {
    this._load()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  async _load() {
    const data = await activityApi.getList()
    if (data) {
      this.setData({
        upcoming: data.upcoming.map(this._decorate),
        past: data.past.map(this._decorate),
        loaded: true,
      })
    }
  },

  // 角标状态：报名中 / 名额已满 / 回顾
  _decorate(a) {
    let badge = '报名中', badgeType = 'open'
    if (a.status === 'finished') { badge = '回顾'; badgeType = 'past' }
    else if (a.capacity > 0 && a.signup_count >= a.capacity) { badge = '名额已满'; badgeType = 'full' }
    const pct = a.capacity > 0 ? Math.min(100, Math.round(a.signup_count / a.capacity * 100)) : 0
    return { ...a, badge, badgeType, pct }
  },

  onOpen(e) {
    const id = e.currentTarget.dataset.id
    throttle(this, 'open', () => wx.navigateTo({ url: `/pages/activity-detail/index?id=${id}` }))
  },

  onPullDownRefresh() {
    this._load().then(() => wx.stopPullDownRefresh())
  },
})
