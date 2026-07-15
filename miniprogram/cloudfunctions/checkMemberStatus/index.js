const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  const [users] = await db.query('SELECT id, identity, member_until, DATEDIFF(member_until, CURDATE()) AS days_left FROM users WHERE openid = ?', [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }

  const user = users[0]
  // 两字段语义：identity 只存授权态，会员由 member_until 派生（到期当天 days_left=0 仍算会员，过期即回落 authed，不改写库）
  const validMember = user.identity !== 'guest' && user.member_until != null && user.days_left >= 0
  const identity = user.identity === 'guest' ? 'guest' : (validMember ? 'member' : 'authed')

  return { code: 0, data: { identity, memberUntil: user.member_until, daysLeft: Math.max(0, user.days_left || 0) } }
}
