const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { tagId, name, isActive } = event
  if (!tagId) return { code: -1, msg: '缺少标签ID' }

  const fields = [], values = []
  if (name !== undefined) { fields.push('name = ?'); values.push(name) }
  if (isActive !== undefined) { fields.push('is_active = ?'); values.push(isActive) }
  if (!fields.length) return { code: -1, msg: 'nothing to update' }

  fields.push('updated_by = ?'); values.push(OPENID)
  values.push(tagId)

  await db.query(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`, values)
  const [tag] = await db.query('SELECT * FROM tags WHERE id = ?', [tagId])
  return { code: 0, data: tag[0] }
}
