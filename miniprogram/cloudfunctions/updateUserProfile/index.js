const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { nickname, realName, phone, gender, avatarUrl, authorize, logout } = event

  const fields = [], values = []
  if (nickname !== undefined) { fields.push('nickname = ?'); values.push(nickname) }
  if (realName !== undefined) { fields.push('real_name = ?'); values.push(realName) }
  if (phone !== undefined) { fields.push('phone = ?'); values.push(phone) }
  if (gender !== undefined) { fields.push('gender = ?'); values.push(gender || null) }
  if (avatarUrl !== undefined) { fields.push('avatar_url = ?'); values.push(avatarUrl) }

  if (authorize) {
    // 两字段语义：identity 只存授权态（authed），会员与否由 member_until 派生（返回时计算，口径统一 >= CURDATE()）
    fields.push("identity = 'authed'")
    fields.push('authorized_at = NOW()')
  } else if (logout) {
    // 退出登录：仅回退授权态为 guest，保留 member_until/unionid，重新登录即恢复会员
    fields.push("identity = 'guest'")
  }

  if (!fields.length) return { code: -1, msg: 'nothing to update' }

  // updated_by 统一存用户表 id：本人操作，直接引用本行 id 列
  fields.push('updated_by = id')
  values.push(OPENID)

  await db.query(`UPDATE users SET ${fields.join(', ')} WHERE openid = ?`, values)
  const [rows] = await db.query(
    "SELECT *, (identity <> 'guest' AND member_until IS NOT NULL AND member_until >= CURDATE()) AS validMember FROM users WHERE openid = ?",
    [OPENID])
  const user = rows[0]
  // 对外 identity 返回派生三态（member 为派生值），前端判断口径不变
  user.identity = user.identity === 'guest' ? 'guest' : (user.validMember ? 'member' : 'authed')
  delete user.validMember
  return { code: 0, data: user }
}
