const app = getApp()
const { hueToColor, getInitial } = require('../../utils/color')
const userApi = require('../../api/user')
const mapper = require('../../utils/mapper')
const { ensureLogin, handleLoginSuccess, toggleTabBar } = require('../../utils/auth-guard')
const { lock } = require('../../utils/guard')

Page({
  data: {
    user: null,
    adminContact: null,
    avatarColor: '#8B7A4A',
    avatarInitial: '?',
    statusBarHeight: 0,
    showProfileSheet: false,
    showPurchaseSheet: false,
    showLoginSheet: false,
    editNickname: '',
    editRealName: '',
    editPhone: '',
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
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 0, adminContact: app.globalData.adminContact })
  },

  onShow() {
    this._loadUser()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 })
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

  // v2.3：微信登录半屏弹窗替代原手机号验证页
  onAuthorize() {
    ensureLogin(this, () => this._loadUser())
  },
  onLoginClose() {
    this.setData({ showLoginSheet: false })
    toggleTabBar(this, false)
    this._pendingLoginAction = null
  },
  onLoginSuccess() {
    handleLoginSuccess(this)
    this._loadUser()
  },

  // v2.3 设置：退出登录（仅回退为未登录，重新登录后会员权益自动恢复）
  onLogout() {
    return lock(this, 'logout', async () => {
      const res = await new Promise(r => wx.showModal({
        title: '退出登录',
        content: '退出后将以未登录身份浏览，重新登录即可恢复全部功能与会员权益。',
        confirmText: '退出',
        cancelText: '取消',
        success: r,
      }))
      if (!res.confirm) return
      const result = await userApi.updateProfile({ logout: true })
      if (result) {
        app.globalData.user = result
        this._loadUser()
        wx.showToast({ title: '已退出登录', icon: 'none', duration: 1500 })
      }
    })
  },

  // tab 页的底部弹层需隐藏自定义 tab-bar，否则 tab-bar 独立层会盖住弹层底部（保存按钮）
  _tabBar(hidden) { const tb = this.getTabBar && this.getTabBar(); if (tb) tb.setData({ hidden }) },

  onShowPurchaseSheet() { this.setData({ showPurchaseSheet: true }); this._tabBar(true) },
  onClosePurchaseSheet() { this.setData({ showPurchaseSheet: false }); this._tabBar(false) },

  onShowProfileSheet() {
    const user = this.data.user || {}
    this.setData({
      showProfileSheet: true,
      editNickname: user.nickname || '',
      editRealName: user.realName || '',
      editPhone: user.phone || '',
      editAvatarUrl: user.avatarUrl || '',
    })
    this._tabBar(true)
  },
  onCloseProfileSheet() { this.setData({ showProfileSheet: false }); this._tabBar(false) },

  onChooseAvatar(e) {
    this.setData({ editAvatarUrl: e.detail.avatarUrl })
  },

  onNicknameInput(e) { this.setData({ editNickname: e.detail.value }) },
  onRealNameInput(e) { this.setData({ editRealName: e.detail.value }) },
  onPhoneInput(e) { this.setData({ editPhone: e.detail.value }) },

  onSaveProfile() {
    const nickname = this.data.editNickname.trim()
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none', duration: 1500 })
      return
    }
    return lock(this, 'saveProfile', async () => {
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

      const patch = { nickname, realName: this.data.editRealName.trim(), phone: this.data.editPhone.trim() }
      if (avatarUrl !== (user.avatarUrl || '')) patch.avatarUrl = avatarUrl

      const result = await userApi.updateProfile(patch)
      wx.hideLoading()
      if (result) {
        app.globalData.user = result
        this._loadUser()
        this.setData({ showProfileSheet: false })
        this._tabBar(false)
        wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 })
      }
    } catch {
      wx.hideLoading()
      wx.showToast({ title: '保存失败，请重试', icon: 'none', duration: 2000 })
    }
    })
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
