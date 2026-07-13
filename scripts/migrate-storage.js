// 云存储跨环境迁移（可复用）：OLD_ENV → NEW_ENV，迁移文件并重写数据库 fileID 前缀。
// ⚠ manager-node 的环境配置是模块级单例：同一进程内创建两个环境实例会串桶配置
//   （上传/列表会打到错误的桶）。因此下载、上传、取桶名一律在单环境子进程中执行。
//   —— 2026-07-13 首次迁移在此翻车两次（DB 前缀写错 + 文件传回旧桶），均已人工修正。
// 用法：.env 配 TENCENT_SECRET_ID / TENCENT_SECRET_KEY（腾讯云 API 密钥，用后删除），
//       node scripts/migrate-storage.js [--dry]
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const mysql = require('mysql2/promise')
const DB = require('../config/db')

const OLD_ENV = 'cloud1-d9gbozhfp4a6c50c0'
const NEW_ENV = 'cloud1-xingshu-prd-d1cev0fcca864'
// posters/ 为海报/小程序码生成缓存（DB 无引用、可再生、量大易挂），不迁移
const FOLDERS = ['activity-posts', 'avatars', 'diary-images']
const TMP = path.join(__dirname, '..', '.storage-migrate-tmp')
const DRY = process.argv.includes('--dry')

const envText = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
const pick = (k) => (envText.match(new RegExp(`^\\s*${k}\\s*=\\s*(.*?)\\s*$`, 'm')) || [])[1]
const secretId = pick('TENCENT_SECRET_ID')
const secretKey = pick('TENCENT_SECRET_KEY')
if (!secretId || !secretKey) {
  console.error('缺少 TENCENT_SECRET_ID / TENCENT_SECRET_KEY，请在根目录 .env 中配置后重试')
  process.exit(1)
}

// 在单环境子进程中执行一段针对 app 的异步代码（body 内可用 app/fs/path，末尾自行 console.log 输出）
function inEnv(envId, body) {
  const code = `
    const fs = require('fs'), path = require('path')
    const CloudBase = require('@cloudbase/manager-node')
    const app = CloudBase.init({ secretId: ${JSON.stringify(secretId)}, secretKey: ${JSON.stringify(secretKey)}, envId: ${JSON.stringify(envId)} })
    ;(async () => { ${body}; process.exit(0) })().catch(e => { console.error(e.message); process.exit(1) })
  `
  return execFileSync(process.execPath, ['-e', code], {
    cwd: path.join(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'inherit'],
  }).toString().trim()
}

const countBody = (dir) => `
  const files = await app.storage.listDirectoryFiles('${dir}/')
  console.log(files.filter(f => f.Key && !f.Key.endsWith('/')).length)
`

async function run() {
  // ── 1. 盘点旧环境 ──
  const counts = {}
  let total = 0
  for (const dir of FOLDERS) {
    counts[dir] = Number(inEnv(OLD_ENV, countBody(dir)))
    total += counts[dir]
    console.log(`旧环境 ${dir}/：${counts[dir]} 个文件`)
  }
  console.log(`合计 ${total} 个文件${DRY ? '（--dry 模式，仅统计）' : ''}`)
  if (DRY) process.exit(0)

  // ── 2. 下载（旧环境子进程）──
  fs.rmSync(TMP, { recursive: true, force: true })
  for (const dir of FOLDERS) {
    fs.mkdirSync(path.join(TMP, dir), { recursive: true })
    console.log(`下载 ${dir}/ …`)
    inEnv(OLD_ENV, `await app.storage.downloadDirectory({ cloudPath: '${dir}', localPath: ${JSON.stringify(path.join(TMP, dir))} })`)
  }

  // ── 3. 上传 + 校验（新环境子进程）──
  let newTotal = 0
  for (const dir of FOLDERS) {
    console.log(`上传 ${dir}/ → 新环境 …`)
    inEnv(NEW_ENV, `await app.storage.uploadDirectory({ localPath: ${JSON.stringify(path.join(TMP, dir))}, cloudPath: '${dir}' })`)
    const n = Number(inEnv(NEW_ENV, countBody(dir)).split('\n').pop())
    console.log(`新环境 ${dir}/：${n} 个文件（旧 ${counts[dir]}）`)
    newTotal += n
  }
  if (newTotal < total) throw new Error(`新环境文件数 ${newTotal} < 旧环境 ${total}，请检查后重跑`)

  // ── 4. 取两环境桶名（各自子进程），重写数据库 fileID 前缀 ──
  const bucketBody = `await app.storage.listDirectoryFiles('${FOLDERS[0]}/'); console.log(app.storage.getStorageConfig().bucket)`
  const oldBucket = inEnv(OLD_ENV, bucketBody).split('\n').pop()
  const newBucket = inEnv(NEW_ENV, bucketBody).split('\n').pop()
  const oldPrefix = `cloud://${OLD_ENV}.${oldBucket}/`
  const newPrefix = `cloud://${NEW_ENV}.${newBucket}/`
  console.log(`\nfileID 前缀替换：\n  ${oldPrefix}\n→ ${newPrefix}\n`)

  const conn = await mysql.createConnection(DB)
  const updates = [
    ['users', 'avatar_url'],
    ['diaries', 'images'],
    ['activities', 'cover_url'],
    ['activities', 'images'],
    ['activities', 'review_images'],
    ['activity_posts', 'images'],
  ]
  for (const [table, col] of updates) {
    const [r] = await conn.query(
      `UPDATE ${table} SET ${col} = REPLACE(${col}, ?, ?) WHERE ${col} LIKE ?`,
      [oldPrefix, newPrefix, `%${oldPrefix}%`])
    console.log(`${table}.${col}：更新 ${r.affectedRows} 行`)
  }
  for (const [table, col] of updates) {
    const [[{ c }]] = await conn.query(
      `SELECT COUNT(*) c FROM ${table} WHERE ${col} LIKE ?`, [`%${OLD_ENV}%`])
    if (c > 0) console.warn(`⚠ ${table}.${col} 仍有 ${c} 行含旧环境 ID，请人工检查`)
  }
  await conn.end()
  fs.rmSync(TMP, { recursive: true, force: true })
  console.log('\n迁移完成。')
  process.exit(0)
}

run().catch(e => { console.error('迁移失败：', e.message); process.exit(1) })
