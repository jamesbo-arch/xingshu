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

  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-1gpabyik2db3478f',
        traceUser: true,
      })
    }
    this._initUser()
  },

  async _initUser() {
    const user = await userApi.login()
    if (user) {
      this.globalData.user = user
      if (user.identity === 'guest') {
        wx.reLaunch({ url: '/pages/auth/index' })
        return
      }
    }
    await this.loadTags()
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
