// 分享计数测试 — recordShare 云函数（PRD 3.1.1 分享数）
// 覆盖：累加 share_count、写 action='share' 互动行、参数/存在性校验、非法用户拒绝。
// 测试用户以 test_share_ 前缀创建，日记为 private 不污染广场，结束时硬删。
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const OPENID = 'test_share_u1'

async function run() {
  console.log('=== 分享计数测试（recordShare）===\n')
  let passed = 0, failed = 0
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  async function shareCount(diaryId) {
    const [[row]] = await conn.query('SELECT share_count FROM diaries WHERE id = ?', [diaryId])
    return row.share_count
  }

  // 准备：登录建用户 → 建私密日记（初始 share_count=0）
  await callFn('login', {}, OPENID)
  // 写日记为会员专享，将测试用户升为有效会员后再建日记（结束时随用户硬删）
  await conn.query("UPDATE users SET identity='member', member_until=DATE_ADD(CURDATE(),INTERVAL 1 YEAR) WHERE openid=?", [OPENID])
  const diary = await callFn('createDiary', {
    title: '分享计数测试日记', content: '本条由 fn-share-test 创建，若残留请删除',
    tags: [], permission: 'private',
  }, OPENID)
  const diaryId = diary.data.id

  await test('SHARE-A01 初始分享数为 0', async () => {
    if (await shareCount(diaryId) !== 0) throw new Error('新建日记 share_count 应为 0')
  })

  await test('SHARE-A02 记录一次分享 → share_count+1 且返回最新值', async () => {
    const r = await callFn('recordShare', { diaryId }, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.shares !== 1) throw new Error(`返回 shares=${r.data.shares}，期望 1`)
    if (await shareCount(diaryId) !== 1) throw new Error('share_count 未 +1')
  })

  await test('SHARE-A03 同一用户重复分享幂等，不重复计数', async () => {
    await callFn('recordShare', { diaryId }, OPENID)
    const r = await callFn('recordShare', { diaryId }, OPENID)
    if (r.data.shares !== 1) throw new Error(`同一用户重复分享应仍为 1，实际 ${r.data.shares}`)
  })

  await test('SHARE-A04 另一用户分享 → 去重分享人 +1', async () => {
    await callFn('login', {}, 'test_share_u2')
    const r = await callFn('recordShare', { diaryId }, 'test_share_u2')
    if (r.data.shares !== 2) throw new Error(`期望 2，实际 ${r.data.shares}`)
    const [[row]] = await conn.query(
      "SELECT COUNT(*) n FROM interactions WHERE target_type='diary' AND target_id=? AND action='share'", [diaryId])
    if (row.n !== 2) throw new Error(`互动行 ${row.n} 条，期望 2`)
  })

  await test('SHARE-A05 缺 diaryId 拒绝', async () => {
    const r = await callFn('recordShare', {}, OPENID)
    if (r.code === 0) throw new Error('缺 diaryId 不应通过')
  })

  await test('SHARE-A06 日记不存在拒绝', async () => {
    const r = await callFn('recordShare', { diaryId: 999999999 }, OPENID)
    if (r.code === 0) throw new Error('不存在的日记不应通过')
  })

  await test('SHARE-A07 未注册用户拒绝', async () => {
    const r = await callFn('recordShare', { diaryId }, 'test_share_ghost_not_exist')
    if (r.code === 0) throw new Error('未注册用户不应通过')
  })

  // 清理（interactions 先删，再删日记与用户）
  await conn.query("DELETE FROM interactions WHERE target_type='diary' AND target_id = ?", [diaryId])
  await conn.query('DELETE FROM diaries WHERE id = ?', [diaryId])
  await conn.query("DELETE FROM users WHERE openid LIKE 'test_share_%'")
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
