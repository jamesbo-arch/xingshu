// v2.3 微信登录半屏弹窗（PRD 5.1.12）：勾选协议 → 点击微信图标完成登录
// 登录成功后更新 app.globalData.user 并触发 success 事件，由触发页自动继续原操作
const userApi = require('../../api/user')

Component({
  properties: {
    visible: { type: Boolean, value: false },
    // 副文案：情境版由触发页传入，默认通用版
    subtitle: { type: String, value: '登录后加入一群认真生活的人。' },
  },

  data: {
    _mounted: false,
    _show: false,
    agreed: false,
    nickname: '',
    avatarUrl: '',
    // 默认头像（微信图标：绿底白气泡）——用户未选头像时展示
    defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%2307C160%22/%3E%3Cellipse cx=%2242%22 cy=%2243%22 rx=%2222%22 ry=%2217%22 fill=%22%23fff%22/%3E%3Cellipse cx=%2266%22 cy=%2262%22 rx=%2215%22 ry=%2212%22 fill=%22%23fff%22/%3E%3Ccircle cx=%2235%22 cy=%2241%22 r=%223%22 fill=%22%2307C160%22/%3E%3Ccircle cx=%2249%22 cy=%2241%22 r=%223%22 fill=%22%2307C160%22/%3E%3Ccircle cx=%2261%22 cy=%2260%22 r=%222.5%22 fill=%22%2307C160%22/%3E%3Ccircle cx=%2271%22 cy=%2260%22 r=%222.5%22 fill=%22%2307C160%22/%3E%3C/svg%3E',
  },

  observers: {
    'visible': function(val) {
      if (val) {
        this.setData({ _mounted: true })
        setTimeout(() => this.setData({ _show: true }), 20)
      } else {
        this.setData({ _show: false })
        setTimeout(() => this.setData({ _mounted: false }), 320)
      }
    },
  },

  methods: {
    onClose() {
      this.triggerEvent('close')
    },

    onToggleAgree() {
      this.setData({ agreed: !this.data.agreed })
    },

    onOpenAgreement() {
      wx.navigateTo({ url: '/pages/doc/index?type=agreement' })
    },

    onOpenPrivacy() {
      wx.navigateTo({ url: '/pages/doc/index?type=privacy' })
    },

    // 昵称：输入或从微信昵称回填时均更新（type="nickname" 在 blur 时才回填微信昵称）
    onNicknameInput(e) {
      this.setData({ nickname: e.detail.value || '' })
    },

    // 头像：拉起微信头像授权，取临时路径，登录时再上传云存储
    onChooseAvatar(e) {
      this.setData({ avatarUrl: e.detail.avatarUrl })
    },

    async onLogin() {
      if (!this.data.agreed) {
        wx.showToast({ title: '请先勾选同意协议', icon: 'none', duration: 1500 })
        return
      }
      const nickname = (this.data.nickname || '').trim()
      if (!nickname) {
        wx.showToast({ title: '请填写昵称', icon: 'none', duration: 1500 })
        return
      }
      if (this._logging) return
      this._logging = true
      wx.showLoading({ title: '登录中', mask: true })
      try {
        let avatarUrl = this.data.avatarUrl
        // 本地临时头像（非 cloud://、非 http）先上传云存储换 fileID
        if (avatarUrl && !/^(cloud:\/\/|https?:\/\/)/.test(avatarUrl)) {
          try {
            const ext = (avatarUrl.match(/\.(\w+)(?:\?|$)/) || [, 'png'])[1]
            const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`
            const up = await wx.cloud.uploadFile({ cloudPath, filePath: avatarUrl })
            avatarUrl = up.fileID
          } catch (err) {
            avatarUrl = '' // 头像上传失败不阻断登录，仅忽略头像
          }
        }
        const patch = { authorize: true, nickname }
        if (avatarUrl) patch.avatarUrl = avatarUrl
        const user = await userApi.updateProfile(patch)
        if (user) {
          getApp().setUser(user)
          this.triggerEvent('success', { user })
        }
      } finally {
        wx.hideLoading()
        this._logging = false
      }
    },
  },
})
