// 日记列表时间筛选测试 — 对应 getDiaryList 的 quick/range/ym 三模式
// 经 fn-harness 本地执行 getDiaryList。测试用户/日记以 test_flt_ 前缀，结束硬删
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const OPENID = 'test_flt_u1'

async function run() {
  console.log('=== 日记列表时间筛选测试 ===\n')
  let passed = 0, failed = 0
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  await conn.query(
    "INSERT INTO users (openid, nickname, identity, avatar_hue, created_by) VALUES (?, '筛选测试', 'authed', 60, ?)",
    [OPENID, OPENID])
  const [[u]] = await conn.query('SELECT id FROM users WHERE openid = ?', [OPENID])
  // 今日一篇、400 天前一篇（跨年、超一年）
  const [rNew] = await conn.query(
    "INSERT INTO diaries (user_id,title,content,permission,status,created_by,created_at) VALUES (?,?,?,'public','active',?,NOW())",
    [u.id, 'flt今日', '今日日记', u.id])
  const [rOld] = await conn.query(
    "INSERT INTO diaries (user_id,title,content,permission,status,created_by,created_at) VALUES (?,?,?,'public','active',?,DATE_SUB(NOW(),INTERVAL 400 DAY))",
    [u.id, 'flt去年', '去年日记', u.id])
  const newId = rNew.insertId, oldId = rOld.insertId

  const ids = (r) => r.data.list.map(d => d.id)
  const list = (payload) => callFn('getDiaryList', { mode: 'mine', pageSize: 100, ...payload }, OPENID)

  await test('无时间筛选：两篇都在', async () => {
    const r = await list({})
    if (!ids(r).includes(newId) || !ids(r).includes(oldId)) throw new Error('基线应含两篇')
  })

  await test('quick=year：含今日、不含 400 天前', async () => {
    const r = await list({ timeMode: 'quick', quickRange: 'year' })
    if (!ids(r).includes(newId)) throw new Error('应含今日')
    if (ids(r).includes(oldId)) throw new Error('不应含 400 天前')
  })

  await test('quick=today：含今日、不含去年', async () => {
    const r = await list({ timeMode: 'quick', quickRange: 'today' })
    if (!ids(r).includes(newId)) throw new Error('应含今日')
    if (ids(r).includes(oldId)) throw new Error('不应含去年')
  })

  await test('quick=all：不筛选（两篇都在）', async () => {
    const r = await list({ timeMode: 'quick', quickRange: 'all' })
    if (!ids(r).includes(newId) || !ids(r).includes(oldId)) throw new Error('all 不应筛选')
  })

  await test('range：起止=今日 → 仅今日', async () => {
    const [[{ today }]] = await conn.query("SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d') today")
    const r = await list({ timeMode: 'range', dateFrom: today, dateTo: today })
    if (!ids(r).includes(newId)) throw new Error('应含今日')
    if (ids(r).includes(oldId)) throw new Error('不应含去年')
  })

  await test('ym：年份=今年 → 含今日、不含去年', async () => {
    const [[{ y }]] = await conn.query('SELECT YEAR(CURDATE()) y')
    const r = await list({ timeMode: 'ym', years: [y] })
    if (!ids(r).includes(newId)) throw new Error('应含今年')
    if (ids(r).includes(oldId)) throw new Error('不应含去年（400天前跨年）')
  })

  await conn.query('DELETE FROM diaries WHERE id IN (?, ?)', [newId, oldId])
  await conn.query("DELETE FROM users WHERE openid = 'test_flt_u1'")
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
