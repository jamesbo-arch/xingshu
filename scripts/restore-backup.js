// 从云存储下载备份并解密还原为可用的 .sql — 备份的另一半，务必定期演练
//
// 用法：
//   node scripts/restore-backup.js                                  # 列出云端备份
//   node scripts/restore-backup.js backups/xingshu_dev-20260722.sql.gz.enc
//   node scripts/restore-backup.js <cloudPath> --verify             # 还原后导入临时库校验行数
//
// 产出落在 backups/ 下的同名 .sql。导入命令：
//   mysql -h <host> -P <port> -u <user> -p <database> < backups/xxx.sql
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const os = require('os')
const { execFileSync } = require('child_process')
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { decrypt } = require('../miniprogram/cloudfunctions/backupDb/crypto')

const ENV_ID = 'cloud1-xingshu-prd-d1cev0fcca864'
const BACKUP_DIR = path.join(__dirname, '..', 'backups')

function tcb(args) {
  return execFileSync('npx', ['-y', '-p', '@cloudbase/cli', 'tcb', ...args, '-e', ENV_ID],
    { encoding: 'utf8', shell: true })
}

// 导入临时库并比对表数，确认备份确实可用（校验完即删临时库）
async function verify(sqlText) {
  const tmpDb = 'xingshu_restore_verify_tmp'
  const conn = await mysql.createConnection({ ...DB, database: undefined })
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${tmpDb}\``)
    await conn.query(`CREATE DATABASE \`${tmpDb}\` CHARACTER SET utf8mb4`)
    await conn.query(`USE \`${tmpDb}\``)
    // 备份是以 ';\n\n' 分隔的语句序列（见 dump.js 的 toSql）
    const statements = sqlText.replace(/^--.*$/gm, '').split(/;\s*\n\s*\n/).map(s => s.trim()).filter(Boolean)
    for (const s of statements) await conn.query(s)
    const [tables] = await conn.query('SHOW TABLES')
    let rows = 0
    for (const t of tables.map(r => Object.values(r)[0])) {
      const [[{ c }]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t}\``)
      rows += c
    }
    console.log(`校验通过：导入临时库成功，${tables.length} 张表 ${rows} 行`)
  } finally {
    await conn.query(`DROP DATABASE IF EXISTS \`${tmpDb}\``)
    await conn.end()
  }
}

async function main() {
  const cloudPath = process.argv[2]
  if (!cloudPath || cloudPath.startsWith('--')) {
    console.log('云端备份列表：\n')
    console.log(tcb(['storage', 'list', 'backups/']))
    console.log('用法：node scripts/restore-backup.js backups/<文件名> [--verify]')
    return
  }

  const tmp = path.join(os.tmpdir(), path.basename(cloudPath))
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
  console.log(`下载中：${cloudPath}`)
  tcb(['storage', 'download', cloudPath, tmp])

  const sql = zlib.gunzipSync(decrypt(fs.readFileSync(tmp), DB.adminPassword))
  fs.unlinkSync(tmp)

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR)
  const out = path.join(BACKUP_DIR, path.basename(cloudPath).replace(/\.gz\.enc$/, ''))
  fs.writeFileSync(out, sql)
  console.log(`已还原：${out}（${(sql.length / 1024).toFixed(1)} KB）`)

  if (process.argv.includes('--verify')) await verify(sql.toString('utf8'))
  else console.log(`导入：mysql -h ${DB.host} -P ${DB.port} -u ${DB.user} -p ${DB.database} < ${out}`)
}

main().catch(e => { console.error('恢复失败：' + e.message); process.exit(1) })
