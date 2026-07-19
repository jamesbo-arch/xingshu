// 活动现场分享视频字段迁移（2026-07-19）
// activity_posts 加 video —— 视频云存储 fileID（一条分享一段视频，与照片互斥）
// 按 information_schema 判断，可重复执行（幂等）。执行前先 node scripts/backup-db.js 备份。
//
// 用法：node scripts/migrate-post-video.js            （读根目录 .env）
//       XINGSHU_ENV_FILE=.env.prod node scripts/migrate-post-video.js   （prod 上线时）
const mysql = require('mysql2/promise')
const cfg = require('../config/db')

async function main() {
  const c = await mysql.createConnection(cfg)
  try {
    const [[r]] = await c.query(
      `SELECT COUNT(*) n FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activity_posts' AND COLUMN_NAME = 'video'`)
    if (r.n > 0) {
      console.log('  · activity_posts.video 已存在，跳过')
    } else {
      await c.query("ALTER TABLE activity_posts ADD COLUMN video VARCHAR(512) NULL COMMENT '视频云存储 fileID（与 images 互斥）' AFTER images")
      console.log('  ✓ activity_posts.video 已添加')
    }
    console.log('现场分享视频字段迁移完成')
  } finally {
    await c.end()
  }
}

main().catch(e => { console.error('迁移失败：', e.message); process.exit(1) })
