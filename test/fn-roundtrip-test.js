// 云函数写入回环测试 — 通过本地 harness 验证日记 CRUD 全链路（含 images 字段）
// 以 mock_me 身份 create → detail → update → delete，结束后硬删测试数据
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const OPENID = 'mock_me'

async function run() {
  console.log('=== 云函数写入回环测试 ===\n')
  let passed = 0, failed = 0, diaryId = null

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  await test('createDiary 携带 2 张配图创建成功', async () => {
    const r = await callFn('createDiary', {
      title: '回环测试日记',
      content: '本条由 fn-roundtrip-test 创建，若残留请删除',
      tags: [],
      permission: 'private',
      images: ['cloud://fake/img1.jpg', 'cloud://fake/img2.jpg'],
    }, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    diaryId = r.data.id
  })

  await test('getDiaryDetail 返回 images 数组（JSON 列自动解析）', async () => {
    const r = await callFn('getDiaryDetail', { diaryId }, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    if (!Array.isArray(r.data.images)) throw new Error(`images 不是数组: ${typeof r.data.images}`)
    if (r.data.images.length !== 2) throw new Error(`期望 2 张，实际 ${r.data.images.length}`)
  })

  await test('updateDiary 替换为 1 张配图', async () => {
    const r = await callFn('updateDiary', { diaryId, images: ['cloud://fake/img3.jpg'] }, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    const d = await callFn('getDiaryDetail', { diaryId }, OPENID)
    if (d.data.images.length !== 1 || d.data.images[0] !== 'cloud://fake/img3.jpg') {
      throw new Error(`更新未生效: ${JSON.stringify(d.data.images)}`)
    }
  })

  await test('updateDiary 传空数组清除配图', async () => {
    const r = await callFn('updateDiary', { diaryId, images: [] }, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    const d = await callFn('getDiaryDetail', { diaryId }, OPENID)
    if (d.data.images !== null && d.data.images.length !== 0) {
      throw new Error(`清除未生效: ${JSON.stringify(d.data.images)}`)
    }
  })

  await test('deleteDiary 软删除成功', async () => {
    const r = await callFn('deleteDiary', { diaryId }, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    const d = await callFn('getDiaryDetail', { diaryId }, OPENID)
    if (d.code === 0) throw new Error('软删除后仍可查到')
  })

  await test('非会员发「会员专属」日记 → 服务端拒绝', async () => {
    const r = await callFn('createDiary', { title: '越权会员日记', content: 'x', tags: [], permission: 'member' }, 'mock_me')
    if (r.code === 0) throw new Error('authed 非会员不应能发会员专属日记')
  })

  let memberDiaryId = null
  await test('会员发「会员专属」日记 → 允许', async () => {
    const r = await callFn('createDiary', { title: '会员专属回环测试', content: 'x', tags: [], permission: 'member' }, 'mock_yanqiu')
    if (r.code !== 0) throw new Error(r.msg)
    memberDiaryId = r.data.id
  })

  await test('非会员将日记改为「会员专属」→ 服务端拒绝', async () => {
    // 用一篇 mock_me 名下的活跃公开日记验证（避免用已软删的 diaryId 误判为"不存在"而非"被拦"）
    const c = await callFn('createDiary', { title: '临时公开日记', content: 'x', tags: [], permission: 'public' }, 'mock_me')
    if (c.code !== 0) throw new Error('前置创建失败: ' + c.msg)
    const r = await callFn('updateDiary', { diaryId: c.data.id, permission: 'member' }, 'mock_me')
    const conn = await mysql.createConnection(DB)
    await conn.execute('DELETE FROM diaries WHERE id = ?', [c.data.id])
    await conn.execute("UPDATE users SET diary_count = GREATEST(diary_count - 1, 0) WHERE openid = 'mock_me'")
    await conn.end()
    if (r.code === 0) throw new Error('authed 非会员不应能改为会员专属')
  })

  // 硬删测试数据（deleteDiary 已平衡 diary_count，此处只清残留行 + 会员测试日记并回退计数）
  {
    const conn = await mysql.createConnection(DB)
    if (diaryId) await conn.execute('DELETE FROM diaries WHERE id = ?', [diaryId])
    if (memberDiaryId) {
      await conn.execute('DELETE FROM diaries WHERE id = ?', [memberDiaryId])
      await conn.execute("UPDATE users SET diary_count = GREATEST(diary_count - 1, 0) WHERE openid = 'mock_yanqiu'")
    }
    await conn.end()
    console.log('\n  测试数据已清理')
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
