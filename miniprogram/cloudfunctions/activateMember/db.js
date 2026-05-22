const mysql = require('mysql2/promise')

const pool = mysql.createPool({
  host: '33.tcp.cpolar.top',
  port: 11028,
  user: 'james',
  password: '751279',
  database: 'xingshu_dev',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  charset: 'utf8mb4',
})

module.exports = pool
