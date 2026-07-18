// 后台多运营角色权限体系迁移（2026-07-18；2026-07-19 role 改多值）
// ① 新表 admin_accounts —— 运营后台账号（手机号+密码登录，4 角色；超管另有全局密码入口）
// ② 新表 activity_staff —— 活动工作人员白名单（移动端报名数据查看授权）
// ③ activities 加 owner_user_id —— 活动主理人（users.id，NULL=仅超管可管）
// ④ admin_accounts.role ENUM → VARCHAR(64)：一个账号可同时授多个角色（逗号分隔）
// 按 information_schema 判断，可重复执行（幂等）。执行前先 node scripts/backup-db.js 备份。
//
// 用法：node scripts/migrate-admin-roles.js            （读根目录 .env）
//       XINGSHU_ENV_FILE=.env.prod node scripts/migrate-admin-roles.js   （prod 上线时）
const mysql = require('mysql2/promise')
const cfg = require('../config/db')

async function tableExists(c, t) {
  const [[r]] = await c.query(
    `SELECT COUNT(*) n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [t])
  return r.n > 0
}

async function colExists(c, t, col) {
  const [[r]] = await c.query(
    `SELECT COUNT(*) n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [t, col])
  return r.n > 0
}

async function main() {
  const c = await mysql.createConnection(cfg)
  try {
    if (await tableExists(c, 'admin_accounts')) {
      console.log('  · admin_accounts 已存在，跳过')
    } else {
      await c.query(`CREATE TABLE admin_accounts (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id       INT UNSIGNED NULL COMMENT '关联 users.id（activity 角色必填，用于主理人匹配）',
        name          VARCHAR(50)  NOT NULL COMMENT '姓名/备注名',
        phone         VARCHAR(20)  NOT NULL COMMENT '登录手机号',
        password_hash VARCHAR(255) NOT NULL COMMENT '格式 scrypt$<salt hex>$<hash hex>',
        role          VARCHAR(64) NOT NULL COMMENT '角色（super/content/activity/member），逗号分隔可多值',
        is_active     TINYINT(1)   NOT NULL DEFAULT 1,
        last_login_at DATETIME     NULL,
        created_by    VARCHAR(64)  NULL,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_phone (phone),
        KEY idx_user (user_id)
      ) CHARACTER SET utf8mb4 COMMENT '运营后台账号（超管另有全局密码入口）'`)
      console.log('  ✓ admin_accounts 已创建')
    }

    if (await tableExists(c, 'activity_staff')) {
      console.log('  · activity_staff 已存在，跳过')
    } else {
      await c.query(`CREATE TABLE activity_staff (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        activity_id INT UNSIGNED NOT NULL,
        user_id     INT UNSIGNED NOT NULL COMMENT 'users.id',
        added_by    VARCHAR(64)  NULL COMMENT '操作者标识（super / au:<accountId>）',
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_activity_user (activity_id, user_id),
        KEY idx_user (user_id)
      ) CHARACTER SET utf8mb4 COMMENT '活动工作人员白名单（移动端报名数据查看授权）'`)
      console.log('  ✓ activity_staff 已创建')
    }

    // ④ 存量 role 列若仍是 ENUM（首版建表），改 VARCHAR 支持多值
    const [[roleCol]] = await c.query(
      `SELECT COLUMN_TYPE ct FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_accounts' AND COLUMN_NAME = 'role'`)
    if (roleCol && roleCol.ct.toLowerCase().startsWith('enum')) {
      await c.query("ALTER TABLE admin_accounts MODIFY COLUMN role VARCHAR(64) NOT NULL COMMENT '角色（super/content/activity/member），逗号分隔可多值'")
      console.log('  ✓ admin_accounts.role 已由 ENUM 改为 VARCHAR(64)（支持多角色）')
    } else {
      console.log('  · admin_accounts.role 已为 VARCHAR，跳过')
    }

    if (await colExists(c, 'activities', 'owner_user_id')) {
      console.log('  · activities.owner_user_id 已存在，跳过')
    } else {
      await c.query("ALTER TABLE activities ADD COLUMN owner_user_id INT UNSIGNED NULL COMMENT '主理人 users.id（NULL=无主理人，仅超管可管）' AFTER organizer, ADD KEY idx_owner (owner_user_id)")
      console.log('  ✓ activities.owner_user_id 已添加')
    }

    console.log('后台角色权限体系迁移完成')
  } finally {
    await c.end()
  }
}

main().catch(e => { console.error('迁移失败：', e.message); process.exit(1) })
