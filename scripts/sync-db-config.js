// 从 .env 重新生成所有云函数的 db.js（连接配置唯一来源见 config/db.js）
// 用法：node scripts/sync-db-config.js（或 npm run sync-db）
// 仅覆盖已存在 db.js 的云函数目录，不涉及数据库的云函数不受影响。
const fs = require('fs')
const path = require('path')
const DB = require('../config/db')

const fnRoot = path.join(__dirname, '..', 'miniprogram', 'cloudfunctions')

const template = `// 本文件由 scripts/sync-db-config.js 从根目录 .env 生成 — 勿手改、勿提交
const mysql = require('mysql2/promise')

const pool = mysql.createPool({
  host: '${DB.host}',
  port: ${DB.port},
  user: '${DB.user}',
  password: '${DB.password}',
  database: '${DB.database}',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  charset: 'utf8mb4',
})

module.exports = pool
`

let count = 0
for (const dir of fs.readdirSync(fnRoot)) {
  const dbFile = path.join(fnRoot, dir, 'db.js')
  if (fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, template)
    count++
  }
}
console.log(`已同步 ${count} 个云函数的 db.js → ${DB.host}:${DB.port}/${DB.database}`)
