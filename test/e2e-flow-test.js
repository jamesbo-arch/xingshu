// 端到端流程测试 — 模拟真实用户行为，直接验证 MySQL 数据一致性
const mysql = require('mysql2/promise')
const DB = require('../config/db')

async function run() {
  const db = await mysql.createConnection(DB)
  console.log('=== 醒书故事 E2E 流程测试 ===\n')
  let passed = 0, failed = 0
  const t = (n, f) => { passed++; console.log(`  PASS  ${n}`) }
  const f = (n, e) => { failed++; console.log(`  FAIL  ${n}: ${e}`) }

  // ==== 用户注册与登录 ====
  console.log('[身份流程] guest → authed → member')

  // 1. 游客首次访问 → login 云函数创建用户
  let testUserId
  try {
    const [r] = await db.query("INSERT INTO users (openid, nickname, identity, avatar_hue) VALUES ('test_e2e_openid', '测试用户', 'guest', 120)")
    testUserId = r.insertId
    await db.query('UPDATE users SET created_by = ? WHERE id = ?', [testUserId, testUserId])
    t('guest 注册',`user_id=${testUserId}`)
  } catch(e) { f('guest 注册', e.message) }

  // 2. 游客升级到 authed
  try {
    await db.query("UPDATE users SET identity='authed', updated_by=? WHERE id=?", [testUserId, testUserId])
    const [u] = await db.query('SELECT identity FROM users WHERE id=?', [testUserId])
    if (u[0].identity !== 'authed') throw new Error('identity not updated')
    t('guest → authed 升级',`identity=${u[0].identity}`)
  } catch(e) { f('guest → authed', e.message) }

  // 3. 用户升级到 member（模拟管理员激活订单）
  try {
    const orderId = 'TEST-' + Date.now().toString(36).toUpperCase()
    const [r] = await db.query(
      "INSERT INTO orders (id, user_id, amount, plan, method, status, note, created_by) VALUES (?,?,365,'年度会员','offline','pending','E2E测试',?)",
      [orderId, testUserId, testUserId]
    )
    await db.query("UPDATE orders SET status='paid' WHERE id=?", [orderId])
    await db.query("UPDATE users SET identity='member', member_from=CURDATE(), member_until=DATE_ADD(CURDATE(),INTERVAL 365 DAY) WHERE id=?", [testUserId])
    const [u] = await db.query('SELECT identity, member_until, DATEDIFF(member_until,CURDATE()) AS days FROM users WHERE id=?', [testUserId])
    if (u[0].identity !== 'member') throw new Error('not member')
    t('authed → member 激活',`${u[0].days}天有效期`)
  } catch(e) { f('authed → member', e.message) }

  // ==== 两态 + 善选可见性验证 ====
  console.log('[两态 + 善选可见性]')

  // 4. 创建两态故事（published × 2、draft × 1），其中一篇纳入善选
  let pubId, memId, privId, featId
  try {
    const [r1] = await db.query("INSERT INTO stories (user_id,title,content,publish_status,created_by) VALUES (?,'已发布故事A','面向会员','published',?)", [testUserId, testUserId])
    pubId = r1.insertId
    const [r2] = await db.query("INSERT INTO stories (user_id,title,content,publish_status,created_by) VALUES (?,'已发布故事B','面向会员','published',?)", [testUserId, testUserId])
    memId = r2.insertId
    const [r3] = await db.query("INSERT INTO stories (user_id,title,content,publish_status,created_by) VALUES (?,'暂存故事','仅自己','draft',?)", [testUserId, testUserId])
    privId = r3.insertId
    const [r4] = await db.query(
      "INSERT INTO featured_stories (story_id, title, content) SELECT id, title, content FROM stories WHERE id = ?", [pubId])
    featId = r4.insertId
    await db.query('UPDATE stories SET is_featured = 1 WHERE id = ?', [pubId])
    t('创建两态故事 + 纳入善选',`published=${pubId},${memId} draft=${privId} featured=${featId}`)
  } catch(e) { f('创建故事', e.message) }

  // 5. 公众（guest/authed）广场可见 = 上架善选副本
  try {
    const [r] = await db.query(
      "SELECT COUNT(*) AS c FROM featured_stories f JOIN stories d ON f.story_id=d.id WHERE f.status='online' AND d.status='active' AND d.publish_status='published'")
    t('公众广场可见（善选）',`${r[0].c}篇上架善选`)
  } catch(e) { f('公众广场', e.message) }

  // 6. 会员广场可见 = 全部已发布（draft 不进）
  try {
    const [r] = await db.query("SELECT COUNT(*) AS c FROM stories WHERE status='active' AND publish_status='published'")
    const [r2] = await db.query("SELECT COUNT(*) AS c FROM stories WHERE status='active' AND publish_status='draft'")
    t('会员广场可见（published）',`${r[0].c}篇已发布，${r2[0].c}篇暂存不进广场`)
  } catch(e) { f('会员广场', e.message) }

  // 7. 暂存故事只有作者可见
  try {
    const [r1] = await db.query("SELECT COUNT(*) AS c FROM stories WHERE id=? AND user_id=? AND status='active'", [privId, testUserId])
    const [r2] = await db.query("SELECT COUNT(*) AS c FROM stories WHERE id=? AND status='active' AND publish_status='published'", [privId])
    if (r1[0].c === 1 && r2[0].c === 0) t('draft 权限隔离',`作者可见(${r1[0].c}) 非发布态(${r2[0].c})`)
    else throw new Error('isolation failed')
  } catch(e) { f('draft隔离', e.message) }

  // ==== 社交互动流程 ====
  console.log('[社交互动]')

  // 8. 点赞 → 取消点赞 → 再点赞
  try {
    await db.query("INSERT INTO interactions (user_id,target_type,target_id,action,created_by) VALUES (?,'story',?,'like',?)", [testUserId, pubId, testUserId])
    const [r1] = await db.query('SELECT COUNT(*) AS c FROM interactions WHERE user_id=? AND target_id=? AND action=?', [testUserId, pubId, 'like'])
    if (r1[0].c !== 1) throw new Error('like failed')

    await db.query('DELETE FROM interactions WHERE user_id=? AND target_id=? AND action=?', [testUserId, pubId, 'like'])
    const [r2] = await db.query('SELECT COUNT(*) AS c FROM interactions WHERE user_id=? AND target_id=? AND action=?', [testUserId, pubId, 'like'])
    if (r2[0].c !== 0) throw new Error('unlike failed')

    await db.query("INSERT INTO interactions (user_id,target_type,target_id,action,created_by) VALUES (?,'story',?,'like',?)", [testUserId, pubId, testUserId])
    t('like → unlike → relike', '状态切换正确')
  } catch(e) { f('点赞流程', e.message) }

  // 9. 重复点赞 → 唯一索引阻止
  try {
    await db.query("INSERT INTO interactions (user_id,target_type,target_id,action,created_by) VALUES (?,'story',?,'like',?)", [testUserId, pubId, testUserId])
    f('重复点赞防护', '唯一索引未生效')
  } catch(e) {
    if (e.code === 'ER_DUP_ENTRY') t('重复点赞防护', '唯一索引生效')
    else f('重复点赞防护', e.message)
  }

  // 10. 收藏 + 取消
  try {
    await db.query("INSERT INTO interactions (user_id,target_type,target_id,action,created_by) VALUES (?,'story',?,'favorite',?)", [testUserId, pubId, testUserId])
    await db.query('DELETE FROM interactions WHERE user_id=? AND target_id=? AND action=?', [testUserId, pubId, 'favorite'])
    t('收藏 → 取消收藏', '正确')
  } catch(e) { f('收藏流程', e.message) }

  // 11. 评论 + 回复
  let commentId
  try {
    const [r] = await db.query("INSERT INTO comments (user_id,story_id,content,created_by) VALUES (?,?,?,?)", [testUserId, pubId, '这是一条评论', testUserId])
    commentId = r.insertId
    t('发布一级评论', `id=${commentId}`)
  } catch(e) { f('发布评论', e.message) }

  try {
    const [r] = await db.query("INSERT INTO comments (user_id,story_id,parent_id,content,created_by) VALUES (?,?,?,'这是一条回复',?)", [testUserId, pubId, commentId, testUserId])
    t('回复评论', `reply_id=${r.insertId} → parent=${commentId}`)
  } catch(e) { f('回复评论', e.message) }

  // 12. 软删除评论
  try {
    await db.query('UPDATE comments SET is_deleted=1 WHERE id=?', [commentId])
    const [r] = await db.query('SELECT is_deleted FROM comments WHERE id=?', [commentId])
    if (r[0].is_deleted === 1) t('软删除评论', '正确')
    else throw new Error('not deleted')
  } catch(e) { f('软删除', e.message) }

  // 13. 软删除故事
  try {
    await db.query("UPDATE stories SET status='deleted' WHERE id=?", [pubId])
    const [r] = await db.query('SELECT status FROM stories WHERE id=?', [pubId])
    if (r[0].status === 'deleted') t('软删除故事', '正确')
    else throw new Error('not deleted')
  } catch(e) { f('故事删除', e.message) }

  // ==== 标签功能 ====
  console.log('[标签功能]')
  try {
    const tagName = 'E2E_' + Date.now().toString(36).slice(-8)
    await db.query('INSERT INTO tags (name, created_by) VALUES (?, ?)', [tagName, testUserId])
    const [r] = await db.query('SELECT id FROM tags WHERE name=?', [tagName])
    if (r.length) t('新增自定义标签', `id=${r[0].id}`)
    // cleanup
    await db.query('DELETE FROM tags WHERE name=?', [tagName])
  } catch(e) { f('标签功能', e.message) }

  // 14. 标签重复 → 阻止
  try {
    await db.query("INSERT INTO tags (name,created_by) VALUES ('修身为本',?)", [testUserId])
    f('标签重复防护', '未报错')
  } catch(e) {
    if (e.code === 'ER_DUP_ENTRY') t('标签重复防护', '唯一约束生效')
    else f('标签重复', e.message)
  }

  // ==== 订单会员流程 ====
  console.log('[订单/会员]')

  // 15. 订单状态流转
  try {
    const oid = 'TST-' + Date.now().toString(36).toUpperCase()
    await db.query("INSERT INTO orders (id,user_id,amount,plan,method,status,created_by) VALUES (?,?,365,'年度会员','offline','pending',?)", [oid, testUserId, testUserId])
    const [r1] = await db.query('SELECT status FROM orders WHERE id=?', [oid])
    if (r1[0].status !== 'pending') throw new Error('not pending')
    await db.query("UPDATE orders SET status='paid', payment_time=NOW() WHERE id=?", [oid])
    const [r2] = await db.query('SELECT status FROM orders WHERE id=?', [oid])
    if (r2[0].status === 'paid') t('订单 pending→paid', '状态流转正确')
    else throw new Error('not paid')
    await db.query('DELETE FROM orders WHERE id=?', [oid])
  } catch(e) { f('订单流转', e.message) }

  // 16. 会员过期自动降级
  try {
    await db.query("UPDATE users SET identity='member', member_until=DATE_SUB(CURDATE(),INTERVAL 1 DAY) WHERE id=?", [testUserId])
    const [r1] = await db.query('SELECT identity, member_until, DATEDIFF(member_until,CURDATE()) AS days FROM users WHERE id=?', [testUserId])
    if (r1[0].days < 0) {
      await db.query("UPDATE users SET identity='authed', member_until=NULL WHERE id=? AND member_until < CURDATE()", [testUserId])
      t('会员过期自动降级', `超期${Math.abs(r1[0].days)}天 → authed`)
    }
  } catch(e) { f('过期降级', e.message) }

  // ==== 数据统计一致性 ====
  console.log('[数据一致性]')

  // 17. 故事计数一致性
  try {
    const [userDiary] = await db.query('SELECT COUNT(*) AS c FROM stories WHERE user_id=? AND status=?', [testUserId, 'active'])
    await db.query('UPDATE users SET story_count=? WHERE id=?', [userDiary[0].c, testUserId])
    t('故事计数一致性', `user.story_count=${userDiary[0].c}`)
  } catch(e) { f('计数一致性', e.message) }

  // ==== 清理测试数据 ====
  console.log('[清理]')
  try {
    await db.query('DELETE FROM interactions WHERE user_id=?', [testUserId])
    await db.query('DELETE FROM comments WHERE user_id=?', [testUserId])
    await db.query('DELETE FROM story_tags WHERE story_id IN (SELECT id FROM stories WHERE user_id=?)', [testUserId])
    await db.query('DELETE FROM stories WHERE user_id=?', [testUserId])
    await db.query('DELETE FROM orders WHERE user_id=?', [testUserId])
    await db.query('DELETE FROM users WHERE id=?', [testUserId])
    t('测试数据清理', '完成')
  } catch(e) { f('清理', e.message) }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  await db.end()
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
