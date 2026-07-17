// API 集成测试 — 直接读 MySQL 验证数据结构完整性
const mysql = require('mysql2/promise')

const DB = require('../config/db')

async function run() {
  const db = await mysql.createConnection(DB)
  console.log('=== 醒书故事 API 集成测试 ===\n')
  let passed = 0, failed = 0

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  // 1. Users table
  console.log('[users]')
  await test('users 表存在', async () => {
    const [r] = await db.query("SHOW TABLES LIKE 'users'")
    if (!r.length) throw new Error('missing')
  })
  await test('users 审计字段完整', async () => {
    const [r] = await db.query("SELECT created_at, updated_at, created_by, updated_by FROM users LIMIT 0")
    if (r.length !== 0) throw new Error('query failed silently')
  })
  await test('users 种子数据可查', async () => {
    const [r] = await db.query('SELECT COUNT(*) AS c FROM users')
    console.log(`  → ${r[0].c} users`)
  })

  // 2. Stories table
  console.log('[stories]')
  await test('stories 表存在', async () => {
    const [r] = await db.query("SHOW TABLES LIKE 'stories'")
    if (!r.length) throw new Error('missing')
  })
  await test('stories status 字段存在', async () => {
    await db.query("SELECT status FROM stories LIMIT 0")
  })
  await test('stories images 字段存在', async () => {
    await db.query("SELECT images FROM stories LIMIT 0")
  })
  await test('stories 热路径复合索引 (status, created_at)', async () => {
    const [r] = await db.query("SHOW INDEX FROM stories WHERE Key_name='idx_status_created'")
    if (r.length !== 2) throw new Error('idx_status_created missing')
  })
  await test('stories 外键约束', async () => {
    const [r] = await db.query("SELECT REFERENCED_TABLE_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='xingshu_dev' AND TABLE_NAME='stories' AND COLUMN_NAME='user_id'")
    if (r[0].REFERENCED_TABLE_NAME !== 'users') throw new Error('FK missing')
  })

  // 3. Tags
  console.log('[tags]')
  await test('tags 20 个种子数据', async () => {
    const [r] = await db.query('SELECT COUNT(*) AS c FROM tags WHERE is_active=1')
    if (r[0].c < 20) throw new Error(`Expected >=20, got ${r[0].c}`)
    console.log(`  → ${r[0].c} active tags`)
  })

  // 4. Interactions unique index
  console.log('[interactions]')
  await test('interactions 唯一索引存在', async () => {
    const [r] = await db.query("SHOW INDEX FROM interactions WHERE Key_name='uk_user_target_action'")
    if (!r.length) throw new Error('unique index missing')
  })

  // 5. Comments self-reference
  console.log('[comments]')
  await test('comments 自引用外键', async () => {
    const [r] = await db.query("SELECT REFERENCED_TABLE_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='xingshu_dev' AND TABLE_NAME='comments' AND COLUMN_NAME='parent_id'")
    if (r[0]?.REFERENCED_TABLE_NAME !== 'comments') throw new Error('self-FK missing')
  })

  // 6. Orders
  console.log('[orders]')
  await test('orders 表存在 + 字段完整', async () => {
    await db.query("SELECT plan, valid_from, valid_until, note FROM orders LIMIT 0")
  })

  // 7. story_tags
  console.log('[story_tags]')
  await test('story_tags 多对多关联表', async () => {
    await db.query("SELECT story_id, tag_id FROM story_tags LIMIT 0")
  })
  await test('story_tags 两级外键', async () => {
    const [r1] = await db.query("SELECT REFERENCED_TABLE_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='xingshu_dev' AND TABLE_NAME='story_tags' AND COLUMN_NAME='story_id' AND REFERENCED_TABLE_NAME IS NOT NULL")
    const [r2] = await db.query("SELECT REFERENCED_TABLE_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='xingshu_dev' AND TABLE_NAME='story_tags' AND COLUMN_NAME='tag_id' AND REFERENCED_TABLE_NAME IS NOT NULL")
    if (r1[0].REFERENCED_TABLE_NAME !== 'stories' || r2[0].REFERENCED_TABLE_NAME !== 'tags') throw new Error('FKs missing')
  })

  // 8. admin_logs
  console.log('[admin_logs]')
  await test('admin_logs JSON 字段存在', async () => {
    await db.query('SELECT detail FROM admin_logs LIMIT 0')
  })

  // 9. Soft delete check
  console.log('[软删除]')
  await test('stories 软删除 (status="deleted")', async () => {
    await db.query("SELECT * FROM stories WHERE status='deleted' LIMIT 0")
  })
  await test('comments 软删除 (is_deleted=1)', async () => {
    await db.query('SELECT * FROM comments WHERE is_deleted=1 LIMIT 0')
  })

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  await db.end()
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
