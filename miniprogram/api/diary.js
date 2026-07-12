const { call } = require('./request')

module.exports = {
  getList(params = {}) {
    return call('getDiaryList', params, { retry: 1 })
  },
  getDetail(diaryId) {
    return call('getDiaryDetail', { diaryId }, { retry: 1 })
  },
  // 返回完整 {code, data, msg}，供详情页处理权限引导码（-3 需验证）
  getDetailRaw(diaryId) {
    return call('getDiaryDetail', { diaryId }, { raw: true, retry: 1 })
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
