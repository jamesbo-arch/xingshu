// 将《醒记故事汇 2026.6》（doc/醒记故事汇 2026.6 按作者排序.docx 解析所得）初始化入库。
// 数据源：test/data/stories-2026-06.json（[{author,title,date,content}...]，共 97 篇 / 16 作者）。
//
// 作者 → 展示型种子用户（合成 openid `story_author_<i>`，非真实微信账号，identity=authed）。
// 日记：permission=public、status=active、created_at 取自各篇日期（同日按收录顺序加秒保序）。
// 计数器 like/fav/comment/share 全 0（真实统计，不造假）。
//
// 幂等：作者按 openid upsert；日记「同作者+同标题」已存在则跳过——可安全重复运行。
// 用法：node test/seed-stories.js            实际写库
//       node test/seed-stories.js --dry      仅预览，不写库
const mysql = require('mysql2/promise')
const cfg = require('../config/db')
const stories = require('./data/stories-2026-06.json')

const DRY = process.argv.includes('--dry')

function pad(n) { return String(n).padStart(2, '0') }
// 作者头像色相分散到暖土色系（与 utils/color.hueToColor 一致的取色区间）
function hueFor(i) { return (i * 53 + 20) % 360 }

async function main() {
  const c = await mysql.createConnection(cfg)
  try {
    const authors = [...new Set(stories.map(s => s.author))]
    console.log(`数据源：${stories.length} 篇 / ${authors.length} 作者${DRY ? '（DRY 预览）' : ''}`)

    // 1) 作者 → 用户（upsert）
    const authorId = {}
    for (let i = 0; i < authors.length; i++) {
      const name = authors[i]
      const openid = 'story_author_' + i
      if (!DRY) {
        await c.query(
          `INSERT INTO users (openid, nickname, identity, avatar_hue, created_by)
           VALUES (?, ?, 'authed', ?, 'seed-stories')
           ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), avatar_hue = VALUES(avatar_hue)`,
          [openid, name.slice(0, 32), hueFor(i)]
        )
      }
      const [rows] = await c.query('SELECT id FROM users WHERE openid = ?', [openid])
      authorId[name] = rows.length ? rows[0].id : null
    }

    // 2) 日记（幂等插入）
    let inserted = 0, skipped = 0
    for (let idx = 0; idx < stories.length; idx++) {
      const s = stories[idx]
      const uid = authorId[s.author]
      const title = s.title.slice(0, 60)
      if (uid) {
        const [ex] = await c.query(
          'SELECT id FROM diaries WHERE user_id = ? AND title = ? LIMIT 1', [uid, title]
        )
        if (ex.length) { skipped++; continue }
      }
      const [y, m, d] = s.date.split('.').map(Number)
      // 同日按收录顺序加秒，保证 created_at 稳定可排序
      const createdAt = `${y}-${pad(m)}-${pad(d)} 12:${pad(Math.floor(idx / 60))}:${pad(idx % 60)}`
      if (!DRY) {
        await c.query(
          `INSERT INTO diaries (user_id, title, content, permission, status, created_by, created_at)
           VALUES (?, ?, ?, 'public', 'active', ?, ?)`,
          [uid, title, s.content, uid, createdAt]
        )
      }
      inserted++
    }

    // 3) 回填作者 diary_count
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
