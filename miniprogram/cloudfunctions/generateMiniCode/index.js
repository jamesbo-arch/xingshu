const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 生成带参小程序码（v2.2）：支持日记/活动两种目标，scene 携带分享人用户 ID
// scene 约定：日记 "d=<diaryId>&s=<sharerUserId>"；活动 "a=<activityId>&s=<sharerUserId>"
// 推荐人参数仅隐含在码中，海报画面不展示（PRD 3.1.5）
exports.main = async (event, context) => {
  const { diaryId, activityId, sharerId } = event
  if (!diaryId && !activityId) return { code: -1, msg: '缺少目标ID' }

  const isDiary = !!diaryId
  const targetId = isDiary ? diaryId : activityId
  const scene = `${isDiary ? 'd' : 'a'}=${targetId}${sharerId ? `&s=${sharerId}` : ''}`
  const page = isDiary ? 'pages/detail/index' : 'pages/activity-detail/index'

  try {
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene,
      page,
      width: 280,
      checkPath: false,
    })

    const uploadResult = await cloud.uploadFile({
      cloudPath: `posters/qrcode-${isDiary ? 'd' : 'a'}${targetId}-s${sharerId || 0}.png`,
      fileContent: result.buffer,
    })

    return { code: 0, data: { fileID: uploadResult.fileID } }
  } catch (err) {
    return { code: -1, msg: '生成小程序码失败: ' + err.message }
  }
}
