const cloud = require('wx-server-sdk')
const db = require('../common/db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { mode, keyword, tag, author, permission, page = 1, pageSize = 20 } = event

  let where = 'WHERE d.status = ?'
  const params = ['active']

  if (mode === 'mine') {
    const [users] = await db.query('SELECT id FROM users WHERE openid = ?', [OPENID])
    if (!users.length) return { code: -1, msg: 'user not found' }
    where += ' AND d.user_id = ?'
    params.push(users[0].id)
  } else {
    const [users] = await db.query('SELECT id, identity FROM users WHERE openid = ?', [OPENID])
    const userIdentity = users.length ? users[0].identity : 'guest'
    const userId = users.length ? users[0].id : null

    if (mode === 'collections') {
      where += ' AND d.id IN (SELECT target_id FROM interactions WHERE user_id = ? AND target_type = ? AND action = ?)'
      params.push(userId, 'diary', 'favorite')
    } else {
      // square: exclude private diaries of other users
      if (userId) {
        where += ' AND (d.permission != ? OR d.user_id = ?)'
        params.push('private', userId)
      } else {
        where += ' AND d.permission = ?'
        params.push('public')
      }
      // member check
      if (userIdentity !== 'member') {
        where += ' AND d.permission != ?'
        params.push('member')
      }
    }
  }

  if (keyword) {
    where += ' AND (d.title LIKE ? OR d.content LIKE ?)'
    params.push(`%${keyword}%`, `%${keyword}%`)
  }
  if (tag) {
    where += ' AND d.id IN (SELECT dt.diary_id FROM diary_tags dt JOIN tags t ON dt.tag_id = t.id WHERE t.name = ?)'
    params.push(tag)
  }
  if (author) {
    where += ' AND d.user_id IN (SELECT id FROM users WHERE nickname LIKE ?)'
    params.push(`%${author}%`)
  }
  if (permission) {
    where += ' AND d.permission = ?'
    params.push(permission)
  }

  const offset = (page - 1) * pageSize
  const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM diaries d ${where}`, params)
  const total = countRows[0].total

  const [diaries] = await db.query(
    `SELECT d.*, u.nickname AS author_name, u.avatar_hue AS author_avatar_hue,
            u.identity AS author_identity
     FROM diaries d
     JOIN users u ON d.user_id = u.id
     ${where}
     ORDER BY d.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  return { code: 0, data: { list: diaries, total, page, pageSize } }
}
