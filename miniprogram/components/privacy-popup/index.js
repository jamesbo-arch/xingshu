// 隐私授权弹窗：配置《用户隐私保护指引》后，基础库在首次调用敏感接口（chooseAvatar/
// chooseMedia/saveImageToPhotosAlbum 等）时会触发 onNeedPrivacyAuthorization，需弹窗
// 让用户同意后放行。在 pageLifetimes.show 重新注册，保证"当前可见页"的弹窗为有效处理者。
Component({
  options: { addGlobalClass: true },
  data: { visible: false },
  pageLifetimes: {
    show() {
      if (wx.onNeedPrivacyAuthorization) {
        wx.onNeedPrivacyAuthorization(resolve => {
          this._resolve = resolve
          this.setData({ visible: true })
        })
      }
    },
  },
  methods: {
    onAgree() {
      this.setData({ visible: false })
      if (this._resolve) { this._resolve({ buttonId: 'agree-btn', event: 'agree' }); this._resolve = null }
    },
    onDisagree() {
      this.setData({ visible: false })
      if (this._resolve) { this._resolve({ event: 'disagree' }); this._resolve = null }
    },
    onOpenDoc(e) {
      wx.navigateTo({ url: '/pages/doc/index?type=' + e.currentTarget.dataset.type })
    },
  },
})
