const activityApi = require('../../api/activity')
const toast = require('../../utils/toast')
const { call } = require('../../api/request')
const { ensureLogin } = require('../../utils/auth-guard')
const { lock, throttle } = require('../../utils/guard')

Page({
  data: {
    activity: null,
    isPast: false,
    isFull: false,
    pct: 0,
    statusBarHeight: 0,
    showSignup: false,
    signupName: '',
    signupContact: '',
    _sheetShow: false,
    showLoginSheet: false,
  },

  onLoad(options) {
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 0 })
    let id = options.id ? (parseInt(options.id, 10) || options.id) : null
    // 扫码/转发以本页为启动页时，id 藏在 scene（"a=3&s=8"）里
    if (!id && options.scene) {
      const m = decodeURIComponent(options.scene).match(/(?:^|&)a=(\d+)/)
      if (m) id = parseInt(m[1], 10)
    }
    this._id = id
    // v2.3：活动详情需微信登录（轻授权），未登录先拉起登录弹窗，取消则返回列表
    if (!ensureLogin(this, () => this._load())) return
    this._load()
  },

  // 微信「…」菜单转发/分享朋友圈：分享当前活动，带分享人 ID（s=）延续推荐人机制
  onShareAppMessage() {
    const a = this.data.activity || {}
    const sharerId = (getApp().globalData.user || {}).id
    return {
      title: a.title || '醒书活动',
      path: `/pages/activity-detail/index?id=${this._id}${sharerId ? '&s=' + sharerId : ''}`,
    }
  },
  onShareTimeline() {
    const a = this.data.activity || {}
    const sharerId = (getApp().globalData.user || {}).id
    return {
      title: a.title || '醒书活动',
      query: `id=${this._id}${sharerId ? '&s=' + sharerId : ''}`,
    }
  },

  onLoginClose() {
    this.setData({ showLoginSheet: false })
    if (!this.data.activity) this._goBack()
  },
  onLoginSuccess() {
    this.setData({ showLoginSheet: false })
    const action = this._pendingLoginAction
    this._pendingLoginAction = null
    if (typeof action === 'function') action()
  },

  async _load() {
    const a = await activityApi.getDetail(this._id)
    if (!a) {
      toast.info('活动不存在')
      setTimeout(() => this._goBack(), 1200)
      return
    }
    this.setData({
      activity: a,
      isPast: a.status === 'finished',
      isFull: a.capacity > 0 && a.signup_count >= a.capacity && !a.isSignedUp,
      pct: a.capacity > 0 ? Math.min(100, Math.round(a.signup_count / a.capacity * 100)) : 0,
    })
  },

  // 若本页是启动页（转发/扫码直达，栈内仅本页），navigateBack 无上一页会报错 → 改回活动列表
  _goBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/activities/index' })
  },
  onBack() { throttle(this, 'nav', () => this._goBack()) },

  // 报名弹层（_mounted/_show 双状态动画模式与其他 sheet 一致，此处简化为单状态）
  // 自动带出当前用户资料：称呼取真实姓名→昵称，联系方式取手机号；未登录先拉起登录
  onOpenSignup() {
    if (!ensureLogin(this, () => this.onOpenSignup())) return
    const u = getApp().globalData.user || {}
    this.setData({
      signupName: (u.real_name || u.nickname || '').trim(),
      signupContact: (u.phone || '').trim(),
      showSignup: true,
    })
    setTimeout(() => this.setData({ _sheetShow: true }), 20)
  },
  onCloseSignup() {
    this.setData({ _sheetShow: false })
    setTimeout(() => this.setData({ showSignup: false }), 300)
  },
  onNameInput(e) { this.setData({ signupName: e.detail.value }) },
  onContactInput(e) { this.setData({ signupContact: e.detail.value }) },

  async onSubmitSignup() {
    if (this._submitting) return
    const name = this.data.signupName.trim()
    if (!name) { toast.info('请留下你的称呼'); return }
    this._submitting = true
    try {
      const r = await activityApi.signup(this._id, { name, contact: this.data.signupContact.trim() })
      if (r) {
        this.onCloseSignup()
        toast.success('报名成功，期待相见')
        this._load()
      }
    } finally {
      this._submitting = false
    }
  },

  onCancelSignup() {
    return lock(this, 'cancelSignup', async () => {
      const res = await new Promise(resolve => wx.showModal({
        title: '取消报名？',
        content: '取消后名额将释放给其他醒书人',
        confirmText: '取消报名',
        cancelText: '再想想',
        success: resolve,
      }))
      if (!res.confirm) return
      const r = await activityApi.cancelSignup(this._id)
      if (r) {
        toast.info('已取消报名')
        this._load()
      }
    })
  },

  onPreviewImage(e) {
    const images = this.data.activity.images || []
    wx.previewImage({ current: images[e.currentTarget.dataset.index], urls: images })
  },

  // v2.2 活动海报：带参小程序码（scene 携带活动 ID + 分享人 ID，推荐参数不展示在画面上）
  async onOpenPoster() {
    this.setData({ showPoster: true })
    setTimeout(() => this.setData({ _posterShow: true }), 20)
    if (!this.data.qrFileID) {
      const app = getApp()
      const sharerId = (app.globalData.user || {}).id
      const res = await call('generateMiniCode', { activityId: this._id, sharerId }, { showError: false })
      if (res && res.fileID) this.setData({ qrFileID: res.fileID })
    }
  },
  onClosePoster() {
    this.setData({ _posterShow: false })
    setTimeout(() => this.setData({ showPoster: false }), 300)
  },
  onSaveQr() {
    if (!this.data.qrFileID) { toast.info('小程序码生成中，稍候再试'); return }
    return lock(this, 'saveQr', async () => {
      try {
        const dl = await wx.cloud.downloadFile({ fileID: this.data.qrFileID })
        await new Promise((resolve, reject) => wx.saveImageToPhotosAlbum({
          filePath: dl.tempFilePath, success: resolve, fail: reject,
        }))
        toast.success('已保存到相册')
      } catch (err) {
        if (err.errMsg && err.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({
            title: '需要相册权限', content: '请在设置中允许访问相册',
            confirmText: '去设置',
            success: (r) => { if (r.confirm) wx.openSetting() },
          })
        } else {
          toast.error('保存失败，请重试')
        }
      }
    })
  },
})
