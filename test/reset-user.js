/**
 * 开发测试用：将指定用户（或全部用户）重置为 guest 身份
 *
 * 用法：
 *   node test/reset-user.js              — 列出所有用户
 *   node test/reset-user.js <openid>     — 重置指定用户为 guest
 *   node test/reset-user.js all          — 重置全部用户为 guest（慎用）
 */

const mysql = require('mysql2/promise')
const DB = require('../config/db')

async function main() {
  const conn = await mysql.createConnection(DB)
  const target = process.argv[2]

  if (!target) {
    const [rows] = await conn.execute(
      'SELECT id, openid, nickname, identity, phone FROM users ORDER BY created_at DESC'
    )
    console.log('\n当前用户列表：\n')
    rows.forEach(r =>
      console.log(`  [${r.id}] ${r.nickname.padEnd(12)} identity=${r.identity.padEnd(8)} phone=${r.phone || '(无)'}\n      openid: ${r.openid}`)
    )
    console.log('\n运行方式：node test/reset-user.js <openid>')
  } else if (target === 'all') {
    const [res] = await conn.execute("UPDATE users SET identity='guest', phone=NULL")
    console.log(`已重置 ${res.affectedRows} 个用户为 guest`)
  } else {
    const [res] = await conn.execute(
      "UPDATE users SET identity='guest', phone=NULL WHERE openid=?",
      [target]
    )
    if (res.affectedRows === 0) {
      console.log('未找到该 openid，请先运行不带参数的命令查看列表')
    } else {
      console.log(`已重置用户 ${target.slice(0, 16)}... 为 guest`)
    }
  }

  await conn.end()
}

main().catch(err => { console.error(err.message); process.exit(1) })
