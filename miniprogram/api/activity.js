const { call } = require('./request')

module.exports = {
  getTypes() {
    return call('activity', { action: 'typeList' }, { retry: 1 })
  },
  // mode:'all' → 平铺全部按开始时间倒序（活动页「全部活动」页签）；缺省返回 {upcoming, past}
  getList(typeId, mode) {
    const payload = {}
    if (typeId) payload.typeId = typeId
    if (mode) payload.mode = mode
    return call('activity', { action: 'list', payload }, { retry: 1 })
  },
  // 跨活动分享瀑布流（游客可浏览）
  getFeed(page) {
    return call('activity', { action: 'postFeed', payload: { page, pageSize: 10 } }, { retry: 1 })
  },
  getDetail(id) {
    return call('activity', { action: 'detail', payload: { id } }, { retry: 1 })
  },
  signup(id, form) {
    return call('activity', { action: 'signup', payload: { id, ...form } })
  },
  cancelSignup(id) {
    return call('activity', { action: 'cancelSignup', payload: { id } })
  },
  // 现场分享
  getPosts(id, page) {
    return call('activity', { action: 'postList', payload: { id, page, pageSize: 10 } }, { retry: 1 })
  },
  createPost(id, { content, images }) {
    return call('activity', { action: 'postCreate', payload: { id, content, images } })
  },
  deletePost(id) {
    return call('activity', { action: 'postDelete', payload: { id } })
  },
}
