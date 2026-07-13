// 活动分享流 + 全量活动列表测试 — FEED-01 ~ FEED-06（活动页重构后端）
// postFeed：跨活动聚合 active 分享，倒序分页，游客可浏览；list mode:'all'：平铺按开始时间倒序
// 测试活动 test_ 前缀创建，结束按 posts → signups → activities 顺序硬删（FK）
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const SIGNED = 'mock_yanqiu'

async function run() {
  console.log('=== 活动分享流测试（FEED-01~06）===\n')
  let passed = 0, failed = 0, token = null
  const createdActs = []

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const act = (action, payload, openid = SIGNED) => callFn('activity', { action, payload }, openid)
  const admin = (action, payload) => callFn('admin', { action, token, payload })
  const conn = await mysql.createConnection(DB)

  const login = await callFn('admin', { action: 'login', payload: { password: DB.adminPassword } })
  token = login.data.token

  const past = new Date(Date.now() - 3600000).toISOString().slice(0, 19).replace('T', ' ')
  const older = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 19).replace('T', ' ')
  async function makeActivity(patch = {}) {
    const r = await admin('activitySave', {
      title: 'test_feed活动' + Math.random().toString(36).slice(2, 6),
      content: '测试', images: [], start_time: past,
      type: 'offline', city: '广州', location: '测试地点',
      capacity: 0, status: 'online', ...patch,
    })
    if (r.code !== 0) throw new Error('前置建活动失败: ' + r.msg)
    createdActs.push(r.data.id)
    return r.data.id
  }

  try {
    // 造数：两个已开始的活动（online / finished），报名后各发分享，共 3 条 active + 1 条已删
    const actA = await makeActivity()
    const actB = await makeActivity({ status: 'finished', start_time: older })
    await act('signup', { id: actA, name: '砚秋' })
    // finished 活动不可报名，直接落库报名记录（补发场景）
    const [[u]] = await conn.query('SELECT id FROM users WHERE openid = ?', [SIGNED])
    await conn.query('INSERT INTO activity_signups (activity_id, user_id, name) VALUES (?, ?, ?)', [actB, u.id, '砚秋'])
    const p1 = await act('postCreate', { id: actA, content: 'test_feed 分享一' })
    const p2 = await act('postCreate', { id: actA, content: 'test_feed 分享二' })
    const p3 = await act('postCreate', { id: actB, content: 'test_feed 分享三（往期）' })
    const pDel = await act('postCreate', { id: actA, content: 'test_feed 将被删除' })
    if (p1.code || p2.code || p3.code || pDel.code) throw new Error('前置发分享失败')
    await act('postDelete', { id: pDel.data.id })

    await test('FEED-01 postFeed 形状：分页字段 + 活动标题/用户昵称 + 倒序', async () => {
      const r = await act('postFeed', { page: 1, pageSize: 10 })
      if (r.code !== 0) throw new Error(r.msg)
      const d = r.data
      for (const k of ['list', 'total', 'page', 'pageSize']) if (!(k in d)) throw new Error(`缺字段 ${k}`)
      const row = d.list[0]
      for (const k of ['id', 'activity_id', 'activity_title', 'content', 'images', 'nickname', 'avatar_hue', 'created_at']) {
        if (!(k in row)) throw new Error(`行缺字段 ${k}`)
      }
      // 最新发布在前：刚发的三条应在最前（pDel 已删不算）
      if (row.id !== p3.data.id) throw new Error(`首条应为最新分享 ${p3.data.id}，实际 ${row.id}`)
      if (!row.activity_title.startsWith('test_feed')) throw new Error('未带出活动标题')
    })

    await test('FEED-02 postFeed 分页：两页不重叠', async () => {
      const r1 = await act('postFeed', { page: 1, pageSize: 2 })
      const r2 = await act('postFeed', { page: 2, pageSize: 2 })
      if (r1.code || r2.code) throw new Error(r1.msg || r2.msg)
      const ids1 = r1.data.list.map(p => p.id), ids2 = r2.data.list.map(p => p.id)
      if (ids1.length !== 2) throw new Error('第一页应 2 条')
      if (ids2.some(id => ids1.includes(id))) throw new Error('两页重叠')
      if (r1.data.total < 3) throw new Error(`total=${r1.data.total} 应 ≥3`)
    })

    await test('FEED-03 已删除分享不出现在 feed', async () => {
      const r = await act('postFeed', { page: 1, pageSize: 50 })
      if (r.code !== 0) throw new Error(r.msg)
      if (r.data.list.some(p => p.id === pDel.data.id)) throw new Error('已删分享泄露')
    })

    await test('FEED-04 游客（未注册 openid）可浏览 feed', async () => {
      const r = await act('postFeed', { page: 1, pageSize: 5 }, 'test_ghost_' + Date.now())
      if (r.code !== 0) throw new Error(`游客应可浏览：${r.msg}`)
      if (!Array.isArray(r.data.list)) throw new Error('形状不符')
    })

    await test('FEED-05 list mode:all 平铺按开始时间倒序，draft 不含', async () => {
      const draftId = await makeActivity({ status: 'draft' })
      const r = await act('list', { mode: 'all' })
      if (r.code !== 0) throw new Error(r.msg)
      const list = r.data.list
      if (!Array.isArray(list)) throw new Error('mode:all 应返回 { list } 平铺数组')
      if (list.some(a => a.id === draftId)) throw new Error('draft 泄露')
      if (!list.some(a => a.id === actA) || !list.some(a => a.id === actB)) throw new Error('online/finished 应都在')
      for (let i = 1; i < list.length; i++) {
        if (list[i - 1].start_time < list[i].start_time) throw new Error('未按开始时间倒序')
      }
    })

    await test('FEED-06 list mode:all + typeId 筛选', async () => {
      const [[t]] = await conn.query("SELECT id FROM activity_types WHERE is_active = 1 ORDER BY id LIMIT 1")
      const typedId = await makeActivity({ type_id: t.id })
      const r = await act('list', { mode: 'all', typeId: t.id })
      if (r.code !== 0) throw new Error(r.msg)
      if (!r.data.list.some(a => a.id === typedId)) throw new Error('筛选后应含该类型测试活动')
      if (r.data.list.some(a => a.type_id !== null && a.type_id !== t.id)) throw new Error('混入其它类型')
    })
  } finally {
    if (createdActs.length) {
      const ph = createdActs.map(() => '?').join(',')
      await conn.query(`DELETE FROM activity_posts WHERE activity_id IN (${ph})`, createdActs)
      await conn.query(`DELETE FROM activity_signups WHERE activity_id IN (${ph})`, createdActs)
      await conn.query(`DELETE FROM activities WHERE id IN (${ph})`, createdActs)
    }
    await conn.query("DELETE FROM admin_logs WHERE detail LIKE '%test_feed%'")
    await conn.end()
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
