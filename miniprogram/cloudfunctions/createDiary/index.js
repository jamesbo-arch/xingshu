const cloud = require('wx-server-sdk')
const db = require('../common/db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { title, content, tags, permission } = event
  if (!title || !content) return { code: -1, msg: '标题和内容不能为空' }

  const [users] = await db.query('SELECT id FROM users WHERE openid = ?', [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }
  const userId = users[0].id

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [result] = await conn.query(
      `INSERT INTO diaries (user_id, title, content, permission, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, content, permission || 'public', userId]
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
