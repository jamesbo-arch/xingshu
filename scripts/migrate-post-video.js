// 活动现场分享视频字段迁移（2026-07-19；2026-07-20 增 video_poster）
// ① activity_posts 加 video —— 视频云存储 fileID（一条分享一段视频，与照片互斥）
// ② activity_posts 加 video_poster —— 视频首帧封面 fileID（chooseMedia 的 thumbTempFilePath 上传所得）
// 按 information_schema 判断，可重复执行（幂等）。执行前先 node scripts/backup-db.js 备份。
//
// 用法：node scripts/migrate-post-video.js            （读根目录 .env）
//       XINGSHU_ENV_FILE=.env.prod node scripts/migrate-post-video.js   （prod 上线时）
const mysql = require('mysql2/promise')
const cfg = require('../config/db')

async function main() {
  const c = await mysql.createConnection(cfg)
  try {
    const colExists = async (col) => {
      const [[r]] = await c.query(
        `SELECT COUNT(*) n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activity_posts' AND COLUMN_NAME = ?`, [col])
      return r.n > 0
    }

    if (await colExists('video')) {
      console.log('  · activity_posts.video 已存在，跳过')
    } else {
      await c.query("ALTER TABLE activity_posts ADD COLUMN video VARCHAR(512) NULL COMMENT '视频云存储 fileID（与 images 互斥）' AFTER images")
      console.log('  ✓ activity_posts.video 已添加')
    }

    if (await colExists('video_poster')) {
      console.log('  · activity_posts.video_poster 已存在，跳过')
    } else {
      await c.query("ALTER TABLE activity_posts ADD COLUMN video_poster VARCHAR(512) NULL COMMENT '视频首帧封面 fileID' AFTER video")
      console.log('  ✓ activity_posts.video_poster 已添加')
    }

    console.log('现场分享视频字段迁移完成')
  } finally {
    await c.end()
  }
}

main().catch(e => { console.error('迁移失败：', e.message); process.exit(1) })
