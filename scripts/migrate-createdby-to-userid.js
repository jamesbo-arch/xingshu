// created_by / updated_by 统一改存用户表 id（2026-07-15）
// 值归一：openid → 对应 users.id；纯数字串保留（本就是 id）；来源标记（admin-web/seed/seed-stories/test 等）→ NULL
// 然后列类型 varchar(64) → INT UNSIGNED NULL。
// admin_logs 不迁移（主体是管理员 openid，非小程序用户，保留 varchar）。
//
// 用法：node scripts/migrate-createdby-to-userid.js            （读根目录 .env）
//       XINGSHU_ENV_FILE=.env.prod node scripts/migrate-createdby-to-userid.js   （prod 上线时）
const mysql = require('mysql2/promise')
const cfg = require('../config/db')

// [表名, 是否有 updated_by]
const TABLES = [
  ['users', true],
  ['orders', true],
  ['tags', true],
  ['activities', true],
  ['activity_types', false],
  ['activity_posts', false],
  ['payment_logs', true],
]

async function main() {
  const c = await mysql.createConnection(cfg)
  try {
    for (const [t, hasUpdated] of TABLES) {
      const cols = hasUpdated ? ['created_by', 'updated_by'] : ['created_by']
      for (const col of cols) {
        // 已是 INT 的表（重复执行）跳过归一
        const [[meta]] = await c.query(
          `SELECT DATA_TYPE dt FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [t, col])
        if (!meta) { console.log(`  - ${t}.${col} 不存在，跳过`); continue }
        if (meta.dt !== 'varchar') { console.log(`  = ${t}.${col} 已是 ${meta.dt}，跳过归一`); continue }
        // 部分表原列为 NOT NULL（如 activity_types），先放开约束再归一（标记值将置 NULL）
        await c.query(`ALTER TABLE ${t} MODIFY ${col} VARCHAR(64) NULL DEFAULT NULL`)
        const [r] = await c.query(
          `UPDATE ${t} x LEFT JOIN users u ON x.${col} = u.openid
           SET x.${col} = CASE
             WHEN u.id IS NOT NULL THEN u.id
             WHEN x.${col} REGEXP '^[0-9]+$' THEN x.${col}
             ELSE NULL END
           WHERE x.${col} IS NOT NULL`)
        console.log(`  ✓ ${t}.${col} 值归一 ${r.affectedRows} 行`)
      }
      const mods = cols.map(col => `MODIFY ${col} INT UNSIGNED NULL DEFAULT NULL`).join(', ')
      await c.query(`ALTER TABLE ${t} ${mods}`)
      console.log(`  ✓ ${t} 列类型 → INT UNSIGNED NULL`)
    }
    console.log('迁移完成')
  } finally {
    await c.end()
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1) })
