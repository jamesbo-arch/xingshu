// 把源库的表结构克隆到目标库（默认 xingshu_dev → xingshu_prod）。
// 只建表结构（CREATE TABLE IF NOT EXISTS），不复制任何数据；幂等，可重复运行。
// 连接信息复用 .env（同一 NAS / cpolar）。
// 用法：node scripts/clone-schema.js [源库] [目标库]
//       node scripts/clone-schema.js               # xingshu_dev → xingshu_prod
const mysql = require('mysql2/promise')
const cfg = require('../config/db')

const SRC = process.argv[2] || cfg.database
const DST = process.argv[3] || 'xingshu_prod'

async function main() {
  if (SRC === DST) { console.error('源库与目标库不能相同'); process.exit(1) }
  const conn = await mysql.createConnection({
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, charset: 'utf8mb4',
  })
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DST}\` DEFAULT CHARSET utf8mb4`)
  const [tables] = await conn.query(
    'SELECT TABLE_NAME AS t FROM information_schema.tables WHERE table_schema = ?', [SRC])
  console.log(`源 ${SRC} 共 ${tables.length} 张表 → 目标 ${DST}`)
  await conn.query('SET FOREIGN_KEY_CHECKS = 0')
  for (const { t } of tables) {
    const [[row]] = await conn.query(`SHOW CREATE TABLE \`${SRC}\`.\`${t}\``)
    let ddl = row['Create Table'].replace(/^CREATE TABLE `/, 'CREATE TABLE IF NOT EXISTS `')
    await conn.query(`USE \`${DST}\``)
    await conn.query(ddl)
    console.log('  ✓', t)
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1')
  await conn.end()
  console.log(`完成：${DST} 表结构已就绪（无数据）。`)
}
main().catch(e => { console.error(e); process.exit(1) })
