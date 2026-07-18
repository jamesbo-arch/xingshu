// 活动收费字段迁移（2026-07-18）
// ① activities 加 price DECIMAL(8,2) 活动价格（0 = 免费）
// ② activity_signups 加 paid TINYINT(1) 是否已收费（后台手动标记）
// 按 information_schema 判断，可重复执行（幂等）。执行前先 node scripts/backup-db.js 备份。
//
// 用法：node scripts/migrate-activity-price.js            （读根目录 .env）
//       XINGSHU_ENV_FILE=.env.prod node scripts/migrate-activity-price.js   （prod 上线时）
const mysql = require('mysql2/promise')
const cfg = require('../config/db')

async function colExists(c, t, col) {
  const [[r]] = await c.query(
    `SELECT COUNT(*) n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [t, col])
  return r.n > 0
}

async function main() {
  const c = await mysql.createConnection(cfg)
  try {
    if (await colExists(c, 'activities', 'price')) {
      console.log('  · activities.price 已存在，跳过')
    } else {
      await c.query("ALTER TABLE activities ADD COLUMN price DECIMAL(8,2) NOT NULL DEFAULT 0 COMMENT '活动价格（元，0=免费）' AFTER capacity")
      console.log('  ✓ activities.price 已添加')
    }

    if (await colExists(c, 'activity_signups', 'paid')) {
      console.log('  · activity_signups.paid 已存在，跳过')
    } else {
      await c.query("ALTER TABLE activity_signups ADD COLUMN paid TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已收费（后台手动标记）' AFTER attended")
      console.log('  ✓ activity_signups.paid 已添加')
    }

    console.log('活动收费字段迁移完成')
  } finally {
    await c.end()
  }
}

main().catch(e => { console.error('迁移失败：', e.message); process.exit(1) })
