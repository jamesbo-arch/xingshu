const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { commentId } = event
  if (!commentId) return { code: -1, msg: '缺少评论ID' }

  const [users] = await db.query('SELECT id FROM users WHERE openid = ?', [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }
  const userId = users[0].id

  const [comments] = await db.query('SELECT * FROM comments WHERE id = ? AND is_deleted = 0', [commentId])
  if (!comments.length) return { code: -1, msg: '评论不存在' }
  if (comments[0].user_id !== userId) return { code: -1, msg: '无权删除' }

  await db.query('UPDATE comments SET is_deleted = 1 WHERE id = ?', [commentId])

  if (!comments[0].parent_id) {
    await db.query('UPDATE stories SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?', [comments[0].story_id])
  }

  return { code: 0, msg: '删除成功' }
}
