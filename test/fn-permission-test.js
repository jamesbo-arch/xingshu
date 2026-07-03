// 日记权限矩阵测试 — 对应 test/m15-test-cases.md PERM-A01 ~ PERM-A08（PRD v2.1 矩阵）
// 身份：guest=test_perm_guest（临时创建）/ authed=mock_me / member=mock_luminyuan / 作者=mock_yanqiu（member）
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const AUTHOR = 'mock_yanqiu'
const AUTHED = 'mock_me'
const MEMBER = 'mock_luminyuan'
const GUEST = 'test_perm_guest'
// 不重复的编号内容：确保"被截断部分"的文字不会出现在前 30% 里，泄露断言才有效
const LONG_CONTENT = Array.from({ length: 20 }, (_, i) => `第${String(i).padStart(2, '0')}段权限矩阵验证文字`).join('；')

async function run() {
  console.log('=== 日记权限矩阵测试（PERM-A01~A08）===\n')
  let passed = 0, failed = 0
  const created = []
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  // 前置：临时 guest 用户 + 作者（member）名下三种权限的测试日记
  await conn.query(
    "INSERT INTO users (openid, nickname, identity, avatar_hue, created_by) VALUES (?, '权限游客', 'guest', 45, ?) ON DUPLICATE KEY UPDATE identity='guest'",
    [GUEST, GUEST])
  async function makeDiary(permission) {
    const r = await callFn('createDiary', {
      title: `test_perm_${permission}`, content: LONG_CONTENT, tags: [], permission,
    }, AUTHOR)
    created.push(r.data.id)
    return r.data.id
  }
  const pubId = await makeDiary('public')
  const memId = await makeDiary('member')
  const priId = await makeDiary('private')

  const detail = (id, openid) => callFn('getDiaryDetail', { diaryId: id }, openid)
  const list = (openid) => callFn('getDiaryList', { mode: 'square', page: 1, pageSize: 50 }, openid)

  await test('PERM-A01 guest 看公众日记详情 → 引导码且不含内容', async () => {
    const r = await detail(pubId, GUEST)
    if (r.code !== -3) throw new Error(`期望 code -3，实际 ${r.code}`)
    if (JSON.stringify(r).includes(LONG_CONTENT.slice(0, 20))) throw new Error('响应泄露了内容')
  })

  await test('PERM-A02 guest 看会员日记详情 → 引导码且不含内容', async () => {
    const r = await detail(memId, GUEST)
    if (r.code !== -3) throw new Error(`期望 code -3，实际 ${r.code}`)
    if (JSON.stringify(r).includes(LONG_CONTENT.slice(0, 20))) throw new Error('响应泄露了内容')
  })

  await test('PERM-A03 authed 看公众日记 → 全文', async () => {
    const r = await detail(pubId, AUTHED)
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.content !== LONG_CONTENT) throw new Error('内容不完整')
    if (r.data.truncated) throw new Error('不应有 truncated 标记')
  })

  await test('PERM-A04 authed 看会员日记 → 前 30% 截断且不泄露剩余', async () => {
    const r = await detail(memId, AUTHED)
    if (r.code !== 0) throw new Error(r.msg)
    if (!r.data.truncated) throw new Error('缺少 truncated 标记')
    const expectLen = Math.floor(LONG_CONTENT.length * 0.3)
    if (r.data.content.length !== expectLen) throw new Error(`截断长度 ${r.data.content.length}，期望 ${expectLen}`)
    const tail = LONG_CONTENT.slice(expectLen + 10)
    if (JSON.stringify(r).includes(tail.slice(0, 20))) throw new Error('响应泄露了被截断内容')
  })

  await test('PERM-A05 member 看会员日记 → 全文无标记', async () => {
    const r = await detail(memId, MEMBER)
    if (r.code !== 0 || r.data.content !== LONG_CONTENT) throw new Error('会员未能读全文')
    if (r.data.truncated) throw new Error('不应有 truncated 标记')
  })

  await test('PERM-A06 作者本人看自己的会员/私密日记 → 全文', async () => {
    for (const id of [memId, priId]) {
      const r = await detail(id, AUTHOR)
      if (r.code !== 0 || r.data.content !== LONG_CONTENT) throw new Error(`作者读 ${id} 失败`)
      if (r.data.truncated) throw new Error('作者不应被截断')
    }
  })

  await test('PERM-A07 私密日记对他人隔离（详情+列表）', async () => {
    const r = await detail(priId, MEMBER)
    if (r.code === 0) throw new Error('他人不应读到私密日记')
    const l = await list(MEMBER)
    if (l.data.list.some(d => d.id === priId)) throw new Error('私密日记泄露到列表')
  })

  await test('PERM-A08 guest 列表可见公众+会员卡片且内容为摘要', async () => {
    const l = await list(GUEST)
    if (l.code !== 0) throw new Error(l.msg)
    const ids = l.data.list.map(d => d.id)
    if (!ids.includes(pubId)) throw new Error('公众卡片缺失')
    if (!ids.includes(memId)) throw new Error('会员卡片缺失（v2.1 矩阵要求可见）')
    if (ids.includes(priId)) throw new Error('私密日记泄露')
    const memRow = l.data.list.find(d => d.id === memId)
    if (!memRow.excerpt || memRow.content.length > 80) throw new Error(`未截断为摘要：len=${memRow.content.length}`)
    if (memRow.content.length >= LONG_CONTENT.length) throw new Error('列表泄露全文')
  })

  // 补充：authed 列表也能看到会员卡片（摘要），公众卡片为全文
  await test('PERM-A08b authed 列表含会员卡片摘要、公众全文', async () => {
    const l = await list(AUTHED)
    const memRow = l.data.list.find(d => d.id === memId)
    const pubRow = l.data.list.find(d => d.id === pubId)
    if (!memRow || !memRow.excerpt) throw new Error('authed 应见会员卡片摘要')
    if (!pubRow || pubRow.excerpt) throw new Error('authed 公众卡片不应截断')
  })

  // 清理
  if (created.length) {
    await conn.query(`DELETE FROM diaries WHERE id IN (${created.map(() => '?').join(',')})`, created)
    await conn.query("UPDATE users SET diary_count = GREATEST(diary_count - 3, 0) WHERE openid = ?", [AUTHOR])
  }
  await conn.query('DELETE FROM users WHERE openid = ?', [GUEST])
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
