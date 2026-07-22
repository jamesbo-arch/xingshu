// 醒书问答云函数 — action 路由（v2.0 新增模块）
//
// 内容口径（对齐故事的精选机制）：
//   · 问题仅正文（帖子式，无标题），两态：draft 暂存仅自己可见 / published 已发布
//   · member → 全部已发布问题原文，可回复
//   · 非会员（含未登录 guest）→ 仅精选问题（featured_questions 上架副本），
//     可读问题与全部回复，但不提供发回复入口（只读）
//   · 发问题 / 发回复均为有效会员专享；点赞 / 收藏只需授权
//   · 匿名：is_anonymous=1 时一律隐去昵称与头像，对外显示「醒书同学」+ 默认「醒」字头像
//     （连作者本人也脱敏；admin 后台走独立查询，始终看真名）
const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 匿名对外统一显示为「醒书同学」，头像用默认「醒」字（前端按 is_anonymous 渲染）
const ANON_NAME = '醒书同学'
const MAX_CONTENT = 2000
const MAX_COMMENT = 1000

// 用户及其权限态：identity 存授权态，会员资格由 member_until 派生（与故事口径一致）
async function findUser(openid) {
  const [rows] = await db.query(
    "SELECT id, identity, (identity <> 'guest' AND member_until IS NOT NULL AND member_until >= CURDATE()) AS validMember " +
    'FROM users WHERE openid = ?', [openid])
  if (!rows.length) return null
  const u = rows[0]
  return {
    id: u.id,
    isGuest: u.identity === 'guest',
    // 退出登录即回游客视角：不认作者特权、不带互动态（与 getStoryList/Detail 一致）
    isMember: !!u.validMember && u.identity !== 'guest',
  }
}

// 授权态用户 id（guest 与未注册均为 null）——互动态与作者判定都用它
function authedId(user) {
  return user && !user.isGuest ? user.id : null
}

async function assertMember(openid) {
  const user = await findUser(openid)
  if (!user) throw new Error('user not found')
  if (!user.isMember) throw new Error('该功能为会员专享')
  return user
}

// 匿名脱敏：抹掉昵称、头像与会员徽章。
// **对作者本人同样脱敏**——匿名就该是彻底的，作者看到自己的真名反而会怀疑匿名没生效；
// 「这条是不是我发的」由 isMine 字段单独承担（删除按钮据它显示），不依赖昵称。
function maskAuthor(row) {
  if (!row.is_anonymous) return row
  return { ...row, nickname: ANON_NAME, avatar_url: '', avatar_hue: null, author_identity: 'authed' }
}

// 一批问题的点赞/收藏态（未授权返回空集）
async function interactionSets(userId, ids) {
  if (!userId || !ids.length) return { liked: new Set(), faved: new Set() }
  const [rows] = await db.query(
    `SELECT target_id, action FROM interactions
     WHERE user_id = ? AND target_type = 'question' AND action IN ('like','favorite')
       AND target_id IN (${ids.map(() => '?').join(',')})`,
    [userId, ...ids])
  return {
    liked: new Set(rows.filter(r => r.action === 'like').map(r => r.target_id)),
    faved: new Set(rows.filter(r => r.action === 'favorite').map(r => r.target_id)),
  }
}

const QUESTION_FIELDS = `
  q.id, q.user_id, q.is_anonymous, q.publish_status, q.is_featured,
  q.like_count, q.fav_count, q.comment_count,
  DATE_FORMAT(q.created_at, '%Y-%m-%d %H:%i') AS created_at,
  u.nickname, u.avatar_hue, u.avatar_url,
  IF(u.member_until IS NOT NULL AND u.member_until >= CURDATE(), 'member', 'authed') AS author_identity`

const handlers = {
  // 列表
  //   mode=all（默认）：member 见全部已发布原文；非会员见精选副本
  //   mode=mine：作者自己的全部问题（含 draft）
  //   mode=collections：我收藏的问题
  async list({ mode = 'all', keyword, page = 1, pageSize = 20 } = {}, openid) {
    const user = await findUser(openid)
    const userId = authedId(user)
    const isMember = !!(user && user.isMember)

    // 非会员（含 guest）走精选副本视图：内容取副本，计数/互动仍挂原问题
    const featuredView = mode === 'all' && !isMember
    const from = featuredView
      ? "questions q JOIN featured_questions f ON f.question_id = q.id AND f.status = 'online' JOIN users u ON q.user_id = u.id"
      : 'questions q JOIN users u ON q.user_id = u.id'
    const contentCol = featuredView ? 'f.content' : 'q.content'

    let where = "WHERE q.status = 'active'"
    const params = []
    if (mode === 'mine') {
      if (!userId) return { list: [], total: 0, page, pageSize }
      where += ' AND q.user_id = ?'
      params.push(userId)
    } else if (mode === 'collections') {
      if (!userId) return { list: [], total: 0, page, pageSize }
      where += " AND q.id IN (SELECT target_id FROM interactions WHERE user_id = ? AND target_type = 'question' AND action = 'favorite')"
      params.push(userId)
      where += " AND (q.publish_status = 'published' OR q.user_id = ?)"
      params.push(userId)
    } else {
      where += " AND q.publish_status = 'published'"
    }
    if (keyword) {
      where += ` AND ${contentCol} LIKE ?`
      params.push(`%${keyword}%`)
    }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM ${from} ${where}`, params)
    const [rows] = await db.query(
      `SELECT ${QUESTION_FIELDS}, ${contentCol} AS content FROM ${from} ${where}
       ORDER BY q.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize])

    const { liked, faved } = await interactionSets(userId, rows.map(r => r.id))
    const list = rows.map(r => ({
      ...maskAuthor(r),
      isLiked: liked.has(r.id),
      isFavorited: faved.has(r.id),
    }))
    return { list, total, page, pageSize }
  },

  // 详情：member/作者 → 原文可回复；非会员 → 命中上架副本则副本内容只读，未精选 -2
  async detail({ id } = {}, openid) {
    if (!id) throw new Error('缺少问题ID')
    const user = await findUser(openid)
    const userId = authedId(user)
    const isMember = !!(user && user.isMember)

    const [rows] = await db.query(
      `SELECT ${QUESTION_FIELDS}, q.content FROM questions q JOIN users u ON q.user_id = u.id
       WHERE q.id = ? AND q.status = 'active'`, [id])
    if (!rows.length) return { notFound: true }

    const q = rows[0]
    const isAuthor = userId && Number(q.user_id) === Number(userId)
    // 暂存仅作者可见，他人按不存在处理
    if (q.publish_status === 'draft' && !isAuthor) return { notFound: true }

    let viaFeatured = false
    if (!isAuthor && !isMember) {
      const [feat] = await db.query(
        "SELECT content FROM featured_questions WHERE question_id = ? AND status = 'online'", [id])
      if (!feat.length) return { memberOnly: true }
      q.content = feat[0].content
      viaFeatured = true
    }

    const { liked, faved } = await interactionSets(userId, [q.id])
    return {
      question: {
        ...maskAuthor(q),
        isLiked: liked.has(q.id),
        isFavorited: faved.has(q.id),
      },
      // 公众版（精选副本）可读全部回复但不能发——回复本身就是"答案"，藏起来就没有阅读价值
      viaFeatured,
      canReply: isMember,
      isAuthor: !!isAuthor,
    }
  },

  // 回复列表（一层 parent_id：顶层回复 + 其下追评）
  async commentList({ id } = {}, openid) {
    if (!id) throw new Error('缺少问题ID')
    const user = await findUser(openid)
    const userId = authedId(user)
    const [rows] = await db.query(
      `SELECT c.id, c.user_id, c.parent_id, c.content, c.is_anonymous,
              DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i') AS created_at,
              u.nickname, u.avatar_hue, u.avatar_url
       FROM question_comments c JOIN users u ON c.user_id = u.id
       WHERE c.question_id = ? AND c.is_deleted = 0
       ORDER BY c.id ASC`, [id])
    const masked = rows.map(r => ({
      ...maskAuthor(r),
      isMine: !!(userId && Number(r.user_id) === Number(userId)),
    }))
    const tops = masked.filter(r => !r.parent_id)
    const byParent = new Map()
    for (const r of masked) {
      if (!r.parent_id) continue
      if (!byParent.has(r.parent_id)) byParent.set(r.parent_id, [])
      byParent.get(r.parent_id).push(r)
    }
    return tops.map(t => ({ ...t, replies: byParent.get(t.id) || [] }))
  },

  // 发布/暂存问题（会员专享）
  async create({ content = '', isAnonymous = false, publishStatus = 'draft' } = {}, openid) {
    const user = await assertMember(openid)
    content = String(content || '').trim()
    if (!content) throw new Error('写点什么再发布吧')
    if (content.length > MAX_CONTENT) throw new Error(`问题不超过 ${MAX_CONTENT} 字`)
    if (!['draft', 'published'].includes(publishStatus)) throw new Error('状态参数无效')
    const [r] = await db.query(
      'INSERT INTO questions (user_id, content, is_anonymous, publish_status, created_by) VALUES (?,?,?,?,?)',
      [user.id, content, isAnonymous ? 1 : 0, publishStatus, user.id])
    return { id: r.insertId }
  },

  async update({ id, content = '', isAnonymous = false, publishStatus } = {}, openid) {
    const user = await assertMember(openid)
    content = String(content || '').trim()
    if (!content) throw new Error('写点什么再保存吧')
    if (content.length > MAX_CONTENT) throw new Error(`问题不超过 ${MAX_CONTENT} 字`)
    const sets = ['content = ?', 'is_anonymous = ?', 'updated_by = ?']
    const params = [content, isAnonymous ? 1 : 0, user.id]
    if (publishStatus) {
      if (!['draft', 'published'].includes(publishStatus)) throw new Error('状态参数无效')
      sets.push('publish_status = ?')
      params.push(publishStatus)
    }
    const [r] = await db.query(
      `UPDATE questions SET ${sets.join(', ')} WHERE id = ? AND user_id = ? AND status = 'active'`,
      [...params, id, user.id])
    if (!r.affectedRows) throw new Error('无权编辑或问题不存在')
    return true
  },

  // 软删；已入选精选的副本联动下架（与故事口径一致）
  async remove({ id } = {}, openid) {
    const user = await findUser(openid)
    if (!user || user.isGuest) throw new Error('user not found')
    const [r] = await db.query(
      "UPDATE questions SET status = 'deleted', is_featured = 0, updated_by = ? WHERE id = ? AND user_id = ? AND status = 'active'",
      [user.id, id, user.id])
    if (!r.affectedRows) throw new Error('无权删除或已删除')
    await db.query("UPDATE featured_questions SET status = 'offline' WHERE question_id = ?", [id])
    return true
  },

  // 发回复（会员专享）
  async commentCreate({ id, content = '', parentId = null, isAnonymous = false } = {}, openid) {
    const user = await assertMember(openid)
    content = String(content || '').trim()
    if (!id || !content) throw new Error('缺少参数')
    if (content.length > MAX_COMMENT) throw new Error(`回复不超过 ${MAX_COMMENT} 字`)
    const [qs] = await db.query(
      "SELECT id FROM questions WHERE id = ? AND status = 'active' AND publish_status = 'published'", [id])
    if (!qs.length) throw new Error('问题不存在或未发布')
    const [r] = await db.query(
      'INSERT INTO question_comments (question_id, user_id, parent_id, content, is_anonymous, created_by) VALUES (?,?,?,?,?,?)',
      [id, user.id, parentId || null, content, isAnonymous ? 1 : 0, user.id])
    // 计数只统顶层回复（与故事评论口径一致）
    if (!parentId) await db.query('UPDATE questions SET comment_count = comment_count + 1 WHERE id = ?', [id])
    return { id: r.insertId }
  },

  async commentDelete({ id } = {}, openid) {
    const user = await findUser(openid)
    if (!user || user.isGuest) throw new Error('user not found')
    const [rows] = await db.query(
      'SELECT question_id, parent_id FROM question_comments WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [id, user.id])
    if (!rows.length) throw new Error('无权删除或已删除')
    await db.query('UPDATE question_comments SET is_deleted = 1, updated_by = ? WHERE id = ?', [user.id, id])
    if (!rows[0].parent_id) {
      await db.query('UPDATE questions SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?',
        [rows[0].question_id])
    }
    return true
  },

  // 点赞 / 收藏：授权即可（与故事一致），翻转式
  async like({ id } = {}, openid) { return toggle(id, 'like', 'like_count', openid) },
  async favToggle({ id } = {}, openid) { return toggle(id, 'favorite', 'fav_count', openid) },
}

async function toggle(id, action, countCol, openid) {
  const user = await findUser(openid)
  if (!user || user.isGuest) throw new Error('user not found')
  if (!id) throw new Error('缺少问题ID')
  const [existing] = await db.query(
    "SELECT id FROM interactions WHERE user_id = ? AND target_type = 'question' AND target_id = ? AND action = ?",
    [user.id, id, action])
  if (existing.length) {
    await db.query('DELETE FROM interactions WHERE id = ?', [existing[0].id])
    await db.query(`UPDATE questions SET ${countCol} = GREATEST(${countCol} - 1, 0) WHERE id = ?`, [id])
    return { active: false }
  }
  await db.query(
    "INSERT INTO interactions (user_id, target_type, target_id, action, created_by) VALUES (?, 'question', ?, ?, ?)",
    [user.id, id, action, user.id])
  await db.query(`UPDATE questions SET ${countCol} = ${countCol} + 1 WHERE id = ?`, [id])
  return { active: true }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action, payload = {} } = event || {}
  try {
    const handler = handlers[action]
    if (!handler) return { code: -1, msg: `未知操作: ${action}` }
    const data = await handler(payload, OPENID)
    // 详情的两种拒绝态用与故事一致的引导码：-1 不存在 / -2 会员专享
    if (data && data.notFound) return { code: -1, msg: '问题不存在' }
    if (data && data.memberOnly) return { code: -2, msg: '会员专享问答' }
    return { code: 0, data }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
