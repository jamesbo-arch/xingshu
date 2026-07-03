// v2.1 授权触发：guest 在互动/看详情的瞬间引导手机号验证
// 返回 true = 已授权可继续；false = 已跳转验证页（可带回跳地址）
function requireAuth(redirect) {
  const app = getApp()
  const identity = (app.globalData.user || {}).identity || 'guest'
  if (identity !== 'guest') return true
  const url = redirect
    ? `/pages/auth/index?redirect=${encodeURIComponent(redirect)}`
    : '/pages/auth/index'
  wx.navigateTo({ url })
  return false
}

module.exports = { requireAuth }
