const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { targetId, targetType } = event
  if (!targetId || !targetType) return { code: -1, msg: '缺少参数' }

  const [users] = await db.query('SELECT id FROM users WHERE openid = ?', [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }
  const userId = users[0].id

  const [existing] = await db.query(
    'SELECT id FROM interactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND action = ?',
    [userId, targetType, targetId, 'like']
  )

  if (existing.length) {
    await db.query('DELETE FROM interactions WHERE id = ?', [existing[0].id])
    await db.query(`UPDATE ${targetType === 'diary' ? 'diaries' : 'comments'} SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?`, [targetId])
    return { code: 0, data: { liked: false } }
  } else {
    await db.query(
      'INSERT INTO interactions (user_id, target_type, target_id, action, created_by) VALUES (?, ?, ?, ?, ?)',
      [userId, targetType, targetId, 'like', userId]
    )
    await db.query(`UPDATE ${targetType === 'diary' ? 'diaries' : 'comments'} SET like_count = like_count + 1 WHERE id = ?`, [targetId])
    return { code: 0, data: { liked: true } }
  }
}
