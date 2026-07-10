// 云函数写入回环测试 — 通过本地 harness 验证日记 CRUD 全链路（含 images 字段）
// 写日记为会员专享，故以会员 mock_yanqiu 身份 create → detail → update → delete，结束后硬删测试数据
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const OPENID = 'mock_yanqiu'

async function run() {
  console.log('=== 云函数写入回环测试 ===\n')
  let passed = 0, failed = 0, diaryId = null

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const RICH = '<p>本条由 fn-roundtrip-test 创建，<strong>粗体</strong><span style="color: #b6452f">深红</span></p>'
  await test('createDiary 携带 2 张配图 + 样式版正文创建成功', async () => {
    const r = await callFn('createDiary', {
      title: '回环测试日记',
      content: '本条由 fn-roundtrip-test 创建，若残留请删除',
      contentRich: RICH,
      tags: [],
      permission: 'private',
      images: ['cloud://fake/img1.jpg', 'cloud://fake/img2.jpg'],
    }, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    diaryId = r.data.id
  })

  await test('getDiaryDetail 返回样式版 content_rich', async () => {
    const r = await callFn('getDiaryDetail', { diaryId }, OPENID)
    if (r.data.content_rich !== RICH) throw new Error(`样式版不符: ${r.data.content_rich}`)
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

  await test('updateDiary 只改 content 不带样式版 → content_rich 清空防陈旧', async () => {
    const r = await callFn('updateDiary', { diaryId, content: '纯文本更新' }, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.content_rich !== null) throw new Error(`应清空，实际: ${r.data.content_rich}`)
  })

  await test('updateDiary 带 contentRich → 样式版更新', async () => {
    const r = await callFn('updateDiary', { diaryId, content: '再更新', contentRich: '<p>再更新<u>下划线</u></p>' }, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.content_rich !== '<p>再更新<u>下划线</u></p>') throw new Error('样式版未更新')
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

  await test('非会员写日记 → 服务端拒绝', async () => {
    const r = await callFn('createDiary', { title: '越权写日记', content: 'x', tags: [], permission: 'public' }, 'mock_me')
    if (r.code === 0) throw new Error('非会员不应能写日记')
  })

  let memberDiaryId = null
  await test('会员发「会员专属」日记 → 允许', async () => {
    const r = await callFn('createDiary', { title: '会员专属回环测试', content: 'x', tags: [], permission: 'member' }, 'mock_yanqiu')
    if (r.code !== 0) throw new Error(r.msg)
    memberDiaryId = r.data.id
  })

  await test('非会员编辑日记 → 服务端拒绝', async () => {
    // 非会员在会员归属的日记上尝试编辑，会员闸先于归属校验，应被拦截
    const r = await callFn('updateDiary', { diaryId: memberDiaryId, title: '越权编辑' }, 'mock_me')
    if (r.code === 0) throw new Error('非会员不应能编辑日记')
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
