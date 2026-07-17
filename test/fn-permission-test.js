// 故事权限矩阵测试（v3.0 善选版）— PERM-A01 ~ PERM-A10
// 身份：guest=test_perm_guest（临时创建）/ authed=mock_me / member=mock_luminyuan / 作者=mock_yanqiu（member）
// 新语义：故事两态（draft 仅作者 / published 面向会员）；公众（guest/authed）只见善选副本；30% 会员墙已下线
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const AUTHOR = 'mock_yanqiu'
const AUTHED = 'mock_me'
const MEMBER = 'mock_luminyuan'
const GUEST = 'test_perm_guest'
const LONG_CONTENT = Array.from({ length: 20 }, (_, i) => `第${String(i).padStart(2, '0')}段权限矩阵验证文字`).join('；')
const FEAT_TITLE = 'test_perm_featured_修订版标题'
const FEAT_CONTENT = '这是管理员修订过的善选副本正文（与原文不同）'

async function run() {
  console.log('=== 故事权限矩阵测试（PERM-A01~A10 · 善选版）===\n')
  let passed = 0, failed = 0
  const created = []
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  // 前置：临时 guest 用户 + 作者（member）名下测试故事：已发布×2（其一纳入善选并修订副本）、暂存×1
  await conn.query(
    "INSERT INTO users (openid, nickname, identity, avatar_hue) VALUES (?, '权限游客', 'guest', 45) ON DUPLICATE KEY UPDATE identity='guest'",
    [GUEST])
  async function makeStory(publishStatus, suffix) {
    const r = await callFn('createStory', {
      title: `test_perm_${suffix}`, content: LONG_CONTENT,
      contentRich: `<p>${LONG_CONTENT}</p>`, tags: [], publishStatus,
    }, AUTHOR)
    created.push(r.data.id)
    return r.data.id
  }
  const featStoryId = await makeStory('published', 'featured')  // 将纳入善选
  const pubOnlyId = await makeStory('published', 'memberonly')  // 仅会员可见（未善选）
  const draftId = await makeStory('draft', 'draft')
  // 直接落库建善选副本（副本标题/正文为修订版，用于断言公众端读到的是副本而非原文）
  await conn.query(
    'INSERT INTO featured_stories (story_id, title, content) VALUES (?, ?, ?)',
    [featStoryId, FEAT_TITLE, FEAT_CONTENT])
  await conn.query('UPDATE stories SET is_featured = 1 WHERE id = ?', [featStoryId])

  const detail = (id, openid) => callFn('getStoryDetail', { storyId: id }, openid)
  const list = (openid) => callFn('getStoryList', { mode: 'square', page: 1, pageSize: 50 }, openid)

  await test('PERM-A01 guest 看任意故事详情 → -3 登录引导且不泄露内容', async () => {
    for (const id of [featStoryId, pubOnlyId]) {
      const r = await detail(id, GUEST)
      if (r.code !== -3) throw new Error(`期望 code -3，实际 ${r.code}`)
      if (JSON.stringify(r).includes(LONG_CONTENT.slice(0, 20))) throw new Error('响应泄露了内容')
    }
  })

  await test('PERM-A02 authed 看善选故事详情 → 副本全文（修订版，非原文）', async () => {
    const r = await detail(featStoryId, AUTHED)
    if (r.code !== 0) throw new Error(r.msg)
    if (r.data.title !== FEAT_TITLE) throw new Error(`标题应为副本修订版，实际 ${r.data.title}`)
    if (r.data.content !== FEAT_CONTENT) throw new Error('正文应为副本修订版')
    if (JSON.stringify(r.data.content).includes(LONG_CONTENT.slice(0, 20))) throw new Error('泄露了原文')
    if (!r.data.is_featured) throw new Error('缺少 is_featured 标记')
  })

  await test('PERM-A03 authed 看未善选的已发布故事 → -2 会员专享且不泄露内容', async () => {
    const r = await detail(pubOnlyId, AUTHED)
    if (r.code !== -2) throw new Error(`期望 code -2，实际 ${r.code}`)
    if (JSON.stringify(r).includes(LONG_CONTENT.slice(0, 20))) throw new Error('响应泄露了内容')
  })

  await test('PERM-A04 member 看已发布故事 → 原文全文（善选故事也读原文非副本）', async () => {
    for (const id of [featStoryId, pubOnlyId]) {
      const r = await detail(id, MEMBER)
      if (r.code !== 0) throw new Error(r.msg)
      if (r.data.content !== LONG_CONTENT) throw new Error(`会员未能读原文全文 id=${id}`)
    }
  })

  await test('PERM-A05 作者本人看自己的已发布/暂存故事 → 原文全文', async () => {
    for (const id of [featStoryId, draftId]) {
      const r = await detail(id, AUTHOR)
      if (r.code !== 0 || r.data.content !== LONG_CONTENT) throw new Error(`作者读 ${id} 失败`)
    }
  })

  await test('PERM-A06 暂存故事对他人隔离（详情+列表，含 member）', async () => {
    const r = await detail(draftId, MEMBER)
    if (r.code === 0) throw new Error('他人不应读到暂存故事')
    const l = await list(MEMBER)
    if (l.data.list.some(d => d.id === draftId)) throw new Error('暂存故事泄露到列表')
  })

  await test('PERM-A07 guest 广场列表 → 仅善选卡片且为摘要、无 content_rich', async () => {
    const l = await list(GUEST)
    if (l.code !== 0) throw new Error(l.msg)
    const ids = l.data.list.map(d => d.id)
    if (!ids.includes(featStoryId)) throw new Error('善选卡片缺失')
    if (ids.includes(pubOnlyId)) throw new Error('未善选故事泄露给游客')
    if (ids.includes(draftId)) throw new Error('暂存故事泄露')
    const row = l.data.list.find(d => d.id === featStoryId)
    if (!row.excerpt || row.content.length > 80) throw new Error(`未截断为摘要：len=${row.content.length}`)
    if (row.content_rich !== undefined) throw new Error('列表泄露样式版 content_rich')
    if (row.title !== FEAT_TITLE) throw new Error('列表应展示善选副本标题')
  })

  await test('PERM-A08 authed 广场列表 → 仅善选卡片且为副本全文（不截断）', async () => {
    const l = await list(AUTHED)
    const ids = l.data.list.map(d => d.id)
    if (!ids.includes(featStoryId)) throw new Error('善选卡片缺失')
    if (ids.includes(pubOnlyId)) throw new Error('未善选故事泄露给非会员')
    const row = l.data.list.find(d => d.id === featStoryId)
    if (row.excerpt) throw new Error('authed 善选卡片不应截断')
    if (row.content !== FEAT_CONTENT) throw new Error('内容应为副本全文')
  })

  await test('PERM-A09 member 广场列表 → 全部已发布原文 + isFeatured 标记，暂存不进', async () => {
    const l = await list(MEMBER)
    const ids = l.data.list.map(d => d.id)
    if (!ids.includes(featStoryId) || !ids.includes(pubOnlyId)) throw new Error('已发布故事缺失')
    if (ids.includes(draftId)) throw new Error('暂存故事泄露')
    const featRow = l.data.list.find(d => d.id === featStoryId)
    if (!featRow.is_featured) throw new Error('善选故事缺 is_featured 标记')
    if (featRow.title === FEAT_TITLE) throw new Error('会员应看原文标题而非善选副本')
    const pubRow = l.data.list.find(d => d.id === pubOnlyId)
    if (pubRow.excerpt) throw new Error('member 不应被截断')
  })

  await test('PERM-A10 善选副本下架 → 公众端消失、authed 详情回落 -2', async () => {
    await conn.query("UPDATE featured_stories SET status = 'offline' WHERE story_id = ?", [featStoryId])
    const l = await list(AUTHED)
    if (l.data.list.some(d => d.id === featStoryId)) throw new Error('下架副本仍出现在公众列表')
    const r = await detail(featStoryId, AUTHED)
    if (r.code !== -2) throw new Error(`下架后期望 -2，实际 ${r.code}`)
    await conn.query("UPDATE featured_stories SET status = 'online' WHERE story_id = ?", [featStoryId])
  })

  await test('PERM-A11 过期会员按非会员：读未善选故事 → -2（身份+有效期综合判断）', async () => {
    const EXP = 'test_perm_expmember'
    await conn.query(
      "INSERT INTO users (openid, nickname, identity, avatar_hue, member_until) " +
      "VALUES (?, '过期会员', 'authed', 45, DATE_SUB(CURDATE(),INTERVAL 1 DAY)) " +
      "ON DUPLICATE KEY UPDATE identity='authed', member_until=DATE_SUB(CURDATE(),INTERVAL 1 DAY)", [EXP])
    const r = await detail(pubOnlyId, EXP)
    if (r.code !== -2) throw new Error(`过期会员读未善选故事应 -2，实际 ${r.code}`)
    await conn.query('DELETE FROM users WHERE openid = ?', [EXP])
  })

  await test('PERM-A12 authed 可对善选故事点赞/评论（互动落在原故事）', async () => {
    const like = await callFn('toggleLike', { targetId: featStoryId, targetType: 'story' }, AUTHED)
    if (like.code !== 0 || like.data.liked !== true) throw new Error('点赞失败')
    const [[row]] = await conn.query(
      "SELECT COUNT(*) c FROM interactions WHERE target_type='story' AND target_id=? AND action='like'", [featStoryId])
    if (!row.c) throw new Error('互动未落库到原故事')
    const cm = await callFn('createComment', { storyId: featStoryId, content: 'test_perm 善选评论' }, AUTHED)
    if (cm.code !== 0) throw new Error('评论失败')
    await conn.query('DELETE FROM comments WHERE id = ?', [cm.data.id])
    await callFn('toggleLike', { targetId: featStoryId, targetType: 'story' }, AUTHED) // 取消点赞还原
    await conn.query('UPDATE stories SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?', [featStoryId])
  })

  // 清理（featured_stories 由 stories 硬删级联删除）
  if (created.length) {
    await conn.query(`DELETE FROM stories WHERE id IN (${created.map(() => '?').join(',')})`, created)
    await conn.query("UPDATE users SET story_count = GREATEST(story_count - 3, 0) WHERE openid = ?", [AUTHOR])
  }
  await conn.query('DELETE FROM users WHERE openid = ?', [GUEST])
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
