// 醒书活动云函数 — action 路由：list / detail / signup / cancelSignup（PRD v2.1 MVP）
// 活动仅需微信授权（openid 存在即可），与日记的手机号验证相互独立
const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const LIST_SELECT = `
  SELECT a.id, a.title, a.cover_url, a.type, a.city, a.location, a.organizer,
         a.capacity, a.signup_count, a.status, a.type_id, t.name AS type_name,
         DATE_FORMAT(a.start_time, '%Y-%m-%d %H:%i') AS start_time,
         DATE_FORMAT(a.end_time, '%Y-%m-%d %H:%i') AS end_time,
         DATE_FORMAT(a.signup_deadline, '%Y-%m-%d %H:%i') AS signup_deadline
  FROM activities a LEFT JOIN activity_types t ON a.type_id = t.id`

async function findUser(openid) {
  const [rows] = await db.query('SELECT id FROM users WHERE openid = ?', [openid])
  return rows.length ? rows[0] : null
}

const handlers = {
  // 活动类型（分类）：小程序筛选用，仅启用项
  async typeList() {
    const [rows] = await db.query(
      'SELECT id, name, channel, schedule_hint FROM activity_types WHERE is_active = 1 ORDER BY sort, id')
    return rows
  },

  // 列表：仅 online（近期）与 finished（往期回顾），draft 不可见；可按类型筛选。
  // mode:'all' → 平铺全部按开始时间倒序（活动页「全部活动」页签）；默认仍返回 upcoming/past 两组（广场预告等）。
  // 每行标注 isSignedUp（当前用户是否已报名，游客/未注册恒 0），供列表「已报名」状态展示
  async list({ typeId, mode } = {}, openid) {
    const params = []
    let where = "WHERE a.status IN ('online', 'finished')"
    if (typeId) { where += ' AND a.type_id = ?'; params.push(typeId) }
    const [rows] = await db.query(`${LIST_SELECT} ${where}`, params)
    let signedSet = new Set()
    const user = await findUser(openid)
    if (user) {
      const [signed] = await db.query('SELECT activity_id FROM activity_signups WHERE user_id = ?', [user.id])
      signedSet = new Set(signed.map(s => s.activity_id))
    }
    rows.forEach(a => { a.isSignedUp = signedSet.has(a.id) ? 1 : 0 })
    if (mode === 'all') {
      return { list: rows.sort((a, b) => b.start_time.localeCompare(a.start_time)) }
    }
    // online 按开始时间正序（最近的活动在前），finished 按开始时间倒序
    const upcoming = rows.filter(a => a.status === 'online')
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
    const past = rows.filter(a => a.status === 'finished')
      .sort((a, b) => b.start_time.localeCompare(a.start_time))
    return { upcoming, past }
  },

  async detail({ id } = {}, openid) {
    const [rows] = await db.query(
      `SELECT a.*, t.name AS type_name, t.schedule_hint,
              DATE_FORMAT(a.start_time, '%Y-%m-%d %H:%i') AS start_time,
              DATE_FORMAT(a.end_time, '%Y-%m-%d %H:%i') AS end_time,
              DATE_FORMAT(a.signup_deadline, '%Y-%m-%d %H:%i') AS signup_deadline,
              (a.start_time <= NOW()) AS started
       FROM activities a LEFT JOIN activity_types t ON a.type_id = t.id
       WHERE a.id = ? AND a.status != 'draft'`, [id])
    if (!rows.length) throw new Error('活动不存在')
    const a = rows[0]
    a.isSignedUp = false
    const user = await findUser(openid)
    if (user) {
      const [s] = await db.query(
        'SELECT id FROM activity_signups WHERE activity_id = ? AND user_id = ?', [id, user.id])
      a.isSignedUp = s.length > 0
    }
    // 现场分享发布权：已报名 + 活动已开始（服务端 NOW() 判定，避免设备时钟/时区问题）
    a.canPost = a.isSignedUp && !!a.started
    delete a.started
    return a
  },

  async signup({ id, name, contact = '' } = {}, openid) {
    if (!name || !String(name).trim()) throw new Error('请留下你的称呼')
    const user = await findUser(openid)
    if (!user) throw new Error('user not found')

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      const [rows] = await conn.query(
        'SELECT capacity, signup_count, signup_deadline, status FROM activities WHERE id = ? FOR UPDATE', [id])
      if (!rows.length || rows[0].status !== 'online') throw new Error('活动不存在或未开放报名')
      const a = rows[0]
      if (a.signup_deadline && new Date(a.signup_deadline) < new Date()) throw new Error('报名已截止')
      if (a.capacity > 0 && a.signup_count >= a.capacity) throw new Error('名额已满')
      await conn.query(
        'INSERT INTO activity_signups (activity_id, user_id, name, contact) VALUES (?, ?, ?, ?)',
        [id, user.id, String(name).trim(), String(contact || '').trim()])
      await conn.query('UPDATE activities SET signup_count = signup_count + 1 WHERE id = ?', [id])
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      if (err.code === 'ER_DUP_ENTRY') throw new Error('你已报名该活动')
      throw err
    } finally {
      conn.release()
    }
    return true
  },

  // 报名名单：仅已报名用户可查看（含本人）；只返回称呼与头像，不外泄联系方式
  async signupList({ id } = {}, openid) {
    const user = await findUser(openid)
    if (!user) throw new Error('user not found')
    const [mine] = await db.query(
      'SELECT id FROM activity_signups WHERE activity_id = ? AND user_id = ?', [id, user.id])
    if (!mine.length) throw new Error('报名后即可查看名单')
    const [rows] = await db.query(
      `SELECT s.name, u.avatar_hue, u.avatar_url
       FROM activity_signups s JOIN users u ON s.user_id = u.id
       WHERE s.activity_id = ? ORDER BY s.id`, [id])
    return rows
  },

  async cancelSignup({ id } = {}, openid) {
    const user = await findUser(openid)
    if (!user) throw new Error('user not found')
    const [r] = await db.query(
      'DELETE FROM activity_signups WHERE activity_id = ? AND user_id = ?', [id, user.id])
    if (!r.affectedRows) throw new Error('未报名该活动')
    await db.query('UPDATE activities SET signup_count = GREATEST(signup_count - 1, 0) WHERE id = ?', [id])
    return true
  },

  // ── 现场分享：仅已报名用户可发，活动开始后开放（含结束后补发）；先发后删 ──
  async postCreate({ id, content = '', images = [] } = {}, openid) {
    const user = await findUser(openid)
    if (!user) throw new Error('user not found')
    content = String(content || '').trim()
    if (!content && (!images || !images.length)) throw new Error('写点文字或选张照片吧')
    if (content.length > 1000) throw new Error('分享内容不超过 1000 字')
    if (images && images.length > 9) throw new Error('最多 9 张照片')
    const [acts] = await db.query(
      "SELECT id FROM activities WHERE id = ? AND status IN ('online','finished') AND start_time <= NOW()", [id])
    if (!acts.length) throw new Error('活动尚未开始，开始后即可分享')
    const [signed] = await db.query(
      'SELECT id FROM activity_signups WHERE activity_id = ? AND user_id = ?', [id, user.id])
    if (!signed.length) throw new Error('报名参加后才能分享现场')
    const [r] = await db.query(
      'INSERT INTO activity_posts (activity_id, user_id, content, images, created_by) VALUES (?,?,?,?,?)',
      [id, user.id, content, images && images.length ? JSON.stringify(images) : null, openid])
    return { id: r.insertId }
  },

  // 分享列表：所有登录用户可看（详情页本身有登录门槛），分页同 getDiaryList 形状
  async postList({ id, page = 1, pageSize = 10 } = {}, openid) {
    page = Math.max(1, parseInt(page, 10) || 1)
    pageSize = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10))
    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) AS total FROM activity_posts WHERE activity_id = ? AND status = 'active'", [id])
    const [rows] = await db.query(
      `SELECT p.id, p.user_id, p.content, p.images, u.nickname, u.avatar_hue, u.avatar_url,
              DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS created_at
       FROM activity_posts p JOIN users u ON p.user_id = u.id
       WHERE p.activity_id = ? AND p.status = 'active'
       ORDER BY p.id DESC LIMIT ? OFFSET ?`, [id, pageSize, (page - 1) * pageSize])
    const user = await findUser(openid)
    const list = rows.map(p => ({ ...p, images: p.images || [], isMine: !!user && p.user_id === user.id }))
    return { list, total, page, pageSize }
  },

  // 跨活动分享流（活动页「活动分享」瀑布流）：聚合全部 active 分享倒序分页；
  // 游客可浏览（不查 user），draft 活动的分享不外泄
  async postFeed({ page = 1, pageSize = 10 } = {}) {
    page = Math.max(1, parseInt(page, 10) || 1)
    pageSize = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10))
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM activity_posts p JOIN activities a ON p.activity_id = a.id
       WHERE p.status = 'active' AND a.status != 'draft'`)
    const [rows] = await db.query(
      `SELECT p.id, p.activity_id, p.content, p.images,
              DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS created_at,
              u.nickname, u.avatar_hue, u.avatar_url,
              a.title AS activity_title, t.name AS type_name, a.type AS activity_channel
       FROM activity_posts p
       JOIN activities a ON p.activity_id = a.id
       LEFT JOIN activity_types t ON a.type_id = t.id
       JOIN users u ON p.user_id = u.id
       WHERE p.status = 'active' AND a.status != 'draft'
       ORDER BY p.id DESC LIMIT ? OFFSET ?`, [pageSize, (page - 1) * pageSize])
    const list = rows.map(p => ({ ...p, images: p.images || [] }))
    return { list, total, page, pageSize }
  },

  async postDelete({ id } = {}, openid) {
    const user = await findUser(openid)
    if (!user) throw new Error('user not found')
    const [r] = await db.query(
      "UPDATE activity_posts SET status = 'deleted' WHERE id = ? AND user_id = ? AND status = 'active'",
      [id, user.id])
    if (!r.affectedRows) throw new Error('无权删除或已删除')
    return true
  },
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action, payload = {} } = event || {}
  try {
    const handler = handlers[action]
    if (!handler) return { code: -1, msg: `未知操作: ${action}` }
    return { code: 0, data: await handler(payload, OPENID) }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
