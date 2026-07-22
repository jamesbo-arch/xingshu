// 醒书问答测试 — QA-A01 ~ A18（v2.0 新模块）
// 覆盖：发布/暂存两态、会员门槛、精选副本公众视图、匿名脱敏、回复只读、点赞收藏
// 身份：member=mock_luminyuan（作者）/ member2=mock_yanqiu / authed=mock_me / guest=test_qa_guest
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const AUTHOR = 'mock_luminyuan'   // 会员，问题作者
const MEMBER2 = 'mock_yanqiu'     // 另一位会员，用于回复
const AUTHED = 'mock_me'          // 已授权非会员
const GUEST = 'test_qa_guest'     // 未授权

const CONTENT = 'test_qa 读经典时如何避免只停留在摘抄，而真正带进日常生活？'
const FEAT_CONTENT = 'test_qa 这是运营修订过的精选副本正文（与原文不同）'
const ANON_CONTENT = 'test_qa 一个不愿具名的提问'

async function run() {
  console.log('=== 醒书问答测试（QA-A01~A18）===\n')
  let passed = 0, failed = 0
  const conn = await mysql.createConnection(DB)
  const created = []

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const qa = (action, payload, openid = AUTHOR) => callFn('qa', { action, payload }, openid)

  // 前置：临时 guest 用户
  await conn.query(
    "INSERT INTO users (openid, nickname, identity, avatar_hue) VALUES (?, '问答游客', 'guest', 45) " +
    "ON DUPLICATE KEY UPDATE identity='guest'", [GUEST])

  let pubId, draftId, anonId, featId

  await test('QA-A01 会员发布问题（published）与暂存（draft）', async () => {
    const r1 = await qa('create', { content: CONTENT, publishStatus: 'published' })
    if (r1.code !== 0 || !r1.data.id) throw new Error(r1.msg)
    pubId = r1.data.id; created.push(pubId)
    const r2 = await qa('create', { content: CONTENT + '（暂存）', publishStatus: 'draft' })
    if (r2.code !== 0) throw new Error(r2.msg)
    draftId = r2.data.id; created.push(draftId)
    const [[row]] = await conn.query('SELECT publish_status FROM questions WHERE id = ?', [draftId])
    if (row.publish_status !== 'draft') throw new Error('暂存态未落库')
  })

  await test('QA-A02 非会员/游客发问题被拒（会员专享）', async () => {
    const a = await qa('create', { content: 'test_qa 非会员提问', publishStatus: 'published' }, AUTHED)
    if (a.code === 0) { created.push(a.data.id); throw new Error('authed 不应能发问题') }
    const g = await qa('create', { content: 'test_qa 游客提问', publishStatus: 'published' }, GUEST)
    if (g.code === 0) { created.push(g.data.id); throw new Error('guest 不应能发问题') }
  })

  await test('QA-A03 匿名问题：他人看到「匿名」且无头像，作者本人看到真名', async () => {
    const r = await qa('create', { content: ANON_CONTENT, isAnonymous: true, publishStatus: 'published' })
    if (r.code !== 0) throw new Error(r.msg)
    anonId = r.data.id; created.push(anonId)
    const mine = await qa('detail', { id: anonId }, AUTHOR)
    if (mine.data.question.nickname === '匿名') throw new Error('作者本人应看到真名')
    const other = await qa('detail', { id: anonId }, MEMBER2)
    if (other.data.question.nickname !== '匿名') throw new Error(`他人应看到匿名，实际 ${other.data.question.nickname}`)
    if (other.data.question.avatar_url) throw new Error('匿名不应带头像')
  })

  await test('QA-A04 暂存问题仅作者可见（详情+列表）', async () => {
    const mine = await qa('detail', { id: draftId }, AUTHOR)
    if (mine.code !== 0) throw new Error('作者应能读自己的暂存')
    const other = await qa('detail', { id: draftId }, MEMBER2)
    if (other.code !== -1) throw new Error(`他人读暂存应 -1，实际 ${other.code}`)
    const l = await qa('list', { mode: 'all', pageSize: 50 }, MEMBER2)
    if (l.data.list.some(q => q.id === draftId)) throw new Error('暂存泄露到列表')
  })

  await test('QA-A05 member 列表 → 全部已发布原文', async () => {
    const l = await qa('list', { mode: 'all', pageSize: 50 }, MEMBER2)
    if (l.code !== 0) throw new Error(l.msg)
    const row = l.data.list.find(q => q.id === pubId)
    if (!row) throw new Error('已发布问题缺失')
    if (row.content !== CONTENT) throw new Error('会员应读原文')
  })

  await test('QA-A06 非会员/游客列表 → 未精选时为空（不泄露原文）', async () => {
    for (const who of [AUTHED, GUEST]) {
      const l = await qa('list', { mode: 'all', pageSize: 50 }, who)
      if (l.code !== 0) throw new Error(l.msg)
      if (l.data.list.some(q => q.id === pubId)) throw new Error(`${who} 不应看到未精选问题`)
      if (JSON.stringify(l).includes(CONTENT.slice(0, 20))) throw new Error('响应泄露了原文')
    }
  })

  await test('QA-A07 非会员/游客读未精选问题详情 → -2 会员专享', async () => {
    for (const who of [AUTHED, GUEST]) {
      const r = await qa('detail', { id: pubId }, who)
      if (r.code !== -2) throw new Error(`${who} 期望 -2，实际 ${r.code}`)
      if (JSON.stringify(r).includes(CONTENT.slice(0, 20))) throw new Error('响应泄露了原文')
    }
  })

  await test('QA-A08 纳入精选（副本可修订）后：公众读到副本而非原文', async () => {
    await conn.query('INSERT INTO featured_questions (question_id, content) VALUES (?, ?)', [pubId, FEAT_CONTENT])
    await conn.query('UPDATE questions SET is_featured = 1 WHERE id = ?', [pubId])
    featId = pubId
    for (const who of [AUTHED, GUEST]) {
      const r = await qa('detail', { id: featId }, who)
      if (r.code !== 0) throw new Error(`${who} 应能读精选问题，实际 ${r.code}`)
      if (r.data.question.content !== FEAT_CONTENT) throw new Error('应返回精选副本正文')
      if (JSON.stringify(r.data.question.content).includes(CONTENT.slice(0, 20))) throw new Error('泄露了原文')
      if (!r.data.viaFeatured) throw new Error('缺 viaFeatured 标记')
      if (r.data.canReply) throw new Error('非会员不应可回复')
    }
  })

  await test('QA-A09 会员读精选问题 → 仍是原文且可回复', async () => {
    const r = await qa('detail', { id: featId }, MEMBER2)
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.question.content !== CONTENT) throw new Error('会员应读原文')
    if (r.data.viaFeatured) throw new Error('会员视角不应标 viaFeatured')
    if (!r.data.canReply) throw new Error('会员应可回复')
  })

  await test('QA-A10 非会员/游客列表 → 精选后可见且为副本内容', async () => {
    for (const who of [AUTHED, GUEST]) {
      const l = await qa('list', { mode: 'all', pageSize: 50 }, who)
      const row = l.data.list.find(q => q.id === featId)
      if (!row) throw new Error(`${who} 应看到精选问题`)
      if (row.content !== FEAT_CONTENT) throw new Error('列表应展示副本内容')
    }
  })

  let commentId
  await test('QA-A11 会员可回复；非会员/游客回复被拒', async () => {
    const r = await qa('commentCreate', { id: featId, content: 'test_qa 我的回答是…' }, MEMBER2)
    if (r.code !== 0) throw new Error(r.msg)
    commentId = r.data.id
    for (const who of [AUTHED, GUEST]) {
      const bad = await qa('commentCreate', { id: featId, content: 'test_qa 非会员回复' }, who)
      if (bad.code === 0) throw new Error(`${who} 不应能回复`)
    }
    const [[row]] = await conn.query('SELECT comment_count FROM questions WHERE id = ?', [featId])
    if (row.comment_count !== 1) throw new Error(`回复计数应为 1，实际 ${row.comment_count}`)
  })

  await test('QA-A12 匿名回复：他人看到「匿名」', async () => {
    const r = await qa('commentCreate', { id: featId, content: 'test_qa 匿名回答', isAnonymous: true }, MEMBER2)
    if (r.code !== 0) throw new Error(r.msg)
    const list = await qa('commentList', { id: featId }, AUTHOR)
    const anon = list.data.find(c => c.id === r.data.id)
    if (!anon || anon.nickname !== '匿名') throw new Error('匿名回复未脱敏')
    const own = await qa('commentList', { id: featId }, MEMBER2)
    const mine = own.data.find(c => c.id === r.data.id)
    if (!mine) throw new Error('回复作者应能看到自己的匿名回复')
    if (mine.nickname === '匿名') throw new Error('回复作者本人应看到真名')
  })

  await test('QA-A13 公众（非会员/游客）可读全部回复（只读）', async () => {
    for (const who of [AUTHED, GUEST]) {
      const l = await qa('commentList', { id: featId }, who)
      if (l.code !== 0) throw new Error(l.msg)
      if (!l.data.length) throw new Error(`${who} 应能读到回复`)
    }
  })

  await test('QA-A14 追评（parent_id）挂在顶层回复下且不计入回复数', async () => {
    const before = (await conn.query('SELECT comment_count c FROM questions WHERE id = ?', [featId]))[0][0].c
    const r = await qa('commentCreate', { id: featId, content: 'test_qa 追问一句', parentId: commentId }, AUTHOR)
    if (r.code !== 0) throw new Error(r.msg)
    const l = await qa('commentList', { id: featId }, AUTHOR)
    const top = l.data.find(c => c.id === commentId)
    if (!top || !top.replies.some(x => x.id === r.data.id)) throw new Error('追评未挂到顶层回复下')
    const after = (await conn.query('SELECT comment_count c FROM questions WHERE id = ?', [featId]))[0][0].c
    if (after !== before) throw new Error('追评不应改变回复计数')
  })

  await test('QA-A15 点赞/收藏翻转（authed 即可，游客被拒）', async () => {
    const on = await qa('like', { id: featId }, AUTHED)
    if (on.code !== 0 || on.data.active !== true) throw new Error('点赞失败')
    const off = await qa('like', { id: featId }, AUTHED)
    if (off.data.active !== false) throw new Error('取消点赞失败')
    const fav = await qa('favToggle', { id: featId }, AUTHED)
    if (fav.code !== 0 || fav.data.active !== true) throw new Error('收藏失败')
    const g = await qa('like', { id: featId }, GUEST)
    if (g.code === 0) throw new Error('游客不应能点赞')
  })

  await test('QA-A16 收藏列表 mode=collections 返回已收藏问题', async () => {
    const l = await qa('list', { mode: 'collections', pageSize: 50 }, AUTHED)
    if (l.code !== 0) throw new Error(l.msg)
    if (!l.data.list.some(q => q.id === featId)) throw new Error('收藏列表缺少已收藏问题')
    await qa('favToggle', { id: featId }, AUTHED)  // 还原
  })

  await test('QA-A17 mode=mine 返回作者全部问题（含 draft），他人拿不到', async () => {
    const mine = await qa('list', { mode: 'mine', pageSize: 50 }, AUTHOR)
    const ids = mine.data.list.map(q => q.id)
    if (!ids.includes(draftId) || !ids.includes(featId)) throw new Error('我的问答应含暂存与已发布')
    const other = await qa('list', { mode: 'mine', pageSize: 50 }, MEMBER2)
    if (other.data.list.some(q => q.id === draftId)) throw new Error('他人 mine 列表混入了我的暂存')
  })

  await test('QA-A18 作者删除问题 → 精选副本联动下架、公众端消失', async () => {
    const r = await qa('remove', { id: featId }, AUTHOR)
    if (r.code !== 0) throw new Error(r.msg)
    const [[f]] = await conn.query('SELECT status FROM featured_questions WHERE question_id = ?', [featId])
    if (f.status !== 'offline') throw new Error('副本未联动下架')
    const l = await qa('list', { mode: 'all', pageSize: 50 }, GUEST)
    if (l.data.list.some(q => q.id === featId)) throw new Error('删除后仍出现在公众列表')
  })

  // 清理（question_comments / featured_questions 由 questions 硬删级联）
  if (created.length) {
    const ph = created.map(() => '?').join(',')
    await conn.query(`DELETE FROM interactions WHERE target_type = 'question' AND target_id IN (${ph})`, created)
    await conn.query(`DELETE FROM questions WHERE id IN (${ph})`, created)
  }
  await conn.query('DELETE FROM users WHERE openid = ?', [GUEST])
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
