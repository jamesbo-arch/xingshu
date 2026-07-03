// 数据库连接配置唯一来源 — 从仓库根目录 .env 读取
// 使用方：test/ 下所有脚本、scripts/sync-db-config.js
const fs = require('fs')
const path = require('path')

const envFile = path.join(__dirname, '..', '.env')

if (!fs.existsSync(envFile)) {
  console.error('缺少 .env 文件：请复制 .env.example 为 .env 并填入数据库连接信息')
  process.exit(1)
}

const env = {}
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
  if (m) env[m[1]] = m[2]
}

const missing = ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'].filter(k => !env[k])
if (missing.length) {
  console.error(`.env 缺少字段：${missing.join(', ')}`)
  process.exit(1)
}

module.exports = {
  host: env.MYSQL_HOST,
  port: Number(env.MYSQL_PORT),
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE,
}

// 不可枚举：避免被展开进 mysql2 连接参数
Object.defineProperty(module.exports, 'adminPassword', {
  value: env.ADMIN_PASSWORD || '',
  enumerable: false,
})
