// 数据库导出为 SQL 文本 — 纯 Node 实现（无需 mysqldump）
// 同时被本云函数与 scripts/backup-db.js 使用，确保定时备份与手动备份产出格式完全一致。
function sqlValue(conn, v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v)) return conn.escape(JSON.stringify(v))
  return conn.escape(v)
}

// 返回 { statements, counts }：statements 为可逐条执行的 SQL 数组，counts 为各表行数
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

// 拼成完整 .sql 文本（含注释头）
function toSql(statements, database) {
  const header = `-- 醒书日记数据库备份\n-- 库：${database}  时间：${new Date().toLocaleString('zh-CN')}\n\n`
  return header + statements.join(';\n\n') + ';\n'
}

module.exports = { dump, toSql }
