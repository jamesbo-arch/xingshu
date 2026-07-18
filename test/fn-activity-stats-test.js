// 活动报名数据（statsGet）测试 — 主理人/工作人员鉴权、全量字段、推荐人、detail 入口标志
// （测试数据自动清理）
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const P = 'test_stats_'

async function run() {
  console.log('=== 活动报名数据（statsGet）测试 ===\n')
  let passed = 0, failed = 0
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const act = (action, payload, openid) => callFn('activity', { action, payload }, openid)

  // ── 造数：主理人 A、工作人员 B、推荐人 D、报名者 C（推荐人 D）/E（无推荐人）、无关会员 F ──
  const mkUser = async (key, referrerId = null) => {
    const [r] = await conn.query(
      `INSERT INTO users (openid, nickname, identity, referrer_user_id) VALUES (?, ?, 'authed', ?)`,
      [P + key, P + key, referrerId])
    return r.insertId
  }
  const userA = await mkUser('owner')
  const userB = await mkUser('staff')
  const userD = await mkUser('referrer')
  const userC = await mkUser('c', userD)
  const userE = await mkUser('e')
  await mkUser('f')

  const [rx] = await conn.query(
    `INSERT INTO activities (title, start_time, status, owner_user_id, capacity, price)
     VALUES (?, '2026-09-01 08:30:00', 'online', ?, 12, 30)`, [P + 'X', userA])
  const actX = rx.insertId
  await conn.query(
    `INSERT INTO activity_signups (activity_id, user_id, name, contact, attended, paid)
     VALUES (?, ?, ?, ?, 1, 1), (?, ?, ?, ?, 0, 0)`,
    [actX, userC, 'C称呼', '13800000001', actX, userE, 'E称呼', ''])
  await conn.query('INSERT INTO activity_staff (activity_id, user_id) VALUES (?, ?)', [actX, userB])

  try {
    await test('主理人 statsGet 通过：统计与全量字段齐全', async () => {
      const r = await act('statsGet', { id: actX }, P + 'owner')
      if (r.code !== 0) throw new Error(r.msg)
      const d = r.data
      if (d.stats.total !== 2 || d.stats.attended !== 1 || d.stats.paid !== 1) {
        throw new Error(`stats 不符：${JSON.stringify(d.stats)}`)
      }
      if (Number(d.activity.price) !== 30) throw new Error('activity.price 不符')
      const row = d.list.find(x => x.user_id === userC)
      for (const k of ['signup_id', 'name', 'contact', 'attended', 'paid', 'signed_at', 'nickname', 'avatar_hue']) {
        if (!(k in row)) throw new Error(`缺少字段 ${k}`)
      }
      if (row.contact !== '13800000001') throw new Error('联系方式不符')
    })

    await test('工作人员 statsGet 通过', async () => {
      const r = await act('statsGet', { id: actX }, P + 'staff')
      if (r.code !== 0) throw new Error(r.msg)
    })

    await test('无关会员 / 游客 statsGet 拒', async () => {
      const f = await act('statsGet', { id: actX }, P + 'f')
      if (f.code === 0) throw new Error('无关会员不应通过')
      const g = await act('statsGet', { id: actX }, 'no_such_openid_xyz')
      if (g.code === 0) throw new Error('未注册游客不应通过')
    })

    await test('推荐人字段：C 带推荐人 D，E 为空', async () => {
      const r = await act('statsGet', { id: actX }, P + 'owner')
      const c = r.data.list.find(x => x.user_id === userC)
      const e = r.data.list.find(x => x.user_id === userE)
      if (Number(c.referrer_id) !== userD) throw new Error(`C 推荐人应为 ${userD}，实际 ${c.referrer_id}`)
      if (c.referrer_nickname !== P + 'referrer') throw new Error('推荐人昵称不符')
      if (e.referrer_id !== null) throw new Error('E 不应有推荐人')
    })

    await test('detail 的 is_stats_viewer：主理人/工作人员 1，无关会员 0', async () => {
      const a = await act('detail', { id: actX }, P + 'owner')
      const b = await act('detail', { id: actX }, P + 'staff')
      const f = await act('detail', { id: actX }, P + 'f')
      if (a.data.is_stats_viewer !== 1) throw new Error('主理人应为 1')
      if (b.data.is_stats_viewer !== 1) throw new Error('工作人员应为 1')
      if (f.data.is_stats_viewer !== 0) throw new Error('无关会员应为 0')
    })

    await test('移出白名单后即时拒', async () => {
      await conn.query('DELETE FROM activity_staff WHERE activity_id = ? AND user_id = ?', [actX, userB])
      const r = await act('statsGet', { id: actX }, P + 'staff')
      if (r.code === 0) throw new Error('移除后不应通过')
    })
  } finally {
    await conn.query('DELETE FROM activity_staff WHERE activity_id = ?', [actX])
    await conn.query('DELETE FROM activity_signups WHERE activity_id = ?', [actX])
    await conn.query('DELETE FROM activities WHERE id = ?', [actX])
    await conn.query('DELETE FROM users WHERE openid LIKE ?', [P + '%'])
    await conn.end()
    console.log('\n  测试数据已清理')
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)  // 云函数 db.js 连接池 keepAlive 会挂住事件循环，须显式退出
}

run().catch(e => { console.error('测试异常：', e); process.exit(1) })
