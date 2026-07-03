// 管理后台统一云函数 — action 路由 + 密码登录 + HMAC token 鉴权
// 由 Web 管理后台通过 @cloudbase/js-sdk 调用，不依赖 wx-server-sdk
// event: { action, token?, payload? }，login 之外的 action 均需有效 token
const crypto = require('crypto')
const db = require('./db')
const { ADMIN_PASSWORD } = require('./secret')

const TOKEN_TTL = 12 * 3600 * 1000

function sign(exp) {
  return crypto.createHmac('sha256', ADMIN_PASSWORD).update(String(exp)).digest('hex')
}

function issueToken() {
  const exp = Date.now() + TOKEN_TTL
  return exp + '.' + sign(exp)
}

function verifyToken(token) {
  const [exp, sig] = String(token || '').split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  const expect = sign(exp)
  return sig.length === expect.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))
}

async function auditLog(action, targetType, targetId, detail) {
  await db.query(
    'INSERT INTO admin_logs (admin_openid, action, target_type, target_id, detail, created_by) VALUES (?,?,?,?,?,?)',
    ['admin-web', action, targetType, String(targetId), JSON.stringify(detail || {}), 'admin-web']
  )
}

// ---- 查询片段（返回字段名与 admin 前端 mock 数据形状一致）----

const USER_SELECT = `
  SELECT u.id, u.nickname, COALESCE(u.real_name,'') AS realName, COALESCE(u.phone,'') AS phone,
         u.avatar_hue AS avatarHue, u.identity,
         DATE_FORMAT(u.member_until, '%Y-%m-%d') AS memberUntil,
         GREATEST(COALESCE(DATEDIFF(u.member_until, CURDATE()), 0), 0) AS daysLeft,
         u.diary_count AS diaries,
         (SELECT COALESCE(SUM(d.like_count),0) FROM diaries d WHERE d.user_id = u.id AND d.status = 'active') AS likes,
         DATE_FORMAT(u.created_at, '%Y-%m-%d') AS registeredAt,
         DATE_FORMAT(u.updated_at, '%Y-%m-%d') AS lastActive
  FROM users u`

const DIARY_SELECT = `
  SELECT d.id, d.title, d.content, d.permission, d.status,
         DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i') AS createdAt,
         d.like_count AS likes, d.fav_count AS favorites,
         d.comment_count AS comments, d.share_count AS shares,
         u.nickname AS author, u.id AS authorId,
         (SELECT GROUP_CONCAT(t.name ORDER BY t.name) FROM diary_tags dt JOIN tags t ON t.id = dt.tag_id WHERE dt.diary_id = d.id) AS tags_csv
  FROM diaries d JOIN users u ON d.user_id = u.id`

const COMMENT_SELECT = `
  SELECT c.id, c.diary_id AS diaryId, d.title AS diaryTitle,
         u.nickname AS user, c.user_id AS userId, c.content,
         DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i') AS time
  FROM comments c JOIN users u ON c.user_id = u.id JOIN diaries d ON c.diary_id = d.id`

function rowToDiary(r) {
  const tags = r.tags_csv ? r.tags_csv.split(',') : []
  delete r.tags_csv
  return { ...r, tags }
}

// ---- action 处理器 ----

const handlers = {
  async users({ identity, keyword } = {}) {
    const where = [], params = []
    if (identity) { where.push('u.identity = ?'); params.push(identity) }
    if (keyword) { where.push('(u.nickname LIKE ? OR u.phone LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }
    const [rows] = await db.query(
      `${USER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.created_at DESC`, params)
    return { list: rows, total: rows.length }
  },

  async userDetail({ id } = {}) {
    const [users] = await db.query(`${USER_SELECT} WHERE u.id = ?`, [id])
    if (!users.length) throw new Error('用户不存在')
    const [diaries] = await db.query(
      `${DIARY_SELECT} WHERE d.user_id = ? AND d.status = 'active' ORDER BY d.created_at DESC`, [id])
    return { user: users[0], diaries: diaries.map(rowToDiary) }
  },

  async diaries({ keyword, permission, tag } = {}) {
    const where = ["d.status = 'active'"], params = []
    if (keyword) { where.push('(d.title LIKE ? OR d.content LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }
    if (permission) { where.push('d.permission = ?'); params.push(permission) }
    if (tag) {
      where.push('EXISTS (SELECT 1 FROM diary_tags dt2 JOIN tags t2 ON t2.id = dt2.tag_id WHERE dt2.diary_id = d.id AND t2.name = ?)')
      params.push(tag)
    }
    const [rows] = await db.query(
      `${DIARY_SELECT} WHERE ${where.join(' AND ')} ORDER BY d.created_at DESC`, params)
    return { list: rows.map(rowToDiary), total: rows.length }
  },

  async diaryDetail({ id } = {}) {
    const [rows] = await db.query(`${DIARY_SELECT} WHERE d.id = ?`, [id])
    if (!rows.length) throw new Error('日记不存在')
    const [comments] = await db.query(
      `${COMMENT_SELECT} WHERE c.diary_id = ? AND c.is_deleted = 0 ORDER BY c.created_at ASC`, [id])
    return { diary: rowToDiary(rows[0]), comments }
  },

  async comments({ keyword, userId } = {}) {
    const where = ['c.is_deleted = 0'], params = []
    if (keyword) { where.push('c.content LIKE ?'); params.push(`%${keyword}%`) }
    if (userId) { where.push('c.user_id = ?'); params.push(userId) }
    const [rows] = await db.query(
      `${COMMENT_SELECT} WHERE ${where.join(' AND ')} ORDER BY c.created_at DESC LIMIT 200`, params)
    return { list: rows, total: rows.length }
  },

  async kpi() {
    const count = async sql => (await db.query(sql))[0][0].c
    const users = await count('SELECT COUNT(*) c FROM users')
    const usersNew = await count('SELECT COUNT(*) c FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)')
    const members = await count("SELECT COUNT(*) c FROM users WHERE identity = 'member'")
    const membersNew = await count("SELECT COUNT(*) c FROM users WHERE identity = 'member' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)")
    const diaries = await count("SELECT COUNT(*) c FROM diaries WHERE status = 'active'")
    const diariesNew = await count("SELECT COUNT(*) c FROM diaries WHERE status = 'active' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)")
    const inter = await count('SELECT COUNT(*) c FROM interactions') +
      await count('SELECT COUNT(*) c FROM comments WHERE is_deleted = 0')
    const interNew = await count("SELECT COUNT(*) c FROM interactions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)") +
      await count("SELECT COUNT(*) c FROM comments WHERE is_deleted = 0 AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)")
    const [[{ s: revenue }]] = await db.query("SELECT COALESCE(SUM(amount),0) s FROM orders WHERE status = 'paid'")
    const [[{ s: revenueNew }]] = await db.query("SELECT COALESCE(SUM(amount),0) s FROM orders WHERE status = 'paid' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)")
    const delta = (part, total) => total ? Math.round(part / total * 1000) / 10 : 0
    return {
      users: { value: users, delta: delta(usersNew, users) },
      members: { value: members, delta: delta(membersNew, members) },
      diaries: { value: diaries, delta: delta(diariesNew, diaries) },
      interactions: { value: inter, delta: delta(interNew, inter) },
      revenue: { value: Number(revenue), delta: delta(Number(revenueNew), Number(revenue)) },
    }
  },

  async activity() {
    const [diaries] = await db.query(
      `SELECT u.nickname, d.title, d.created_at FROM diaries d JOIN users u ON d.user_id = u.id
       WHERE d.status = 'active' ORDER BY d.created_at DESC LIMIT 5`)
    const [users] = await db.query(
      'SELECT nickname, created_at FROM users ORDER BY created_at DESC LIMIT 5')
    const [orders] = await db.query(
      `SELECT u.nickname, o.plan, o.created_at FROM orders o JOIN users u ON o.user_id = u.id
       WHERE o.status = 'paid' ORDER BY o.created_at DESC LIMIT 5`)
    const fmt = t => {
      const s = String(t)
      const m = s.replace('T', ' ').match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/)
      return m ? `${m[1]} ${m[2]}` : s.slice(0, 16)
    }
    const items = [
      ...diaries.map(r => ({ type: 'diary', text: `${r.nickname} 发布《${r.title}》`, time: fmt(r.created_at), ts: +new Date(r.created_at) })),
      ...users.map(r => ({ type: 'user', text: `${r.nickname} 完成注册`, time: fmt(r.created_at), ts: +new Date(r.created_at) })),
      ...orders.map(r => ({ type: 'order', text: `为「${r.nickname}」确认${r.plan}订单`, time: fmt(r.created_at), ts: +new Date(r.created_at) })),
    ].sort((a, b) => b.ts - a.ts).slice(0, 8)
    return items.map(({ ts, ...rest }) => rest)
  },

  async trend() {
    const daily = async (table, extra = '') => {
      const [rows] = await db.query(
        `SELECT DATE(created_at) d, COUNT(*) c FROM ${table}
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) ${extra} GROUP BY DATE(created_at)`)
      const map = {}
      rows.forEach(r => { map[String(r.d).slice(0, 10)] = r.c })
      return map
    }
    const u = await daily('users')
    const d = await daily('diaries', "AND status = 'active'")
    const i = await daily('interactions')
    const out = []
    for (let n = 29; n >= 0; n--) {
      const dt = new Date(Date.now() - n * 86400000)
      const key = dt.toISOString().slice(0, 10)
      out.push({
        date: `${dt.getMonth() + 1}/${dt.getDate()}`,
        newUsers: u[key] || 0,
        newDiaries: d[key] || 0,
        interactions: i[key] || 0,
      })
    }
    return out
  },

  async deleteDiary({ id } = {}) {
    const [rows] = await db.query("SELECT id, user_id FROM diaries WHERE id = ? AND status = 'active'", [id])
    if (!rows.length) throw new Error('日记不存在或已删除')
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      // updated_by 为用户 id 整型列，管理员操作不写入，审计走 admin_logs
      await conn.query("UPDATE diaries SET status = 'deleted' WHERE id = ?", [id])
      await conn.query('UPDATE comments SET is_deleted = 1 WHERE diary_id = ?', [id])
      await conn.query("DELETE FROM interactions WHERE target_type = 'diary' AND target_id = ?", [id])
      await conn.query('UPDATE users SET diary_count = GREATEST(diary_count - 1, 0) WHERE id = ?', [rows[0].user_id])
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
    await auditLog('deleteDiary', 'diary', id, { userId: rows[0].user_id })
    return true
  },

  async deleteComment({ id } = {}) {
    const [rows] = await db.query('SELECT diary_id FROM comments WHERE id = ? AND is_deleted = 0', [id])
    if (!rows.length) throw new Error('评论不存在或已删除')
    await db.query('UPDATE comments SET is_deleted = 1 WHERE id = ?', [id])
    await db.query('UPDATE diaries SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?', [rows[0].diary_id])
    await auditLog('deleteComment', 'comment', id, { diaryId: rows[0].diary_id })
    return true
  },
}

exports.main = async (event) => {
  const { action, token, payload = {} } = event || {}
  try {
    if (action === 'login') {
      if (!ADMIN_PASSWORD || payload.password !== ADMIN_PASSWORD) return { code: -1, msg: '密码错误' }
      return { code: 0, data: { token: issueToken() } }
    }
    if (!verifyToken(token)) return { code: -401, msg: '未登录或登录已过期' }
    const handler = handlers[action]
    if (!handler) return { code: -1, msg: `未知操作: ${action}` }
    return { code: 0, data: await handler(payload) }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
