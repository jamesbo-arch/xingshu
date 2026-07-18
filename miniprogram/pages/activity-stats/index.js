// 活动报名数据页（主理人/工作人员专用，只读）：统计头 + 报名名单全量字段 + 推荐人。
// 鉴权在 statsGet 服务端（owner_user_id 或 activity_staff 白名单），分享链接只是入口——
// 不在名单的用户打开渲染「无权限」空态。到场/收费勾选仍在管理后台，本页不做写操作。
const activityApi = require('../../api/activity')
const { ensureLogin } = require('../../utils/auth-guard')
const { hueToColor, getInitial } = require('../../utils/color')

Page({
  data: {
    statusBarHeight: 0,
    loading: true,
    needLogin: false,
    noAccess: false,     // 无权限（不在主理人/工作人员名单）
    errMsg: '',
    activity: null,      // { id, title, startTime, capacity, price }
    stats: null,         // { total, attended, paid }
    list: [],
    feeText: '',
    showLoginSheet: false,
  },

  onLoad(options) {
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 0 })
    let id = options.id ? (parseInt(options.id, 10) || options.id) : null
    if (!id && options.scene) {
      const m = decodeURIComponent(options.scene).match(/(?:^|&)a=(\d+)/)
      if (m) id = parseInt(m[1], 10)
    }
    this._id = id
  },

  // 登录墙放 onReady（同 activity-detail：onLoad 同步置 visible 会致弹窗不挂载）
  onReady() {
    if (!ensureLogin(this, () => this._load())) { this.setData({ needLogin: true, loading: false }); return }
    this._load()
  },

  onWallLogin() {
    if (!ensureLogin(this, () => this._load())) return
    this._load()
  },

  onLoginClose() {
    this.setData({ showLoginSheet: false })
  },
  onLoginSuccess() {
    this.setData({ showLoginSheet: false, needLogin: false })
    const action = this._pendingLoginAction
    this._pendingLoginAction = null
    if (typeof action === 'function') action()
  },

  onPullDownRefresh() {
    this._load().finally(() => wx.stopPullDownRefresh())
  },

  async _load() {
    if (!this._id) { this.setData({ loading: false, noAccess: true, errMsg: '缺少活动参数' }); return }
    this.setData({ loading: true, needLogin: false })
    const r = await activityApi.getStats(this._id)
    if (!r || r.code !== 0) {
      // 未注册/不在名单/活动不存在均落无权限空态（分享链接不授权，鉴权凭身份）
      this.setData({ loading: false, noAccess: true, errMsg: (r && r.msg) || '网络异常，请重试' })
      return
    }
    const d = r.data
    const price = Number(d.activity.price) || 0
    const list = d.list.map(s => ({
      signupId: s.signup_id,
      name: s.name,
      contact: s.contact || '',
      attended: !!s.attended,
      paid: !!s.paid,
      signedAt: s.signed_at,
      userId: s.user_id,
      nickname: s.nickname,
      avatarColor: hueToColor(s.avatar_hue),
      initial: getInitial(s.name || s.nickname),
      referrerText: s.referrer_id ? `${s.referrer_nickname || '?'} · ID ${s.referrer_id}` : '',
    }))
    this.setData({
      loading: false,
      noAccess: false,
      activity: { id: d.activity.id, title: d.activity.title, startTime: d.activity.start_time, capacity: d.activity.capacity },
      stats: d.stats,
      feeText: price > 0 ? price + ' 元' : '免费',
      list,
    })
  },

  // 工作人员间转发入口（打开后仍走身份鉴权，不在名单只见空态）
  onShareAppMessage() {
    const a = this.data.activity || {}
    return {
      title: `报名数据 · ${a.title || '醒书活动'}`,
      path: `/pages/activity-stats/index?id=${this._id}`,
    }
  },

  onBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/activities/index' })
  },
})
