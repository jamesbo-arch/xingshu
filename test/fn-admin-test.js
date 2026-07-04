// admin 云函数测试 — 鉴权、数据形状、删除闭环（测试数据自动清理）
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

async function run() {
  console.log('=== admin 云函数测试 ===\n')
  let passed = 0, failed = 0, token = null

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const admin = (action, payload) => callFn('admin', { action, token, payload })

  await test('错误密码登录被拒绝', async () => {
    const r = await callFn('admin', { action: 'login', payload: { password: 'wrong' } })
    if (r.code === 0) throw new Error('不应登录成功')
  })

  await test('正确密码登录签发 token', async () => {
    const r = await callFn('admin', { action: 'login', payload: { password: DB.adminPassword } })
    if (r.code !== 0 || !r.data.token) throw new Error(r.msg || '无 token')
    token = r.data.token
  })

  await test('无 token 请求返回 -401', async () => {
    const r = await callFn('admin', { action: 'users' })
    if (r.code !== -401) throw new Error(`期望 -401，实际 ${r.code}`)
  })

  await test('伪造 token 被拒绝', async () => {
    const r = await callFn('admin', { action: 'users', token: (Date.now() + 9999999) + '.deadbeef' })
    if (r.code !== -401) throw new Error(`期望 -401，实际 ${r.code}`)
  })

  await test('users 列表形状与库内数量一致', async () => {
    const r = await admin('users')
    if (r.code !== 0) throw new Error(r.msg)
    const conn = await mysql.createConnection(DB)
    const [[{ c }]] = await conn.query('SELECT COUNT(*) c FROM users')
    await conn.end()
    if (r.data.total !== c) throw new Error(`total=${r.data.total}，库内 ${c}`)
    const u = r.data.list[0]
    // A档：互动合计需 favorites/comments/shares + lastActive/realName（列表展示对齐）
    for (const k of ['id', 'nickname', 'identity', 'avatarHue', 'diaries', 'likes',
                     'favorites', 'comments', 'shares', 'lastActive', 'realName', 'registeredAt']) {
      if (!(k in u)) throw new Error(`缺少字段 ${k}`)
    }
  })

  await test('users 按 identity 筛选', async () => {
    const r = await admin('users', { identity: 'member' })
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.list.some(u => u.identity !== 'member')) throw new Error('筛选失效')
  })

  await test('users/diaries 服务端分页：page/pageSize/total 返回且切片正确', async () => {
    const r = await admin('users', { page: 1, pageSize: 2 })
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.page !== 1 || r.data.pageSize !== 2) throw new Error('分页字段缺失')
    if (r.data.list.length > 2) throw new Error(`page1 应 ≤2 条，实际 ${r.data.list.length}`)
    if (typeof r.data.total !== 'number' || r.data.total < r.data.list.length) throw new Error('total 异常')
    // 第 2 页与第 1 页不重叠（库内用户 >2 时）
    if (r.data.total > 2) {
      const r2 = await admin('users', { page: 2, pageSize: 2 })
      const p1 = r.data.list.map(u => u.id), p2 = r2.data.list.map(u => u.id)
      if (p2.some(id => p1.includes(id))) throw new Error('第 2 页与第 1 页重叠')
    }
    const d = await admin('diaries', { page: 1, pageSize: 3 })
    if (d.data.page !== 1 || d.data.pageSize !== 3 || typeof d.data.total !== 'number') throw new Error('diaries 分页字段缺失')
    if (d.data.list.length > 3) throw new Error('diaries page1 应 ≤3 条')
  })

  await test('diaries 列表含 tags 数组与作者', async () => {
    const r = await admin('diaries')
    if (r.code !== 0) throw new Error(r.msg)
    const d = r.data.list[0]
    if (!Array.isArray(d.tags) || !d.author || !d.createdAt) throw new Error('形状不符: ' + JSON.stringify(Object.keys(d)))
  })

  await test('kpi 五项指标齐全', async () => {
    const r = await admin('kpi')
    if (r.code !== 0) throw new Error(r.msg)
    for (const k of ['users', 'members', 'diaries', 'interactions', 'revenue']) {
      if (typeof r.data[k].value !== 'number') throw new Error(`${k}.value 缺失`)
    }
  })

  await test('trend 返回 30 天序列', async () => {
    const r = await admin('trend')
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.length !== 30) throw new Error(`期望 30 天，实际 ${r.data.length}`)
  })

  await test('activity 返回动态列表', async () => {
    const r = await admin('activity')
    if (r.code !== 0) throw new Error(r.msg)
    if (!r.data.length || !r.data[0].text || !r.data[0].type) throw new Error('形状不符')
  })

  // 删除闭环：创建测试日记（含评论、点赞）→ admin 删除 → 校验联动清理
  let diaryId = null
  await test('deleteDiary 删除日记并联动清理互动数据', async () => {
    const created = await callFn('createDiary', {
      title: 'admin测试日记', content: '待删除', tags: [], permission: 'private',
    }, 'mock_me')
    diaryId = created.data.id
    await callFn('toggleLike', { diaryId }, 'mock_yanqiu')
    await callFn('createComment', { diaryId, content: '测试评论' }, 'mock_yanqiu')

    const r = await admin('deleteDiary', { id: diaryId })
    if (r.code !== 0) throw new Error(r.msg)

    const conn = await mysql.createConnection(DB)
    const [[d]] = await conn.query('SELECT status FROM diaries WHERE id = ?', [diaryId])
    const [[{ c: inter }]] = await conn.query("SELECT COUNT(*) c FROM interactions WHERE target_type='diary' AND target_id = ?", [diaryId])
    const [[{ c: cmts }]] = await conn.query('SELECT COUNT(*) c FROM comments WHERE diary_id = ? AND is_deleted = 0', [diaryId])
    const [[{ c: logs }]] = await conn.query("SELECT COUNT(*) c FROM admin_logs WHERE action='deleteDiary' AND target_id = ?", [String(diaryId)])
    await conn.end()
    if (d.status !== 'deleted') throw new Error('日记未删除')
    if (inter !== 0) throw new Error(`互动残留 ${inter} 条`)
    if (cmts !== 0) throw new Error(`评论残留 ${cmts} 条`)
    if (logs !== 1) throw new Error('admin_logs 未记录')
  })

  // 批量删除闭环：创建 2 篇 → deleteDiaries（含一个无效 ID）→ 校验成败分账
  const batchIds = []
  await test('deleteDiaries 批量删除并汇总成败', async () => {
    for (let i = 0; i < 2; i++) {
      const c = await callFn('createDiary', {
        title: `admin批量测试${i}`, content: '待批量删除', tags: [], permission: 'private',
      }, 'mock_me')
      batchIds.push(c.data.id)
    }
    const r = await admin('deleteDiaries', { ids: [...batchIds, 99999999] })
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.deleted.length !== 2) throw new Error(`期望删除 2 篇，实际 ${r.data.deleted.length}`)
    if (r.data.failed.length !== 1) throw new Error(`期望失败 1 篇（无效ID），实际 ${r.data.failed.length}`)
    const conn = await mysql.createConnection(DB)
    const [rows] = await conn.query('SELECT status FROM diaries WHERE id IN (?, ?)', batchIds)
    await conn.end()
    if (rows.some(x => x.status !== 'deleted')) throw new Error('存在未删除的日记')
  })

  // 硬删测试数据
  if (batchIds.length) {
    const conn = await mysql.createConnection(DB)
    await conn.query('DELETE FROM diaries WHERE id IN (?, ?)', batchIds)
    await conn.execute("DELETE FROM admin_logs WHERE action='deleteDiaries'")
    await conn.end()
  }
  if (diaryId) {
    const conn = await mysql.createConnection(DB)
    await conn.execute('DELETE FROM comments WHERE diary_id = ?', [diaryId])
    await conn.execute('DELETE FROM diaries WHERE id = ?', [diaryId])
    await conn.execute("DELETE FROM admin_logs WHERE action='deleteDiary' AND target_id = ?", [String(diaryId)])
    await conn.end()
    console.log('\n  测试数据已清理')
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
