const userApi = require('./api/user')
const tagApi = require('./api/tag')

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
        env: 'awakebook-env-1g0oford0bea44cc',
        traceUser: true,
      })
    }
    this._initUser()
  },

  async _initUser() {
    const user = await userApi.login()
    if (user) {
      this.globalData.user = user
    }
    const tags = await tagApi.getAll()
    if (tags) {
      this.globalData.tags = tags
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
