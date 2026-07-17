// 评论二级回复测试 — 对应 test/prd-ch3-test-cases.md CMT-A01 ~ CMT-A05（PRD 3.1.1）
// 测试用户以 test_cmt_ 前缀创建，故事为 private 不污染广场，结束时硬删
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const OPENID = 'test_cmt_u1'

async function run() {
  console.log('=== 评论二级回复测试（CMT-A01~A05）===\n')
  let passed = 0, failed = 0
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  async function commentCount(storyId) {
    const [[row]] = await conn.query('SELECT comment_count FROM stories WHERE id = ?', [storyId])
    return row.comment_count
  }

  // 准备：登录建用户 → 建私密故事 → 发一条一级评论
  await callFn('login', {}, OPENID)
  // 写故事为会员专享，将测试用户升为有效会员后再建故事（结束时随用户硬删）
  await conn.query("UPDATE users SET identity='member', member_until=DATE_ADD(CURDATE(),INTERVAL 1 YEAR) WHERE openid=?", [OPENID])
  const story = await callFn('createStory', {
    title: '评论回环测试故事', content: '本条由 fn-comment-test 创建，若残留请删除',
    tags: [], publishStatus: 'draft',
  }, OPENID)
  const storyId = story.data.id
  const parent = await callFn('createComment', { storyId, content: '一级评论' }, OPENID)
  const parentId = parent.data.id

  let replyId
  await test('CMT-A01 发布二级回复 → 落库且不增加故事评论计数', async () => {
    const before = await commentCount(storyId)
    const r = await callFn('createComment', { storyId, parentId, content: '二级回复1' }, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    replyId = r.data.id
    const [[row]] = await conn.query('SELECT parent_id FROM comments WHERE id = ?', [replyId])
    if (row.parent_id !== parentId) throw new Error(`parent_id=${row.parent_id}`)
    const after = await commentCount(storyId)
    if (after !== before) throw new Error(`计数变化 ${before}→${after}，回复不应计入`)
  })

  await test('CMT-A02 回复随父评论返回且按时间正序', async () => {
    await callFn('createComment', { storyId, parentId, content: '二级回复2' }, OPENID)
    const r = await callFn('getComments', { storyId }, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    const p = r.data.list.find(c => c.id === parentId)
    if (!p || !Array.isArray(p.replies)) throw new Error('父评论无 replies 数组')
    if (p.replies.length !== 2) throw new Error(`期望 2 条回复，实际 ${p.replies.length}`)
    if (p.replies[0].content !== '二级回复1') throw new Error('回复未按时间正序')
    // 回复须带 isMine（本人回复），供前端回复删除入口判定
    if (p.replies.some(x => x.isMine !== true)) throw new Error('回复缺 isMine 标记')
  })

  await test('CMT-A03 删除自己的回复 → 软删且父评论计数不变', async () => {
    const before = await commentCount(storyId)
    const r = await callFn('deleteComment', { commentId: replyId }, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    const [[row]] = await conn.query('SELECT is_deleted FROM comments WHERE id = ?', [replyId])
    if (row.is_deleted !== 1) throw new Error('未软删')
    if (await commentCount(storyId) !== before) throw new Error('回复删除不应改变故事计数')
    const g = await callFn('getComments', { storyId }, OPENID)
    if (g.data.list.find(c => c.id === parentId).replies.some(x => x.id === replyId)) {
      throw new Error('已删回复仍返回')
    }
  })

  await test('CMT-A04 删除父评论 → 故事计数 -1 且整串不再返回', async () => {
    const before = await commentCount(storyId)
    const r = await callFn('deleteComment', { commentId: parentId }, OPENID)
    if (r.code !== 0) throw new Error(r.msg)
    if (await commentCount(storyId) !== before - 1) throw new Error('计数未 -1')
    const g = await callFn('getComments', { storyId }, OPENID)
    if (g.data.list.some(c => c.id === parentId)) throw new Error('已删父评论仍返回')
  })

  await test('CMT-A05 参数校验：缺 content/storyId 拒绝；parentId 不存在拒绝', async () => {
    const r1 = await callFn('createComment', { storyId }, OPENID)
    if (r1.code === 0) throw new Error('缺 content 不应通过')
    const r2 = await callFn('createComment', { content: 'x' }, OPENID)
    if (r2.code === 0) throw new Error('缺 storyId 不应通过')
    // parent_id 有外键约束，不存在的父评论应导致调用失败（抛错）或非 0 code
    let rejected = false
    try {
      const r3 = await callFn('createComment', { storyId, parentId: 999999999, content: 'x' }, OPENID)
      rejected = r3.code !== 0
    } catch { rejected = true }
    if (!rejected) throw new Error('无效 parentId 不应通过')
  })

  // 清理（comments 对 story 有级联外键，先删故事评论再删故事与用户）
  await conn.query('DELETE FROM comments WHERE story_id = ?', [storyId])
  await conn.query('DELETE FROM stories WHERE id = ?', [storyId])
  await conn.query("DELETE FROM users WHERE openid LIKE 'test_cmt_%'")
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
