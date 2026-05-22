const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { nickname, realName, phone, avatarUrl, upgradeToAuthed } = event

  const fields = [], values = []
  if (nickname !== undefined) { fields.push('nickname = ?'); values.push(nickname) }
  if (realName !== undefined) { fields.push('real_name = ?'); values.push(realName) }
  if (phone !== undefined) { fields.push('phone = ?'); values.push(phone) }
  if (avatarUrl !== undefined) { fields.push('avatar_url = ?'); values.push(avatarUrl) }

  if (upgradeToAuthed) {
    // only upgrade guest → authed, never downgrade
    fields.push("identity = IF(identity = 'guest', 'authed', identity)")
  }

  if (!fields.length) return { code: -1, msg: 'nothing to update' }

  fields.push('updated_by = ?'); values.push(OPENID)
  values.push(OPENID)

  await db.query(`UPDATE users SET ${fields.join(', ')} WHERE openid = ?`, values)
  const [rows] = await db.query('SELECT * FROM users WHERE openid = ?', [OPENID])
  return { code: 0, data: rows[0] }
}
