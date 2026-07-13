// 云存储跨环境迁移（一次性）：cloud1-d9gbozhfp4a6c50c0 → cloud1-xingshu-prd-d1cev0fcca864
// 1) 整目录下载旧环境文件 → 原路径上传新环境；2) 重写数据库中的 fileID 前缀
// 用法：在 .env 追加 TENCENT_SECRET_ID / TENCENT_SECRET_KEY（腾讯云 API 密钥，用后可删），
//       然后 node scripts/migrate-storage.js [--dry]（--dry 只统计不执行）
const fs = require('fs')
const path = require('path')
const CloudBase = require('@cloudbase/manager-node')
const mysql = require('mysql2/promise')
const DB = require('../config/db')

const OLD_ENV = 'cloud1-d9gbozhfp4a6c50c0'
const NEW_ENV = 'cloud1-xingshu-prd-d1cev0fcca864'
const FOLDERS = ['activity-posts', 'avatars', 'diary-images', 'posters']
const TMP = path.join(__dirname, '..', '.storage-migrate-tmp')
const DRY = process.argv.includes('--dry')

// 从根目录 .env 读腾讯云 API 密钥（config/db.js 只导出数据库字段，这里自行解析）
const envText = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
const pick = (k) => (envText.match(new RegExp(`^\\s*${k}\\s*=\\s*(.*?)\\s*$`, 'm')) || [])[1]
const secretId = pick('TENCENT_SECRET_ID')
const secretKey = pick('TENCENT_SECRET_KEY')
if (!secretId || !secretKey) {
  console.error('缺少 TENCENT_SECRET_ID / TENCENT_SECRET_KEY，请在根目录 .env 中配置后重试')
  process.exit(1)
}

// 独立子进程取指定环境的存储桶名（规避 manager-node 环境配置单例串扰）
function bucketOf(envId) {
  const { execFileSync } = require('child_process')
  const code = `
    const CloudBase = require('@cloudbase/manager-node')
    const app = CloudBase.init({ secretId: ${JSON.stringify(secretId)}, secretKey: ${JSON.stringify(secretKey)}, envId: ${JSON.stringify(envId)} })
    app.storage.listDirectoryFiles('${FOLDERS[0]}/').then(() => { console.log(app.storage.getStorageConfig().bucket); process.exit(0) })
      .catch(e => { console.error(e.message); process.exit(1) })
  `
  return execFileSync(process.execPath, ['-e', code], { cwd: path.join(__dirname, '..') }).toString().trim()
}

async function listAll(storage, dir) {
  const files = await storage.listDirectoryFiles(dir + '/')
  return (files || []).filter(f => f.Key && !f.Key.endsWith('/'))
}

async function run() {
  const oldApp = CloudBase.init({ secretId, secretKey, envId: OLD_ENV })
  const newApp = CloudBase.init({ secretId, secretKey, envId: NEW_ENV })

  // ── 1. 盘点旧环境文件 ──
  let total = 0
  const inventory = {}
  for (const dir of FOLDERS) {
    const files = await listAll(oldApp.storage, dir)
    inventory[dir] = files.length
    total += files.length
    console.log(`旧环境 ${dir}/：${files.length} 个文件`)
  }
  console.log(`合计 ${total} 个文件${DRY ? '（--dry 模式，仅统计）' : ''}`)
  if (DRY) process.exit(0)

  // ── 2. 下载 → 上传（保持原路径） ──
  fs.rmSync(TMP, { recursive: true, force: true })
  fs.mkdirSync(TMP, { recursive: true })
  for (const dir of FOLDERS) {
    if (!inventory[dir]) continue
    const local = path.join(TMP, dir)
    fs.mkdirSync(local, { recursive: true }) // SDK 要求本地目录已存在
    console.log(`下载 ${dir}/ …`)
    await oldApp.storage.downloadDirectory({ cloudPath: dir, localPath: local })
    console.log(`上传 ${dir}/ → 新环境 …`)
    await newApp.storage.uploadDirectory({ localPath: local, cloudPath: dir })
  }

  // ── 3. 校验新环境文件数并取新桶前缀 ──
  let newTotal = 0
  let sampleKey = null
  for (const dir of FOLDERS) {
    const files = await listAll(newApp.storage, dir)
    if (files.length && !sampleKey) sampleKey = files[0].Key
    console.log(`新环境 ${dir}/：${files.length} 个文件（旧 ${inventory[dir]}）`)
    newTotal += files.length
  }
  if (newTotal < total) throw new Error(`新环境文件数 ${newTotal} < 旧环境 ${total}，请检查后重跑`)

  // fileID 前缀：cloud://<env>.<bucket>/ 。
  // ⚠ manager-node 的环境配置是模块级单例，同进程建两个环境实例会串（后加载者覆盖前者的桶名），
  //   桶名必须在独立子进程中逐环境获取（2026-07-13 首次执行时踩坑，DB 前缀写错后人工修正）
  const oldBucket = bucketOf(OLD_ENV)
  const newBucket = bucketOf(NEW_ENV)
  if (!newBucket || !oldBucket) throw new Error('取存储桶名失败')
  const oldPrefix = `cloud://${OLD_ENV}.${oldBucket}/`
  const newPrefix = `cloud://${NEW_ENV}.${newBucket}/`
  console.log(`\nfileID 前缀替换：\n  ${oldPrefix}\n→ ${newPrefix}\n`)

  // ── 4. 重写数据库引用 ──
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
  // 残留检查
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
