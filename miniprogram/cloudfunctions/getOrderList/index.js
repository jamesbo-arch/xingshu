const cloud = require('wx-server-sdk')
const db = require('../common/db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { page = 1, pageSize = 20 } = event

  const [users] = await db.query('SELECT id FROM users WHERE openid = ?', [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }
  const userId = users[0].id

  const offset = (page - 1) * pageSize
  const [countRows] = await db.query('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?', [userId])
  const total = countRows[0].total

  const [orders] = await db.query(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [userId, pageSize, offset]
  )

  return { code: 0, data: { list: orders, total, page, pageSize } }
}
