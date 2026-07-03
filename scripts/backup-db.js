// 数据库备份脚本 — 纯 Node 实现（无需 mysqldump），从 .env 读取连接信息
//
// 用法：
//   node scripts/backup-db.js            # 备份到 backups/xingshu_dev-<时间戳>.sql
//   node scripts/backup-db.js --verify   # 备份后恢复到临时库校验行数，校验完删除临时库
//
// 恢复方式：
//   mysql -h <host> -P <port> -u <user> -p <database> < backups/xxx.sql
//
// 定时调度（Windows 任务计划程序，每天 3:00）：
//   schtasks /create /tn "xingshu-db-backup" /tr "node d:\workspace\xingshu\scripts\backup-db.js" /sc daily /st 03:00
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
const DB = require('../config/db')

const VERIFY = process.argv.includes('--verify')
const BACKUP_DIR = path.join(__dirname, '..', 'backups')

function sqlValue(conn, v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v)) return conn.escape(JSON.stringify(v))
  return conn.escape(v)
}

async function dump(conn) {
  const statements = ['SET FOREIGN_KEY_CHECKS=0']
  const counts = {}

  const [tables] = await conn.query('SHOW TABLES')
  const names = tables.map(r => Object.values(r)[0])

  for (const t of names) {
    const [[create]] = await conn.query(`SHOW CREATE TABLE \`${t}\``)
    statements.push(`DROP TABLE IF EXISTS \`${t}\``)
    statements.push(create['Create Table'])

    const [rows] = await conn.query(`SELECT * FROM \`${t}\``)
    counts[t] = rows.length
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100)
      const values = chunk
        .map(r => '(' + Object.values(r).map(v => sqlValue(conn, v)).join(',') + ')')
        .join(',\n')
      statements.push(`INSERT INTO \`${t}\` VALUES\n${values}`)
    }
  }

  statements.push('SET FOREIGN_KEY_CHECKS=1')
  return { statements, counts }
}

async function verify(statements, counts) {
  const tmpDb = 'xingshu_backup_verify_tmp'
  const conn = await mysql.createConnection({ ...DB, database: undefined, multipleStatements: false })
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${tmpDb}\``)
    await conn.query(`CREATE DATABASE \`${tmpDb}\` CHARACTER SET utf8mb4`)
    await conn.query(`USE \`${tmpDb}\``)
    for (const s of statements) await conn.query(s)

    for (const [t, expected] of Object.entries(counts)) {
      const [[{ c }]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t}\``)
      if (c !== expected) throw new Error(`表 ${t} 行数不一致：备份 ${expected}，恢复 ${c}`)
    }
    console.log(`校验通过：${Object.keys(counts).length} 张表恢复后行数一致`)
  } finally {
    await conn.query(`DROP DATABASE IF EXISTS \`${tmpDb}\``)
    await conn.end()
  }
}

async function main() {
  const conn = await mysql.createConnection(DB)
  const { statements, counts } = await dump(conn)
  await conn.end()

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR)
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const file = path.join(BACKUP_DIR, `${DB.database}-${stamp}.sql`)
  const header = `-- 醒书日记数据库备份\n-- 库：${DB.database}  时间：${new Date().toLocaleString('zh-CN')}\n-- 恢复：mysql -h <host> -P <port> -u <user> -p ${DB.database} < ${path.basename(file)}\n\n`
  fs.writeFileSync(file, header + statements.join(';\n\n') + ';\n')

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  console.log(`备份完成：${file}`)
  console.log(`共 ${Object.keys(counts).length} 张表 ${total} 行，${(fs.statSync(file).size / 1024).toFixed(1)} KB`)
  Object.entries(counts).forEach(([t, c]) => console.log(`  ${t}: ${c} 行`))

  if (VERIFY) await verify(statements, counts)
}

main().catch(e => { console.error('备份失败：' + e.message); process.exit(1) })
