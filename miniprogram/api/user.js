const { call } = require('./request')

module.exports = {
  login(nickname) {
    return call('login', { nickname })
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
}
