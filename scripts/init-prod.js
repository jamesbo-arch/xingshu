// 一步初始化正式库 xingshu_prod（同一 MySQL 实例，源 = xingshu_dev）
// 只搬「表结构 + 静态字典数据」，业务数据（会员/故事/活动/订单/互动…）留空、由业务侧单独初始化。
// 云存储不迁移（图片/视频/头像 fileID 仍指向 dev 环境，如需 prod 显示另行迁移）。
//
// ⚠ 破坏性：会 DROP 并按 dev 现行结构重建 xingshu_prod 全部表。
//   安全护栏：prod 已有业务数据（users 非空）时拒绝执行，确认覆盖需加 --force。
//
// 用法：
//   node scripts/init-prod.js --dry     # 仅演示：列出将重建的表与将复制的字典表，不改库
//   node scripts/init-prod.js           # 执行初始化（prod.users 为空时）
//   node scripts/init-prod.js --force   # prod 已有数据时强制清空重建
//
// 连接信息复用根目录 .env（dev/prod 同一 cpolar 隧道、同一账号，一条连接可跨库操作）。
const mysql = require('mysql2/promise')
const cfg = require('../config/db')

const SRC = 'xingshu_dev'
const DST = 'xingshu_prod'
// 静态字典 / 系统运行必须的初始化数据（仅这两张表复制数据，其余表只建结构）
const SEED_TABLES = ['tags', 'activity_types']
const FORCE = process.argv.includes('--force')
const DRY = process.argv.includes('--dry')

async function main() {
  if (SRC === DST) { console.error('源库与目标库不能相同'); process.exit(1) }
  const conn = await mysql.createConnection({
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, charset: 'utf8mb4',
  })
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DST}\` DEFAULT CHARSET utf8mb4`)

  // ── 安全护栏：prod 已有业务数据（users 非空）则拒绝，避免误清生产库 ──
  const [[hasUsers]] = await conn.query(
    `SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=? AND table_name='users'`, [DST])
  if (hasUsers.n) {
    const [[{ n }]] = await conn.query(`SELECT COUNT(*) n FROM \`${DST}\`.users`)
    if (n > 0 && !FORCE) {
      console.error(`⚠ ${DST}.users 已有 ${n} 行业务数据。init-prod 会清空重建，如确认请加 --force。已中止。`)
      process.exit(1)
    }
  }

  // ── 列出源库全部表 ──
  const [tables] = await conn.query(
    'SELECT TABLE_NAME t FROM information_schema.tables WHERE table_schema=? ORDER BY t', [SRC])
  const names = tables.map(r => r.t)
  console.log(`源 ${SRC}：${names.length} 张表`)
  console.log(`将重建 ${DST} 全部表结构；仅复制字典表数据：${SEED_TABLES.join(', ')}`)
  if (DRY) { console.log('\n--dry 模式：未改动任何库。'); await conn.end(); return }

  await conn.query('SET FOREIGN_KEY_CHECKS=0')

  // ── 1) 清空目标库现有表 ──
  const [dstTables] = await conn.query(
    'SELECT TABLE_NAME t FROM information_schema.tables WHERE table_schema=?', [DST])
  for (const { t } of dstTables) await conn.query(`DROP TABLE IF EXISTS \`${DST}\`.\`${t}\``)
  console.log(`已清空 ${DST} 原有 ${dstTables.length} 张表`)

  // ── 2) 按源库现行结构重建（FK 检查关闭，创建顺序无关）──
  for (const t of names) {
    const [[row]] = await conn.query(`SHOW CREATE TABLE \`${SRC}\`.\`${t}\``)
    const ddl = row['Create Table'].replace(/^CREATE TABLE `[^`]+`/, `CREATE TABLE \`${DST}\`.\`${t}\``)
    await conn.query(ddl)
  }
  console.log(`已按 ${SRC} 结构重建 ${names.length} 张表`)

  // ── 3) 仅复制字典表数据 ──
  for (const t of SEED_TABLES) {
    if (!names.includes(t)) { console.warn(`  · 源库无表 ${t}，跳过`); continue }
    await conn.query(`INSERT INTO \`${DST}\`.\`${t}\` SELECT * FROM \`${SRC}\`.\`${t}\``)
    const [[{ n }]] = await conn.query(`SELECT COUNT(*) n FROM \`${DST}\`.\`${t}\``)
    console.log(`  ✓ 字典 ${t}：复制 ${n} 行`)
  }

  await conn.query('SET FOREIGN_KEY_CHECKS=1')
  await conn.end()
  console.log(`\n完成：${DST} 已初始化（结构 + 字典数据；业务数据留空，云存储未迁移）。`)
  console.log('后续：npm run sync-db:prod → 部署 prod 云函数 → admin 后台发布 → 小程序 release 环境发版。')
}

main().catch(e => { console.error('初始化失败：', e.message); process.exit(1) })
