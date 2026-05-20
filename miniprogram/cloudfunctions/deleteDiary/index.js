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

  const [diaries] = await db.query('SELECT id FROM diaries WHERE id = ? AND user_id = ? AND status = ?', [diaryId, userId, 'active'])
  if (!diaries.length) return { code: -1, msg: '日记不存在或无权删除' }

  await db.query('UPDATE diaries SET status = ? WHERE id = ?', ['deleted', diaryId])
  await db.query('UPDATE users SET diary_count = GREATEST(diary_count - 1, 0) WHERE id = ?', [userId])
  return { code: 0, msg: '删除成功' }
}
