const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const [rows] = await db.query(
    "SELECT *, (identity='member' AND (member_until IS NULL OR member_until < CURDATE())) AS memberExpired FROM users WHERE openid = ?",
    [OPENID])
  if (!rows.length) return { code: -1, msg: 'user not found' }
  const user = rows[0]
  // 会员到期自愈：身份仍为 member 但 member_until 已过 → 回落 authed 并清空到期日
  if (user.memberExpired) {
    await db.query("UPDATE users SET identity = 'authed', member_until = NULL WHERE id = ?", [user.id])
    user.identity = 'authed'
    user.member_until = null
  }
  delete user.memberExpired
  return { code: 0, data: user }
}
