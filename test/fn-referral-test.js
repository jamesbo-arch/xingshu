// 推荐人体系测试 — 对应 test/m15-test-cases.md REF-A01 ~ REF-A09（PRD v2.2）
// 测试用户以 test_ref_ 前缀创建，结束时硬删
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

async function run() {
  console.log('=== 推荐人体系测试（REF-A01~A09）===\n')
  let passed = 0, failed = 0, token = null
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const login = await callFn('admin', { action: 'login', payload: { password: DB.adminPassword } })
  token = login.data.token
  const admin = (action, payload) => callFn('admin', { action, token, payload })

  // 分享人：种子用户 mock_yanqiu
  const [[sharer]] = await conn.query("SELECT id FROM users WHERE openid = 'mock_yanqiu'")

  await test('REF-A01 users.referrer_user_id 列存在', async () => {
    const [cols] = await conn.query("SHOW COLUMNS FROM users LIKE 'referrer_user_id'")
    if (!cols.length) throw new Error('列缺失')
  })

  let newUserId
  await test('REF-A02 新用户经分享码登录 → 绑定推荐人', async () => {
    const r = await callFn('login', { scene: `d=1&s=${sharer.id}` }, 'test_ref_new1')
    if (r.code !== 0) throw new Error(r.msg)
    newUserId = r.data.id
    if (r.data.referrer_user_id !== sharer.id) throw new Error(`referrer=${r.data.referrer_user_id}`)
  })

  await test('REF-A03 已有推荐人的用户再扫他人码 → 不覆盖', async () => {
    const [[other]] = await conn.query("SELECT id FROM users WHERE openid = 'mock_luminyuan'")
    const r = await callFn('login', { scene: `a=2&s=${other.id}` }, 'test_ref_new1')
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.referrer_user_id !== sharer.id) throw new Error(`被覆盖为 ${r.data.referrer_user_id}`)
  })

  await test('REF-A04/A06 scene 无效值（不存在的分享人）→ 忽略且登录正常', async () => {
    const r = await callFn('login', { scene: 'd=1&s=99999999' }, 'test_ref_new2')
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.referrer_user_id != null) throw new Error(`不应绑定：${r.data.referrer_user_id}`)
  })

  await test('REF-A05 老用户（无推荐人）扫码 → 不绑定', async () => {
    // test_ref_new2 已是老用户且无推荐人，再带 scene 登录
    const r = await callFn('login', { scene: `d=1&s=${sharer.id}` }, 'test_ref_new2')
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.referrer_user_id != null) throw new Error('老用户不应被绑定')
  })

  await test('REF-A07 admin 修改推荐人成功且写审计', async () => {
    const [[target]] = await conn.query("SELECT id FROM users WHERE openid = 'test_ref_new2'")
    const r = await admin('updateReferrer', { userId: target.id, referrerId: sharer.id })
    if (r.code !== 0) throw new Error(r.msg)
    const [[u]] = await conn.query('SELECT referrer_user_id FROM users WHERE id = ?', [target.id])
    if (u.referrer_user_id !== sharer.id) throw new Error('未生效')
    const [[{ c }]] = await conn.query(
      "SELECT COUNT(*) c FROM admin_logs WHERE action='updateReferrer' AND target_id = ?", [String(target.id)])
    if (c !== 1) throw new Error('审计缺失')
  })

  await test('REF-A08 admin 校验：推荐人不能是本人', async () => {
    const r = await admin('updateReferrer', { userId: newUserId, referrerId: newUserId })
    if (r.code === 0) throw new Error('不应允许自荐')
  })

  await test('REF-A09 admin 校验：互为推荐循环被拒', async () => {
    // new1 的推荐人是 yanqiu；构造：让 new2 的推荐人是 new1，再把 new1 的推荐人改成 new2 → 应拒绝
    const [[u2]] = await conn.query("SELECT id FROM users WHERE openid = 'test_ref_new2'")
    await admin('updateReferrer', { userId: u2.id, referrerId: newUserId })
    const r = await admin('updateReferrer', { userId: newUserId, referrerId: u2.id })
    if (r.code === 0) throw new Error('不应允许互为推荐')
  })

  await test('REF-A07b admin 清空推荐人 + userDetail 返回"他推荐的用户"', async () => {
    const d = await admin('userDetail', { id: sharer.id })
    if (d.code !== 0) throw new Error(d.msg)
    if (!Array.isArray(d.data.referred)) throw new Error('缺少 referred 列表')
    if (!d.data.referred.some(u => u.id === newUserId)) throw new Error('推荐列表不含新用户')
    const r = await admin('updateReferrer', { userId: newUserId, referrerId: null })
    if (r.code !== 0) throw new Error(r.msg)
    const [[u]] = await conn.query('SELECT referrer_user_id FROM users WHERE id = ?', [newUserId])
    if (u.referrer_user_id != null) throw new Error('清空未生效')
  })

  // 清理
  await conn.query("DELETE FROM admin_logs WHERE action='updateReferrer'")
  await conn.query("DELETE FROM users WHERE openid LIKE 'test_ref_%'")
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
