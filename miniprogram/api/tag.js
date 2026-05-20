const { call } = require('./request')

module.exports = {
  getAll() {
    return call('getTags')
  },
  add(name) {
    return call('addTag', { name })
  },
}
