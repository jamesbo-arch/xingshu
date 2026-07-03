// 醒书活动云函数 — action 路由：list / detail / signup / cancelSignup（PRD v2.1 MVP）
// 活动仅需微信授权（openid 存在即可），与日记的手机号验证相互独立
const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const LIST_SELECT = `
  SELECT id, title, cover_url, type, city, location, organizer,
         capacity, signup_count, status,
         DATE_FORMAT(start_time, '%Y-%m-%d %H:%i') AS start_time,
         DATE_FORMAT(end_time, '%Y-%m-%d %H:%i') AS end_time,
         DATE_FORMAT(signup_deadline, '%Y-%m-%d %H:%i') AS signup_deadline
  FROM activities`

async function findUser(openid) {
  const [rows] = await db.query('SELECT id FROM users WHERE openid = ?', [openid])
  return rows.length ? rows[0] : null
}

const handlers = {
  // 列表：仅 online（近期）与 finished（往期回顾），draft 不可见
  async list() {
    const [rows] = await db.query(
      `${LIST_SELECT} WHERE status IN ('online', 'finished')
       ORDER BY FIELD(status, 'online', 'finished'), start_time ${''}`)
    // online 按开始时间正序（最近的活动在前），finished 按开始时间倒序
    const upcoming = rows.filter(a => a.status === 'online')
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
    const past = rows.filter(a => a.status === 'finished')
      .sort((a, b) => b.start_time.localeCompare(a.start_time))
    return { upcoming, past }
  },

  async detail({ id } = {}, openid) {
    const [rows] = await db.query(
      `SELECT *,
              DATE_FORMAT(start_time, '%Y-%m-%d %H:%i') AS start_time,
              DATE_FORMAT(end_time, '%Y-%m-%d %H:%i') AS end_time,
              DATE_FORMAT(signup_deadline, '%Y-%m-%d %H:%i') AS signup_deadline
       FROM activities WHERE id = ? AND status != 'draft'`, [id])
    if (!rows.length) throw new Error('活动不存在')
    const a = rows[0]
    a.isSignedUp = false
    const user = await findUser(openid)
    if (user) {
      const [s] = await db.query(
        'SELECT id FROM activity_signups WHERE activity_id = ? AND user_id = ?', [id, user.id])
      a.isSignedUp = s.length > 0
    }
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

  async cancelSignup({ id } = {}, openid) {
    const user = await findUser(openid)
    if (!user) throw new Error('user not found')
    const [r] = await db.query(
      'DELETE FROM activity_signups WHERE activity_id = ? AND user_id = ?', [id, user.id])
    if (!r.affectedRows) throw new Error('未报名该活动')
    await db.query('UPDATE activities SET signup_count = GREATEST(signup_count - 1, 0) WHERE id = ?', [id])
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
