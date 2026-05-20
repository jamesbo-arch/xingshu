const cloud = require('wx-server-sdk')
const db = require('../common/db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { diaryId } = event
  if (!diaryId) return { code: -1, msg: '缺少日记ID' }

  const [users] = await db.query('SELECT id FROM users WHERE openid = ?', [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }
  const userId = users[0].id

  const [existing] = await db.query(
    'SELECT id FROM interactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND action = ?',
    [userId, 'diary', diaryId, 'favorite']
  )

  if (existing.length) {
    await db.query('DELETE FROM interactions WHERE id = ?', [existing[0].id])
    await db.query('UPDATE diaries SET fav_count = GREATEST(fav_count - 1, 0) WHERE id = ?', [diaryId])
    return { code: 0, data: { favorited: false } }
  } else {
    await db.query(
      'INSERT INTO interactions (user_id, target_type, target_id, action, created_by) VALUES (?, ?, ?, ?, ?)',
      [userId, 'diary', diaryId, 'favorite', userId]
    )
    await db.query('UPDATE diaries SET fav_count = fav_count + 1 WHERE id = ?', [diaryId])
    return { code: 0, data: { favorited: true } }
  }
}
