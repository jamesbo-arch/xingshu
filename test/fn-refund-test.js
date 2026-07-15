// 会员退费测试（REF-01~10）— admin 云函数 refundPreview / refundOrder + createOrder 续费关联
// 规则：入会（支付）7 天内全额退款；过 7 天按剩余天数折算（金额 × 剩余天数 ÷ 订单总天数）。
// 退费落库：新退款订单 status='refunded'、related_order_id=原缴费单；用户即时回落 authed 并清会员期。
// 测试数据 test_ 前缀，结束硬删。
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

function fmtDate(d) { return d.toISOString().slice(0, 10) }
function daysAgo(n) { return new Date(Date.now() - n * 86400000) }
function daysLater(n) { return new Date(Date.now() + n * 86400000) }

async function run() {
  console.log('=== 会员退费测试 ===\n')
  let passed = 0, failed = 0, token = null
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const admin = (action, payload) => callFn('admin', { action, token, payload })

  // ── 造数：三个测试用户 + 手工订单 ──
  async function mkUser(suffix, identity, memberUntil) {
    const [r] = await conn.query(
      `INSERT INTO users (openid, nickname, identity, avatar_hue, member_from, member_until)
       VALUES (?, ?, ?, 30, ?, ?)`,
      [`test_refund_${suffix}`, `test_refund_${suffix}`, identity,
       memberUntil ? fmtDate(daysAgo(30)) : null, memberUntil])
    return r.insertId
  }
  async function mkOrder(id, userId, amount, payDaysAgo, validFrom, validUntil) {
    await conn.query(
      `INSERT INTO orders (id, user_id, amount, plan, method, status, member_days,
         valid_from, valid_until, payment_time)
       VALUES (?, ?, ?, '年度会员', '微信转账', 'paid', 365, ?, ?, ?)`,
      [id, userId, amount, validFrom, validUntil,
       fmtDate(daysAgo(payDaysAgo)) + ' 10:00:00'])
  }

  // uA：3 天前入会（7 天内全额）；uB：30 天前入会（折算）；uC：会员已过期
  // 两字段语义：identity 存授权态 authed，会员资格由 member_until 表达
  const uA = await mkUser('a', 'authed', fmtDate(daysLater(362)))
  const uB = await mkUser('b', 'authed', fmtDate(daysLater(335)))
  const uC = await mkUser('c', 'authed', fmtDate(daysAgo(1)))
  await mkOrder('XS-TEST-A1', uA, 365, 3, fmtDate(daysAgo(3)), fmtDate(daysLater(362)))
  await mkOrder('XS-TEST-B1', uB, 365, 30, fmtDate(daysAgo(30)), fmtDate(daysLater(335)))
  await mkOrder('XS-TEST-C1', uC, 365, 400, fmtDate(daysAgo(400)), fmtDate(daysAgo(1)))
  const createdOrderIds = ['XS-TEST-A1', 'XS-TEST-B1', 'XS-TEST-C1']

  try {
    const r = await callFn('admin', { action: 'login', payload: { password: DB.adminPassword } })
    token = r.data && r.data.token
    if (!token) throw new Error('管理员登录失败，无法继续')

    await test('REF-01 orders 表含 related_order_id 字段', async () => {
      const [cols] = await conn.query("SHOW COLUMNS FROM orders LIKE 'related_order_id'")
      if (!cols.length) throw new Error('字段不存在')
    })

    await test('REF-02 入会 7 天内退费预览：全额', async () => {
      const r = await admin('refundPreview', { userId: uA })
      if (r.code !== 0) throw new Error(r.msg)
      const d = r.data
      if (d.rule !== 'full') throw new Error(`期望 full，实际 ${d.rule}`)
      if (Number(d.refundAmount) !== 365) throw new Error(`期望 365，实际 ${d.refundAmount}`)
      if (d.order.id !== 'XS-TEST-A1') throw new Error('未定位到最近缴费单')
    })

    await test('REF-03 过 7 天退费预览：按剩余天数折算', async () => {
      const r = await admin('refundPreview', { userId: uB })
      if (r.code !== 0) throw new Error(r.msg)
      const d = r.data
      if (d.rule !== 'prorated') throw new Error(`期望 prorated，实际 ${d.rule}`)
      // 剩余/总天数由 DB 按日期差算，期望 335/365 → 365×335/365 = 335.00
      const expect = Math.round(365 * d.remainingDays / d.totalDays * 100) / 100
      if (Number(d.refundAmount) !== expect) throw new Error(`期望 ${expect}，实际 ${d.refundAmount}`)
      if (d.remainingDays <= 0 || d.totalDays <= 0) throw new Error('天数派生异常')
    })

    let refundOrderId = null
    await test('REF-04 refundOrder 落库：新退款单关联原单', async () => {
      const r = await admin('refundOrder', { userId: uB })
      if (r.code !== 0) throw new Error(r.msg)
      refundOrderId = r.data.order.id
      createdOrderIds.push(refundOrderId)
      const [[row]] = await conn.query(
        'SELECT status, amount, related_order_id FROM orders WHERE id = ?', [refundOrderId])
      if (!row) throw new Error('退款单未落库')
      if (row.status !== 'refunded') throw new Error(`status=${row.status}`)
      if (row.related_order_id !== 'XS-TEST-B1') throw new Error(`关联=${row.related_order_id}`)
      if (Number(row.amount) !== Number(r.data.refundAmount)) throw new Error('金额与返回不一致')
    })

    await test('REF-05 退费后会员即时失效（会员期清空，授权态不变）', async () => {
      const [[u]] = await conn.query(
        'SELECT identity, member_from, member_until FROM users WHERE id = ?', [uB])
      if (u.identity !== 'authed') throw new Error(`identity=${u.identity}（授权态不应被退费改动）`)
      if (u.member_from !== null || u.member_until !== null) throw new Error('会员期未清空')
    })

    await test('REF-06 重复退费被拒', async () => {
      const r = await admin('refundOrder', { userId: uB })
      if (r.code === 0) throw new Error('不应可重复退费')
    })

    await test('REF-07 非会员退费预览被拒', async () => {
      const [r2] = await conn.query('SELECT id FROM users WHERE id = ?', [uB]) // uB 已回落 authed
      if (!r2.length) throw new Error('测试用户缺失')
      const r = await admin('refundPreview', { userId: uB })
      if (r.code === 0) throw new Error('非会员不应可预览退费')
    })

    await test('REF-08 会员已过期（无剩余天数）退费被拒', async () => {
      const r = await admin('refundPreview', { userId: uC })
      if (r.code === 0) throw new Error('已过期不应可退费')
    })

    await test('REF-09 续费建单自动关联上一张缴费单', async () => {
      const r = await admin('createOrder', { userId: uA, amount: 100, memberDays: 30 })
      if (r.code !== 0) throw new Error(r.msg)
      createdOrderIds.push(r.data.order.id)
      const [[row]] = await conn.query(
        'SELECT related_order_id FROM orders WHERE id = ?', [r.data.order.id])
      if (row.related_order_id !== 'XS-TEST-A1') throw new Error(`关联=${row.related_order_id}`)
    })

    await test('REF-10 退费写入审计日志', async () => {
      const [rows] = await conn.query(
        "SELECT id FROM admin_logs WHERE action = 'refundOrder' AND target_id = ?", [refundOrderId])
      if (!rows.length) throw new Error('无审计记录')
    })
  } finally {
    // 清理：审计 → 订单 → 用户（顺序防 FK）
    await conn.query(
      "DELETE FROM admin_logs WHERE action IN ('refundOrder','createOrder') AND target_id IN (?)",
      [createdOrderIds])
    await conn.query('DELETE FROM orders WHERE user_id IN (?, ?, ?)', [uA, uB, uC])
    await conn.query('DELETE FROM users WHERE id IN (?, ?, ?)', [uA, uB, uC])
    await conn.end()
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  // harness 加载的云函数持有 mysql 连接池，不显式退出进程会挂住 npm test 链
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
