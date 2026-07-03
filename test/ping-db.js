// 数据库连通性快速检查 — npm test 的第一道关卡
// 隧道不可达时 5 秒内失败并给出明确指引，避免后续测试挂起或无意义重试
const mysql = require('mysql2/promise')
const DB = require('../config/db')

mysql.createConnection({ ...DB, connectTimeout: 5000 })
  .then(async conn => {
    await conn.ping()
    await conn.end()
    console.log(`数据库可达：${DB.host}:${DB.port}/${DB.database}`)
  })
  .catch(e => {
    console.error(`数据库不可达（${DB.host}:${DB.port}）：${e.message}`)
    console.error('cpolar 隧道可能已变更或未启动。请确认新地址后更新 .env 并运行 npm run sync-db。')
    console.error('自动化循环遇到此错误应停止并报告，而非重试。')
    process.exit(1)
  })
