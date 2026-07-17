const { call } = require('./request')

module.exports = {
  getList(params = {}) {
    return call('getStoryList', params, { retry: 1 })
  },
  getDetail(storyId) {
    return call('getStoryDetail', { storyId }, { retry: 1 })
  },
  // 返回完整 {code, data, msg}，供详情页处理权限引导码（-3 需登录 / -2 会员专享）
  getDetailRaw(storyId) {
    return call('getStoryDetail', { storyId }, { raw: true, retry: 1 })
  },
  create(data) {
    return call('createStory', data)
  },
  update(storyId, data) {
    return call('updateStory', { storyId, ...data })
  },
  remove(storyId) {
    return call('deleteStory', { storyId })
  },
}
