// 把本地备份加密后上传云存储 — 用于补传历史备份或临时手动备份
// （日常备份由 backupDb 云函数的定时触发器自动完成，无需跑本脚本）
//
// 用法：
//   node scripts/upload-backup.js                       # 上传 backups/ 下最新的 .sql
//   node scripts/upload-backup.js backups/xxx.sql       # 上传指定文件
//
// 上传前会 gzip + AES-256-GCM 加密（密钥由 .env 的 ADMIN_PASSWORD 派生），
// 因为云存储桶是「所有用户可读」，明文备份等同公开泄露用户隐私数据。
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const { execFileSync } = require('child_process')
const os = require('os')
const DB = require('../config/db')
const { encrypt } = require('../miniprogram/cloudfunctions/backupDb/crypto')

const ENV_ID = 'cloud1-xingshu-prd-d1cev0fcca864'
const BACKUP_DIR = path.join(__dirname, '..', 'backups')

function latestBackup() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(f => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  if (!files.length) throw new Error(`${BACKUP_DIR} 下没有 .sql 备份，请先运行 node scripts/backup-db.js`)
  return path.join(BACKUP_DIR, files[0].f)
}

function main() {
  const src = process.argv[2] ? path.resolve(process.argv[2]) : latestBackup()
  if (!fs.existsSync(src)) throw new Error('文件不存在：' + src)

  const plain = fs.readFileSync(src)
  const packed = encrypt(zlib.gzipSync(plain), DB.adminPassword)

  // 云端文件名按备份文件里的日期戳，与云函数产出的命名保持一致
  const stamp = (path.basename(src).match(/-(\d{8})/) || [, ''])[1]
  const cloudPath = `backups/${DB.database}-${stamp}.sql.gz.enc`

  const tmp = path.join(os.tmpdir(), path.basename(cloudPath))
  fs.writeFileSync(tmp, packed)
  try {
    console.log(`加密完成：${(plain.length / 1024).toFixed(1)} KB → ${(packed.length / 1024).toFixed(1)} KB`)
    console.log(`上传中：${cloudPath}`)
    execFileSync('npx', ['-y', '-p', '@cloudbase/cli', 'tcb', 'storage', 'upload', tmp, cloudPath, '-e', ENV_ID],
      { stdio: 'inherit', shell: true })
    console.log(`\n上传完成：cloud://${ENV_ID}/${cloudPath}`)
    console.log(`恢复：node scripts/restore-backup.js ${cloudPath}`)
  } finally {
    fs.unlinkSync(tmp)
  }
}

try { main() } catch (e) { console.error('上传失败：' + e.message); process.exit(1) }
