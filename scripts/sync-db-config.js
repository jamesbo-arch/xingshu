// 从 .env 重新生成所有云函数的 db.js（连接配置唯一来源见 config/db.js）
// 用法：node scripts/sync-db-config.js（或 npm run sync-db）
// 仅覆盖已存在 db.js 的云函数目录，不涉及数据库的云函数不受影响。
const fs = require('fs')
const path = require('path')
// 可传入 env 文件名（如 .env.prod）以生成对应环境的 db.js
if (process.argv[2]) process.env.XINGSHU_ENV_FILE = process.argv[2]
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
  // 隧道链路冷透时握手可能挂死，mysql2 默认 connectTimeout 10s 会吃光云函数超时预算——
  // 5s 快速失败，把机会留给前端重试；keepalive 减少热容器里连接被隧道静默断掉
  connectTimeout: 5000,
  enableKeepAlive: true,
})

module.exports = pool
`

const secretTemplate = `// 本文件由 scripts/sync-db-config.js 从根目录 .env 生成 — 勿手改、勿提交
module.exports = { ADMIN_PASSWORD: '${DB.adminPassword}' }
`

let count = 0, secretCount = 0
for (const dir of fs.readdirSync(fnRoot)) {
  const dbFile = path.join(fnRoot, dir, 'db.js')
  if (fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, template)
    count++
  }
  // 管理端云函数额外需要鉴权密钥（目录下存在 secret.js 即重新生成）
  const secretFile = path.join(fnRoot, dir, 'secret.js')
  if (fs.existsSync(secretFile)) {
    fs.writeFileSync(secretFile, secretTemplate)
    secretCount++
  }
}
console.log(`已同步 ${count} 个云函数的 db.js${secretCount ? `、${secretCount} 个 secret.js` : ''} → ${DB.host}:${DB.port}/${DB.database}`)
