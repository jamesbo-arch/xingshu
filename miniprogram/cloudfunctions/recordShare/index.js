const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 记录一次分享：share_count 采用"去重分享人"口径（与点赞/收藏一致，受
// interactions 唯一键 uk_user_target_action 约束——每位用户对同一故事至多计一次）。
// 首次分享插入 action='share' 互动行并 share_count+1；重复分享幂等不重复计数。
// 返回最新分享数。
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { storyId } = event
  if (!storyId) return { code: -1, msg: '缺少故事ID' }

  const [users] = await db.query('SELECT id FROM users WHERE openid = ?', [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }
  const userId = users[0].id

  // 目标故事须存在且未删除
  const [stories] = await db.query('SELECT id FROM stories WHERE id = ? AND status = ?', [storyId, 'active'])
  if (!stories.length) return { code: -1, msg: '故事不存在' }

  const [existing] = await db.query(
    'SELECT id FROM interactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND action = ?',
    [userId, 'story', storyId, 'share']
  )
  if (!existing.length) {
    await db.query(
      'INSERT INTO interactions (user_id, target_type, target_id, action, created_by) VALUES (?, ?, ?, ?, ?)',
      [userId, 'story', storyId, 'share', userId]
    )
    await db.query('UPDATE stories SET share_count = share_count + 1 WHERE id = ?', [storyId])
  }

  const [[row]] = await db.query('SELECT share_count FROM stories WHERE id = ?', [storyId])
  return { code: 0, data: { shares: row.share_count } }
}
