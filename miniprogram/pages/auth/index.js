const app = getApp()
const userApi = require('../../api/user')

Page({
  data: {
    phone: '',
    phoneMasked: '',
    agreed: false,
    statusBarHeight: 0,
    saving: false,
    manualPhone: '',
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 0 })
  },

  onManualPhoneInput(e) {
    this.setData({ manualPhone: e.detail.value })
  },

  onConfirmManualPhone() {
    const p = this.data.manualPhone.trim()
    if (!/^1\d{10}$/.test(p)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none', duration: 1500 })
      return
    }
    const masked = p.slice(0, 3) + '****' + p.slice(-4)
    this.setData({ phone: p, phoneMasked: masked })
  },

  onReauth() {
    this.setData({ phone: '', phoneMasked: '', manualPhone: '' })
  },

  onToggleAgreement() {
    this.setData({ agreed: !this.data.agreed })
  },

  async onSave() {
    if (this.data.saving) return
    const { phone, agreed } = this.data

    if (!phone) {
      wx.showToast({ title: '请先授权手机号', icon: 'none', duration: 1500 })
      return
    }
    if (!agreed) {
      wx.showToast({ title: '请先阅读并勾选协议', icon: 'none', duration: 1500 })
      return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中…', mask: true })
    try {
      const result = await userApi.updateProfile({ phone, upgradeToAuthed: true })
      wx.hideLoading()
      if (result) {
        app.globalData.user = result
        await app.loadTags()
        wx.reLaunch({ url: '/pages/square/index' })
      } else {
        throw new Error('save failed')
      }
    } catch {
      wx.hideLoading()
      wx.showToast({ title: '保存失败，请重试', icon: 'none', duration: 2000 })
      this.setData({ saving: false })
    }
  },

  async onSkip() {
    await app.loadTags()
    wx.reLaunch({ url: '/pages/square/index' })
  },
})
