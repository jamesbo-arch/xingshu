// 本地缓存 — wx.setStorageSync 封装，带 TTL（分钟）
// 存储异常（配额满等）静默降级为无缓存，不影响主流程
const PREFIX = 'xs_cache:'

function set(key, value, ttlMinutes) {
  try {
    wx.setStorageSync(PREFIX + key, { value, expires: Date.now() + ttlMinutes * 60000 })
  } catch (e) {}
}

function get(key) {
  try {
    const item = wx.getStorageSync(PREFIX + key)
    if (!item || !item.expires || Date.now() > item.expires) return null
    return item.value
  } catch (e) {
    return null
  }
}

function remove(key) {
  try { wx.removeStorageSync(PREFIX + key) } catch (e) {}
}

module.exports = { set, get, remove }
