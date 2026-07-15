// 会员订单管理测试 — 对应 test/prd-ch3-test-cases.md ORDER-A01 ~ A08（PRD v2.4 §5.2.7）
// 经 fn-harness 调 admin 云函数（HMAC token 鉴权）。测试用户/订单以 test_order_ 前缀，结束硬删
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

async function run() {
  console.log('=== 会员订单管理测试（ORDER-A01~A11）===\n')
  let passed = 0, failed = 0
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const login = await callFn('admin', { action: 'login', payload: { password: DB.adminPassword } })
  const token = login.data.token
  const admin = (action, payload) => callFn('admin', { action, token, payload })

  // 由 DB 计算预期日期，避免与 JS 时区错位
  const [[{ today, plus365 }]] = await conn.query(
    "SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d') today, DATE_FORMAT(DATE_ADD(CURDATE(),INTERVAL 365 DAY),'%Y-%m-%d') plus365")

  // 准备测试用户（直接建表以精确控制身份与到期日）
  async function mkUser(openid, identity, memberUntil = null) {
    await conn.query(
      "INSERT INTO users (openid, nickname, identity, avatar_hue, member_until, member_from) VALUES (?,?,?,?,?,?)",
      [openid, openid, identity, 60, memberUntil, memberUntil ? today : null])
    const [[u]] = await conn.query('SELECT id FROM users WHERE openid = ?', [openid])
    return u.id
  }
  const authedId = await mkUser('test_order_authed', 'authed')
  const memberId = await mkUser('test_order_member', 'member', await (async () => {
    const [[r]] = await conn.query("SELECT DATE_FORMAT(DATE_ADD(CURDATE(),INTERVAL 30 DAY),'%Y-%m-%d') d"); return r.d
  })())
  const guestId = await mkUser('test_order_guest', 'guest')

  await test('ORDER-A01 无 token → 拒绝（-401）', async () => {
    const r = await callFn('admin', { action: 'orderList', payload: {} })
    if (r.code !== -401) throw new Error(`应 -401，实得 ${r.code}`)
  })

  let order1Id
  await test('ORDER-A02 为 authed 用户建单 → 订单 paid、用户变会员、有效期今日+365', async () => {
    const r = await admin('createOrder', { userId: authedId, amount: 365 })
    if (r.code !== 0) throw new Error(r.msg)
    order1Id = r.data.order.id
    if (r.data.validUntil !== plus365) throw new Error(`validUntil=${r.data.validUntil}，期望 ${plus365}`)
    const [[o]] = await conn.query("SELECT status, DATE_FORMAT(valid_until,'%Y-%m-%d') vu FROM orders WHERE id = ?", [order1Id])
    if (o.status !== 'paid') throw new Error(`订单状态 ${o.status}`)
    if (o.vu !== plus365) throw new Error(`订单 valid_until=${o.vu}`)
    // 两字段语义：identity 列保持授权态（authed），会员资格 = member_until 落库；派生展示为 member
    const [[u]] = await conn.query(
      "SELECT identity, DATE_FORMAT(member_until,'%Y-%m-%d') mu FROM users WHERE id = ?", [authedId])
    if (u.identity !== 'authed') throw new Error(`identity 列应保持授权态 authed，实际 ${u.identity}`)
    if (u.mu !== plus365) throw new Error(`member_until=${u.mu}，会员期未落库`)
    const d = await admin('userDetail', { id: authedId })
    if (d.data.user.identity !== 'member') throw new Error(`admin 派生身份 ${d.data.user.identity}，应为 member`)
  })

  await test('ORDER-A03 现会员续期 → 有效期从原到期日顺延（时长叠加，不覆盖剩余）', async () => {
    const [[{ expect }]] = await conn.query(
      "SELECT DATE_FORMAT(DATE_ADD(DATE_ADD(CURDATE(),INTERVAL 30 DAY),INTERVAL 365 DAY),'%Y-%m-%d') expect")
    const r = await admin('createOrder', { userId: memberId, amount: 300, note: '续费优惠' })
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.validUntil !== expect) throw new Error(`续期 validUntil=${r.data.validUntil}，期望 ${expect}（叠加剩余30天）`)
    const [[u]] = await conn.query("SELECT DATE_FORMAT(member_until,'%Y-%m-%d') mu FROM users WHERE id = ?", [memberId])
    if (u.mu !== expect) throw new Error(`用户 member_until=${u.mu}`)
  })

  await test('ORDER-A04 游客不可开通 → 拒绝', async () => {
    const r = await admin('createOrder', { userId: guestId, amount: 365 })
    if (r.code === 0) throw new Error('游客不应可建单')
  })

  await test('ORDER-A05 非法金额 / 缺 userId → 拒绝', async () => {
    const r1 = await admin('createOrder', { userId: authedId, amount: 0 })
    if (r1.code === 0) throw new Error('金额 0 不应通过')
    const r2 = await admin('createOrder', { amount: 365 })
    if (r2.code === 0) throw new Error('缺 userId 不应通过')
  })

  await test('ORDER-A06 建单写 admin_logs 审计', async () => {
    const [[{ c }]] = await conn.query(
      "SELECT COUNT(*) c FROM admin_logs WHERE action='createOrder' AND target_id = ?", [order1Id])
    if (c !== 1) throw new Error(`审计缺失，count=${c}`)
  })

  await test('ORDER-A07 orderList 状态派生：expiring / expired', async () => {
    // 直接构造两笔已过期 / 即将到期订单
    await conn.query(
      "INSERT INTO orders (id,user_id,amount,plan,method,status,member_days,valid_from,valid_until,payment_time) " +
      "VALUES ('XS-TESTEXPIRED',?,365,'年度会员','offline','paid',365,DATE_SUB(CURDATE(),INTERVAL 400 DAY),DATE_SUB(CURDATE(),INTERVAL 35 DAY),NOW())", [authedId])
    await conn.query(
      "INSERT INTO orders (id,user_id,amount,plan,method,status,member_days,valid_from,valid_until,payment_time) " +
      "VALUES ('XS-TESTEXPIRING',?,365,'年度会员','offline','paid',365,CURDATE(),DATE_ADD(CURDATE(),INTERVAL 10 DAY),NOW())", [authedId])
    const r = await admin('orderList', { pageSize: 100000 })  // 取全量以定位测试数据（服务端分页后）
    if (r.code !== 0) throw new Error(r.msg)
    const expired = r.data.list.find(o => o.id === 'XS-TESTEXPIRED')
    const expiring = r.data.list.find(o => o.id === 'XS-TESTEXPIRING')
    if (!expired || expired.state !== 'expired') throw new Error(`过期单 state=${expired && expired.state}`)
    if (!expiring || expiring.state !== 'expiring') throw new Error(`临期单 state=${expiring && expiring.state}`)
    // 状态筛选（SQL 下推）
    const rf = await admin('orderList', { status: 'expired', pageSize: 100000 })
    if (!rf.data.list.every(o => o.state === 'expired')) throw new Error('状态筛选未生效')
    if (!rf.data.list.some(o => o.id === 'XS-TESTEXPIRED')) throw new Error('expired 筛选应含测试过期单')
  })

  await test('ORDER-A08 userOrders 归属过滤 + orderDetail', async () => {
    const r = await admin('userOrders', { userId: memberId })
    if (r.code !== 0) throw new Error(r.msg)
    if (!r.data.list.every(o => o.userId === memberId)) throw new Error('userOrders 含非本人订单')
    if (r.data.list.length < 1) throw new Error('会员用户应至少 1 笔订单')
    const d = await admin('orderDetail', { id: order1Id })
    if (d.code !== 0 || !d.data.order || d.data.order.id !== order1Id) throw new Error('orderDetail 返回异常')
  })

  await test('ORDER-A09 显式指定有效期 → 按操作者所填 valid_from/until 落库（不走自动计算）', async () => {
    const explicitId = await mkUser('test_order_explicit', 'authed')
    const vf = '2026-09-01', vu = '2027-09-01'
    const r = await admin('createOrder', { userId: explicitId, amount: 365, validFrom: vf, validUntil: vu })
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.validUntil !== vu) throw new Error(`validUntil=${r.data.validUntil}，期望 ${vu}`)
    const [[o]] = await conn.query(
      "SELECT DATE_FORMAT(valid_from,'%Y-%m-%d') vf, DATE_FORMAT(valid_until,'%Y-%m-%d') vu FROM orders WHERE id = ?", [r.data.order.id])
    if (o.vf !== vf || o.vu !== vu) throw new Error(`订单落库 ${o.vf}→${o.vu}，期望 ${vf}→${vu}`)
    const [[u]] = await conn.query(
      "SELECT DATE_FORMAT(member_from,'%Y-%m-%d') mf, DATE_FORMAT(member_until,'%Y-%m-%d') mu FROM users WHERE id = ?", [explicitId])
    if (u.mf !== vf || u.mu !== vu) throw new Error(`用户会员期 ${u.mf}→${u.mu}，期望 ${vf}→${vu}`)
  })

  await test('ORDER-A10 失效日期不晚于生效日期 → 拒绝', async () => {
    const r = await admin('createOrder', { userId: authedId, amount: 365, validFrom: '2026-09-01', validUntil: '2026-09-01' })
    if (r.code === 0) throw new Error('失效日=生效日不应通过')
    const r2 = await admin('createOrder', { userId: authedId, amount: 365, validFrom: '2026-09-01', validUntil: '2026-08-01' })
    if (r2.code === 0) throw new Error('失效日早于生效日不应通过')
  })

  await test('ORDER-A11 未传有效期但支付日回填过去 → 生效日默认取支付日（非今日）', async () => {
    const backId = await mkUser('test_order_backdate', 'authed')
    const r = await admin('createOrder', { userId: backId, amount: 365, paymentTime: '2026-05-19 00:00:00' })
    if (r.code !== 0) throw new Error(r.msg)
    const [[o]] = await conn.query(
      "SELECT DATE_FORMAT(valid_from,'%Y-%m-%d') vf, DATE_FORMAT(valid_until,'%Y-%m-%d') vu FROM orders WHERE id = ?", [r.data.order.id])
    if (o.vf !== '2026-05-19') throw new Error(`valid_from=${o.vf}，期望 2026-05-19（支付日，而非今日）`)
    if (o.vu !== '2027-05-19') throw new Error(`valid_until=${o.vu}，期望 2027-05-19（支付日+365）`)
  })

  // 清理：先按测试用户的订单 id 精确清审计，再删订单与用户（orders 对 users 有 ON DELETE CASCADE）
  const [testOrders] = await conn.query(
    "SELECT o.id FROM orders o JOIN users u ON o.user_id = u.id WHERE u.openid LIKE 'test_order_%'")
  const ids = testOrders.map(o => o.id)
  if (ids.length) {
    await conn.query('DELETE FROM admin_logs WHERE action = ? AND target_id IN (?)', ['createOrder', ids])
  }
  await conn.query("DELETE FROM users WHERE openid LIKE 'test_order_%'")
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
