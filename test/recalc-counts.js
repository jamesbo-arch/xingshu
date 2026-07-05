// 校准日记计数器 — 把 diaries 表的 like_count/fav_count/comment_count/share_count
// 按 interactions / comments 的实际行数回填，消除种子/历史造成的"虚高"数字。
//
// 计数口径（与云函数保持一致）：
//   like_count    = interactions 中 action='like'     的行数
//   fav_count     = interactions 中 action='favorite' 的行数
//   comment_count = comments 中未删除的一级评论（parent_id IS NULL）行数
//   share_count   = interactions 中 action='share'    的行数
//
// 用法：node test/recalc-counts.js         预览差异，不写库
//       node test/recalc-counts.js --apply 实际写库
const mysql = require('mysql2/promise')
const cfg = require('../config/db')

const apply = process.argv.includes('--apply')

async function main() {
  const c = await mysql.createConnection(cfg)
  try {
    const [diaries] = await c.query(
      'SELECT id, title, like_count, fav_count, comment_count, share_count FROM diaries'
    )
    let changed = 0
    for (const d of diaries) {
      const [[lk]] = await c.query(
        "SELECT COUNT(*) n FROM interactions WHERE target_type='diary' AND target_id=? AND action='like'", [d.id])
      const [[fv]] = await c.query(
        "SELECT COUNT(*) n FROM interactions WHERE target_type='diary' AND target_id=? AND action='favorite'", [d.id])
      const [[sh]] = await c.query(
        "SELECT COUNT(*) n FROM interactions WHERE target_type='diary' AND target_id=? AND action='share'", [d.id])
      const [[cm]] = await c.query(
        "SELECT COUNT(*) n FROM comments WHERE diary_id=? AND is_deleted=0 AND parent_id IS NULL", [d.id])

      const next = { like_count: lk.n, fav_count: fv.n, comment_count: cm.n, share_count: sh.n }
      const diff = ['like_count', 'fav_count', 'comment_count', 'share_count'].some(k => d[k] !== next[k])
      if (!diff) continue
      changed++
      console.log(`#${d.id} ${d.title}`)
      console.log(`   赞 ${d.like_count}→${next.like_count}  藏 ${d.fav_count}→${next.fav_count}  ` +
                  `评 ${d.comment_count}→${next.comment_count}  享 ${d.share_count}→${next.share_count}`)
      if (apply) {
        await c.query(
          'UPDATE diaries SET like_count=?, fav_count=?, comment_count=?, share_count=? WHERE id=?',
          [next.like_count, next.fav_count, next.comment_count, next.share_count, d.id])
      }
    }
    console.log('')
    if (!changed) console.log('所有计数器均已与实际数据一致，无需校准。')
    else console.log(apply ? `已校准 ${changed} 篇日记的计数器。` : `${changed} 篇日记计数器与实际不符（上为预览，加 --apply 写库）。`)
  } finally {
    await c.end()
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
