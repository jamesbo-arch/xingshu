// 活动模块云函数测试 — 对应 test/m15-test-cases.md ACT-A01 ~ ACT-A11
// 测试活动以 test_ 前缀创建，结束时硬删
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

async function run() {
  console.log('=== 活动模块云函数测试（ACT-A01~A11）===\n')
  let passed = 0, failed = 0, token = null
  const created = []

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const act = (action, payload, openid = 'mock_me') => callFn('activity', { action, payload }, openid)
  const admin = (action, payload) => callFn('admin', { action, token, payload })
  const conn = await mysql.createConnection(DB)

  // 登录 admin 获取 token
  const login = await callFn('admin', { action: 'login', payload: { password: DB.adminPassword } })
  token = login.data.token

  // 造数工具
  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 19).replace('T', ' ')
  const futureDeadline = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 19).replace('T', ' ')
  const pastDeadline = new Date(Date.now() - 86400000).toISOString().slice(0, 19).replace('T', ' ')
  async function makeActivity(patch = {}) {
    const r = await admin('activitySave', {
      title: 'test_活动' + Math.random().toString(36).slice(2, 6),
      content: '测试活动介绍', images: [],
      start_time: future, signup_deadline: futureDeadline,
      type: 'offline', city: '广州', location: '测试地点',
      capacity: 3, status: 'online', ...patch,
    })
    created.push(r.data.id)
    return r.data.id
  }

  await test('ACT-A01 表结构与唯一约束', async () => {
    // activit% 现有 4 张表（+types/+posts），此处只断言活动/报名两张必需表存在
    const [t] = await conn.query("SHOW TABLES LIKE 'activit%'")
    const names = t.map(r => Object.values(r)[0])
    if (!names.includes('activities') || !names.includes('activity_signups')) throw new Error('activities/activity_signups 表缺失')
    const [idx] = await conn.query("SHOW INDEX FROM activity_signups WHERE Key_name='uk_activity_user'")
    if (idx.length !== 2) throw new Error('(activity_id, user_id) 唯一约束缺失')
  })

  let onlineId, draftId
  await test('ACT-A02 列表仅含上线/已结束活动，draft 不可见', async () => {
    onlineId = await makeActivity()
    draftId = await makeActivity({ status: 'draft' })
    const r = await act('list')
    if (r.code !== 0) throw new Error(r.msg)
    const all = [...r.data.upcoming, ...r.data.past].map(a => a.id)
    if (!all.includes(onlineId)) throw new Error('online 活动未出现在列表')
    if (all.includes(draftId)) throw new Error('draft 活动泄露到列表')
  })

  await test('ACT-A03 详情字段完整', async () => {
    const r = await act('detail', { id: onlineId })
    if (r.code !== 0) throw new Error(r.msg)
    for (const k of ['title', 'start_time', 'location', 'capacity', 'signup_count', 'content', 'type', 'isSignedUp']) {
      if (!(k in r.data)) throw new Error(`缺少字段 ${k}`)
    }
  })

  await test('ACT-A04 正常报名（计数+1、落库）', async () => {
    const r = await act('signup', { id: onlineId, name: '测试用户', contact: 'wx123' })
    if (r.code !== 0) throw new Error(r.msg)
    const [[a]] = await conn.query('SELECT signup_count FROM activities WHERE id = ?', [onlineId])
    if (a.signup_count !== 1) throw new Error(`计数=${a.signup_count}`)
    const d = await act('detail', { id: onlineId })
    if (!d.data.isSignedUp) throw new Error('isSignedUp 未生效')
  })

  await test('ACT-A05 重复报名被拒且计数不变', async () => {
    const r = await act('signup', { id: onlineId, name: '测试用户' })
    if (r.code === 0) throw new Error('不应允许重复报名')
    const [[a]] = await conn.query('SELECT signup_count FROM activities WHERE id = ?', [onlineId])
    if (a.signup_count !== 1) throw new Error(`计数被污染=${a.signup_count}`)
  })

  await test('ACT-A06 名额已满拒绝报名', async () => {
    const fullId = await makeActivity({ capacity: 1 })
    await act('signup', { id: fullId, name: '甲' }, 'mock_yanqiu')
    const r = await act('signup', { id: fullId, name: '乙' }, 'mock_luminyuan')
    if (r.code === 0 || !r.msg.includes('名额')) throw new Error(`期望名额已满，实际 ${r.msg || 'code 0'}`)
  })

  await test('ACT-A07 报名截止后拒绝', async () => {
    const closedId = await makeActivity({ signup_deadline: pastDeadline })
    const r = await act('signup', { id: closedId, name: '丙' }, 'mock_yeqinghe')
    if (r.code === 0 || !r.msg.includes('截止')) throw new Error(`期望已截止，实际 ${r.msg || 'code 0'}`)
  })

  await test('ACT-A08 称呼必填', async () => {
    const r = await act('signup', { id: onlineId, name: '  ' }, 'mock_sujingxing')
    if (r.code === 0) throw new Error('空称呼不应通过')
  })

  await test('ACT-A09 取消报名（计数-1）；未报名者取消报错', async () => {
    const r = await act('cancelSignup', { id: onlineId })
    if (r.code !== 0) throw new Error(r.msg)
    const [[a]] = await conn.query('SELECT signup_count FROM activities WHERE id = ?', [onlineId])
    if (a.signup_count !== 0) throw new Error(`计数=${a.signup_count}`)
    const r2 = await act('cancelSignup', { id: onlineId }, 'mock_hehuaijin')
    if (r2.code === 0) throw new Error('未报名者取消不应成功')
  })

  await test('ACT-A10 guest 身份（仅微信授权）可报名', async () => {
    // 找/造一个 guest 身份用户
    const [g] = await conn.query("SELECT openid FROM users WHERE identity = 'guest' LIMIT 1")
    let guestOpenid = g.length ? g[0].openid : null
    if (!guestOpenid) {
      guestOpenid = 'test_act_guest'
      await conn.query(
        "INSERT INTO users (openid, nickname, identity, avatar_hue) VALUES (?, '活动游客', 'guest', 90)",
        [guestOpenid])
    }
    const r = await act('signup', { id: onlineId, name: '游客报名' }, guestOpenid)
    if (r.code !== 0) throw new Error(`guest 报名失败: ${r.msg}`)
    await act('cancelSignup', { id: onlineId }, guestOpenid)
    await conn.query("DELETE FROM users WHERE openid = 'test_act_guest'")
  })

  await test('ACT-A11 admin 活动管理（编辑/下线/报名名单）', async () => {
    await act('signup', { id: onlineId, name: '名单验证', contact: '138x' }, 'mock_yanqiu')
    const list = await admin('activitySignups', { id: onlineId })
    if (list.code !== 0 || list.data.total !== 1) throw new Error(`名单数量=${list.data && list.data.total}`)
    const row = list.data.list[0]
    if (row.name !== '名单验证' || !('contact' in row) || !('signedAt' in row)) throw new Error('名单字段不全')
    // 编辑 + 下线
    const upd = await admin('activitySave', { id: onlineId, title: 'test_已改名', start_time: future, status: 'finished' })
    if (upd.code !== 0) throw new Error(upd.msg)
    const al = await admin('activityList')
    const found = al.data.list.find(a => a.id === onlineId)
    if (!found || found.title !== 'test_已改名' || found.status !== 'finished') throw new Error('编辑未生效')
  })

  // 清理测试数据
  if (created.length) {
    await conn.query(`DELETE FROM activity_signups WHERE activity_id IN (${created.map(() => '?').join(',')})`, created)
    await conn.query(`DELETE FROM activities WHERE id IN (${created.map(() => '?').join(',')})`, created)
    await conn.query("DELETE FROM admin_logs WHERE action IN ('activityCreate','activityUpdate')")
    console.log('\n  测试数据已清理')
  }
  await conn.end()

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
