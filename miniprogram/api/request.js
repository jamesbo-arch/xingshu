const toast = require('../utils/toast')

const call = async (name, data = {}, options = {}) => {
  const { showError = true, raw = false } = options
  try {
    const res = await wx.cloud.callFunction({ name, data })
    if (raw) return res.result // 调用方自行处理 code（如权限引导码 -3）
    if (res.result.code === 0) {
      return res.result.data
    }
    if (showError) toast.error(res.result.msg || '请求失败')
    return null
  } catch (err) {
    if (showError) toast.error('网络异常，请重试')
    console.error(`[${name}]`, err)
    if (raw) return { code: -99, msg: '网络异常' }
    return null
  }
}

module.exports = { call }
