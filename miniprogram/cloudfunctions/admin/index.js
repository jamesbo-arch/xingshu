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
         (SELECT COALESCE(SUM(d.fav_count),0) FROM diaries d WHERE d.user_id = u.id AND d.status = 'active') AS favorites,
         (SELECT COALESCE(SUM(d.comment_count),0) FROM diaries d WHERE d.user_id = u.id AND d.status = 'active') AS comments,
         (SELECT COALESCE(SUM(d.share_count),0) FROM diaries d WHERE d.user_id = u.id AND d.status = 'active') AS shares,
         DATE_FORMAT(u.created_at, '%Y-%m-%d') AS registeredAt,
         DATE_FORMAT(u.updated_at, '%Y-%m-%d') AS lastActive,
         u.referrer_user_id AS referrerId, r.nickname AS referrerName
  FROM users u LEFT JOIN users r ON u.referrer_user_id = r.id`

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

// 订单查询：附用户信息 + 据 valid_until 实时计算状态（active/expiring≤15天/expired/pending）
// 注：不含 proof_url（凭证 base64 较大），仅 orderDetail 单独取，避免列表/历史返回过重
const ORDER_SELECT = `
  SELECT o.id, o.user_id AS userId, u.nickname AS userName, COALESCE(u.phone,'') AS userPhone,
         u.avatar_hue AS avatarHue, o.amount, o.plan, o.method, o.status,
         o.member_days AS memberDays, o.note, o.created_by AS createdBy,
         DATE_FORMAT(o.valid_from, '%Y-%m-%d') AS validFrom,
         DATE_FORMAT(o.valid_until, '%Y-%m-%d') AS validUntil,
         DATE_FORMAT(o.payment_time, '%Y-%m-%d %H:%i') AS paymentTime,
         DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i') AS createdAt,
         DATEDIFF(o.valid_until, CURDATE()) AS daysToExpiry
  FROM orders o JOIN users u ON o.user_id = u.id`

// 依 status 与到期天数派生展示态：pending/refunded/cancelled 原样返回；paid 再分 active/expiring/expired
function orderState(row) {
  if (row.status !== 'paid') return row.status
  const d = row.daysToExpiry
  if (d == null) return 'active'
  if (d < 0) return 'expired'
  if (d <= 15) return 'expiring'
  return 'active'
}
function rowToOrder(r) {
  const state = orderState(r)
  delete r.daysToExpiry
  return { ...r, state }
}

function rowToDiary(r) {
  const tags = r.tags_csv ? r.tags_csv.split(',') : []
  delete r.tags_csv
  return { ...r, tags }
}

// 软删日记并联动清理互动（updated_by 为用户 id 整型列，管理员操作不写入，审计走 admin_logs）
async function deleteDiaryById(id) {
  const [rows] = await db.query("SELECT id, user_id FROM diaries WHERE id = ? AND status = 'active'", [id])
  if (!rows.length) throw new Error('日记不存在或已删除')
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
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
    // v2.2 "他推荐的用户"
    const [referred] = await db.query(
      `SELECT id, nickname, identity, DATE_FORMAT(created_at, '%Y-%m-%d') AS registeredAt
       FROM users WHERE referrer_user_id = ? ORDER BY created_at DESC`, [id])
    return { user: users[0], diaries: diaries.map(rowToDiary), referred }
  },

  // v2.2 管理员修改推荐人：非本人、不得互为推荐循环，写审计（旧值→新值）
  async updateReferrer({ userId, referrerId = null } = {}) {
    if (!userId) throw new Error('缺少用户 ID')
    const [users] = await db.query('SELECT id, referrer_user_id FROM users WHERE id = ?', [userId])
    if (!users.length) throw new Error('用户不存在')
    if (referrerId != null) {
      if (Number(referrerId) === Number(userId)) throw new Error('推荐人不能是用户本人')
      const [refs] = await db.query('SELECT id, referrer_user_id FROM users WHERE id = ?', [referrerId])
      if (!refs.length) throw new Error('推荐人不存在')
      if (refs[0].referrer_user_id != null && Number(refs[0].referrer_user_id) === Number(userId)) {
        throw new Error('不能形成互为推荐的循环')
      }
    }
    await db.query('UPDATE users SET referrer_user_id = ? WHERE id = ?', [referrerId, userId])
    await auditLog('updateReferrer', 'user', userId, { from: users[0].referrer_user_id, to: referrerId })
    return true
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
    await deleteDiaryById(id)
    await auditLog('deleteDiary', 'diary', id, {})
    return true
  },

  // 批量删除：逐条独立事务，单条失败不影响其余；汇总写一条审计
  async deleteDiaries({ ids } = {}) {
    if (!Array.isArray(ids) || !ids.length) throw new Error('缺少日记 ID 列表')
    const deleted = [], failed = []
    for (const id of ids) {
      try { await deleteDiaryById(id); deleted.push(id) }
      catch (err) { failed.push({ id, msg: err.message }) }
    }
    await auditLog('deleteDiaries', 'diary', ids.join(','), { deleted, failed })
    return { deleted, failed }
  },

  // ── 活动管理（M1.5.1 MVP）──
  async activityList() {
    const [rows] = await db.query(
      `SELECT id, title, type, city, capacity, signup_count AS signedUp, status,
              DATE_FORMAT(start_time, '%Y-%m-%d %H:%i') AS startTime,
              DATE_FORMAT(signup_deadline, '%Y-%m-%d %H:%i') AS deadline
       FROM activities ORDER BY created_at DESC`)
    return { list: rows, total: rows.length }
  },

  async activitySave({ id, title, cover_url = '', content = '', images = [], start_time, end_time = null,
                       type = 'offline', city = '', location = '', organizer = '醒书运营组',
                       capacity = 0, signup_deadline = null, status = 'draft',
                       review_content = null, review_images = null } = {}) {
    if (!title || !start_time) throw new Error('标题与开始时间必填')
    const imagesJson = images && images.length ? JSON.stringify(images) : null
    const reviewImagesJson = review_images && review_images.length ? JSON.stringify(review_images) : null
    if (id) {
      await db.query(
        `UPDATE activities SET title=?, cover_url=?, content=?, images=?, start_time=?, end_time=?,
         type=?, city=?, location=?, organizer=?, capacity=?, signup_deadline=?, status=?,
         review_content=?, review_images=?, updated_by='admin-web' WHERE id=?`,
        [title, cover_url, content, imagesJson, start_time, end_time, type, city, location,
         organizer, capacity, signup_deadline, status, review_content, reviewImagesJson, id])
      await auditLog('activityUpdate', 'activity', id, { title, status })
      return { id }
    }
    const [r] = await db.query(
      `INSERT INTO activities (title, cover_url, content, images, start_time, end_time, type, city,
        location, organizer, capacity, signup_deadline, status, review_content, review_images, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'admin-web')`,
      [title, cover_url, content, imagesJson, start_time, end_time, type, city, location,
       organizer, capacity, signup_deadline, status, review_content, reviewImagesJson])
    await auditLog('activityCreate', 'activity', r.insertId, { title, status })
    return { id: r.insertId }
  },

  async activitySignups({ id } = {}) {
    const [rows] = await db.query(
      `SELECT s.id, s.name, s.contact, u.nickname, u.phone,
              DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i') AS signedAt
       FROM activity_signups s JOIN users u ON s.user_id = u.id
       WHERE s.activity_id = ? ORDER BY s.created_at ASC`, [id])
    return { list: rows, total: rows.length }
  },

  async deleteComment({ id } = {}) {
    const [rows] = await db.query('SELECT diary_id FROM comments WHERE id = ? AND is_deleted = 0', [id])
    if (!rows.length) throw new Error('评论不存在或已删除')
    await db.query('UPDATE comments SET is_deleted = 1 WHERE id = ?', [id])
    await db.query('UPDATE diaries SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?', [rows[0].diary_id])
    await auditLog('deleteComment', 'comment', id, { diaryId: rows[0].diary_id })
    return true
  },

  // ── 会员订单管理（v2.4：线下转账开通/续期会员）──
  async orderList({ keyword, status } = {}) {
    const where = [], params = []
    if (keyword) {
      where.push('(o.id LIKE ? OR u.nickname LIKE ? OR u.phone LIKE ?)')
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
    }
    const [rows] = await db.query(
      `${ORDER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.created_at DESC`, params)
    let list = rows.map(rowToOrder)
    // 展示态筛选（active/expiring/expired）在派生后过滤
    if (status) list = list.filter(o => o.state === status)
    return { list, total: list.length }
  },

  async orderDetail({ id } = {}) {
    const [rows] = await db.query(`${ORDER_SELECT} WHERE o.id = ?`, [id])
    if (!rows.length) throw new Error('订单不存在')
    const order = rowToOrder(rows[0])
    // 凭证 base64 单独取，仅详情需要
    const [[proof]] = await db.query('SELECT proof_url AS proofUrl FROM orders WHERE id = ?', [id])
    order.proofUrl = proof.proofUrl || ''
    return { order }
  },

  async userOrders({ userId } = {}) {
    if (!userId) throw new Error('缺少用户 ID')
    const [rows] = await db.query(
      `${ORDER_SELECT} WHERE o.user_id = ? ORDER BY o.created_at DESC`, [userId])
    return { list: rows.map(rowToOrder), total: rows.length }
  },

  // 建单即开通：记录一笔已完成的线下转账，直接 paid 并激活/续期会员（含时长叠加）
  async createOrder({ userId, amount, plan = '年度会员', method = 'offline',
                      memberDays = 365, paymentTime = null, note = '', proofUrl = null } = {}) {
    if (!userId) throw new Error('缺少用户 ID')
    const amt = Number(amount)
    if (!amt || isNaN(amt) || amt <= 0) throw new Error('金额无效')
    const days = Number(memberDays) || 365

    const [users] = await db.query(
      "SELECT id, identity, DATE_FORMAT(member_from,'%Y-%m-%d') AS memberFrom, member_until FROM users WHERE id = ?",
      [userId])
    if (!users.length) throw new Error('用户不存在')
    const user = users[0]
    if (user.identity === 'guest') throw new Error('游客不可开通会员，需先登录')

    // 时长叠加：现会员（未过期）从原到期日顺延，否则从今日起算
    const todayStr = new Date().toISOString().slice(0, 10)
    const [[calc]] = await db.query(
      `SELECT CURDATE() AS today,
              CASE WHEN ? = 'member' AND ? IS NOT NULL AND ? >= CURDATE() THEN ? ELSE CURDATE() END AS base`,
      [user.identity, user.member_until, user.member_until, user.member_until])
    const validFrom = todayStr
    const [[dates]] = await db.query(
      'SELECT DATE_FORMAT(DATE_ADD(?, INTERVAL ? DAY), "%Y-%m-%d") AS validUntil', [calc.base, days])
    const validUntil = dates.validUntil
    // 首次开通用今日为 member_from，续期保留原 member_from
    const memberFrom = (user.identity === 'member' && user.memberFrom) ? user.memberFrom : validFrom

    const orderId = 'XS-' + todayStr.replace(/-/g, '') + '-' +
      Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    const payTime = paymentTime || new Date().toISOString().slice(0, 19).replace('T', ' ')

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(
        `INSERT INTO orders (id, user_id, amount, plan, method, status, member_days,
           valid_from, valid_until, payment_time, note, proof_url, created_by)
         VALUES (?,?,?,?,?,'paid',?,?,?,?,?,?,'admin-web')`,
        [orderId, userId, amt, plan, method, days, validFrom, validUntil, payTime, note, proofUrl])
      await conn.query(
        "UPDATE users SET identity = 'member', member_from = ?, member_until = ? WHERE id = ?",
        [memberFrom, validUntil, userId])
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
    await auditLog('createOrder', 'order', orderId, { userId, amount: amt, validUntil, renew: user.identity === 'member' })
    const [orderRows] = await db.query(`${ORDER_SELECT} WHERE o.id = ?`, [orderId])
    return { order: rowToOrder(orderRows[0]), validUntil }
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
