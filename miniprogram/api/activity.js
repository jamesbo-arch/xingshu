const { call } = require('./request')

module.exports = {
  getTypes() {
    return call('activity', { action: 'typeList' }, { retry: 1 })
  },
  getList(typeId) {
    return call('activity', { action: 'list', payload: typeId ? { typeId } : {} }, { retry: 1 })
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
