const cloud = require('wx-server-sdk')
const db = require('../common/db')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  const [rows] = await db.query('SELECT * FROM users WHERE openid = ?', [OPENID])

  if (rows.length > 0) {
    const user = rows[0]
    await db.query('UPDATE users SET last_active = NOW() WHERE id = ?', [user.id])
    return { code: 0, data: user }
  }

  const [result] = await db.query(
    `INSERT INTO users (openid, nickname, identity, avatar_hue, created_by)
     VALUES (?, ?, 'guest', ?, ?)`,
    [OPENID, event.nickname || '微信用户', event.avatarHue || 60, OPENID]
  )

  const [newUser] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId])
  return { code: 0, data: newUser[0] }
}
