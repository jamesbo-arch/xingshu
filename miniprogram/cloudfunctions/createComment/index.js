const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { diaryId, parentId, content } = event
  if (!diaryId || !content) return { code: -1, msg: '缺少参数' }

  const [users] = await db.query('SELECT id, nickname FROM users WHERE openid = ?', [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }
  const userId = users[0].id

  const [result] = await db.query(
    'INSERT INTO comments (user_id, diary_id, parent_id, content, created_by) VALUES (?, ?, ?, ?, ?)',
    [userId, diaryId, parentId || null, content, userId]
  )

  if (!parentId) {
    await db.query('UPDATE diaries SET comment_count = comment_count + 1 WHERE id = ?', [diaryId])
  }

  const [comment] = await db.query(
    `SELECT c.*, u.nickname AS user_name, u.avatar_hue AS user_avatar_hue
     FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
    [result.insertId]
  )

  return { code: 0, data: comment[0] }
}
