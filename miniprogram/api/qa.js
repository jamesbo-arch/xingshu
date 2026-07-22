// 醒书问答 API — 统一走 qa 云函数的 action 路由
const { call } = require('./request')

const qa = (action, payload, options) => call('qa', { action, payload }, options)

module.exports = {
  // mode: all（默认）/ mine / collections
  getList(params = {}) {
    return qa('list', params, { retry: 1 })
  },
  // 返回完整 {code, data, msg}：详情页需处理 -1 不存在 / -2 会员专享
  getDetailRaw(id) {
    return call('qa', { action: 'detail', payload: { id } }, { raw: true, retry: 1 })
  },
  getComments(id) {
    return qa('commentList', { id }, { retry: 1 })
  },
  create(data) {
    return qa('create', data)
  },
  update(id, data) {
    return qa('update', { id, ...data })
  },
  remove(id) {
    return qa('remove', { id })
  },
  createComment(id, content, parentId, isAnonymous) {
    return qa('commentCreate', { id, content, parentId, isAnonymous })
  },
  deleteComment(id) {
    return qa('commentDelete', { id })
  },
  toggleLike(id) {
    return qa('like', { id })
  },
  toggleFav(id) {
    return qa('favToggle', { id })
  },
}
