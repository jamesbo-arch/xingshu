const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { diaryId } = event
  if (!diaryId) return { code: -1, msg: '缺少日记ID' }

  try {
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: `diary=${diaryId}`,
      page: 'pages/detail/index',
      width: 280,
      checkPath: false,
    })

    const uploadResult = await cloud.uploadFile({
      cloudPath: `posters/qrcode-${diaryId}.png`,
      fileContent: result.buffer,
    })

    return { code: 0, data: { fileID: uploadResult.fileID } }
  } catch (err) {
    return { code: -1, msg: '生成小程序码失败: ' + err.message }
  }
}
