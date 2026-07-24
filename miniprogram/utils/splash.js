// 冷启动蒙布的认领逻辑 —— 广场 / 故事详情 / 活动详情三个可能的启动页共用
// 归属（splashOwner）由 app.js 的 onLaunch 判定：扫码或转发直达详情时归 'detail'，否则归 'home'
const cache = require('./cache')

// 认领当日蒙布：仅归属页且今日未弹时返回 true，并即刻写下当日标记
// 标记放在真正展示时写，而非 onLaunch 判定时——否则归属页万一没能挂载，当天就再也不弹了
function claim(owner) {
  const g = getApp().globalData
  if (!g.splashPending || g.splashOwner !== owner) return false
  g.splashPending = false
  const now = new Date()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  cache.set('splash:day', 1, Math.ceil((tomorrow - now) / 60000))
  return true
}

module.exports = { claim }
