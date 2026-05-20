const cloud = require('wx-server-sdk')
const db = require('../common/db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { name } = event
  if (!name || !name.trim()) return { code: -1, msg: '标签名不能为空' }
  if (name.length > 16) return { code: -1, msg: '标签名最长16字' }

  try {
    const [result] = await db.query('INSERT INTO tags (name, created_by) VALUES (?, ?)', [name.trim(), OPENID])
    return { code: 0, data: { id: result.insertId, name: name.trim() } }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return { code: -1, msg: '标签已存在' }
    return { code: -1, msg: err.message }
  }
}
