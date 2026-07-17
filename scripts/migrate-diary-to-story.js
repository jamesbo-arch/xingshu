// 日记 → 故事 数据库迁移（2026-07-17）
// ① 表改名：diaries→stories、diary_tags→story_tags
// ② 列改名：story_tags.diary_id / comments.diary_id → story_id（FK 先拆后建）
// ③ interactions.target_type 枚举：'diary' → 'story'（扩→改→收）
// ④ stories 权限模型：加 publish_status（private→draft，其余→published）+ is_featured，删 permission 及旧索引
// ⑤ users.diary_count → story_count
// ⑥ 新建 featured_stories 善选故事表（副本可修订，不影响原文）
// 每步按 information_schema 判断，可重复执行（幂等）。执行前先 node scripts/backup-db.js 备份。
//
// 用法：node scripts/migrate-diary-to-story.js            （读根目录 .env）
//       XINGSHU_ENV_FILE=.env.prod node scripts/migrate-diary-to-story.js   （prod 上线时）
const mysql = require('mysql2/promise')
const cfg = require('../config/db')

async function tableExists(c, t) {
  const [[r]] = await c.query(
    `SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [t])
  return r.n > 0
}

async function colMeta(c, t, col) {
  const [[r]] = await c.query(
    `SELECT COLUMN_TYPE ct, IS_NULLABLE nullable, COLUMN_DEFAULT dflt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [t, col])
  return r || null
}

async function indexExists(c, t, idx) {
  const [[r]] = await c.query(
    `SELECT COUNT(*) n FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`, [t, idx])
  return r.n > 0
}

// 列改名（diary_id → story_id）：动态查 FK 名与删除规则，拆 FK → CHANGE COLUMN → 重建 FK
async function renameFkColumn(c, table, from, to, refTable) {
  const meta = await colMeta(c, table, from)
  if (!meta) { console.log(`  = ${table}.${from} 不存在（已迁移），跳过`); return }
  const [fks] = await c.query(
    `SELECT k.CONSTRAINT_NAME name, r.DELETE_RULE delRule, k.REFERENCED_COLUMN_NAME refCol
     FROM information_schema.KEY_COLUMN_USAGE k
     JOIN information_schema.REFERENTIAL_CONSTRAINTS r
       ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
     WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = ? AND k.COLUMN_NAME = ?
       AND k.REFERENCED_TABLE_NAME IS NOT NULL`, [table, from])
  for (const fk of fks) {
    await c.query(`ALTER TABLE ${table} DROP FOREIGN KEY \`${fk.name}\``)
  }
  const nullSql = meta.nullable === 'YES' ? 'NULL' : 'NOT NULL'
  await c.query(`ALTER TABLE ${table} CHANGE COLUMN ${from} ${to} ${meta.ct} ${nullSql}`)
  const delRule = fks.length ? fks[0].delRule : 'CASCADE'
  const refCol = fks.length ? fks[0].refCol : 'id'
  await c.query(
    `ALTER TABLE ${table} ADD CONSTRAINT fk_${table}_${to}
     FOREIGN KEY (${to}) REFERENCES ${refTable}(${refCol}) ON DELETE ${delRule}`)
  console.log(`  ✓ ${table}.${from} → ${to}（FK 重建，ON DELETE ${delRule}）`)
}

async function main() {
  const c = await mysql.createConnection(cfg)
  try {
    // ① 表改名
    if (await tableExists(c, 'diaries') && !(await tableExists(c, 'stories'))) {
      await c.query('RENAME TABLE diaries TO stories')
      console.log('  ✓ diaries → stories')
    } else console.log('  = stories 已存在，跳过表改名')
    if (await tableExists(c, 'diary_tags') && !(await tableExists(c, 'story_tags'))) {
      await c.query('RENAME TABLE diary_tags TO story_tags')
      console.log('  ✓ diary_tags → story_tags')
    } else console.log('  = story_tags 已存在，跳过表改名')

    // ② 列改名
    await renameFkColumn(c, 'story_tags', 'diary_id', 'story_id', 'stories')
    await renameFkColumn(c, 'comments', 'diary_id', 'story_id', 'stories')

    // ③ interactions.target_type 枚举 diary → story（扩→改→收，保留其余成员如 activity_post）
    const tt = await colMeta(c, 'interactions', 'target_type')
    if (tt && tt.ct.includes("'diary'")) {
      const members = tt.ct.replace(/^enum\(|\)$/gi, '').split(',').map(s => s.trim().replace(/^'|'$/g, ''))
      const expanded = [...new Set([...members, 'story'])]
      const finalSet = expanded.filter(m => m !== 'diary')
      const enumSql = arr => arr.map(m => `'${m}'`).join(',')
      await c.query(`ALTER TABLE interactions MODIFY target_type ENUM(${enumSql(expanded)}) NOT NULL`)
      const [r] = await c.query(`UPDATE interactions SET target_type = 'story' WHERE target_type = 'diary'`)
      await c.query(`ALTER TABLE interactions MODIFY target_type ENUM(${enumSql(finalSet)}) NOT NULL`)
      console.log(`  ✓ interactions.target_type diary→story ${r.affectedRows} 行，枚举收为 (${enumSql(finalSet)})`)
    } else console.log('  = interactions.target_type 已无 diary，跳过')

    // ④ stories：publish_status + is_featured，删 permission
    if (!(await colMeta(c, 'stories', 'publish_status'))) {
      await c.query(`ALTER TABLE stories ADD COLUMN publish_status ENUM('draft','published') NOT NULL DEFAULT 'published'`)
      console.log('  ✓ stories.publish_status 已添加')
    } else console.log('  = stories.publish_status 已存在，跳过')
    if (!(await colMeta(c, 'stories', 'is_featured'))) {
      await c.query(`ALTER TABLE stories ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0`)
      console.log('  ✓ stories.is_featured 已添加')
    } else console.log('  = stories.is_featured 已存在，跳过')
    // 先建新索引（idx_user_publish 可作为 user_id 外键的支撑索引），再删旧索引/列
    if (!(await indexExists(c, 'stories', 'idx_publish_status')))
      await c.query('ALTER TABLE stories ADD INDEX idx_publish_status (publish_status)')
    if (!(await indexExists(c, 'stories', 'idx_user_publish')))
      await c.query('ALTER TABLE stories ADD INDEX idx_user_publish (user_id, publish_status)')
    if (await colMeta(c, 'stories', 'permission')) {
      const [r] = await c.query(`UPDATE stories SET publish_status = IF(permission = 'private', 'draft', 'published')`)
      console.log(`  ✓ publish_status 回填 ${r.affectedRows} 行（private→draft，其余→published）`)
      if (await indexExists(c, 'stories', 'idx_permission')) await c.query('DROP INDEX idx_permission ON stories')
      if (await indexExists(c, 'stories', 'idx_user_permission')) await c.query('DROP INDEX idx_user_permission ON stories')
      await c.query('ALTER TABLE stories DROP COLUMN permission')
      console.log('  ✓ stories.permission 及旧索引已删除')
    } else console.log('  = stories.permission 已删除，跳过回填')

    // ⑤ users.diary_count → story_count
    const dc = await colMeta(c, 'users', 'diary_count')
    if (dc) {
      const nullSql = dc.nullable === 'YES' ? 'NULL' : 'NOT NULL'
      const dfltSql = dc.dflt !== null ? `DEFAULT ${dc.dflt}` : ''
      await c.query(`ALTER TABLE users CHANGE COLUMN diary_count story_count ${dc.ct} ${nullSql} ${dfltSql}`)
      console.log('  ✓ users.diary_count → story_count')
    } else console.log('  = users.story_count 已就位，跳过')

    // ⑥ featured_stories 善选故事表
    await c.query(`CREATE TABLE IF NOT EXISTS featured_stories (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      story_id INT NOT NULL COMMENT '原故事 id（互动/计数共享原故事）',
      title VARCHAR(60) NOT NULL COMMENT '副本标题（管理员可修订）',
      content TEXT COMMENT '副本正文',
      content_rich MEDIUMTEXT COMMENT '副本富文本',
      images JSON COMMENT '副本配图',
      status ENUM('online','offline') NOT NULL DEFAULT 'online' COMMENT '上架状态（公众可见性）',
      created_by INT UNSIGNED NULL DEFAULT NULL,
      updated_by INT UNSIGNED NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_story (story_id),
      KEY idx_status (status),
      CONSTRAINT fk_featured_story FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='善选故事（公众可见的修订副本）'`)
    console.log('  ✓ featured_stories 已就绪')

    // 收尾校验
    const [ps] = await c.query(`SELECT publish_status, COUNT(*) n FROM stories GROUP BY publish_status`)
    const [it] = await c.query(`SELECT target_type, COUNT(*) n FROM interactions GROUP BY target_type`)
    console.log('校验：stories 分布 =', JSON.stringify(ps), '；interactions 分布 =', JSON.stringify(it))
    console.log('迁移完成')
  } finally {
    await c.end()
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1) })
