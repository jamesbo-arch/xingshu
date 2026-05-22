const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const [tags] = await db.query(
    'SELECT name FROM tags WHERE is_active = 1 ORDER BY usage_count DESC, name ASC'
  )
  return { code: 0, data: tags.map(t => t.name) }
}
