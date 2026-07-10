// 标签维护测试 — 对应 test/prd-ch3-test-cases.md TAG-A01 ~ TAG-A03（PRD 3.1.1）
// 测试标签以 test_tag_ 前缀创建，结束时硬删（含关联 diary_tags 与测试日记）
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const OPENID = 'mock_yanqiu' // 种子会员用户，仅用于建关联日记（写日记为会员专享）

async function run() {
  console.log('=== 标签维护测试（TAG-A01~A03）===\n')
  let passed = 0, failed = 0
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  let tagId, diaryId
  await test('TAG-A01 getTags 返回启用标签名数组，停用标签不出现', async () => {
    const r = await callFn('getTags', {}, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    if (!Array.isArray(r.data) || !r.data.length) throw new Error('应返回非空数组')
    if (r.data.some(n => typeof n !== 'string')) throw new Error('元素应为标签名字符串')
    // 插入一个停用标签 → 不应出现在列表
    await conn.query("INSERT INTO tags (name, is_active) VALUES ('test_tag_off', 0)")
    const r2 = await callFn('getTags', {}, OPENID)
    if (r2.data.includes('test_tag_off')) throw new Error('停用标签泄露到列表')
  })

  await test('TAG-A02 addTag：新增成功；重名/空名/超长拒绝', async () => {
    const r = await callFn('addTag', { name: 'test_tag_rn' }, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    tagId = r.data.id
    const dup = await callFn('addTag', { name: 'test_tag_rn' }, OPENID)
    if (dup.code === 0) throw new Error('重名不应通过')
    const empty = await callFn('addTag', { name: '  ' }, OPENID)
    if (empty.code === 0) throw new Error('空名不应通过')
    const long = await callFn('addTag', { name: 'a'.repeat(17) }, OPENID)
    if (long.code === 0) throw new Error('超过16字不应通过')
  })

  await test('TAG-A03 updateTag 改名后日记关联不丢；停用后不再出现在 getTags', async () => {
    const d = await callFn('createDiary', {
      title: '标签回环测试日记', content: '本条由 fn-tag-test 创建，若残留请删除',
      tags: ['test_tag_rn'], permission: 'private',
    }, OPENID)
    if (d.code !== 0) throw new Error(d.msg)
    diaryId = d.data.id
    const r = await callFn('updateTag', { tagId, name: 'test_tag_rn2' }, OPENID)
    if (r.code !== 0 || r.data.name !== 'test_tag_rn2') throw new Error('改名未生效')
    const [[link]] = await conn.query(
      'SELECT COUNT(*) c FROM diary_tags WHERE diary_id = ? AND tag_id = ?', [diaryId, tagId])
    if (link.c !== 1) throw new Error('改名后 diary_tags 关联丢失')
    const off = await callFn('updateTag', { tagId, isActive: 0 }, OPENID)
    if (off.code !== 0) throw new Error(off.msg)
    const g = await callFn('getTags', {}, OPENID)
    if (g.data.includes('test_tag_rn2')) throw new Error('停用标签仍出现在列表')
  })

  // 清理
  if (diaryId) {
    await conn.query('DELETE FROM diary_tags WHERE diary_id = ?', [diaryId])
    await conn.query('DELETE FROM diaries WHERE id = ?', [diaryId])
  }
  await conn.query("DELETE FROM tags WHERE name LIKE 'test_tag_%'")
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
