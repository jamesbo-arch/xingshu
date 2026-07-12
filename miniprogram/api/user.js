const { call } = require('./request')

module.exports = {
  // login 幂等（老用户仅 SELECT+刷 last_active），重试安全
  login(nickname, scene) {
    return call('login', { nickname, scene }, { retry: 1 })
  },
  getUserInfo() {
    return call('getUserInfo', {}, { retry: 1 })
  },
  updateProfile(patch) {
    return call('updateUserProfile', patch)
  },
  checkMember() {
    return call('checkMemberStatus')
  },
}
