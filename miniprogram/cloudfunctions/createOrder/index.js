const cloud = require('wx-server-sdk')
const db = require('../common/db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  // 管理员权限校验 — 此处简化，后续 Phase 4 正式实现
  const [admin] = await db.query('SELECT id FROM users WHERE openid = ? AND identity = ?', [OPENID, 'member'])
  // 创建订单（线下转账模式，管理员手动创建）
  const { userId, amount, plan, method, note } = event
  if (!userId || !amount) return { code: -1, msg: '缺少参数' }

  const orderId = 'XS-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0')

  await db.query(
    `INSERT INTO orders (id, user_id, amount, plan, method, status, note, created_by)
     VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)`,
    [orderId, userId, amount, plan || '年度会员', method || '线下转账', note || '', OPENID]
  )

  const [order] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId])
  return { code: 0, data: order[0] }
}
