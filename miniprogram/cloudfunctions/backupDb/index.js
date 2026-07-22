// 数据库每日全量备份 — 定时触发器每天 03:00（UTC+8）执行
//
// 流程：导出 SQL → gzip → AES-256-GCM 加密 → 上传云存储 backups/ → 删除 N 天前的旧备份
// 云存储桶为「所有用户可读」，故备份必须加密后再上传（密钥见 crypto.js）。
//
// 手动触发（云函数控制台「测试」或 tcb fn invoke backupDb）亦可，无需入参。
// 恢复方式见 scripts/restore-backup.js 与 doc/数据库备份与恢复.md。
const cloud = require('wx-server-sdk')
const zlib = require('zlib')
const { promisify } = require('util')
const pool = require('./db')
const { ADMIN_PASSWORD } = require('./secret')
const { dump, toSql } = require('./dump')
const { encrypt } = require('./crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const gzip = promisify(zlib.gzip)
const KEEP_DAYS = 30   // 云存储只留最近 30 天，更早的自动删除

// 备份文件名按日期，便于按天定位与清理：backups/xingshu_dev-20260722.sql.gz.enc
function cloudPathOf(database, date) {
  const d = new Date(date.getTime() + 8 * 3600 * 1000)   // 云函数为 UTC，按东八区算日期
  const stamp = d.toISOString().slice(0, 10).replace(/-/g, '')
  return `backups/${database}-${stamp}.sql.gz.enc`
}

exports.main = async () => {
  const started = Date.now()
  const conn = await pool.getConnection()
  let sql, counts, database
  try {
    const [[row]] = await conn.query('SELECT DATABASE() AS db')
    database = row.db
    const res = await dump(conn)
    counts = res.counts
    sql = toSql(res.statements, database)
  } finally {
    conn.release()
  }

  const packed = encrypt(await gzip(Buffer.from(sql, 'utf8')), ADMIN_PASSWORD)
  const cloudPath = cloudPathOf(database, new Date())

  const up = await cloud.uploadFile({ cloudPath, fileContent: packed })

  // 清理 KEEP_DAYS 天前的那一份（按日期直接定位，无需遍历列表）。
  // 环境前缀从刚上传的 fileID 反推，避免依赖 TCB_ENV 之类的环境变量名。
  const prefix = up.fileID.slice(0, up.fileID.indexOf('/', 'cloud://'.length) + 1)
  const stale = cloudPathOf(database, new Date(Date.now() - KEEP_DAYS * 86400000))
  await cloud.deleteFile({ fileList: [prefix + stale] })
    .catch(() => { /* 旧文件不存在属正常，忽略 */ })

  const tables = Object.keys(counts).length
  const rows = Object.values(counts).reduce((a, b) => a + b, 0)
  const result = {
    fileID: up.fileID,
    cloudPath,
    tables,
    rows,
    bytes: packed.length,
    ms: Date.now() - started,
  }
  console.log(`备份完成：${cloudPath} — ${tables} 张表 ${rows} 行，${(packed.length / 1024).toFixed(1)} KB，耗时 ${result.ms}ms`)
  return result
}
