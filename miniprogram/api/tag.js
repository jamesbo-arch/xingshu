const { call } = require('./request')

module.exports = {
  getAll() {
    return call('getTags', {}, { retry: 1 })
  },
  add(name) {
    return call('addTag', { name })
  },
}
