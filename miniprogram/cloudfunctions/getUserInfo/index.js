const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const [rows] = await db.query('SELECT * FROM users WHERE openid = ?', [OPENID])
  if (!rows.length) return { code: -1, msg: 'user not found' }
  return { code: 0, data: rows[0] }
}
