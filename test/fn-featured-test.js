// 善选故事测试 — FEAT-A01~A10：热度榜（权重/日期/排除口径）、纳入、副本修订不动原文、上下架联动、删除联动
// 经 admin 云函数（HMAC token）。测试用户/故事以 test_feat_ 前缀，结束硬删（featured_stories 随 stories 级联删）
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

async function run() {
  console.log('=== 善选故事测试（FEAT-A01~A10）===\n')
  let passed = 0, failed = 0
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const login = await callFn('admin', { action: 'login', payload: { password: DB.adminPassword } })
  const token = login.data.token
  const admin = (action, payload) => callFn('admin', { action, token, payload })

  // 前置：测试作者 + 三篇不同计数的已发布故事 + 一篇暂存
  await conn.query(
    "INSERT INTO users (openid, nickname, identity, avatar_hue, member_until) " +
    "VALUES ('test_feat_author','善选作者','authed',60,DATE_ADD(CURDATE(),INTERVAL 365 DAY)) " +
    "ON DUPLICATE KEY UPDATE member_until=DATE_ADD(CURDATE(),INTERVAL 365 DAY)")
  const [[author]] = await conn.query("SELECT id FROM users WHERE openid = 'test_feat_author'")
  async function makeStory(title, publishStatus, likes, favs, comments) {
    const [r] = await conn.query(
      "INSERT INTO stories (user_id,title,content,publish_status,like_count,fav_count,comment_count,created_by) VALUES (?,?,?,?,?,?,?,?)",
      [author.id, title, `${title} 的正文原文`, publishStatus, likes, favs, comments, author.id])
    return r.insertId
  }
  // 计数设计：默认权重(1/1/1)下 A(9) > B(8) > C(6)；权重(0/0/1)下 C(5) > B(2) > A(1)
  const idA = await makeStory('test_feat_A', 'published', 5, 3, 1)
  const idB = await makeStory('test_feat_B', 'published', 2, 4, 2)
  const idC = await makeStory('test_feat_C', 'published', 1, 0, 5)
  const idDraft = await makeStory('test_feat_draft', 'draft', 99, 99, 99)

  const rankIds = async (payload = {}) => {
    const r = await admin('featuredRank', { pageSize: 100, ...payload })
    if (r.code !== 0) throw new Error(r.msg)
    return r.data.list.filter(x => String(x.title).startsWith('test_feat_')).map(x => x.id)
  }

  await test('FEAT-A01 默认权重榜单：按 赞+藏+评 降序，暂存不进榜', async () => {
    const ids = await rankIds()
    const expect = [idA, idB, idC]
    if (JSON.stringify(ids) !== JSON.stringify(expect)) throw new Error(`顺序 ${ids}，期望 ${expect}`)
  })

  await test('FEAT-A02 改权重（0/0/1 仅评论）→ 排序变化', async () => {
    const ids = await rankIds({ wLike: 0, wFav: 0, wComment: 1 })
    const expect = [idC, idB, idA]
    if (JSON.stringify(ids) !== JSON.stringify(expect)) throw new Error(`顺序 ${ids}，期望 ${expect}`)
  })

  await test('FEAT-A03 权重非法（负数/超界）→ 拒绝', async () => {
    const r1 = await admin('featuredRank', { wLike: -1 })
    if (r1.code === 0) throw new Error('负权重不应通过')
    const r2 = await admin('featuredRank', { wFav: 101 })
    if (r2.code === 0) throw new Error('超界权重不应通过')
  })

  await test('FEAT-A04 日期范围过滤：dateTo 在创建日之前 → 空榜', async () => {
    const ids = await rankIds({ dateTo: '2020-01-01' })
    if (ids.length) throw new Error('过滤失效')
  })

  let featuredId
  await test('FEAT-A05 featuredAdd 纳入 → 副本拷贝原文 + is_featured=1 + 审计', async () => {
    const r = await admin('featuredAdd', { storyId: idA })
    if (r.code !== 0) throw new Error(r.msg)
    featuredId = r.data.id
    const [[f]] = await conn.query('SELECT story_id, title, content, status FROM featured_stories WHERE id = ?', [featuredId])
    if (f.story_id !== idA || f.title !== 'test_feat_A' || f.status !== 'online') throw new Error('副本内容异常')
    const [[d]] = await conn.query('SELECT is_featured FROM stories WHERE id = ?', [idA])
    if (d.is_featured !== 1) throw new Error('is_featured 未置位')
    const [[{ c }]] = await conn.query("SELECT COUNT(*) c FROM admin_logs WHERE action='featuredAdd' AND target_id=?", [String(featuredId)])
    if (c !== 1) throw new Error('审计缺失')
  })

  await test('FEAT-A06 已善选（含 offline）不再进榜 + 重复纳入报错', async () => {
    const ids = await rankIds()
    if (ids.includes(idA)) throw new Error('已善选故事仍在榜单')
    const dup = await admin('featuredAdd', { storyId: idA })
    if (dup.code === 0) throw new Error('重复纳入不应通过')
    await admin('featuredToggle', { id: featuredId, status: 'offline' })
    const ids2 = await rankIds()
    if (ids2.includes(idA)) throw new Error('offline 副本对应故事不应回榜（应在善选列表重新上架）')
    await admin('featuredToggle', { id: featuredId, status: 'online' })
  })

  await test('FEAT-A07 featuredUpdate 修订副本 → 原故事原文不受影响', async () => {
    const r = await admin('featuredUpdate', { id: featuredId, title: '修订后的善选标题', content: '修订后的善选正文' })
    if (r.code !== 0) throw new Error(r.msg)
    const [[f]] = await conn.query('SELECT title, content FROM featured_stories WHERE id = ?', [featuredId])
    if (f.title !== '修订后的善选标题' || f.content !== '修订后的善选正文') throw new Error('副本未更新')
    const [[d]] = await conn.query('SELECT title, content, content_edited_at FROM stories WHERE id = ?', [idA])
    if (d.title !== 'test_feat_A' || d.content !== 'test_feat_A 的正文原文') throw new Error('原文被误改')
    if (d.content_edited_at !== null) throw new Error('原故事 content_edited_at 不应被置位')
  })

  await test('FEAT-A08 featuredToggle 下架/上架 → stories.is_featured 联动', async () => {
    await admin('featuredToggle', { id: featuredId, status: 'offline' })
    let [[d]] = await conn.query('SELECT is_featured FROM stories WHERE id = ?', [idA])
    if (d.is_featured !== 0) throw new Error('下架未联动 is_featured=0')
    await admin('featuredToggle', { id: featuredId, status: 'online' })
    ;[[d]] = await conn.query('SELECT is_featured FROM stories WHERE id = ?', [idA])
    if (d.is_featured !== 1) throw new Error('上架未联动 is_featured=1')
  })

  await test('FEAT-A09 featuredList/featuredDetail 形状（副本+原文对照）', async () => {
    const l = await admin('featuredList', { keyword: '修订后的善选标题' })
    if (l.code !== 0) throw new Error(l.msg)
    const row = l.data.list.find(x => x.id === featuredId)
    if (!row || row.storyId !== idA || !('excerpt' in row) || !('featuredAt' in row)) throw new Error('列表形状异常')
    const d = await admin('featuredDetail', { id: featuredId })
    if (d.code !== 0) throw new Error(d.msg)
    if (d.data.title !== '修订后的善选标题' || d.data.originTitle !== 'test_feat_A') throw new Error('详情副本/原文对照异常')
  })

  await test('FEAT-A10 admin 删除原故事 → 善选副本联动下架 + is_featured=0', async () => {
    const r = await admin('deleteStory', { id: idA })
    if (r.code !== 0) throw new Error(r.msg)
    const [[f]] = await conn.query('SELECT status FROM featured_stories WHERE id = ?', [featuredId])
    if (f.status !== 'offline') throw new Error('副本未联动下架')
    const [[d]] = await conn.query('SELECT is_featured, status FROM stories WHERE id = ?', [idA])
    if (d.is_featured !== 0 || d.status !== 'deleted') throw new Error('原故事状态异常')
  })

  // 清理：硬删测试故事（featured_stories 级联）与测试用户，清相关审计
  await conn.query('DELETE FROM stories WHERE id IN (?,?,?,?)', [idA, idB, idC, idDraft])
  await conn.query("DELETE FROM admin_logs WHERE target_type IN ('featured','story') AND action LIKE 'featured%'")
  await conn.query("DELETE FROM admin_logs WHERE action='deleteStory' AND target_id=?", [String(idA)])
  await conn.query("DELETE FROM users WHERE openid = 'test_feat_author'")
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
