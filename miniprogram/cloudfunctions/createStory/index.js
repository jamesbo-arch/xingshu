const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { title, content, contentRich, tags, publishStatus, images } = event
  if (!title || !content) return { code: -1, msg: '标题和内容不能为空' }
  // 两态：暂存(draft) / 发布(published)，发布后默认仅会员可见（公众可见性由后台善选决定）
  const status = publishStatus || 'published'
  if (!['draft', 'published'].includes(status)) return { code: -1, msg: '无效的发布状态' }

  const [users] = await db.query(
    "SELECT id, (identity <> 'guest' AND member_until IS NOT NULL AND member_until >= CURDATE()) AS validMember FROM users WHERE openid = ?",
    [OPENID])
  if (!users.length) return { code: -1, msg: 'user not found' }
  const userId = users[0].id

  // 服务端兜底：写故事为会员专享（身份 member 且未过期），前端已拦截，防绕过
  if (!users[0].validMember) {
    return { code: -1, msg: '写故事是会员专享功能，请先开通会员' }
  }

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [result] = await conn.query(
      `INSERT INTO stories (user_id, title, content, content_rich, images, publish_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, title, content, contentRich || null, images && images.length ? JSON.stringify(images) : null, status, userId]
    )
    const storyId = result.insertId

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
        await conn.query('INSERT INTO story_tags (story_id, tag_id, created_by) VALUES (?, ?, ?)', [storyId, tagId, userId])
      }
    }

    await conn.query('UPDATE users SET story_count = story_count + 1 WHERE id = ?', [userId])
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
