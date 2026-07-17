const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { storyId } = event
  if (!storyId) return { code: -1, msg: '缺少故事ID' }

  const [users] = await db.query('SELECT id FROM users WHERE openid = ?', [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }
  const userId = users[0].id

  const [stories] = await db.query('SELECT id FROM stories WHERE id = ? AND user_id = ? AND status = ?', [storyId, userId, 'active'])
  if (!stories.length) return { code: -1, msg: '故事不存在或无权删除' }

  // 软删 + 善选联动：原故事删除后善选副本同步下架（公众侧消失）
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query('UPDATE stories SET status = ?, is_featured = 0 WHERE id = ?', ['deleted', storyId])
    await conn.query("UPDATE featured_stories SET status = 'offline' WHERE story_id = ?", [storyId])
    await conn.query('UPDATE users SET story_count = GREATEST(story_count - 1, 0) WHERE id = ?', [userId])
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    return { code: -1, msg: err.message }
  } finally {
    conn.release()
  }
  return { code: 0, msg: '删除成功' }
}
