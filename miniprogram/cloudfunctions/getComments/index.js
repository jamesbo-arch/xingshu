const cloud = require('wx-server-sdk')
const db = require('../common/db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { diaryId, page = 1, pageSize = 20 } = event
  if (!diaryId) return { code: -1, msg: '缺少日记ID' }

  const [users] = await db.query('SELECT id FROM users WHERE openid = ?', [OPENID])
  const userId = users.length ? users[0].id : null

  const offset = (page - 1) * pageSize
  const [countRows] = await db.query(
    'SELECT COUNT(*) AS total FROM comments WHERE diary_id = ? AND parent_id IS NULL AND is_deleted = 0',
    [diaryId]
  )
  const total = countRows[0].total

  const [comments] = await db.query(
    `SELECT c.*, u.nickname AS user_name, u.avatar_hue AS user_avatar_hue
     FROM comments c JOIN users u ON c.user_id = u.id
     WHERE c.diary_id = ? AND c.parent_id IS NULL AND c.is_deleted = 0
     ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
    [diaryId, pageSize, offset]
  )

  // fetch replies for each comment
  for (const comment of comments) {
    const [replies] = await db.query(
      `SELECT c.*, u.nickname AS user_name, u.avatar_hue AS user_avatar_hue
       FROM comments c JOIN users u ON c.user_id = u.id
       WHERE c.parent_id = ? AND c.is_deleted = 0 ORDER BY c.created_at ASC`,
      [comment.id]
    )
    comment.replies = replies
    comment.isMine = userId ? comment.user_id === userId : false
  }

  return { code: 0, data: { list: comments, total, page, pageSize } }
}
