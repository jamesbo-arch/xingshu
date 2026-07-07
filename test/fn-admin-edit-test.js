// 后台编辑/代发/ID 测试 — 对应 prd-ch3-test-cases.md AE-A01~A08（B/C/D 档）
// 经 admin 云函数（HMAC token）。测试用户/日记以 test_ae_ 前缀，结束硬删
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

async function run() {
  console.log('=== 后台编辑/代发/ID 测试（AE-A01~A11）===\n')
  let passed = 0, failed = 0
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const login = await callFn('admin', { action: 'login', payload: { password: DB.adminPassword } })
  const token = login.data.token
  const admin = (action, payload) => callFn('admin', { action, token, payload })

  // 准备：一个已授权测试用户 + 其一篇日记
  await conn.query(
    "INSERT INTO users (openid, unionid, nickname, real_name, phone, identity, avatar_hue, created_by) " +
    "VALUES ('test_ae_u1','test_ae_union1','原昵称','原实名','13800000000','authed',60,'test_ae_u1')")
  const [[u1]] = await conn.query("SELECT id FROM users WHERE openid = 'test_ae_u1'")
  const [dr] = await conn.query(
    "INSERT INTO diaries (user_id,title,content,permission,created_by) VALUES (?,?,?,?,?)",
    [u1.id, '原标题', '原正文内容', 'public', u1.id])
  const diaryId = dr.insertId

  await test('AE-A01 updateUser 改昵称/真实姓名/手机号 → 落库、身份不变、写审计', async () => {
    const r = await admin('updateUser', { userId: u1.id, nickname: '新昵称', realName: '新实名', phone: '13900000000' })
    if (r.code !== 0) throw new Error(r.msg)
    const [[u]] = await conn.query('SELECT nickname, real_name, phone, identity FROM users WHERE id = ?', [u1.id])
    if (u.nickname !== '新昵称' || u.real_name !== '新实名' || u.phone !== '13900000000') throw new Error('未落库')
    if (u.identity !== 'authed') throw new Error('身份被误改')
    const [[{ c }]] = await conn.query("SELECT COUNT(*) c FROM admin_logs WHERE action='updateUser' AND target_id=?", [String(u1.id)])
    if (c !== 1) throw new Error('审计缺失')
  })

  await test('AE-A02 updateUser 校验：缺 userId / 用户不存在 → 拒绝', async () => {
    const r1 = await admin('updateUser', { nickname: 'x' })
    if (r1.code === 0) throw new Error('缺 userId 不应通过')
    const r2 = await admin('updateUser', { userId: 999999999, nickname: 'x' })
    if (r2.code === 0) throw new Error('不存在用户不应通过')
  })

  await test('AE-A10 updateUser 改身份为 member + 有效期 → 落库 member_from/until', async () => {
    const r = await admin('updateUser', { userId: u1.id, identity: 'member', memberFrom: '2026-05-19', memberUntil: '2027-05-19' })
    if (r.code !== 0) throw new Error(r.msg)
    const [[u]] = await conn.query(
      "SELECT identity, DATE_FORMAT(member_from,'%Y-%m-%d') mf, DATE_FORMAT(member_until,'%Y-%m-%d') mu FROM users WHERE id = ?", [u1.id])
    if (u.identity !== 'member' || u.mf !== '2026-05-19' || u.mu !== '2027-05-19') throw new Error(`落库异常 ${u.identity}/${u.mf}/${u.mu}`)
  })

  await test('AE-A11 updateUser 会员校验 + 改回 authed 清空会员期', async () => {
    const bad1 = await admin('updateUser', { userId: u1.id, identity: 'member' })  // 缺日期
    if (bad1.code === 0) throw new Error('会员缺有效期不应通过')
    const bad2 = await admin('updateUser', { userId: u1.id, identity: 'member', memberFrom: '2027-05-19', memberUntil: '2026-05-19' })
    if (bad2.code === 0) throw new Error('失效早于生效不应通过')
    const bad3 = await admin('updateUser', { userId: u1.id, identity: 'vip' })  // 非法枚举
    if (bad3.code === 0) throw new Error('非法身份不应通过')
    const r = await admin('updateUser', { userId: u1.id, identity: 'authed' })
    if (r.code !== 0) throw new Error(r.msg)
    const [[u]] = await conn.query('SELECT identity, member_from, member_until FROM users WHERE id = ?', [u1.id])
    if (u.identity !== 'authed' || u.member_from !== null || u.member_until !== null) throw new Error('改回 authed 未清空会员期')
  })

  await test('AE-A03 updateDiary 改标题/正文/权限 → 落库 + content_edited_at 置位 + 审计', async () => {
    const r = await admin('updateDiary', { id: diaryId, title: '改后标题', content: '改后正文', permission: 'member' })
    if (r.code !== 0) throw new Error(r.msg)
    const [[d]] = await conn.query('SELECT title, content, permission, content_edited_at FROM diaries WHERE id = ?', [diaryId])
    if (d.title !== '改后标题' || d.content !== '改后正文' || d.permission !== 'member') throw new Error('未落库')
    if (!d.content_edited_at) throw new Error('content_edited_at 未置位')
    const [[{ c }]] = await conn.query("SELECT COUNT(*) c FROM admin_logs WHERE action='updateDiary' AND target_id=?", [String(diaryId)])
    if (c !== 1) throw new Error('审计缺失')
  })

  await test('AE-A04 updateDiary 改标签 → diary_tags 重建', async () => {
    const r = await admin('updateDiary', { id: diaryId, tags: ['修身为本', '日新又新'] })
    if (r.code !== 0) throw new Error(r.msg)
    const [rows] = await conn.query(
      'SELECT t.name FROM diary_tags dt JOIN tags t ON t.id = dt.tag_id WHERE dt.diary_id = ? ORDER BY t.name', [diaryId])
    const names = rows.map(x => x.name)
    if (names.length !== 2 || !names.includes('修身为本') || !names.includes('日新又新')) throw new Error('标签未重建: ' + names)
  })

  let newDiaryId
  await test('AE-A05 createDiary 代发（指定 authorId）→ 归属该用户 + diary_count +1 + 审计', async () => {
    const [[before]] = await conn.query('SELECT diary_count FROM users WHERE id = ?', [u1.id])
    const r = await admin('createDiary', { authorId: u1.id, title: '代发标题', content: '代发正文', permission: 'public', tags: ['格物致知'] })
    if (r.code !== 0) throw new Error(r.msg)
    newDiaryId = r.data.diary.id
    const [[d]] = await conn.query('SELECT user_id FROM diaries WHERE id = ?', [newDiaryId])
    if (d.user_id !== u1.id) throw new Error('归属错误')
    const [[after]] = await conn.query('SELECT diary_count FROM users WHERE id = ?', [u1.id])
    if (after.diary_count !== before.diary_count + 1) throw new Error('diary_count 未 +1')
    const [[{ c }]] = await conn.query("SELECT COUNT(*) c FROM admin_logs WHERE action='createDiary' AND target_id=?", [String(newDiaryId)])
    if (c !== 1) throw new Error('审计缺失')
  })

  await test('AE-A06 createDiary 校验：作者不存在 / 缺标题内容 → 拒绝', async () => {
    const r1 = await admin('createDiary', { authorId: 999999999, title: 't', content: 'c' })
    if (r1.code === 0) throw new Error('作者不存在不应通过')
    const r2 = await admin('createDiary', { authorId: u1.id, title: '', content: 'c' })
    if (r2.code === 0) throw new Error('缺标题不应通过')
  })

  await test('AE-A07 userDetail 返回 openid / unionid（D 档）', async () => {
    const r = await admin('userDetail', { id: u1.id })
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.user.openid !== 'test_ae_u1') throw new Error('openid 缺失/错误')
    if (r.data.user.unionid !== 'test_ae_union1') throw new Error('unionid 缺失/错误')
  })

  await test('AE-A08 已编辑标记：新建代发日记 editedAt 空；被编辑日记 editedAt 非空', async () => {
    const r = await admin('diaries', { pageSize: 100000 })  // 取全量以定位测试数据（服务端分页后）
    if (r.code !== 0) throw new Error(r.msg)
    const edited = r.data.list.find(d => d.id === diaryId)
    const fresh = r.data.list.find(d => d.id === newDiaryId)
    if (!edited || !edited.editedAt) throw new Error('被编辑日记 editedAt 应非空')
    if (!fresh || fresh.editedAt) throw new Error('新建日记 editedAt 应为空')
  })

  // 清理（diary_tags 随日记级联；先删日记/审计/用户）
  await conn.query('DELETE FROM diary_tags WHERE diary_id IN (?, ?)', [diaryId, newDiaryId || 0])
  await conn.query('DELETE FROM diaries WHERE id IN (?, ?)', [diaryId, newDiaryId || 0])
  await conn.query("DELETE FROM admin_logs WHERE action IN ('updateUser','updateDiary','createDiary') AND target_id IN (?,?,?)",
    [String(u1.id), String(diaryId), String(newDiaryId || 0)])
  await conn.query("DELETE FROM users WHERE openid = 'test_ae_u1'")
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
