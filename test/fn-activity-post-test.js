// 活动现场分享测试 — POST-A01 ~ A12（发布鉴权矩阵/分页/软删/admin 审计）
// 测试活动 test_ 前缀创建，结束时按 posts → signups → activities 顺序硬删（FK）
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const SIGNED = 'mock_yanqiu'      // 报名并发分享的用户
const OTHER = 'mock_me'           // 未报名/他人视角用户

async function run() {
  console.log('=== 活动现场分享测试（POST-A01~A12）===\n')
  let passed = 0, failed = 0, token = null
  const createdActs = []

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const act = (action, payload, openid = SIGNED) => callFn('activity', { action, payload }, openid)
  const admin = (action, payload) => callFn('admin', { action, token, payload })
  const conn = await mysql.createConnection(DB)

  const login = await callFn('admin', { action: 'login', payload: { password: DB.adminPassword } })
  token = login.data.token

  const past = new Date(Date.now() - 3600000).toISOString().slice(0, 19).replace('T', ' ')     // 1h 前已开始
  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 19).replace('T', ' ')
  async function makeActivity(patch = {}) {
    const r = await admin('activitySave', {
      title: 'test_分享活动' + Math.random().toString(36).slice(2, 6),
      content: '测试', images: [], start_time: past,
      type: 'offline', city: '广州', location: '测试地点',
      capacity: 0, status: 'online', ...patch,
    })
    if (r.code !== 0) throw new Error('前置建活动失败: ' + r.msg)
    createdActs.push(r.data.id)
    return r.data.id
  }

  await test('POST-A01 activity_posts 表结构与索引', async () => {
    const [cols] = await conn.query('SHOW COLUMNS FROM activity_posts')
    const names = cols.map(c => c.Field)
    for (const k of ['activity_id', 'user_id', 'content', 'images', 'status']) {
      if (!names.includes(k)) throw new Error(`缺列 ${k}`)
    }
    const [idx] = await conn.query("SHOW INDEX FROM activity_posts WHERE Key_name='idx_activity_status'")
    if (!idx.length) throw new Error('缺复合索引 idx_activity_status')
  })

  let startedId
  await test('POST-A02 未报名用户发分享 → 拒绝', async () => {
    startedId = await makeActivity()
    const r = await act('postCreate', { id: startedId, content: '未报名越权' }, OTHER)
    if (r.code === 0) throw new Error('未报名不应能发')
    if (!r.msg.includes('报名')) throw new Error(`提示不符: ${r.msg}`)
  })

  let notStartedId
  await test('POST-A03 已报名但活动未开始 → 拒发且 canPost=false', async () => {
    notStartedId = await makeActivity({ start_time: future })
    await act('signup', { id: notStartedId, name: '砚秋' })
    const r = await act('postCreate', { id: notStartedId, content: '抢跑' })
    if (r.code === 0) throw new Error('未开始不应能发')
    const d = await act('detail', { id: notStartedId })
    if (d.data.canPost !== false) throw new Error(`canPost=${d.data.canPost}`)
  })

  let postId
  await test('POST-A04 已报名 + 已开始 → 发布成功且 canPost=true', async () => {
    await act('signup', { id: startedId, name: '砚秋' })
    const d = await act('detail', { id: startedId })
    if (d.data.canPost !== true) throw new Error(`canPost=${d.data.canPost}`)
    const r = await act('postCreate', { id: startedId, content: '现场很棒', images: ['cloud://fake/p1.jpg'] })
    if (r.code !== 0) throw new Error(r.msg)
    postId = r.data.id
    const [[row]] = await conn.query('SELECT content, status FROM activity_posts WHERE id=?', [postId])
    if (row.content !== '现场很棒' || row.status !== 'active') throw new Error('落库不符')
  })

  await test('POST-A05 活动改 finished 后仍可补发', async () => {
    await admin('activitySave', { id: startedId, title: 'test_分享活动f', start_time: past, status: 'finished' })
    const r = await act('postCreate', { id: startedId, content: '事后补发回顾' })
    if (r.code !== 0) throw new Error(r.msg)
  })

  await test('POST-A06 空内容拒；纯图无文字可发', async () => {
    const r1 = await act('postCreate', { id: startedId, content: '  ', images: [] })
    if (r1.code === 0) throw new Error('空内容不应通过')
    const r2 = await act('postCreate', { id: startedId, content: '', images: ['cloud://fake/p2.jpg'] })
    if (r2.code !== 0) throw new Error('纯图应可发: ' + r2.msg)
  })

  await test('POST-A13 视频分享：单视频可发、与照片互斥、非 cloud:// 拒', async () => {
    // 独立活动，避免扰动 A08 对 startedId 的计数
    const vid = await makeActivity()
    await act('signup', { id: vid, name: '砚秋' })
    const r1 = await act('postCreate', { id: vid, content: '现场视频', video: 'cloud://fake/v1.mp4' })
    if (r1.code !== 0) throw new Error('单视频应可发: ' + r1.msg)
    const [[row]] = await conn.query('SELECT video FROM activity_posts WHERE id=?', [r1.data.id])
    if (row.video !== 'cloud://fake/v1.mp4') throw new Error('video 未落库: ' + row.video)
    // postList 回带 video 字段
    const list = await act('postList', { id: vid, page: 1, pageSize: 5 })
    const found = list.data.list.find(p => p.id === r1.data.id)
    if (!found || found.video !== 'cloud://fake/v1.mp4') throw new Error('postList 未回带 video')
    // 照片 + 视频同发 → 拒
    const r2 = await act('postCreate', { id: vid, content: 'x', images: ['cloud://fake/p.jpg'], video: 'cloud://fake/v2.mp4' })
    if (r2.code === 0) throw new Error('照片与视频同发不应通过')
    // 非 cloud:// 视频 → 拒
    const r3 = await act('postCreate', { id: vid, video: 'http://evil/x.mp4' })
    if (r3.code === 0) throw new Error('非 cloud:// 视频不应通过')
  })

  await test('POST-A07 draft 活动拒发', async () => {
    const draftId = await makeActivity({ status: 'draft' })
    await conn.query('INSERT INTO activity_signups (activity_id, user_id, name) SELECT ?, id, \'预埋\' FROM users WHERE openid=?', [draftId, SIGNED])
    const r = await act('postCreate', { id: draftId, content: 'draft 越权' })
    if (r.code === 0) throw new Error('draft 不应能发')
  })

  await test('POST-A08 postList 分页（倒序 + total + 第二页）', async () => {
    // 此时 startedId 名下已有 3 条（A04/A05/A06 各 1）
    const p1 = await act('postList', { id: startedId, page: 1, pageSize: 2 })
    if (p1.code !== 0) throw new Error(p1.msg)
    if (p1.data.total !== 3 || p1.data.list.length !== 2) throw new Error(`total=${p1.data.total} len=${p1.data.list.length}`)
    if (p1.data.list[0].id < p1.data.list[1].id) throw new Error('未按倒序')
    for (const k of ['nickname', 'avatar_hue', 'content', 'images', 'created_at', 'isMine']) {
      if (!(k in p1.data.list[0])) throw new Error(`缺字段 ${k}`)
    }
    const p2 = await act('postList', { id: startedId, page: 2, pageSize: 2 })
    if (p2.data.list.length !== 1) throw new Error(`第二页 len=${p2.data.list.length}`)
  })

  await test('POST-A09 isMine 视角（本人 true / 他人 false）', async () => {
    const mine = await act('postList', { id: startedId, page: 1, pageSize: 10 })
    if (!mine.data.list.every(p => p.isMine === true)) throw new Error('本人视角应全为 true')
    const other = await act('postList', { id: startedId, page: 1, pageSize: 10 }, OTHER)
    if (!other.data.list.every(p => p.isMine === false)) throw new Error('他人视角应全为 false')
  })

  await test('POST-A10 本人删除 → 软删且列表不再返回', async () => {
    const r = await act('postDelete', { id: postId })
    if (r.code !== 0) throw new Error(r.msg)
    const [[row]] = await conn.query('SELECT status FROM activity_posts WHERE id=?', [postId])
    if (row.status !== 'deleted') throw new Error('未软删')
    const l = await act('postList', { id: startedId, page: 1, pageSize: 10 })
    if (l.data.total !== 2 || l.data.list.some(p => p.id === postId)) throw new Error('已删项仍在列表')
  })

  await test('POST-A11 他人删除 → 拒绝且数据不变', async () => {
    const l = await act('postList', { id: startedId, page: 1, pageSize: 1 })
    const targetId = l.data.list[0].id
    const r = await act('postDelete', { id: targetId }, OTHER)
    if (r.code === 0) throw new Error('他人不应能删')
    const [[row]] = await conn.query('SELECT status FROM activity_posts WHERE id=?', [targetId])
    if (row.status !== 'active') throw new Error('数据被误删')
  })

  await test('POST-A12 admin 分享列表含已删行；admin 删除 + 审计', async () => {
    const la = await admin('postListAdmin', { activityId: startedId, page: 1, pageSize: 10 })
    if (la.code !== 0) throw new Error(la.msg)
    if (la.data.total !== 3) throw new Error(`admin total=${la.data.total}（应含已删行）`)
    if (!la.data.list.some(p => p.status === 'deleted')) throw new Error('缺已删行')
    const target = la.data.list.find(p => p.status === 'active')
    const del = await admin('postDeleteAdmin', { id: target.id })
    if (del.code !== 0) throw new Error(del.msg)
    const [[row]] = await conn.query('SELECT status FROM activity_posts WHERE id=?', [target.id])
    if (row.status !== 'deleted') throw new Error('admin 删除未生效')
    const [[{ c }]] = await conn.query("SELECT COUNT(*) c FROM admin_logs WHERE action='deletePost' AND target_id=?", [String(target.id)])
    if (c !== 1) throw new Error('缺审计')
  })

  // 清理（FK 顺序：posts → signups → activities）
  if (createdActs.length) {
    const ph = createdActs.map(() => '?').join(',')
    await conn.query(`DELETE FROM activity_posts WHERE activity_id IN (${ph})`, createdActs)
    await conn.query(`DELETE FROM activity_signups WHERE activity_id IN (${ph})`, createdActs)
    await conn.query(`DELETE FROM activities WHERE id IN (${ph})`, createdActs)
    await conn.query("DELETE FROM admin_logs WHERE action IN ('activityCreate','activityUpdate','deletePost')")
    console.log('\n  测试数据已清理')
  }
  await conn.end()

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
