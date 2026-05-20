const { call } = require('./request')

module.exports = {
  getList(params = {}) {
    return call('getDiaryList', params)
  },
  getDetail(diaryId) {
    return call('getDiaryDetail', { diaryId })
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
