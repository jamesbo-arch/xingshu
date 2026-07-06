// 将《醒记故事汇》各月日记集初始化入库。
// 数据源：test/data/stories-<YYYY-MM>.json（[{author,title,date,content}...]），见 MONTHS。
//
// 作者 → 展示型种子用户：openid 按作者名稳定哈希（`story_<md5前16>`），跨月同名归并为同一用户，
//   非真实微信账号，identity=authed，avatar_hue 由名字派生（稳定分散），created_by='seed-stories'。
// 日记：permission=public、status=active、created_at 取自各篇日期（同日按收录顺序加秒保序）、计数器全 0。
// 幂等键：(user_id, title, 日期)——同作者同标题不同月的作品不会互相误跳（如 Olia 的重复标题）。
//
// 用法：node test/seed-stories.js           幂等写库（已存在则跳过）
//       node test/seed-stories.js --dry     仅预览，不写库
//       node test/seed-stories.js --reset   先清除全部 seed-stories 数据再重建（统一 openid 方案时用）
const fs = require('fs')
const crypto = require('crypto')
const mysql = require('mysql2/promise')
const cfg = require('../config/db')

const MONTHS = ['2026-04', '2026-05', '2026-06']
const DRY = process.argv.includes('--dry')
const RESET = process.argv.includes('--reset')

function pad(n) { return String(n).padStart(2, '0') }
function openidFor(name) { return 'story_' + crypto.createHash('md5').update(name).digest('hex').slice(0, 16) }
function hueFor(name) { return parseInt(crypto.createHash('md5').update(name).digest('hex').slice(0, 4), 16) % 360 }

async function main() {
  const stories = MONTHS.flatMap(m => require(`./data/stories-${m}.json`))
  const authors = [...new Set(stories.map(s => s.author))]
  const c = await mysql.createConnection(cfg)
  try {
    console.log(`数据源：${MONTHS.join(', ')} → ${stories.length} 篇 / ${authors.length} 作者${DRY ? '（DRY）' : ''}${RESET ? '（RESET）' : ''}`)

    if (RESET && !DRY) {
      const sub = 'SELECT id FROM diaries WHERE created_by IN (SELECT id FROM users WHERE created_by = "seed-stories")'
      await c.query(`DELETE FROM interactions WHERE target_type = "diary" AND target_id IN (${sub})`)
      await c.query(`DELETE FROM comments WHERE diary_id IN (${sub})`)
      await c.query('DELETE FROM diaries WHERE created_by IN (SELECT id FROM users WHERE created_by = "seed-stories")')
      await c.query('DELETE FROM users WHERE created_by = "seed-stories"')
      console.log('  已清除旧 seed-stories 数据')
    }

    // 作者 → 用户（按名字哈希 upsert，跨月同名归并）
    const authorId = {}
    for (const name of authors) {
      const openid = openidFor(name)
      if (!DRY) {
        await c.query(
          `INSERT INTO users (openid, nickname, identity, avatar_hue, created_by)
           VALUES (?, ?, 'authed', ?, 'seed-stories')
           ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), avatar_hue = VALUES(avatar_hue)`,
          [openid, name.slice(0, 32), hueFor(name)]
        )
      }
      const [rows] = await c.query('SELECT id FROM users WHERE openid = ?', [openid])
      authorId[name] = rows.length ? rows[0].id : null
    }

    // 日记（幂等：user + title + 日期）
    let inserted = 0, skipped = 0
    for (let idx = 0; idx < stories.length; idx++) {
      const s = stories[idx]
      const uid = authorId[s.author]
      const title = s.title.slice(0, 60)
      const [y, m, d] = s.date.split('.').map(Number)
      const dateStr = `${y}-${pad(m)}-${pad(d)}`
      if (uid) {
        const [ex] = await c.query(
          'SELECT id FROM diaries WHERE user_id = ? AND title = ? AND DATE(created_at) = ? LIMIT 1',
          [uid, title, dateStr]
        )
        if (ex.length) { skipped++; continue }
      }
      const createdAt = `${dateStr} 12:${pad(Math.floor(idx / 60))}:${pad(idx % 60)}`
      if (!DRY) {
        await c.query(
          `INSERT INTO diaries (user_id, title, content, permission, status, created_by, created_at)
           VALUES (?, ?, ?, 'public', 'active', ?, ?)`,
          [uid, title, s.content, uid, createdAt]
        )
      }
      inserted++
    }

    // 回填作者 diary_count
    if (!DRY) {
      for (const name of authors) {
        const uid = authorId[name]
        if (!uid) continue
        await c.query(
          'UPDATE users SET diary_count = (SELECT COUNT(*) FROM diaries WHERE user_id = ? AND status = "active") WHERE id = ?',
          [uid, uid]
        )
      }
    }

    console.log(DRY
      ? `将插入 ${inserted} 篇（预览，未写库）`
      : `完成：插入 ${inserted} 篇，跳过(已存在) ${skipped} 篇；作者用户 ${authors.length} 个`)
  } finally {
    await c.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
