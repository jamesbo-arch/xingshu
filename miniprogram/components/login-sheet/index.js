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

    async onLogin() {
      if (!this.data.agreed) {
        wx.showToast({ title: '请先勾选同意协议', icon: 'none', duration: 1500 })
        return
      }
      if (this._logging) return
      this._logging = true
      try {
        const user = await userApi.updateProfile({ authorize: true })
        if (user) {
          getApp().globalData.user = user
          this.triggerEvent('success', { user })
        }
      } finally {
        this._logging = false
      }
    },
  },
})
