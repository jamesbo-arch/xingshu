const cloud = require('wx-server-sdk')
const db = require('../common/db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { diaryId, title, content, tags, permission } = event
  if (!diaryId) return { code: -1, msg: '缺少日记ID' }

  const [users] = await db.query('SELECT id FROM users WHERE openid = ?', [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }
  const userId = users[0].id

  const [diaries] = await db.query('SELECT * FROM diaries WHERE id = ? AND user_id = ? AND status = ?', [diaryId, userId, 'active'])
  if (!diaries.length) return { code: -1, msg: '日记不存在或无权编辑' }

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const fields = [], values = []
    if (title !== undefined) { fields.push('title = ?'); values.push(title) }
    if (content !== undefined) { fields.push('content = ?'); values.push(content) }
    if (permission !== undefined) { fields.push('permission = ?'); values.push(permission) }
    fields.push('updated_by = ?'); values.push(userId)
    values.push(diaryId)

    await conn.query(`UPDATE diaries SET ${fields.join(', ')} WHERE id = ?`, values)

    if (tags !== undefined) {
      await conn.query('DELETE FROM diary_tags WHERE diary_id = ?', [diaryId])
      for (const tagName of tags) {
        let [tagRows] = await conn.query('SELECT id FROM tags WHERE name = ?', [tagName])
        let tagId
        if (tagRows.length) {
          tagId = tagRows[0].id
        } else {
          const [newTag] = await conn.query('INSERT INTO tags (name, usage_count, created_by) VALUES (?, 0, ?)', [tagName, userId])
          tagId = newTag.insertId
        }
        await conn.query('INSERT INTO diary_tags (diary_id, tag_id, created_by) VALUES (?, ?, ?)', [diaryId, tagId, userId])
      }
    }

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
