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
    // v2.3 微信登录：会员期内恢复 member，否则 authed；记录授权时间
    fields.push("identity = IF(member_until IS NOT NULL AND member_until > NOW(), 'member', 'authed')")
    fields.push('authorized_at = NOW()')
  } else if (logout) {
    // 退出登录：仅回退身份为 guest，保留 member_until/unionid，重新登录可恢复
    fields.push("identity = 'guest'")
  }

  if (!fields.length) return { code: -1, msg: 'nothing to update' }

  fields.push('updated_by = ?'); values.push(OPENID)
  values.push(OPENID)

  await db.query(`UPDATE users SET ${fields.join(', ')} WHERE openid = ?`, values)
  const [rows] = await db.query('SELECT * FROM users WHERE openid = ?', [OPENID])
  return { code: 0, data: rows[0] }
}
