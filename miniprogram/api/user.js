const { call } = require('./request')

module.exports = {
  login(nickname, scene) {
    return call('login', { nickname, scene })
  },
  getUserInfo() {
    return call('getUserInfo')
  },
  updateProfile(patch) {
    return call('updateUserProfile', patch)
  },
  checkMember() {
    return call('checkMemberStatus')
  },
  getPhoneNumber(code) {
    return call('getPhoneNumber', { code })
  },
}
