const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 记录一次分享：share_count 采用"去重分享人"口径（与点赞/收藏一致，受
// interactions 唯一键 uk_user_target_action 约束——每位用户对同一日记至多计一次）。
// 首次分享插入 action='share' 互动行并 share_count+1；重复分享幂等不重复计数。
// 返回最新分享数。
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { diaryId } = event
  if (!diaryId) return { code: -1, msg: '缺少日记ID' }

  const [users] = await db.query('SELECT id FROM users WHERE openid = ?', [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }
  const userId = users[0].id

  // 目标日记须存在且未删除
  const [diaries] = await db.query('SELECT id FROM diaries WHERE id = ? AND status = ?', [diaryId, 'active'])
  if (!diaries.length) return { code: -1, msg: '日记不存在' }

  const [existing] = await db.query(
    'SELECT id FROM interactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND action = ?',
    [userId, 'diary', diaryId, 'share']
  )
  if (!existing.length) {
    await db.query(
      'INSERT INTO interactions (user_id, target_type, target_id, action, created_by) VALUES (?, ?, ?, ?, ?)',
      [userId, 'diary', diaryId, 'share', userId]
    )
    await db.query('UPDATE diaries SET share_count = share_count + 1 WHERE id = ?', [diaryId])
  }

  const [[row]] = await db.query('SELECT share_count FROM diaries WHERE id = ?', [diaryId])
  return { code: 0, data: { shares: row.share_count } }
}
