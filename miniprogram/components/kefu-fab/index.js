// 客服浮动图标（全局，所有页面挂载）：点击打开微信客服（企业微信）会话
// ⚠️ KF_URL 配置：企业微信后台 → 微信客服 → 客服账号 → 复制链接（https://work.weixin.qq.com/kfid/kfc...）
const CORP_ID = 'ww6e6791e71177150a'
const KF_URL = '' // TODO: 填入客服链接后生效

Component({
  methods: {
    onTap() {
      if (!KF_URL) {
        wx.showToast({ title: '客服暂未开通', icon: 'none', duration: 1500 })
        return
      }
      wx.openCustomerServiceChat({
        extInfo: { url: KF_URL },
        corpId: CORP_ID,
        fail: () => wx.showToast({ title: '客服打开失败，请稍后再试', icon: 'none', duration: 1500 }),
      })
    },
  },
})
