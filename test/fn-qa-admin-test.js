// 问答后台管理测试 — QAA-01 ~ 08（v2.0）
// 覆盖：列表筛选与真实作者、详情含回复与副本、精选纳入/修订/上下架联动、删除联动、ACL
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const AUTHOR = 'mock_luminyuan'   // 会员，问题作者
const MEMBER2 = 'mock_yanqiu'     // 另一位会员，回复者

async function run() {
  console.log('=== 问答后台管理测试（QAA-01~08）===\n')
  let passed = 0, failed = 0, token = null
  const created = []

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const admin = (action, payload) => callFn('admin', { action, token, payload })
  const qa = (action, payload, openid = AUTHOR) => callFn('qa', { action, payload }, openid)
  const conn = await mysql.createConnection(DB)

  const login = await callFn('admin', { action: 'login', payload: { password: DB.adminPassword } })
  token = login.data.token

  // 前置：一条匿名已发布问题 + 一条暂存 + 一条回复
  const anonQ = await qa('create', { content: 'test_qaa 匿名提问正文', isAnonymous: true, publishStatus: 'published' })
  const qid = anonQ.data.id; created.push(qid)
  const draftQ = await qa('create', { content: 'test_qaa 暂存问题', publishStatus: 'draft' })
  const draftId = draftQ.data.id; created.push(draftId)
  const cm = await qa('commentCreate', { id: qid, content: 'test_qaa 我的回答' }, MEMBER2)
  const commentId = cm.data.id

  await test('QAA-01 列表返回真实作者 + 匿名标记（后台不脱敏）', async () => {
    const r = await admin('questionList', { keyword: 'test_qaa 匿名提问' })
    if (r.code !== 0) throw new Error(r.msg)
    const row = r.data.list.find(q => q.id === qid)
    if (!row) throw new Error('列表缺目标问题')
    if (row.author === '匿名') throw new Error('后台应显示真实作者')
    if (!row.isAnonymous) throw new Error('缺 isAnonymous 标记')
  })

  await test('QAA-02 按状态筛选：draft / published', async () => {
    const d = await admin('questionList', { keyword: 'test_qaa', publishStatus: 'draft' })
    const ids = d.data.list.map(q => q.id)
    if (!ids.includes(draftId)) throw new Error('暂存筛选缺目标')
    if (ids.includes(qid)) throw new Error('暂存筛选混入已发布')
    const p = await admin('questionList', { keyword: 'test_qaa', publishStatus: 'published' })
    if (p.data.list.some(q => q.id === draftId)) throw new Error('已发布筛选混入暂存')
  })

  await test('QAA-03 详情含问题 + 回复列表（真实作者）+ 副本占位', async () => {
    const r = await admin('questionDetail', { id: qid })
    if (r.code !== 0) throw new Error(r.msg)
    if (!r.data.question) throw new Error('缺 question')
    if (!r.data.comments.some(c => c.id === commentId)) throw new Error('缺回复')
    if (r.data.comments[0].author === '匿名') throw new Error('后台回复应显示真实作者')
    if (r.data.featured !== null) throw new Error('尚未纳入精选时 featured 应为 null')
  })

  await test('QAA-04 纳入精选：生成副本 + is_featured 置位 + 审计', async () => {
    const r = await admin('qaFeaturedAdd', { questionId: qid })
    if (r.code !== 0) throw new Error(r.msg)
    const [[q]] = await conn.query('SELECT is_featured FROM questions WHERE id = ?', [qid])
    if (!q.is_featured) throw new Error('is_featured 未置位')
    const [[f]] = await conn.query('SELECT content, status FROM featured_questions WHERE question_id = ?', [qid])
    if (f.content !== 'test_qaa 匿名提问正文') throw new Error('副本未拷贝原文')
    if (f.status !== 'online') throw new Error('副本应默认上架')
    const [[{ c }]] = await conn.query(
      "SELECT COUNT(*) c FROM admin_logs WHERE action='qaFeaturedAdd' AND target_id=?", [String(qid)])
    if (!c) throw new Error('缺审计')
  })

  await test('QAA-05 暂存问题不可纳入精选', async () => {
    const r = await admin('qaFeaturedAdd', { questionId: draftId })
    if (r.code === 0) throw new Error('暂存问题不应能纳入精选')
  })

  await test('QAA-06 修订副本不影响作者原文', async () => {
    const NEW = 'test_qaa 运营修订后的副本正文'
    const r = await admin('qaFeaturedUpdate', { questionId: qid, content: NEW })
    if (r.code !== 0) throw new Error(r.msg)
    const [[f]] = await conn.query('SELECT content FROM featured_questions WHERE question_id = ?', [qid])
    if (f.content !== NEW) throw new Error('副本未更新')
    const [[q]] = await conn.query('SELECT content FROM questions WHERE id = ?', [qid])
    if (q.content !== 'test_qaa 匿名提问正文') throw new Error('作者原文被误改')
    // 公众端读到的应是修订后的副本
    const pub = await qa('detail', { id: qid }, 'mock_me')
    if (pub.data.question.content !== NEW) throw new Error('公众端未读到修订副本')
  })

  await test('QAA-07 下架副本：is_featured 归零、公众端消失；重新上架恢复', async () => {
    await admin('qaFeaturedToggle', { questionId: qid, status: 'offline' })
    const [[q]] = await conn.query('SELECT is_featured FROM questions WHERE id = ?', [qid])
    if (q.is_featured) throw new Error('下架后 is_featured 应归零')
    const pub = await qa('detail', { id: qid }, 'mock_me')
    if (pub.code !== -2) throw new Error(`下架后非会员应 -2，实际 ${pub.code}`)
    await admin('qaFeaturedToggle', { questionId: qid, status: 'online' })
    const back = await qa('detail', { id: qid }, 'mock_me')
    if (back.code !== 0) throw new Error('重新上架后应可读')
    // 重新上架不应覆盖运营修订过的正文
    if (back.data.question.content !== 'test_qaa 运营修订后的副本正文') throw new Error('重新上架覆盖了修订内容')
  })

  await test('QAA-08 删回复减计数；删问题联动下架副本', async () => {
    const before = (await conn.query('SELECT comment_count c FROM questions WHERE id = ?', [qid]))[0][0].c
    const dc = await admin('questionCommentDelete', { id: commentId })
    if (dc.code !== 0) throw new Error(dc.msg)
    const after = (await conn.query('SELECT comment_count c FROM questions WHERE id = ?', [qid]))[0][0].c
    if (after !== before - 1) throw new Error(`回复计数应 -1，实际 ${before}→${after}`)

    const dq = await admin('questionDelete', { id: qid })
    if (dq.code !== 0) throw new Error(dq.msg)
    const [[q]] = await conn.query('SELECT status, is_featured FROM questions WHERE id = ?', [qid])
    if (q.status !== 'deleted' || q.is_featured) throw new Error('问题未软删或 is_featured 未清')
    const [[f]] = await conn.query('SELECT status FROM featured_questions WHERE question_id = ?', [qid])
    if (f.status !== 'offline') throw new Error('副本未联动下架')
  })

  // 清理
  if (created.length) {
    const ph = created.map(() => '?').join(',')
    await conn.query(`DELETE FROM interactions WHERE target_type='question' AND target_id IN (${ph})`, created)
    await conn.query(`DELETE FROM questions WHERE id IN (${ph})`, created)
  }
  await conn.query(
    "DELETE FROM admin_logs WHERE action IN ('qaFeaturedAdd','qaFeaturedUpdate','qaFeaturedToggle','questionDelete','questionCommentDelete')")
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
