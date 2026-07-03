const activityApi = require('../../api/activity')
const toast = require('../../utils/toast')

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
  },

  onLoad(options) {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 0 })
    this._id = parseInt(options.id, 10) || options.id
    this._load()
  },

  async _load() {
    const a = await activityApi.getDetail(this._id)
    if (!a) {
      toast.info('活动不存在')
      setTimeout(() => wx.navigateBack(), 1200)
      return
    }
    this.setData({
      activity: a,
      isPast: a.status === 'finished',
      isFull: a.capacity > 0 && a.signup_count >= a.capacity && !a.isSignedUp,
      pct: a.capacity > 0 ? Math.min(100, Math.round(a.signup_count / a.capacity * 100)) : 0,
    })
  },

  onBack() { wx.navigateBack() },

  // 报名弹层（_mounted/_show 双状态动画模式与其他 sheet 一致，此处简化为单状态）
  onOpenSignup() {
    this.setData({ showSignup: true })
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

  async onCancelSignup() {
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
  },

  onPreviewImage(e) {
    const images = this.data.activity.images || []
    wx.previewImage({ current: images[e.currentTarget.dataset.index], urls: images })
  },
})
