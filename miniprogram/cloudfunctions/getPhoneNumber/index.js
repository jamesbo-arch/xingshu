const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { code } = event
  if (!code) return { code: -1, msg: '缺少 code' }

  try {
    const result = await cloud.openapi.phonenumber.getPhoneNumber({ code })
    const info = result.phoneInfo
    const phone = info.purePhoneNumber || info.phoneNumber || ''
    return { code: 0, data: { phone } }
  } catch (e) {
    return { code: -1, msg: e.errMsg || e.message || '获取手机号失败' }
  }
}
