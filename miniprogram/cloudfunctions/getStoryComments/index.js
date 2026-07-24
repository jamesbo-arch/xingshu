const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { storyId, page = 1, pageSize = 20 } = event
  if (!storyId) return { code: -1, msg: '缺少故事ID' }

  const offset = (page - 1) * pageSize
  // 用户、总数、当前页一级评论三条查询互相独立，并行执行（连接池支持并发）
  const [[users], [countRows], [comments]] = await Promise.all([
    db.query('SELECT id FROM users WHERE openid = ?', [OPENID]),
    db.query(
      'SELECT COUNT(*) AS total FROM comments WHERE story_id = ? AND parent_id IS NULL AND is_deleted = 0',
      [storyId]
    ),
    db.query(
      `SELECT c.*, u.nickname AS user_name, u.avatar_hue AS user_avatar_hue
       FROM comments c JOIN users u ON c.user_id = u.id
       WHERE c.story_id = ? AND c.parent_id IS NULL AND c.is_deleted = 0
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      [storyId, pageSize, offset]
    ),
  ])
  const userId = users.length ? users[0].id : null
  const total = countRows[0].total

  // 一次性取本页所有一级评论的回复（parent_id IN (...)），避免逐条 N+1 查询
  const ids = comments.map(c => c.id)
  const repliesByParent = {}
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',')
    const [replies] = await db.query(
      `SELECT c.*, u.nickname AS user_name, u.avatar_hue AS user_avatar_hue
       FROM comments c JOIN users u ON c.user_id = u.id
       WHERE c.parent_id IN (${placeholders}) AND c.is_deleted = 0
       ORDER BY c.created_at ASC`,
      ids
    )
    for (const r of replies) {
      const mapped = { ...r, isMine: userId ? r.user_id === userId : false }
      ;(repliesByParent[r.parent_id] = repliesByParent[r.parent_id] || []).push(mapped)
    }
  }
  for (const comment of comments) {
    comment.replies = repliesByParent[comment.id] || []
    comment.isMine = userId ? comment.user_id === userId : false
  }

  return { code: 0, data: { list: comments, total, page, pageSize } }
}
