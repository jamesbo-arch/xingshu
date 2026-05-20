const toast = require('../utils/toast')

const call = async (name, data = {}, options = {}) => {
  const { showError = true } = options
  try {
    const res = await wx.cloud.callFunction({ name, data })
    if (res.result.code === 0) {
      return res.result.data
    }
    if (showError) toast.error(res.result.msg || '请求失败')
    return null
  } catch (err) {
    if (showError) toast.error('网络异常，请重试')
    console.error(`[${name}]`, err)
    return null
  }
}

module.exports = { call }
