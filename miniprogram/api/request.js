const toast = require('../utils/toast')

// options.retry：网络层失败（callFunction 抛错，如云函数冷启动+隧道握手超时）时自动静默重试的次数。
// 仅读接口挂重试；业务错误（code≠0）不重试。写接口勿开，避免重复提交。
const call = async (name, data = {}, options = {}) => {
  const { showError = true, raw = false, retry = 0 } = options
  try {
    const res = await wx.cloud.callFunction({ name, data })
    if (raw) return res.result // 调用方自行处理 code（如权限引导码 -3）
    if (res.result.code === 0) {
      return res.result.data
    }
    if (showError) toast.error(res.result.msg || '请求失败')
    return null
  } catch (err) {
    if (retry > 0) {
      console.warn(`[${name}] 网络失败，重试`, err)
      return call(name, data, { ...options, retry: retry - 1 })
    }
    if (showError) toast.error('网络异常，请重试')
    console.error(`[${name}]`, err)
    if (raw) return { code: -99, msg: '网络异常' }
    return null
  }
}

module.exports = { call }
