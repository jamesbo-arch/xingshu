// v2.0 大改版迁移（2026-07-22）—— 四页签重构 + 醒书问答 + 活动 Banner
// ① 新表 banners            —— 活动页顶部轮播图（可选跳自建富文本详情页）
// ② 新表 questions          —— 醒书问答（仅正文、可匿名、暂存/发布两态、精选标志）
// ③ 新表 question_comments  —— 问答回复（可匿名，一层 parent_id）
// ④ 新表 featured_questions —— 精选问答副本（照 featured_stories：可修订、可上下架）
// ⑤ interactions.target_type 枚举加 'activity'（活动收藏）与 'question'（问答赞/藏）
// 按 information_schema 判断，可重复执行（幂等）。执行前先 node scripts/backup-db.js 备份。
//
// 用法：node scripts/migrate-v2.js                                （读根目录 .env）
//       XINGSHU_ENV_FILE=.env.prod node scripts/migrate-v2.js     （prod 上线时）
const mysql = require('mysql2/promise')
const cfg = require('../config/db')

async function tableExists(c, t) {
  const [[r]] = await c.query(
    `SELECT COUNT(*) n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [t])
  return r.n > 0
}

async function main() {
  const c = await mysql.createConnection(cfg)
  try {
    // ① banners
    if (await tableExists(c, 'banners')) {
      console.log('  · banners 已存在，跳过')
    } else {
      await c.query(`CREATE TABLE banners (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        image_url    VARCHAR(255) NOT NULL COMMENT '轮播图 cloud:// fileID',
        title        VARCHAR(60)  NULL COMMENT '详情页标题（link_type=detail 时用）',
        link_type    ENUM('none','detail') NOT NULL DEFAULT 'none' COMMENT 'none=纯展示不可点；detail=跳自建富文本详情页',
        content_rich MEDIUMTEXT   NULL COMMENT '详情页富文本 HTML（同 stories.content_rich）',
        sort         INT          NOT NULL DEFAULT 0 COMMENT '越小越靠前',
        is_active    TINYINT(1)   NOT NULL DEFAULT 1,
        created_by   VARCHAR(64)  NULL,
        updated_by   VARCHAR(64)  NULL,
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_active_sort (is_active, sort)
      ) CHARACTER SET utf8mb4 COMMENT '醒书活动页顶部轮播 Banner'`)
      console.log('  ✓ banners 已创建')
    }

    // ② questions —— 字段口径对齐 stories（仅正文、无标题/标签/图片）
    if (await tableExists(c, 'questions')) {
      console.log('  · questions 已存在，跳过')
    } else {
      await c.query(`CREATE TABLE questions (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        user_id        INT NOT NULL COMMENT '提问者 users.id',
        content        TEXT NOT NULL COMMENT '问题正文（帖子式，无标题）',
        is_anonymous   TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=对非作者隐去昵称头像',
        publish_status ENUM('draft','published') NOT NULL DEFAULT 'draft',
        is_featured    TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已入选精选（featured_questions 有上架副本）',
        status         ENUM('active','deleted') NOT NULL DEFAULT 'active',
        like_count     INT NOT NULL DEFAULT 0,
        fav_count      INT NOT NULL DEFAULT 0,
        comment_count  INT NOT NULL DEFAULT 0 COMMENT '回复数',
        created_by     INT NULL,
        updated_by     INT NULL,
        created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_user (user_id),
        KEY idx_list (status, publish_status, created_at),
        CONSTRAINT fk_question_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COMMENT '醒书问答 —— 问题'`)
      console.log('  ✓ questions 已创建')
    }

    // ③ question_comments —— 照 comments，多一个 is_anonymous
    if (await tableExists(c, 'question_comments')) {
      console.log('  · question_comments 已存在，跳过')
    } else {
      await c.query(`CREATE TABLE question_comments (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        question_id  INT NOT NULL,
        user_id      INT NOT NULL,
        parent_id    INT NULL COMMENT '回复某条回复（一层）',
        content      VARCHAR(1000) NOT NULL,
        is_anonymous TINYINT(1) NOT NULL DEFAULT 0,
        is_deleted   TINYINT(1) NOT NULL DEFAULT 0,
        created_by   INT NULL,
        updated_by   INT NULL,
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_question (question_id, is_deleted),
        KEY idx_user (user_id),
        CONSTRAINT fk_qcomment_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COMMENT '醒书问答 —— 回复'`)
      console.log('  ✓ question_comments 已创建')
    }

    // ④ featured_questions —— 照 featured_stories（副本可修订、可上下架，不动作者原文）
    if (await tableExists(c, 'featured_questions')) {
      console.log('  · featured_questions 已存在，跳过')
    } else {
      await c.query(`CREATE TABLE featured_questions (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        question_id INT NOT NULL,
        content     TEXT NOT NULL COMMENT '副本正文（管理员可修订）',
        status      ENUM('online','offline') NOT NULL DEFAULT 'online',
        created_by  VARCHAR(64) NULL,
        updated_by  VARCHAR(64) NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_question (question_id),
        CONSTRAINT fk_fq_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COMMENT '醒书问答 —— 精选副本'`)
      console.log('  ✓ featured_questions 已创建')
    }

    // ⑤ interactions.target_type 扩枚举（活动收藏 / 问答赞藏）
    const [[ttCol]] = await c.query(
      `SELECT COLUMN_TYPE ct FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'interactions' AND COLUMN_NAME = 'target_type'`)
    const ct = (ttCol && ttCol.ct || '').toLowerCase()
    if (ct.includes("'activity'") && ct.includes("'question'")) {
      console.log('  · interactions.target_type 已含 activity/question，跳过')
    } else {
      await c.query(`ALTER TABLE interactions MODIFY COLUMN target_type
        ENUM('comment','activity_post','story','activity','question') NOT NULL`)
      console.log('  ✓ interactions.target_type 已扩展（+activity +question）')
    }

    console.log('v2.0 改版迁移完成')
  } finally {
    await c.end()
  }
}

main().catch(e => { console.error('迁移失败：', e.message); process.exit(1) })
