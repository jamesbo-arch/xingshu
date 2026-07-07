const userApi = require('./api/user')
const tagApi = require('./api/tag')
const cache = require('./utils/cache')

App({
  globalData: {
    user: null,
    tags: [],
    adminContact: {
      name: '运营 · 砚秋',
      wechat: 'xingshu-ops',
      hours: '工作日 09:00 -- 18:00',
      note: '请备注您的微信昵称与手机号，便于核对身份。',
    },
  },

  onLaunch(options) {
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d9gbozhfp4a6c50c0',
        traceUser: true,
      })
    }
    // v2.2 带参小程序码：scene 形如 "d=12&s=8"（日记）/ "a=3&s=8"（活动），s 为分享人 ID
    const q = (options && options.query) || {}
    let scene = q.scene ? decodeURIComponent(q.scene) : ''
    // 微信转发卡片直达：path 直接携带 s=<分享人>，无 scene，也作为推荐人来源（与扫码 s 对齐）
    if (!scene && q.s) scene = 's=' + q.s
    this._initUser(scene)
  },

  async _initUser(scene) {
    const user = await userApi.login(undefined, scene || undefined)
    if (user) {
      this.globalData.user = user
      // v2.1 克制原则：不再强制 guest 跳验证页——游客可自由浏览列表，
      // 验证在互动/查看详情的瞬间触发（utils/auth-guard.js）
    }
    await this.loadTags()
    // 扫码直达对应详情页
    if (scene) {
      const diary = scene.match(/(?:^|&)d=(\d+)/)
      const act = scene.match(/(?:^|&)a=(\d+)/)
      if (diary) wx.navigateTo({ url: `/pages/detail/index?id=${diary[1]}` })
      else if (act) wx.navigateTo({ url: `/pages/activity-detail/index?id=${act[1]}` })
    }
  },

  async loadTags() {
    // 先用本地缓存兜底，网络返回后刷新缓存（stale-while-revalidate）
    if (!this.globalData.tags.length) {
      const cached = cache.get('tags')
      if (cached) this.globalData.tags = cached
    }
    const tags = await tagApi.getAll()
    if (tags) {
      this.globalData.tags = tags
      cache.set('tags', tags, 60)
    }
  },

  async refreshUser() {
    const user = await userApi.getUserInfo()
    if (user) {
      this.globalData.user = user
    }
    return user
  },

  updateUser(patch) {
    Object.assign(this.globalData.user, patch)
  },
})
