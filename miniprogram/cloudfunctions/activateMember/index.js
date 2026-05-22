const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { orderId } = event
  if (!orderId) return { code: -1, msg: '缺少订单ID' }

  // 管理员权限校验
  const [admin] = await db.query(
    'SELECT id FROM users WHERE openid = ? AND identity = ?',
    [OPENID, 'member']
  )
  if (!admin.length) return { code: -1, msg: '无管理员权限' }

  const [orders] = await db.query('SELECT * FROM orders WHERE id = ? AND status = ?', [orderId, 'pending'])
  if (!orders.length) return { code: -1, msg: '订单不存在或状态异常' }

  const order = orders[0]
  const validFrom = new Date().toISOString().slice(0, 10)
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  const validUntil = d.toISOString().slice(0, 10)

  await db.query(
    "UPDATE users SET identity = 'member', member_from = ?, member_until = ?, updated_by = ? WHERE id = ?",
    [validFrom, validUntil, OPENID, order.user_id]
  )
  await db.query(
    "UPDATE orders SET status = 'paid', valid_from = ?, valid_until = ?, updated_by = ? WHERE id = ?",
    [validFrom, validUntil, OPENID, orderId]
  )

  const [user] = await db.query('SELECT * FROM users WHERE id = ?', [order.user_id])
  return { code: 0, data: user[0] }
}
