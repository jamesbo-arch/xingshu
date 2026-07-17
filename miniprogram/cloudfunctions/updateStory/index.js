const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { storyId, title, content, contentRich, tags, publishStatus, images } = event
  if (!storyId) return { code: -1, msg: '缺少故事ID' }
  if (publishStatus !== undefined && !['draft', 'published'].includes(publishStatus)) {
    return { code: -1, msg: '无效的发布状态' }
  }

  const [users] = await db.query(
    "SELECT id, (identity <> 'guest' AND member_until IS NOT NULL AND member_until >= CURDATE()) AS validMember FROM users WHERE openid = ?",
    [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }
  const userId = users[0].id

  // 服务端兜底：编辑故事为会员专享（身份 member 且未过期），前端已拦截，防绕过
  if (!users[0].validMember) {
    return { code: -1, msg: '编辑故事是会员专享功能，请先开通会员' }
  }

  const [stories] = await db.query('SELECT * FROM stories WHERE id = ? AND user_id = ? AND status = ?', [storyId, userId, 'active'])
  if (!stories.length) return { code: -1, msg: '故事不存在或无权编辑' }

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const fields = [], values = []
    if (title !== undefined) { fields.push('title = ?'); values.push(title) }
    if (content !== undefined) { fields.push('content = ?'); values.push(content) }
    // 样式版与纯文本同步更新；只改 content 未带 contentRich 时清掉旧样式版，防陈旧样式盖新文
    if (contentRich !== undefined) { fields.push('content_rich = ?'); values.push(contentRich || null) }
    else if (content !== undefined) { fields.push('content_rich = NULL') }
    if (publishStatus !== undefined) { fields.push('publish_status = ?'); values.push(publishStatus) }
    if (images !== undefined) { fields.push('images = ?'); values.push(images && images.length ? JSON.stringify(images) : null) }
    // 内容类变更（标题/正文/标签/状态）置"已编辑"时间（与点赞/评论等互动 UPDATE 无关）
    if (title !== undefined || content !== undefined || publishStatus !== undefined || tags !== undefined) {
      fields.push('content_edited_at = NOW()')
    }
    fields.push('updated_by = ?'); values.push(userId)
    values.push(storyId)

    await conn.query(`UPDATE stories SET ${fields.join(', ')} WHERE id = ?`, values)

    if (tags !== undefined) {
      await conn.query('DELETE FROM story_tags WHERE story_id = ?', [storyId])
      for (const tagName of tags) {
        let [tagRows] = await conn.query('SELECT id FROM tags WHERE name = ?', [tagName])
        let tagId
        if (tagRows.length) {
          tagId = tagRows[0].id
        } else {
          const [newTag] = await conn.query('INSERT INTO tags (name, usage_count, created_by) VALUES (?, 0, ?)', [tagName, userId])
          tagId = newTag.insertId
        }
        await conn.query('INSERT INTO story_tags (story_id, tag_id, created_by) VALUES (?, ?, ?)', [storyId, tagId, userId])
      }
    }

    await conn.commit()
    const [story] = await db.query('SELECT * FROM stories WHERE id = ?', [storyId])
    return { code: 0, data: story[0] }
  } catch (err) {
    await conn.rollback()
    return { code: -1, msg: err.message }
  } finally {
    conn.release()
  }
}
