const app = getApp()
const { hueToColor, getInitial } = require('../../utils/color')
const userApi = require('../../api/user')
const mapper = require('../../utils/mapper')

Page({
  data: {
    user: null,
    adminContact: null,
    avatarColor: '#8B7A4A',
    avatarInitial: '?',
    statusBarHeight: 0,
    showProfileSheet: false,
    showPurchaseSheet: false,
    editNickname: '',
    editRealName: '',
    benefits: [
      { icon: '◎', text: '阅读全部会员日记' },
      { icon: '✎', text: '发布会员可见日记' },
      { icon: '◆', text: '无限量收藏' },
      { icon: '★', text: '优先获取新功能' },
    ],
    purchaseSteps: [
      { num: '壹', title: '添加微信', desc: '添加运营微信，备注昵称与手机号' },
      { num: '贰', title: '确认身份', desc: '运营核对您的微信昵称与手机号' },
      { num: '叁', title: '完成支付', desc: '线下转账，运营确认后开通会员' },
      { num: '肆', title: '即时生效', desc: '开通后刷新页面，会员权益立即生效' },
    ],
  },

  onLoad() {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 0, adminContact: app.globalData.adminContact })
  },

  onShow() {
    this._loadUser()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
  },

  _loadUser() {
    const raw = app.globalData.user
    if (!raw) return
    const user = mapper.user(raw)
    this.setData({
      user,
      avatarColor: hueToColor(user.avatarHue || 60),
      avatarInitial: getInitial(user.nickname || '?'),
    })
  },

  onAuthorize() {
    wx.showModal({
      title: '微信授权',
      content: '授权后可获得完整功能，包括发布日记与查看会员内容。',
      confirmText: '授权', cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          app.updateUser({ identity: 'authed' })
          this._loadUser()
          wx.showToast({ title: '授权成功', icon: 'success', duration: 1500 })
        }
      },
    })
  },

  onShowPurchaseSheet() { this.setData({ showPurchaseSheet: true }) },
  onClosePurchaseSheet() { this.setData({ showPurchaseSheet: false }) },

  onShowProfileSheet() {
    const user = this.data.user || {}
    this.setData({
      showProfileSheet: true,
      editNickname: user.nickname || '',
      editRealName: user.real_name || user.realName || '',
    })
  },
  onCloseProfileSheet() { this.setData({ showProfileSheet: false }) },
  onNicknameInput(e) { this.setData({ editNickname: e.detail.value }) },
  onRealNameInput(e) { this.setData({ editRealName: e.detail.value }) },

  async onSaveProfile() {
    const nickname = this.data.editNickname.trim()
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none', duration: 1500 })
      return
    }
    const result = await userApi.updateProfile({ nickname, realName: this.data.editRealName.trim() })
    if (result) {
      app.globalData.user = result
      this._loadUser()
      this.setData({ showProfileSheet: false })
      wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 })
    }
  },

  onCopyWechat() {
    const wechat = this.data.adminContact && this.data.adminContact.wechat
    if (wechat) {
      wx.setClipboardData({
        data: wechat,
        success: () => wx.showToast({ title: '微信号已复制', icon: 'none', duration: 1500 }),
      })
    }
  },
})
