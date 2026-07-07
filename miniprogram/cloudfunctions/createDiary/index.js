const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { title, content, tags, permission, images } = event
  if (!title || !content) return { code: -1, msg: '标题和内容不能为空' }

  const [users] = await db.query(
    "SELECT id, (identity='member' AND member_until IS NOT NULL AND member_until >= CURDATE()) AS validMember FROM users WHERE openid = ?",
    [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }
  const userId = users[0].id

  // 服务端兜底：仅有效会员（身份 member 且未过期）可发布「会员专属」日记（前端已置灰，防绕过）
  if (permission === 'member' && !users[0].validMember) {
    return { code: -1, msg: '仅会员可发布会员专属日记' }
  }

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [result] = await conn.query(
      `INSERT INTO diaries (user_id, title, content, images, permission, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, title, content, images && images.length ? JSON.stringify(images) : null, permission || 'public', userId]
    )
    const diaryId = result.insertId

    if (tags && tags.length) {
      for (const tagName of tags) {
        let [tagRows] = await conn.query('SELECT id FROM tags WHERE name = ?', [tagName])
        let tagId
        if (tagRows.length) {
          tagId = tagRows[0].id
          await conn.query('UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?', [tagId])
        } else {
          const [newTag] = await conn.query(
            'INSERT INTO tags (name, usage_count, created_by) VALUES (?, 1, ?)',
            [tagName, userId]
          )
          tagId = newTag.insertId
        }
        await conn.query('INSERT INTO diary_tags (diary_id, tag_id, created_by) VALUES (?, ?, ?)', [diaryId, tagId, userId])
      }
    }

    await conn.query('UPDATE users SET diary_count = diary_count + 1 WHERE id = ?', [userId])
    await conn.commit()

    const [diary] = await db.query('SELECT * FROM diaries WHERE id = ?', [diaryId])
    return { code: 0, data: diary[0] }
  } catch (err) {
    await conn.rollback()
    return { code: -1, msg: err.message }
  } finally {
    conn.release()
  }
}
