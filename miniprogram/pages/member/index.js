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
    editAvatarUrl: '',
    benefits: [
      { title: '查看全部会员权限日记', desc: '解锁优质内容，与志同道合者同行' },
      { title: '会员专属印记', desc: '日记卡片、评论区显示会员标识' },
      { title: '海报样式特权', desc: '使用专属海报模板' },
      { title: '优先收录推荐', desc: '高质量日记有机会进入广场首页推荐' },
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
    wx.navigateTo({ url: '/pages/auth/index' })
  },

  onShowPurchaseSheet() { this.setData({ showPurchaseSheet: true }) },
  onClosePurchaseSheet() { this.setData({ showPurchaseSheet: false }) },

  onShowProfileSheet() {
    const user = this.data.user || {}
    this.setData({
      showProfileSheet: true,
      editNickname: user.nickname || '',
      editRealName: user.realName || '',
      editAvatarUrl: user.avatarUrl || '',
    })
  },
  onCloseProfileSheet() { this.setData({ showProfileSheet: false }) },

  onChooseAvatar(e) {
    this.setData({ editAvatarUrl: e.detail.avatarUrl })
  },

  onNicknameInput(e) { this.setData({ editNickname: e.detail.value }) },
  onRealNameInput(e) { this.setData({ editRealName: e.detail.value }) },

  async onSaveProfile() {
    const nickname = this.data.editNickname.trim()
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none', duration: 1500 })
      return
    }

    wx.showLoading({ title: '保存中…', mask: true })
    try {
      let avatarUrl = this.data.editAvatarUrl
      const user = this.data.user || {}
      // upload new avatar only if it changed and is a temp path
      if (avatarUrl && avatarUrl !== (user.avatarUrl || '') &&
          (avatarUrl.startsWith('wxfile://') || avatarUrl.includes('/tmp/'))) {
        const ext = avatarUrl.split('.').pop().split('?')[0] || 'jpg'
        const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const res = await wx.cloud.uploadFile({ cloudPath, filePath: avatarUrl })
        avatarUrl = res.fileID
      }

      const patch = { nickname, realName: this.data.editRealName.trim() }
      if (avatarUrl !== (user.avatarUrl || '')) patch.avatarUrl = avatarUrl

      const result = await userApi.updateProfile(patch)
      wx.hideLoading()
      if (result) {
        app.globalData.user = result
        this._loadUser()
        this.setData({ showProfileSheet: false })
        wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 })
      }
    } catch {
      wx.hideLoading()
      wx.showToast({ title: '保存失败，请重试', icon: 'none', duration: 2000 })
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
