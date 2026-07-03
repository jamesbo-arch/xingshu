const { call } = require('./request')

module.exports = {
  getList(params = {}) {
    return call('getDiaryList', params)
  },
  getDetail(diaryId) {
    return call('getDiaryDetail', { diaryId })
  },
  // 返回完整 {code, data, msg}，供详情页处理权限引导码（-3 需验证）
  getDetailRaw(diaryId) {
    return call('getDiaryDetail', { diaryId }, { raw: true })
  },
  create(data) {
    return call('createDiary', data)
  },
  update(diaryId, data) {
    return call('updateDiary', { diaryId, ...data })
  },
  remove(diaryId) {
    return call('deleteDiary', { diaryId })
  },
}
