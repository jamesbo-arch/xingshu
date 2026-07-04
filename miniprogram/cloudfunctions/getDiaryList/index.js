const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { mode, keyword, tag, author, permission, page = 1, pageSize = 20 } = event

  let where = 'WHERE d.status = ?'
  const params = ['active']

  let userId = null
  let userIdentity = 'guest'

  if (mode === 'mine') {
    const [users] = await db.query('SELECT id FROM users WHERE openid = ?', [OPENID])
    if (!users.length) return { code: -1, msg: 'user not found' }
    userId = users[0].id
    where += ' AND d.user_id = ?'
    params.push(userId)
  } else {
    const [users] = await db.query('SELECT id, identity FROM users WHERE openid = ?', [OPENID])
    userIdentity = users.length ? users[0].identity : 'guest'
    userId = users.length ? users[0].id : null

    if (mode === 'collections') {
      where += ' AND d.id IN (SELECT target_id FROM interactions WHERE user_id = ? AND target_type = ? AND action = ?)'
      params.push(userId, 'diary', 'favorite')
    } else {
      // square（v2.1 矩阵）：所有身份可见公众+会员日记的卡片，仅排除他人私密；
      // 无完整阅读权的行在返回前截断为摘要（见下方 EXCERPT 处理）
      if (userId) {
        where += ' AND (d.permission != ? OR d.user_id = ?)'
        params.push('private', userId)
      } else {
        where += ' AND d.permission != ?'
        params.push('private')
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

  // 时间筛选（三选一模式：quick 快捷 / range 起止日期 / ym 年月）——按 d.created_at
  const { timeMode, quickRange, dateFrom, dateTo, years, months } = event
  if (timeMode === 'quick' && quickRange && quickRange !== 'all') {
    const QUICK = {
      today:        'DATE(d.created_at) = CURDATE()',
      yesterday:    'DATE(d.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)',
      week:         'd.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)',
      month:        'YEAR(d.created_at)=YEAR(CURDATE()) AND MONTH(d.created_at)=MONTH(CURDATE())',
      'last-month': 'YEAR(d.created_at)=YEAR(DATE_SUB(CURDATE(),INTERVAL 1 MONTH)) AND MONTH(d.created_at)=MONTH(DATE_SUB(CURDATE(),INTERVAL 1 MONTH))',
      'half-year':  'd.created_at >= DATE_SUB(CURDATE(), INTERVAL 183 DAY)',
      year:         'd.created_at >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)',
    }
    if (QUICK[quickRange]) where += ' AND (' + QUICK[quickRange] + ')'
  } else if (timeMode === 'range') {
    if (dateFrom) { where += ' AND DATE(d.created_at) >= ?'; params.push(dateFrom) }
    if (dateTo)   { where += ' AND DATE(d.created_at) <= ?'; params.push(dateTo) }
  } else if (timeMode === 'ym') {
    const ys = (years || []).map(Number).filter(n => n)
    const ms = (months || []).map(Number).filter(n => n >= 1 && n <= 12)
    if (ys.length) { where += ` AND YEAR(d.created_at) IN (${ys.map(() => '?').join(',')})`; params.push(...ys) }
    if (ms.length) { where += ` AND MONTH(d.created_at) IN (${ms.map(() => '?').join(',')})`; params.push(...ms) }
  }

  const offset = (page - 1) * pageSize
  const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM diaries d ${where}`, params)
  const total = countRows[0].total

  // isLiked / isFavorited subqueries (only when user is logged in)
  const likedSql = userId
    ? `EXISTS(SELECT 1 FROM interactions WHERE user_id=? AND target_type='diary' AND target_id=d.id AND action='like') AS isLiked,
       EXISTS(SELECT 1 FROM interactions WHERE user_id=? AND target_type='diary' AND target_id=d.id AND action='favorite') AS isFavorited,`
    : `0 AS isLiked, 0 AS isFavorited,`
  const likedParams = userId ? [userId, userId] : []

  const [diaries] = await db.query(
    `SELECT d.*, u.nickname AS author_name, u.avatar_hue AS author_avatar_hue,
            u.identity AS author_identity,
            ${likedSql}
            GROUP_CONCAT(t.name ORDER BY t.name SEPARATOR ',') AS tags_csv
     FROM diaries d
     JOIN users u ON d.user_id = u.id
     LEFT JOIN diary_tags dt ON dt.diary_id = d.id
     LEFT JOIN tags t ON t.id = dt.tag_id
     ${where}
     GROUP BY d.id
     ORDER BY d.created_at DESC
     LIMIT ? OFFSET ?`,
    [...likedParams, ...params, pageSize, offset]
  )

  // v2.1 内容墙：无完整阅读权的行截断为摘要，防止列表接口泄露全文
  const EXCERPT_LEN = 80
  const canReadFull = (d) => {
    if (userId && d.user_id === userId) return true
    if (userIdentity === 'member') return true
    if (userIdentity === 'authed') return d.permission === 'public'
    return false // guest：一律摘要
  }

  const list = diaries.map(d => {
    const tags = d.tags_csv ? d.tags_csv.split(',') : []
    delete d.tags_csv
    const row = { ...d, tags, isLiked: d.isLiked === 1, isFavorited: d.isFavorited === 1 }
    if (!canReadFull(d)) {
      row.content = (d.content || '').slice(0, EXCERPT_LEN)
      row.excerpt = true
    }
    return row
  })

  return { code: 0, data: { list, total, page, pageSize } }
}
