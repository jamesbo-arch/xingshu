const cloud = require('wx-server-sdk')
const db = require('../common/db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { diaryId } = event
  if (!diaryId) return { code: -1, msg: '缺少日记ID' }

  const [users] = await db.query('SELECT id, identity FROM users WHERE openid = ?', [OPENID])
  const userId = users.length ? users[0].id : null
  const userIdentity = users.length ? users[0].identity : 'guest'

  const [diaries] = await db.query(
    `SELECT d.*, u.nickname AS author_name, u.avatar_hue AS author_avatar_hue,
            u.identity AS author_identity
     FROM diaries d JOIN users u ON d.user_id = u.id
     WHERE d.id = ? AND d.status = ?`, [diaryId, 'active']
  )
  if (!diaries.length) return { code: -1, msg: '日记不存在' }

  const diary = diaries[0]
  if (diary.permission === 'member' && userIdentity !== 'member' && diary.user_id !== userId) {
    return { code: -2, msg: '需开通会员查看该日记' }
  }
  if (diary.permission === 'private' && diary.user_id !== userId) {
    return { code: -1, msg: '日记不存在' }
  }

  // Check like/fav status
  if (userId) {
    const [liked] = await db.query(
      'SELECT action FROM interactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND action = ?',
      [userId, 'diary', diaryId, 'like']
    )
    const [faved] = await db.query(
      'SELECT action FROM interactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND action = ?',
      [userId, 'diary', diaryId, 'favorite']
    )
    diary.isLiked = liked.length > 0
    diary.isFavorited = faved.length > 0
  }

  // Get tags
  const [tags] = await db.query(
    'SELECT t.name FROM tags t JOIN diary_tags dt ON t.id = dt.tag_id WHERE dt.diary_id = ?',
    [diaryId]
  )
  diary.tags = tags.map(t => t.name)

  return { code: 0, data: diary }
}
