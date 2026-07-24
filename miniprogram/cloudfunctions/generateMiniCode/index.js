const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 生成带参小程序码（v2.2）：支持日记/活动两种目标，scene 携带分享人用户 ID
// scene 约定：故事 "d=<storyId>&s=<sharerUserId>"（d= 前缀沿用旧约定，保证已分发的旧码可用）；活动 "a=<activityId>&s=<sharerUserId>"
// 推荐人参数仅隐含在码中，海报画面不展示（PRD 3.1.5）
exports.main = async (event, context) => {
  const { storyId, activityId, sharerId } = event
  if (!storyId && !activityId) return { code: -1, msg: '缺少目标ID' }

  const isStory = !!storyId
  const targetId = isStory ? storyId : activityId
  const scene = `${isStory ? 'd' : 'a'}=${targetId}${sharerId ? `&s=${sharerId}` : ''}`
  const page = isStory ? 'pages/story-detail/index' : 'pages/activity-detail/index'

  try {
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene,
      page,
      width: 430,
      checkPath: false,
    })

    const uploadResult = await cloud.uploadFile({
      cloudPath: `posters/qrcode-${isStory ? 'd' : 'a'}${targetId}-s${sharerId || 0}.png`,
      fileContent: result.buffer,
    })

    return { code: 0, data: { fileID: uploadResult.fileID } }
  } catch (err) {
    // 暴露 errCode/errMsg 便于定位（未发布小程序常见 41030 / 未上线）
    const detail = err && (err.errCode || err.errMsg || err.message) ? `errCode=${err.errCode} errMsg=${err.errMsg || err.message}` : String(err)
    console.error('[generateMiniCode] getUnlimited 失败:', detail, 'scene=', scene, 'page=', page)
    return { code: -1, msg: '生成小程序码失败: ' + detail }
  }
}
