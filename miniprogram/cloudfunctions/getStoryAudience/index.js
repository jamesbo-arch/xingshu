const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 故事的读者/互动人员清单（作者视角，「我的故事」页卡片点击统计项时调用）
// type：read 阅读 / like 点赞 / favorite 收藏 / comment 评论
// 仅作者本人可查（清单含他人昵称，非作者一律 -1）
const TYPES = ['read', 'like', 'favorite', 'comment']

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { storyId, type, page = 1, pageSize = 20 } = event
  if (!storyId) return { code: -1, msg: '缺少故事ID' }
  if (!TYPES.includes(type)) return { code: -1, msg: '参数有误' }

  const [users] = await db.query("SELECT id FROM users WHERE openid = ? AND identity <> 'guest'", [OPENID])
  if (!users.length) return { code: -1, msg: '故事不存在' }
  const userId = users[0].id

  const [stories] = await db.query("SELECT user_id FROM stories WHERE id = ? AND status = 'active'", [storyId])
  if (!stories.length || stories[0].user_id !== userId) return { code: -1, msg: '故事不存在' }

  const offset = (page - 1) * pageSize
  let countSql
  let listSql
  const params = [storyId]

  if (type === 'read') {
    // 阅读记录含未登录读者（user_id 可为 NULL / 昵称为空），昵称兜底在前端展示层
    countSql = 'SELECT COUNT(*) AS total FROM story_reads WHERE story_id = ?'
    listSql = `SELECT sr.created_at, u.nickname AS user_name, u.avatar_hue AS user_avatar_hue
               FROM story_reads sr LEFT JOIN users u ON sr.user_id = u.id
               WHERE sr.story_id = ?
               ORDER BY sr.created_at DESC LIMIT ? OFFSET ?`
  } else if (type === 'comment') {
    // 评论清单含二级回复，按时间倒序平铺
    countSql = 'SELECT COUNT(*) AS total FROM comments WHERE story_id = ? AND is_deleted = 0'
    listSql = `SELECT c.created_at, c.content, u.nickname AS user_name, u.avatar_hue AS user_avatar_hue
               FROM comments c JOIN users u ON c.user_id = u.id
               WHERE c.story_id = ? AND c.is_deleted = 0
               ORDER BY c.created_at DESC LIMIT ? OFFSET ?`
  } else {
    countSql = "SELECT COUNT(*) AS total FROM interactions WHERE target_type = 'story' AND target_id = ? AND action = ?"
    listSql = `SELECT i.created_at, u.nickname AS user_name, u.avatar_hue AS user_avatar_hue
               FROM interactions i JOIN users u ON i.user_id = u.id
               WHERE i.target_type = 'story' AND i.target_id = ? AND i.action = ?
               ORDER BY i.created_at DESC LIMIT ? OFFSET ?`
    params.push(type)
  }

  const [[countRows], [rows]] = await Promise.all([
    db.query(countSql, params),
    db.query(listSql, [...params, pageSize, offset]),
  ])

  return { code: 0, data: { list: rows, total: countRows[0].total, page, pageSize } }
}
