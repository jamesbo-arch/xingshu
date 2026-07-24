// 故事权限矩阵测试（v3.0 善选版）— PERM-A01 ~ PERM-A13
// 身份：guest=test_perm_guest（临时创建）/ authed=mock_me / member=mock_luminyuan / 作者=mock_yanqiu（member）
// 新语义：故事两态（draft 仅作者 / published 面向会员）；善选故事对公众开放（未登录亦可读全文，互动才需授权）；
// 非会员读未善选 → -2；30% 会员墙已下线；退出登录即回游客视角（不认作者、不带互动态）
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
  console.log('=== 故事权限矩阵测试（PERM-A01~A16 · 精选版）===\n')
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
  const list = (openid) => callFn('getStoryList', { mode: 'stories', page: 1, pageSize: 50 }, openid)

  await test('PERM-A01 guest 看善选故事详情 → 免登录读副本全文（无互动态字段）', async () => {
    const r = await detail(featStoryId, GUEST)
    if (r.code !== 0) throw new Error(`期望 code 0，实际 ${r.code}`)
    if (r.data.title !== FEAT_TITLE || r.data.content !== FEAT_CONTENT) throw new Error('未返回善选副本全文')
    if (JSON.stringify(r.data.content).includes(LONG_CONTENT.slice(0, 20))) throw new Error('泄露了原文')
    if (r.data.isLiked !== undefined || r.data.isFavorited !== undefined) throw new Error('未登录不应带互动态')
  })

  await test('PERM-A01b guest 看未善选的会员故事 → -2 会员专享且不泄露内容', async () => {
    const r = await detail(pubOnlyId, GUEST)
    if (r.code !== -2) throw new Error(`期望 code -2，实际 ${r.code}`)
    if (JSON.stringify(r).includes(LONG_CONTENT.slice(0, 20))) throw new Error('响应泄露了内容')
  })

  await test('PERM-A01c guest 看暂存稿 → -1 不存在', async () => {
    const r = await detail(draftId, GUEST)
    if (r.code !== -1) throw new Error(`期望 code -1，实际 ${r.code}`)
    if (JSON.stringify(r).includes(LONG_CONTENT.slice(0, 20))) throw new Error('响应泄露了内容')
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

  await test('PERM-A07 guest 广场列表 → 仅善选卡片、副本全文、无 content_rich', async () => {
    const l = await list(GUEST)
    if (l.code !== 0) throw new Error(l.msg)
    const ids = l.data.list.map(d => d.id)
    if (!ids.includes(featStoryId)) throw new Error('善选卡片缺失')
    if (ids.includes(pubOnlyId)) throw new Error('未善选故事泄露给游客')
    if (ids.includes(draftId)) throw new Error('暂存故事泄露')
    const row = l.data.list.find(d => d.id === featStoryId)
    if (row.title !== FEAT_TITLE || row.content !== FEAT_CONTENT) throw new Error('列表应展示善选副本全文')
    if (row.content_rich !== undefined) throw new Error('列表泄露样式版 content_rich')
    if (row.isLiked || row.isFavorited) throw new Error('未登录不应有互动态')
  })

  await test('PERM-A08 authed 广场列表 → 仅善选卡片且为副本全文', async () => {
    const l = await list(AUTHED)
    const ids = l.data.list.map(d => d.id)
    if (!ids.includes(featStoryId)) throw new Error('善选卡片缺失')
    if (ids.includes(pubOnlyId)) throw new Error('未善选故事泄露给非会员')
    const row = l.data.list.find(d => d.id === featStoryId)
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
    if (pubRow.content !== LONG_CONTENT) throw new Error('member 应读原文全文')
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

  await test('PERM-A13 退出登录即回游客视角：作者读不到自己的暂存稿，不带互动态', async () => {
    const EXA = 'test_perm_exauthor'
    await conn.query(
      "INSERT INTO users (openid, nickname, identity, avatar_hue, member_until) " +
      "VALUES (?, '退出态作者', 'authed', 45, DATE_ADD(CURDATE(),INTERVAL 30 DAY)) " +
      "ON DUPLICATE KEY UPDATE identity='authed', member_until=DATE_ADD(CURDATE(),INTERVAL 30 DAY)", [EXA])
    const own = await callFn('createStory', { title: 'test_perm_ex_draft', content: LONG_CONTENT, tags: [], publishStatus: 'draft' }, EXA)
    if (own.code !== 0) throw new Error('前置造数失败：' + own.msg)
    // 授权态：作者可读自己的暂存稿
    const before = await detail(own.data.id, EXA)
    if (before.code !== 0) throw new Error(`授权态作者应可读自己的暂存稿，实际 ${before.code}`)
    // 退出登录（identity=guest，会员期仍在）：不再认作者
    await conn.query("UPDATE users SET identity='guest' WHERE openid = ?", [EXA])
    const after = await detail(own.data.id, EXA)
    if (after.code !== -1) throw new Error(`退出态应按游客拦截（-1），实际 ${after.code}`)
    const l = await list(EXA)
    if (l.data.list.some(d => d.id === own.data.id)) throw new Error('退出态广场泄露自己的暂存稿')
    await conn.query('DELETE FROM stories WHERE id = ?', [own.data.id])
    await conn.query('DELETE FROM users WHERE openid = ?', [EXA])
  })

  // v2.0：评论收窄为会员专享（精选/公众版故事无评论区），authed 只保留点赞/收藏
  await test('PERM-A12 authed 可对精选故事点赞（落原故事），但评论被拒（会员专享）', async () => {
    const like = await callFn('toggleLike', { targetId: featStoryId, targetType: 'story' }, AUTHED)
    if (like.code !== 0 || like.data.liked !== true) throw new Error('点赞失败')
    const [[row]] = await conn.query(
      "SELECT COUNT(*) c FROM interactions WHERE target_type='story' AND target_id=? AND action='like'", [featStoryId])
    if (!row.c) throw new Error('互动未落库到原故事')
    const cm = await callFn('createStoryComment', { storyId: featStoryId, content: 'test_perm 精选评论' }, AUTHED)
    if (cm.code !== -2) throw new Error(`非会员评论应被拒（-2），实际 code=${cm.code}`)
    const mcm = await callFn('createStoryComment', { storyId: featStoryId, content: 'test_perm 会员评论' }, MEMBER)
    if (mcm.code !== 0) throw new Error('会员评论应通过：' + mcm.msg)
    await conn.query('DELETE FROM comments WHERE id = ?', [mcm.data.id])
    await callFn('toggleLike', { targetId: featStoryId, targetType: 'story' }, AUTHED) // 取消点赞还原
    await conn.query('UPDATE stories SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?', [featStoryId])
  })

  await test('PERM-A14 阅读记录落表：guest/member 读各记一行，作者自读与 -2 拒绝不记', async () => {
    const cnt = async () => (await conn.query(
      'SELECT COUNT(*) c FROM story_reads WHERE story_id IN (?,?)', [featStoryId, pubOnlyId]))[0][0].c
    const base = await cnt()
    await detail(featStoryId, GUEST)     // guest 读善选 → +1（via_featured=1）
    await detail(pubOnlyId, MEMBER)      // member 读原文 → +1（via_featured=0）
    await detail(featStoryId, AUTHOR)    // 作者自读 → 不记
    await detail(pubOnlyId, AUTHED)      // -2 拒绝 → 不记
    const after = await cnt()
    if (after !== base + 2) throw new Error(`期望 +2，实际 +${after - base}`)
    const [[g]] = await conn.query(
      "SELECT identity, via_featured FROM story_reads WHERE story_id = ? ORDER BY id DESC LIMIT 1", [featStoryId])
    if (g.identity !== 'guest' || g.via_featured !== 1) throw new Error(`guest 记录异常 ${g.identity}/${g.via_featured}`)
    const [[m]] = await conn.query(
      "SELECT identity, via_featured FROM story_reads WHERE story_id = ? ORDER BY id DESC LIMIT 1", [pubOnlyId])
    if (m.identity !== 'member' || m.via_featured !== 0) throw new Error(`member 记录异常 ${m.identity}/${m.via_featured}`)
  })

  // v2.0：取副本（preferFeatured）与「是否记阅读」拆成两个参数——
  // 海报生成传 silent 不记（不是真实阅读）；会员星标筛选态阅读只传 preferFeatured，照常记
  await test('PERM-A15 preferFeatured 取精选副本：silent 不计阅读，不带 silent 则计', async () => {
    const cnt = async () => (await conn.query(
      'SELECT COUNT(*) c FROM story_reads WHERE story_id = ?', [featStoryId]))[0][0].c
    const base = await cnt()
    const poster = await callFn('getStoryDetail', { storyId: featStoryId, preferFeatured: true, silent: true }, MEMBER)
    if (poster.code !== 0) throw new Error(poster.msg)
    if (poster.data.title !== FEAT_TITLE || poster.data.content !== FEAT_CONTENT) throw new Error('海报视角应返回精选副本')
    if (!poster.data.viaFeatured) throw new Error('取到副本时应回报 viaFeatured')
    if (await cnt() !== base) throw new Error('silent 不应计入阅读记录')

    const read = await callFn('getStoryDetail', { storyId: featStoryId, preferFeatured: true }, MEMBER)
    if (read.code !== 0) throw new Error(read.msg)
    if (read.data.content !== FEAT_CONTENT) throw new Error('星标筛选态应返回精选副本')
    if (await cnt() !== base + 1) throw new Error('不带 silent 的副本阅读应计入阅读记录')
  })

  await test('PERM-A16 会员传 featuredOnly → 列表切公众版精选副本视图', async () => {
    const l = await callFn('getStoryList', { mode: 'stories', page: 1, pageSize: 50, featuredOnly: true }, MEMBER)
    if (l.code !== 0) throw new Error(l.msg)
    const ids = l.data.list.map(d => d.id)
    if (!ids.includes(featStoryId)) throw new Error('精选故事缺失')
    if (ids.includes(pubOnlyId)) throw new Error('未精选故事不应出现在精选筛选结果')
    const row = l.data.list.find(d => d.id === featStoryId)
    if (row.title !== FEAT_TITLE || row.content !== FEAT_CONTENT) throw new Error('精选筛选应展示副本内容')
  })

  // 清理（featured_stories/story_reads 由 stories 硬删级联删除）
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
