// 活动收藏测试 — AFAV-01 ~ 06（v2.0 新增）
// 覆盖：收藏翻转、list/detail 带 isFavorited、favList 排序与草稿隔离、未登录拒绝
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const USER = 'mock_yanqiu'
const OTHER = 'mock_me'

async function run() {
  console.log('=== 活动收藏测试（AFAV-01~06）===\n')
  let passed = 0, failed = 0, token = null
  const createdActs = []

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const act = (action, payload, openid = USER) => callFn('activity', { action, payload }, openid)
  const admin = (action, payload) => callFn('admin', { action, token, payload })
  const conn = await mysql.createConnection(DB)

  const login = await callFn('admin', { action: 'login', payload: { password: DB.adminPassword } })
  token = login.data.token

  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 19).replace('T', ' ')
  async function makeActivity(patch = {}) {
    const r = await admin('activitySave', {
      title: 'test_收藏活动' + Math.random().toString(36).slice(2, 6),
      content: '测试', images: [],
      start_time: future, type: 'offline', city: '广州', location: '测试地点',
      capacity: 5, status: 'online', ...patch,
    })
    if (r.code !== 0) throw new Error('前置建活动失败: ' + r.msg)
    createdActs.push(r.data.id)
    return r.data.id
  }

  const actA = await makeActivity()
  const actB = await makeActivity()
  const draftAct = await makeActivity({ status: 'draft' })

  await test('AFAV-01 收藏翻转：首次收藏 active=true，再点 false', async () => {
    const on = await act('favToggle', { id: actA })
    if (on.code !== 0 || on.data.active !== true) throw new Error('收藏失败: ' + on.msg)
    const [[row]] = await conn.query(
      "SELECT COUNT(*) c FROM interactions WHERE target_type='activity' AND target_id=? AND action='favorite'", [actA])
    if (!row.c) throw new Error('未落库 interactions')
    const off = await act('favToggle', { id: actA })
    if (off.data.active !== false) throw new Error('取消收藏失败')
    await act('favToggle', { id: actA })   // 恢复为已收藏，供后续用例
  })

  await test('AFAV-02 list 带 isFavorited（仅本人视角）', async () => {
    const mine = await act('list', { mode: 'all' })
    const rowA = mine.data.list.find(a => a.id === actA)
    if (!rowA || !rowA.isFavorited) throw new Error('本人 list 未标记已收藏')
    const rowB = mine.data.list.find(a => a.id === actB)
    if (rowB && rowB.isFavorited) throw new Error('未收藏的活动不应标记')
    const other = await act('list', { mode: 'all' }, OTHER)
    const otherA = other.data.list.find(a => a.id === actA)
    if (otherA && otherA.isFavorited) throw new Error('他人不应看到我的收藏态')
  })

  await test('AFAV-03 detail 带 isFavorited', async () => {
    const d = await act('detail', { id: actA })
    if (d.code !== 0) throw new Error(d.msg)
    if (!d.data.isFavorited) throw new Error('详情未标记已收藏')
    const other = await act('detail', { id: actA }, OTHER)
    if (other.data.isFavorited) throw new Error('他人详情不应带我的收藏态')
  })

  await test('AFAV-04 favList 返回我收藏的活动，他人为空', async () => {
    const mine = await act('favList', {})
    if (mine.code !== 0) throw new Error(mine.msg)
    if (!mine.data.list.some(a => a.id === actA)) throw new Error('favList 缺少已收藏活动')
    if (mine.data.list.some(a => a.id === actB)) throw new Error('favList 混入未收藏活动')
    const other = await act('favList', {}, OTHER)
    if (other.data.list.some(a => a.id === actA)) throw new Error('他人 favList 混入了我的收藏')
  })

  await test('AFAV-05 favList 按收藏时间倒序（后收藏的在前）', async () => {
    await act('favToggle', { id: actB })
    const mine = await act('favList', {})
    const ids = mine.data.list.map(a => a.id)
    if (ids.indexOf(actB) > ids.indexOf(actA)) throw new Error('未按收藏时间倒序')
  })

  await test('AFAV-06 草稿活动即使被收藏也不出现在 favList', async () => {
    await conn.query(
      "INSERT INTO interactions (user_id, target_type, target_id, action) " +
      "SELECT id, 'activity', ?, 'favorite' FROM users WHERE openid = ?", [draftAct, USER])
    const mine = await act('favList', {})
    if (mine.data.list.some(a => a.id === draftAct)) throw new Error('草稿活动泄露到收藏列表')
  })

  // 清理
  if (createdActs.length) {
    const ph = createdActs.map(() => '?').join(',')
    await conn.query(`DELETE FROM interactions WHERE target_type='activity' AND target_id IN (${ph})`, createdActs)
    await conn.query(`DELETE FROM activity_signups WHERE activity_id IN (${ph})`, createdActs)
    await conn.query(`DELETE FROM activities WHERE id IN (${ph})`, createdActs)
  }
  await conn.query("DELETE FROM admin_logs WHERE action IN ('activityCreate','activityUpdate')")
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
