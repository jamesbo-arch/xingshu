// v2.3 登录触发：guest 在互动/看详情的瞬间拉起微信登录半屏弹窗（components/login-sheet）
// 触发页约定：data 声明 showLoginSheet，wxml 挂载 <login-sheet>，
// bind:close 里收起弹窗，bind:success 里调用 handleLoginSuccess(this)

// tab 页的自定义 tab-bar 是独立层，会遮挡底部弹层——弹窗开合时同步隐藏/恢复。
// 非 tab 页无 tab-bar，getTabBar() 取不到，静默跳过。
function toggleTabBar(page, hidden) {
  const tb = page.getTabBar && page.getTabBar()
  if (tb) tb.setData({ hidden })
}

// 返回 true = 已登录可继续；false = 已拉起弹窗并暂存 action，登录成功后自动续做
function ensureLogin(page, action) {
  const app = getApp()
  const identity = (app.globalData.user || {}).identity || 'guest'
  if (identity !== 'guest') return true
  page._pendingLoginAction = action || null
  page.setData({ showLoginSheet: true })
  toggleTabBar(page, true)
  return false
}

// 登录成功：收起弹窗并自动继续触发前的原操作
function handleLoginSuccess(page) {
  page.setData({ showLoginSheet: false })
  toggleTabBar(page, false)
  const action = page._pendingLoginAction
  page._pendingLoginAction = null
  if (typeof action === 'function') action()
}

module.exports = { ensureLogin, handleLoginSuccess, toggleTabBar }
