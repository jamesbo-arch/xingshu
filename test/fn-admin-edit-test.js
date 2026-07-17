// 后台编辑/代发/ID 测试 — 对应 prd-ch3-test-cases.md AE-A01~A08（B/C/D 档）
// 经 admin 云函数（HMAC token）。测试用户/故事以 test_ae_ 前缀，结束硬删
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

async function run() {
  console.log('=== 后台编辑/代发/ID 测试（AE-A01~A12）===\n')
  let passed = 0, failed = 0
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const login = await callFn('admin', { action: 'login', payload: { password: DB.adminPassword } })
  const token = login.data.token
  const admin = (action, payload) => callFn('admin', { action, token, payload })

  // 准备：一个已授权测试用户 + 其一篇故事
  await conn.query(
    "INSERT INTO users (openid, unionid, nickname, real_name, phone, identity, avatar_hue) " +
    "VALUES ('test_ae_u1','test_ae_union1','原昵称','原实名','13800000000','authed',60)")
  const [[u1]] = await conn.query("SELECT id FROM users WHERE openid = 'test_ae_u1'")
  const [dr] = await conn.query(
    "INSERT INTO stories (user_id,title,content,publish_status,created_by) VALUES (?,?,?,?,?)",
    [u1.id, '原标题', '原正文内容', 'published', u1.id])
  const storyId = dr.insertId

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

  await test('AE-A10 updateUser 改身份为 member + 有效期 → 会员期落库，identity 列保持授权态，回传派生 member', async () => {
    const r = await admin('updateUser', { userId: u1.id, identity: 'member', memberFrom: '2026-05-19', memberUntil: '2027-05-19' })
    if (r.code !== 0) throw new Error(r.msg)
    // 两字段语义：identity 列只存授权态（authed），会员资格 = member_until；回传的 identity 为派生值
    const [[u]] = await conn.query(
      "SELECT identity, DATE_FORMAT(member_from,'%Y-%m-%d') mf, DATE_FORMAT(member_until,'%Y-%m-%d') mu FROM users WHERE id = ?", [u1.id])
    if (u.identity !== 'authed' || u.mf !== '2026-05-19' || u.mu !== '2027-05-19') throw new Error(`落库异常 ${u.identity}/${u.mf}/${u.mu}`)
    if (r.data.user.identity !== 'member') throw new Error(`回传派生身份 ${r.data.user.identity}，应为 member`)
  })

  await test('AE-A12 updateUser 设置性别 → 落库、USER_SELECT 回传', async () => {
    const r = await admin('updateUser', { userId: u1.id, gender: 'male' })
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.user.gender !== 'male') throw new Error(`回传 gender=${r.data.user.gender}`)
    const [[u]] = await conn.query('SELECT gender FROM users WHERE id = ?', [u1.id])
    if (u.gender !== 'male') throw new Error(`DB gender=${u.gender}`)
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

  await test('AE-A03 updateStory 改标题/正文/状态 → 落库 + content_edited_at 置位 + 审计', async () => {
    const r = await admin('updateStory', { id: storyId, title: '改后标题', content: '改后正文', publishStatus: 'draft' })
    if (r.code !== 0) throw new Error(r.msg)
    const [[d]] = await conn.query('SELECT title, content, publish_status, content_edited_at FROM stories WHERE id = ?', [storyId])
    if (d.title !== '改后标题' || d.content !== '改后正文' || d.publish_status !== 'draft') throw new Error('未落库')
    if (!d.content_edited_at) throw new Error('content_edited_at 未置位')
    const [[{ c }]] = await conn.query("SELECT COUNT(*) c FROM admin_logs WHERE action='updateStory' AND target_id=?", [String(storyId)])
    if (c !== 1) throw new Error('审计缺失')
  })

  await test('AE-A04 updateStory 改标签 → story_tags 重建', async () => {
    const r = await admin('updateStory', { id: storyId, tags: ['修身为本', '日新又新'] })
    if (r.code !== 0) throw new Error(r.msg)
    const [rows] = await conn.query(
      'SELECT t.name FROM story_tags dt JOIN tags t ON t.id = dt.tag_id WHERE dt.story_id = ? ORDER BY t.name', [storyId])
    const names = rows.map(x => x.name)
    if (names.length !== 2 || !names.includes('修身为本') || !names.includes('日新又新')) throw new Error('标签未重建: ' + names)
  })

  let newStoryId
  await test('AE-A05 createStory 代发（指定 authorId）→ 归属该用户 + story_count +1 + 审计', async () => {
    const [[before]] = await conn.query('SELECT story_count FROM users WHERE id = ?', [u1.id])
    const r = await admin('createStory', { authorId: u1.id, title: '代发标题', content: '代发正文', publishStatus: 'published', tags: ['格物致知'] })
    if (r.code !== 0) throw new Error(r.msg)
    newStoryId = r.data.story.id
    const [[d]] = await conn.query('SELECT user_id FROM stories WHERE id = ?', [newStoryId])
    if (d.user_id !== u1.id) throw new Error('归属错误')
    const [[after]] = await conn.query('SELECT story_count FROM users WHERE id = ?', [u1.id])
    if (after.story_count !== before.story_count + 1) throw new Error('story_count 未 +1')
    const [[{ c }]] = await conn.query("SELECT COUNT(*) c FROM admin_logs WHERE action='createStory' AND target_id=?", [String(newStoryId)])
    if (c !== 1) throw new Error('审计缺失')
  })

  await test('AE-A06 createStory 校验：作者不存在 / 缺标题内容 → 拒绝', async () => {
    const r1 = await admin('createStory', { authorId: 999999999, title: 't', content: 'c' })
    if (r1.code === 0) throw new Error('作者不存在不应通过')
    const r2 = await admin('createStory', { authorId: u1.id, title: '', content: 'c' })
    if (r2.code === 0) throw new Error('缺标题不应通过')
  })

  await test('AE-A07 userDetail 返回 openid / unionid（D 档）', async () => {
    const r = await admin('userDetail', { id: u1.id })
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.user.openid !== 'test_ae_u1') throw new Error('openid 缺失/错误')
    if (r.data.user.unionid !== 'test_ae_union1') throw new Error('unionid 缺失/错误')
  })

  await test('AE-A08 已编辑标记：新建代发故事 editedAt 空；被编辑故事 editedAt 非空', async () => {
    const r = await admin('stories', { pageSize: 100000 })  // 取全量以定位测试数据（服务端分页后）
    if (r.code !== 0) throw new Error(r.msg)
    const edited = r.data.list.find(d => d.id === storyId)
    const fresh = r.data.list.find(d => d.id === newStoryId)
    if (!edited || !edited.editedAt) throw new Error('被编辑故事 editedAt 应非空')
    if (!fresh || fresh.editedAt) throw new Error('新建故事 editedAt 应为空')
  })

  // 清理（story_tags 随故事级联；先删故事/审计/用户）
  await conn.query('DELETE FROM story_tags WHERE story_id IN (?, ?)', [storyId, newStoryId || 0])
  await conn.query('DELETE FROM stories WHERE id IN (?, ?)', [storyId, newStoryId || 0])
  await conn.query("DELETE FROM admin_logs WHERE action IN ('updateUser','updateStory','createStory') AND target_id IN (?,?,?)",
    [String(u1.id), String(storyId), String(newStoryId || 0)])
  await conn.query("DELETE FROM users WHERE openid = 'test_ae_u1'")
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
