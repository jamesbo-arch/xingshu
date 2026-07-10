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

// 有效会员判定：identity=member 且 memberUntil>=今天（与后端一致，过期按非会员）
function isValidMember(user) {
  if (!user || user.identity !== 'member') return false
  const mu = user.memberUntil
  if (!mu) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const until = new Date(String(mu).slice(0, 10).replace(/-/g, '/'))
  return !isNaN(until.getTime()) && until >= today
}

// 会员专享操作守卫（如写日记）：非有效会员弹窗引导至会员中心；有效会员执行 action
// 返回 true = 有效会员已放行；false = 已弹窗拦截
function ensureMember(page, action) {
  const user = getApp().globalData.user || {}
  if (isValidMember(user)) {
    if (typeof action === 'function') action()
    return true
  }
  const isGuest = (user.identity || 'guest') === 'guest'
  wx.showModal({
    title: '会员专享',
    content: isGuest
      ? '写日记是会员专享功能，请登录并开通会员后使用。'
      : '写日记是会员专享功能，开通会员后即可记录你的醒书日记。',
    confirmText: '去开通',
    cancelText: '再想想',
    success: (res) => {
      if (res.confirm) wx.switchTab({ url: '/pages/member/index' })
    },
  })
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

module.exports = { ensureLogin, ensureMember, isValidMember, handleLoginSuccess, toggleTabBar }
