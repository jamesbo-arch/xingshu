const { call } = require('./request')

module.exports = {
  getList() {
    return call('activity', { action: 'list' })
  },
  getDetail(id) {
    return call('activity', { action: 'detail', payload: { id } })
  },
  signup(id, form) {
    return call('activity', { action: 'signup', payload: { id, ...form } })
  },
  cancelSignup(id) {
    return call('activity', { action: 'cancelSignup', payload: { id } })
  },
}
