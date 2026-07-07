const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  const [users] = await db.query('SELECT id, identity, member_until, DATEDIFF(member_until, CURDATE()) AS days_left FROM users WHERE openid = ?', [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }

  const user = users[0]
  // 有效期"过了"才降级：member_until < 今天（days_left < 0）；到期当天仍算会员
  if (user.identity === 'member' && user.days_left < 0) {
    await db.query("UPDATE users SET identity = 'authed', member_until = NULL WHERE id = ?", [user.id])
    user.identity = 'authed'
    user.member_until = null
    user.days_left = 0
  }

  return { code: 0, data: { identity: user.identity, memberUntil: user.member_until, daysLeft: Math.max(0, user.days_left || 0) } }
}
