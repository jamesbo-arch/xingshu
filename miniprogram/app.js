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
        env: this._pickCloudEnv(),
        traceUser: true,
      })
    }
    // v2.2 带参小程序码：scene 形如 "d=12&s=8"（日记）/ "a=3&s=8"（活动），s 为分享人 ID
    const q = (options && options.query) || {}
    let scene = q.scene ? decodeURIComponent(q.scene) : ''
    // 微信转发卡片直达：path 直接携带 s=<分享人>，无 scene，也作为推荐人来源（与扫码 s 对齐）
    if (!scene && q.s) scene = 's=' + q.s
    this._initUser(scene, (options && options.path) || '')
  },

  // 云环境按小程序版本切换：正式版(release)→生产环境；开发/体验版(develop/trial)→测试环境。
  // 建好独立测试环境前，两者都填当前环境即可（不影响现状）；建好后只改 dev 的 env ID。
  _pickCloudEnv() {
    const ENVS = {
      prod: 'cloud1-xingshu-prd-d1cev0fcca864', // 正式环境（release）
      dev: 'cloud1-d9gbozhfp4a6c50c0',          // 测试/体验环境（develop/trial，原环境）
    }
    let version = 'release'
    try { version = wx.getAccountInfoSync().miniProgram.envVersion } catch (e) { /* 兜底按正式 */ }
    return version === 'release' ? ENVS.prod : ENVS.dev
  },

  async _initUser(scene, launchPath) {
    // 冷启动先用本地缓存恢复身份（登录返回前页面即有身份，避免会员被误判 guest 弹登录窗），
    // 网络返回后由 setUser 覆盖刷新。会员有效性由 isValidMember 按 member_until 判定，缓存过期身份不越权。
    const cached = cache.get('user')
    if (cached) this.globalData.user = cached
    // 登录在途标记：auth-guard 的 ensureLogin 据此等待落地再判定，而非直接按 guest 弹窗
    this._loginPromise = userApi.login(undefined, scene || undefined).then((user) => {
      if (user) this.setUser(user)
      this._loginPromise = null
      // v2.1 克制原则：不再强制 guest 跳验证页——游客可自由浏览列表，
      // 验证在互动/查看详情的瞬间触发（utils/auth-guard.js）
      return user
    })
    await this._loginPromise
    await this.loadTags()
    // 扫码/转发直达对应详情页。若小程序已直接以目标页为启动页（小程序码 page 即详情页、
    // 转发 path 即详情页），则页面自身会从 scene/query 加载，这里不再重复 navigateTo，
    // 否则会压入重复页导致「navigateBack with an invalid tabbar page / webviewId not found」。
    if (scene) {
      const diary = scene.match(/(?:^|&)d=(\d+)/)
      const act = scene.match(/(?:^|&)a=(\d+)/)
      if (diary && launchPath !== 'pages/detail/index') wx.navigateTo({ url: `/pages/detail/index?id=${diary[1]}` })
      else if (act && launchPath !== 'pages/activity-detail/index') wx.navigateTo({ url: `/pages/activity-detail/index?id=${act[1]}` })
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
      this.setUser(user)
    }
    return user
  },

  // 用户身份统一写入口：更新全局并落本地缓存（7 天），登录/退出/改资料都走这里
  setUser(user) {
    this.globalData.user = user
    cache.set('user', user, 7 * 24 * 60)
  },

  updateUser(patch) {
    Object.assign(this.globalData.user, patch)
    cache.set('user', this.globalData.user, 7 * 24 * 60)
  },
})
