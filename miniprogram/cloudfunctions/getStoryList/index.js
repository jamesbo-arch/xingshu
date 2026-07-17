const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 故事列表（v3.0 善选版）
// mode=mine：作者旁路，返回自己全部故事（含 draft）
// mode=square/collections：member → 已发布故事全文；非会员（含未登录 guest）→ 仅善选故事（展示善选副本全文）
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { mode, keyword, tag, author, page = 1, pageSize = 20 } = event

  let userId = null
  let userIdentity = 'guest'

  if (mode === 'mine') {
    const [users] = await db.query('SELECT id FROM users WHERE openid = ?', [OPENID])
    if (!users.length) return { code: -1, msg: 'user not found' }
    userId = users[0].id
  } else {
    // 两字段语义：identity 存授权态，会员资格由 member_until 派生（过期即按 authed，无自愈依赖）
    const [users] = await db.query(
      "SELECT id, identity, (identity <> 'guest' AND member_until IS NOT NULL AND member_until >= CURDATE()) AS validMember FROM users WHERE openid = ?",
      [OPENID])
    userIdentity = (!users.length || users[0].identity === 'guest') ? 'guest'
      : (users[0].validMember ? 'member' : 'authed')
    // 退出登录即回游客视角：互动态（点赞/收藏）一律按授权态取，退出态不带出历史标记
    userId = (users.length && userIdentity !== 'guest') ? users[0].id : null
  }

  // 非会员（guest/authed）的广场与收藏走善选视图：只见 featured_stories 上架副本
  const featuredView = mode !== 'mine' && userIdentity !== 'member'

  let where = "WHERE d.status = 'active'"
  const params = []

  if (mode === 'mine') {
    where += ' AND d.user_id = ?'
    params.push(userId)
  } else if (featuredView) {
    where += " AND f.status = 'online' AND d.publish_status = 'published'"
    if (mode === 'collections') {
      if (!userId) return { code: 0, data: { list: [], total: 0, page, pageSize } }
      where += " AND d.id IN (SELECT target_id FROM interactions WHERE user_id = ? AND target_type = 'story' AND action = 'favorite')"
      params.push(userId)
    }
  } else {
    // member 视角：全部已发布故事；收藏列表放行自己的（含 draft 回撤后仍可见自己的）
    if (mode === 'collections') {
      where += " AND d.id IN (SELECT target_id FROM interactions WHERE user_id = ? AND target_type = 'story' AND action = 'favorite')"
      params.push(userId)
      where += " AND (d.publish_status = 'published' OR d.user_id = ?)"
      params.push(userId)
    } else {
      where += " AND d.publish_status = 'published'"
    }
  }

  if (keyword) {
    // 顶部搜索：标题 / 正文 / 作者昵称——善选视图搜副本内容（所见即所搜）
    const titleCol = featuredView ? 'f.title' : 'd.title'
    const contentCol = featuredView ? 'f.content' : 'd.content'
    where += ` AND (${titleCol} LIKE ? OR ${contentCol} LIKE ? OR d.user_id IN (SELECT id FROM users WHERE nickname LIKE ?))`
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }
  if (tag) {
    where += ' AND d.id IN (SELECT st.story_id FROM story_tags st JOIN tags t ON st.tag_id = t.id WHERE t.name = ?)'
    params.push(tag)
  }
  if (author) {
    where += ' AND d.user_id IN (SELECT id FROM users WHERE nickname LIKE ?)'
    params.push(`%${author}%`)
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

  // 善选视图：内容字段取副本（管理员修订版），id/计数/作者/时间仍取原故事（互动共享原故事）
  const from = featuredView
    ? 'featured_stories f JOIN stories d ON f.story_id = d.id'
    : 'stories d'
  const fields = featuredView
    ? `d.id, d.user_id, d.created_at, d.publish_status,
       d.like_count, d.fav_count, d.comment_count, d.share_count,
       f.title AS title, f.content AS content, f.images AS images, 1 AS is_featured,`
    : 'd.*,'

  const offset = (page - 1) * pageSize
  const [countRows] = await db.query(`SELECT COUNT(DISTINCT d.id) AS total FROM ${from} ${where}`, params)
  const total = countRows[0].total

  // isLiked / isFavorited subqueries (only when user is logged in)
  const likedSql = userId
    ? `EXISTS(SELECT 1 FROM interactions WHERE user_id=? AND target_type='story' AND target_id=d.id AND action='like') AS isLiked,
       EXISTS(SELECT 1 FROM interactions WHERE user_id=? AND target_type='story' AND target_id=d.id AND action='favorite') AS isFavorited,`
    : `0 AS isLiked, 0 AS isFavorited,`
  const likedParams = userId ? [userId, userId] : []

  const [rows] = await db.query(
    `SELECT ${fields}
            u.nickname AS author_name, u.avatar_hue AS author_avatar_hue,
            IF(u.member_until IS NOT NULL AND u.member_until >= CURDATE(), 'member', 'authed') AS author_identity,
            ${likedSql}
            GROUP_CONCAT(t.name ORDER BY t.name SEPARATOR ',') AS tags_csv
     FROM ${from}
     JOIN users u ON d.user_id = u.id
     LEFT JOIN story_tags st ON st.story_id = d.id
     LEFT JOIN tags t ON t.id = st.tag_id
     ${where}
     GROUP BY d.id
     ORDER BY d.created_at DESC
     LIMIT ? OFFSET ?`,
    [...likedParams, ...params, pageSize, offset]
  )

  const list = rows.map(d => {
    const tags = d.tags_csv ? d.tags_csv.split(',') : []
    delete d.tags_csv
    const row = { ...d, tags, isLiked: d.isLiked === 1, isFavorited: d.isFavorited === 1 }
    delete row.content_rich // 列表卡片只用纯文本；样式版留在列表无用且徒增返回体
    return row
  })

  return { code: 0, data: { list, total, page, pageSize } }
}
