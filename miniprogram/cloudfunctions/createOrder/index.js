const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  // 管理员权限校验
  const [admin] = await db.query(
    'SELECT id FROM users WHERE openid = ? AND identity = ?',
    [OPENID, 'member']
  )
  if (!admin.length) return { code: -1, msg: '无管理员权限' }

  const { userId, amount, plan, method, note } = event
  if (!userId || !amount) return { code: -1, msg: '缺少参数' }
  if (isNaN(amount) || amount <= 0) return { code: -1, msg: '金额无效' }

  // 验证目标用户存在
  const [target] = await db.query('SELECT id FROM users WHERE id = ?', [userId])
  if (!target.length) return { code: -1, msg: '用户不存在' }

  const orderId = 'XS-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0')

  await db.query(
    `INSERT INTO orders (id, user_id, amount, plan, method, status, note, created_by)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [orderId, userId, amount, plan || '年度会员', method || '线下转账', note || '', OPENID]
  )

  const [order] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId])
  return { code: 0, data: order[0] }
}
