const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { diaryId, title, content, tags, permission, images } = event
  if (!diaryId) return { code: -1, msg: '缺少日记ID' }

  const [users] = await db.query('SELECT id, identity FROM users WHERE openid = ?', [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }
  const userId = users[0].id

  // 服务端兜底：仅会员可将日记设为「会员专属」（前端已置灰，防绕过）
  if (permission === 'member' && users[0].identity !== 'member') {
    return { code: -1, msg: '仅会员可发布会员专属日记' }
  }

  const [diaries] = await db.query('SELECT * FROM diaries WHERE id = ? AND user_id = ? AND status = ?', [diaryId, userId, 'active'])
  if (!diaries.length) return { code: -1, msg: '日记不存在或无权编辑' }

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const fields = [], values = []
    if (title !== undefined) { fields.push('title = ?'); values.push(title) }
    if (content !== undefined) { fields.push('content = ?'); values.push(content) }
    if (permission !== undefined) { fields.push('permission = ?'); values.push(permission) }
    if (images !== undefined) { fields.push('images = ?'); values.push(images && images.length ? JSON.stringify(images) : null) }
    // 内容类变更（标题/正文/标签/权限）置"已编辑"时间（与点赞/评论等互动 UPDATE 无关）
    if (title !== undefined || content !== undefined || permission !== undefined || tags !== undefined) {
      fields.push('content_edited_at = NOW()')
    }
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
