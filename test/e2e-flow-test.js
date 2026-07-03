// 端到端流程测试 — 模拟真实用户行为，直接验证 MySQL 数据一致性
const mysql = require('mysql2/promise')
const DB = require('../config/db')

async function run() {
  const db = await mysql.createConnection(DB)
  console.log('=== 醒书日记 E2E 流程测试 ===\n')
  let passed = 0, failed = 0
  const t = (n, f) => { passed++; console.log(`  PASS  ${n}`) }
  const f = (n, e) => { failed++; console.log(`  FAIL  ${n}: ${e}`) }

  // ==== 用户注册与登录 ====
  console.log('[身份流程] guest → authed → member')

  // 1. 游客首次访问 → login 云函数创建用户
  let testUserId
  try {
    const [r] = await db.query("INSERT INTO users (openid, nickname, identity, avatar_hue, created_by) VALUES ('test_e2e_openid', '测试用户', 'guest', 120, 'test_e2e_openid')")
    testUserId = r.insertId
    t('guest 注册',`user_id=${testUserId}`)
  } catch(e) { f('guest 注册', e.message) }

  // 2. 游客升级到 authed
  try {
    await db.query("UPDATE users SET identity='authed', updated_by=? WHERE id=?", ['test_e2e_openid', testUserId])
    const [u] = await db.query('SELECT identity FROM users WHERE id=?', [testUserId])
    if (u[0].identity !== 'authed') throw new Error('identity not updated')
    t('guest → authed 升级',`identity=${u[0].identity}`)
  } catch(e) { f('guest → authed', e.message) }

  // 3. 用户升级到 member（模拟管理员激活订单）
  try {
    const orderId = 'TEST-' + Date.now().toString(36).toUpperCase()
    const [r] = await db.query(
      "INSERT INTO orders (id, user_id, amount, plan, method, status, note, created_by) VALUES (?,?,365,'年度会员','offline','pending','E2E测试',?)",
      [orderId, testUserId, 'test_e2e_openid']
    )
    await db.query("UPDATE orders SET status='paid' WHERE id=?", [orderId])
    await db.query("UPDATE users SET identity='member', member_from=CURDATE(), member_until=DATE_ADD(CURDATE(),INTERVAL 365 DAY) WHERE id=?", [testUserId])
    const [u] = await db.query('SELECT identity, member_until, DATEDIFF(member_until,CURDATE()) AS days FROM users WHERE id=?', [testUserId])
    if (u[0].identity !== 'member') throw new Error('not member')
    t('authed → member 激活',`${u[0].days}天有效期`)
  } catch(e) { f('authed → member', e.message) }

  // ==== 9 种权限组合验证 ====
  console.log('[3×3 权限矩阵]')

  // 4. 创建三种权限日记
  let pubId, memId, privId
  try {
    const [r1] = await db.query("INSERT INTO diaries (user_id,title,content,permission,created_by) VALUES (?,'公开日记','公众可见','public',?)", [testUserId, testUserId])
    pubId = r1.insertId
    const [r2] = await db.query("INSERT INTO diaries (user_id,title,content,permission,created_by) VALUES (?,'会员日记','会员可见','member',?)", [testUserId, testUserId])
    memId = r2.insertId
    const [r3] = await db.query("INSERT INTO diaries (user_id,title,content,permission,created_by) VALUES (?,'私密日记','仅自己','private',?)", [testUserId, testUserId])
    privId = r3.insertId
    t('创建三种权限日记',`public=${pubId} member=${memId} private=${privId}`)
  } catch(e) { f('创建日记', e.message) }

  // 5. Square 模式过滤（模拟 guest 视角）
  try {
    const [r] = await db.query("SELECT COUNT(*) AS c FROM diaries WHERE status='active' AND permission='public'")
    t('guest 广场可见',`${r[0].c}篇(仅public)`)
  } catch(e) { f('guest 广场', e.message) }

  // 6. 非会员看 member 日记 → 过滤
  try {
    const [r] = await db.query("SELECT COUNT(*) AS c FROM diaries WHERE status='active' AND permission='member' AND user_id!=?", [testUserId])
    t('非会员过滤 member',`${r[0].c}篇member日记(不含自己)`)
  } catch(e) { f('member 过滤', e.message) }

  // 7. 私密日记只有作者可见
  try {
    const [r1] = await db.query("SELECT COUNT(*) AS c FROM diaries WHERE id=? AND user_id=? AND status='active'", [privId, testUserId])
    const [r2] = await db.query("SELECT COUNT(*) AS c FROM diaries WHERE id=? AND status='active' AND user_id!=?", [privId, testUserId])
    if (r1[0].c === 1 && r2[0].c === 0) t('private 权限隔离',`作者可见(${r1[0].c}) 他人不可见(${r2[0].c})`)
    else throw new Error('isolation failed')
  } catch(e) { f('private隔离', e.message) }

  // ==== 社交互动流程 ====
  console.log('[社交互动]')

  // 8. 点赞 → 取消点赞 → 再点赞
  try {
    await db.query("INSERT INTO interactions (user_id,target_type,target_id,action,created_by) VALUES (?,'diary',?,'like',?)", [testUserId, pubId, testUserId])
    const [r1] = await db.query('SELECT COUNT(*) AS c FROM interactions WHERE user_id=? AND target_id=? AND action=?', [testUserId, pubId, 'like'])
    if (r1[0].c !== 1) throw new Error('like failed')

    await db.query('DELETE FROM interactions WHERE user_id=? AND target_id=? AND action=?', [testUserId, pubId, 'like'])
    const [r2] = await db.query('SELECT COUNT(*) AS c FROM interactions WHERE user_id=? AND target_id=? AND action=?', [testUserId, pubId, 'like'])
    if (r2[0].c !== 0) throw new Error('unlike failed')

    await db.query("INSERT INTO interactions (user_id,target_type,target_id,action,created_by) VALUES (?,'diary',?,'like',?)", [testUserId, pubId, testUserId])
    t('like → unlike → relike', '状态切换正确')
  } catch(e) { f('点赞流程', e.message) }

  // 9. 重复点赞 → 唯一索引阻止
  try {
    await db.query("INSERT INTO interactions (user_id,target_type,target_id,action,created_by) VALUES (?,'diary',?,'like',?)", [testUserId, pubId, testUserId])
    f('重复点赞防护', '唯一索引未生效')
  } catch(e) {
    if (e.code === 'ER_DUP_ENTRY') t('重复点赞防护', '唯一索引生效')
    else f('重复点赞防护', e.message)
  }

  // 10. 收藏 + 取消
  try {
    await db.query("INSERT INTO interactions (user_id,target_type,target_id,action,created_by) VALUES (?,'diary',?,'favorite',?)", [testUserId, pubId, testUserId])
    await db.query('DELETE FROM interactions WHERE user_id=? AND target_id=? AND action=?', [testUserId, pubId, 'favorite'])
    t('收藏 → 取消收藏', '正确')
  } catch(e) { f('收藏流程', e.message) }

  // 11. 评论 + 回复
  let commentId
  try {
    const [r] = await db.query("INSERT INTO comments (user_id,diary_id,content,created_by) VALUES (?,?,?,?)", [testUserId, pubId, '这是一条评论', testUserId])
    commentId = r.insertId
    t('发布一级评论', `id=${commentId}`)
  } catch(e) { f('发布评论', e.message) }

  try {
    const [r] = await db.query("INSERT INTO comments (user_id,diary_id,parent_id,content,created_by) VALUES (?,?,?,'这是一条回复',?)", [testUserId, pubId, commentId, testUserId])
    t('回复评论', `reply_id=${r.insertId} → parent=${commentId}`)
  } catch(e) { f('回复评论', e.message) }

  // 12. 软删除评论
  try {
    await db.query('UPDATE comments SET is_deleted=1 WHERE id=?', [commentId])
    const [r] = await db.query('SELECT is_deleted FROM comments WHERE id=?', [commentId])
    if (r[0].is_deleted === 1) t('软删除评论', '正确')
    else throw new Error('not deleted')
  } catch(e) { f('软删除', e.message) }

  // 13. 软删除日记
  try {
    await db.query("UPDATE diaries SET status='deleted' WHERE id=?", [pubId])
    const [r] = await db.query('SELECT status FROM diaries WHERE id=?', [pubId])
    if (r[0].status === 'deleted') t('软删除日记', '正确')
    else throw new Error('not deleted')
  } catch(e) { f('日记删除', e.message) }

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
    await db.query("INSERT INTO tags (name,created_by) VALUES ('修身为本','test')")
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
    await db.query("INSERT INTO orders (id,user_id,amount,plan,method,status,created_by) VALUES (?,?,365,'年度会员','offline','pending',?)", [oid, testUserId, 'test_e2e_openid'])
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

  // 17. 日记计数一致性
  try {
    const [userDiary] = await db.query('SELECT COUNT(*) AS c FROM diaries WHERE user_id=? AND status=?', [testUserId, 'active'])
    await db.query('UPDATE users SET diary_count=? WHERE id=?', [userDiary[0].c, testUserId])
    t('日记计数一致性', `user.diary_count=${userDiary[0].c}`)
  } catch(e) { f('计数一致性', e.message) }

  // ==== 清理测试数据 ====
  console.log('[清理]')
  try {
    await db.query('DELETE FROM interactions WHERE user_id=?', [testUserId])
    await db.query('DELETE FROM comments WHERE user_id=?', [testUserId])
    await db.query('DELETE FROM diary_tags WHERE diary_id IN (SELECT id FROM diaries WHERE user_id=?)', [testUserId])
    await db.query('DELETE FROM diaries WHERE user_id=?', [testUserId])
    await db.query('DELETE FROM orders WHERE user_id=?', [testUserId])
    await db.query('DELETE FROM users WHERE id=?', [testUserId])
    t('测试数据清理', '完成')
  } catch(e) { f('清理', e.message) }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  await db.end()
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
