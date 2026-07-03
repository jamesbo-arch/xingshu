// v2.3 微信登录授权测试 — 对应 test/m15-test-cases.md AUTH-A01 ~ AUTH-A06
// 覆盖：unionid 落库与补录、authorize 升级、logout 回退、会员身份恢复
// 测试用户以 test_auth_ 前缀创建，结束时硬删
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

async function run() {
  console.log('=== 微信登录授权测试（AUTH-A01~A06）===\n')
  let passed = 0, failed = 0
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  await test('AUTH-A01 users.unionid / authorized_at 列存在', async () => {
    const [u] = await conn.query("SHOW COLUMNS FROM users LIKE 'unionid'")
    const [a] = await conn.query("SHOW COLUMNS FROM users LIKE 'authorized_at'")
    if (!u.length || !a.length) throw new Error('列缺失')
  })

  await test('AUTH-A02 新用户登录 → identity=guest 且 unionid 落库', async () => {
    const r = await callFn('login', {}, 'test_auth_u1', 'test_auth_union1')
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.identity !== 'guest') throw new Error(`identity=${r.data.identity}`)
    const [[row]] = await conn.query("SELECT unionid FROM users WHERE openid = 'test_auth_u1'")
    if (row.unionid !== 'test_auth_union1') throw new Error(`unionid=${row.unionid}`)
  })

  await test('AUTH-A03 老用户 unionid 为空 → 再登录补录；已有值不覆盖', async () => {
    // 制造历史用户：unionid 置空后带新 unionid 登录 → 补录
    await conn.query("UPDATE users SET unionid = NULL WHERE openid = 'test_auth_u1'")
    await callFn('login', {}, 'test_auth_u1', 'test_auth_union1b')
    const [[row]] = await conn.query("SELECT unionid FROM users WHERE openid = 'test_auth_u1'")
    if (row.unionid !== 'test_auth_union1b') throw new Error('未补录')
    // 已有值：换一个 unionid 再登录 → 不覆盖
    await callFn('login', {}, 'test_auth_u1', 'test_auth_union1c')
    const [[row2]] = await conn.query("SELECT unionid FROM users WHERE openid = 'test_auth_u1'")
    if (row2.unionid !== 'test_auth_union1b') throw new Error(`被覆盖为 ${row2.unionid}`)
  })

  await test('AUTH-A04 authorize：guest → authed，authorized_at 写入', async () => {
    const r = await callFn('updateUserProfile', { authorize: true }, 'test_auth_u1')
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.identity !== 'authed') throw new Error(`identity=${r.data.identity}`)
    if (!r.data.authorized_at) throw new Error('authorized_at 未写入')
  })

  await test('AUTH-A05 logout：authed → guest，unionid 保留', async () => {
    const r = await callFn('updateUserProfile', { logout: true }, 'test_auth_u1')
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.identity !== 'guest') throw new Error(`identity=${r.data.identity}`)
    if (r.data.unionid !== 'test_auth_union1b') throw new Error('unionid 丢失')
  })

  await test('AUTH-A06 会员恢复：member_until 未过期时 authorize → member', async () => {
    await conn.query(
      "UPDATE users SET member_until = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE openid = 'test_auth_u1'")
    const r = await callFn('updateUserProfile', { authorize: true }, 'test_auth_u1')
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.identity !== 'member') throw new Error(`identity=${r.data.identity}，会员未恢复`)
  })

  // 清理
  await conn.query("DELETE FROM users WHERE openid LIKE 'test_auth_%'")
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
