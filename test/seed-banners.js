// 活动页 Banner 测试数据 — 三条运营介绍类 Banner（均可点进图文详情页）
//
// ⚠️ 图片为**占位**：暂借云存储里已有的活动照片，正式使用前请在
//    管理后台「活动Banner」页逐条更换为设计好的横幅图（建议 750×340）。
//
// 用法：node test/seed-banners.js          # 幂等：按标题去重，已存在则更新内容
//       node test/seed-banners.js --clean  # 删除这三条测试 Banner
const mysql = require('mysql2/promise')
const DB = require('../config/db')

const ENV = 'cloud://cloud1-xingshu-prd-d1cev0fcca864.636c-cloud1-xingshu-prd-d1cev0fcca864-1451247102'

// 富文本片段：与小程序纸质暖色调一致（rich-text 只认内联样式）
const P = 'style="margin:0 0 24rpx;font-size:30rpx;line-height:54rpx;color:#2A2723;"'
const LEAD = 'style="margin:0 0 28rpx;font-size:32rpx;line-height:56rpx;color:#2A2723;font-weight:600;"'
const LI = 'style="margin:0 0 16rpx;font-size:30rpx;line-height:52rpx;color:#4A453E;"'
const NOTE = 'style="margin:28rpx 0 0;padding-top:20rpx;border-top:1px solid rgba(126,102,64,0.18);font-size:26rpx;line-height:46rpx;color:#7A746A;"'

const BANNERS = [
  {
    title: '醒书知行社介绍',
    image_url: `${ENV}/activities/1784394239839-172741.png`,
    sort: 1,
    content_rich: [
      `<p ${LEAD}>一个将经典落地实践的分享平台。</p>`,
      `<p ${P}>醒书知行社结合《大学》与《高效能人士的七个习惯》，把古典的修身次第与现代的效能方法放在一起读——不停留在摘抄与感慨，而是让它们从书本走进生活。</p>`,
      `<p ${P}>我们希望经典成为一份导航：向内校准心性，向外落实到每天的工作与生活里。读到的每一句，都要能对应到一件具体做得出来的事。</p>`,
      `<p ${P}>在这里，<strong>每一位同学都是醒书线下活动的创造者与共建者</strong>——不是来听课的听众，而是一起把内容做出来的人。</p>`,
      `<p ${NOTE}>知行合一，从每一次相聚开始。</p>`,
    ].join(''),
  },
  {
    title: '醒书观影会',
    image_url: `${ENV}/activity-posts/1784472327016-ruaror.jpg`,
    sort: 2,
    content_rich: [
      `<p ${LEAD}>以影像走进典籍，让文字里的人重新开口说话。</p>`,
      `<p ${P}>醒书观影会围绕《典籍里的中国》系列展开，观影后一同讨论：这一篇讲的是什么，与今天的我们又有什么关系。</p>`,
      `<p ${P}><strong>本季片单</strong></p>`,
      `<ul style="margin:0 0 24rpx;padding-left:36rpx;">`,
      `<li ${LI}>《典籍里的中国 · 尚书》</li>`,
      `<li ${LI}>《典籍里的中国 · 礼记》</li>`,
      `<li ${LI}>《典籍里的中国 · 诗经》</li>`,
      `<li ${LI}>《典籍里的中国 · 论语》</li>`,
      `</ul>`,
      `<p ${NOTE}>具体场次与报名请见活动列表。</p>`,
    ].join(''),
  },
  {
    title: '醒书故事会',
    image_url: `${ENV}/activity-posts/1784471994088-0964zk.jpg`,
    sort: 3,
    content_rich: [
      `<p ${LEAD}>每月一次，醒书同学的故事汇集线上分享会。</p>`,
      `<p ${P}>过去一个月里，你把哪一句经典真正用了出来？遇到过什么难处，又是怎么过去的？故事会就是把这些真实发生过的事讲给彼此听。</p>`,
      `<p ${P}>不需要讲得漂亮，讲得真就好。听别人的故事，往往比读十页道理更能让人动起来。</p>`,
      `<p ${NOTE}>线上进行，每月一场，场次与报名请见活动列表。</p>`,
    ].join(''),
  },
]

async function main() {
  const clean = process.argv.includes('--clean')
  const c = await mysql.createConnection(DB)
  try {
    if (clean) {
      const [r] = await c.query(
        `DELETE FROM banners WHERE title IN (${BANNERS.map(() => '?').join(',')})`,
        BANNERS.map(b => b.title))
      console.log(`已删除 ${r.affectedRows} 条测试 Banner`)
      return
    }
    for (const b of BANNERS) {
      const [exist] = await c.query('SELECT id FROM banners WHERE title = ?', [b.title])
      if (exist.length) {
        await c.query(
          `UPDATE banners SET image_url=?, link_type='detail', content_rich=?, sort=?, is_active=1,
           updated_by='seed' WHERE id=?`,
          [b.image_url, b.content_rich, b.sort, exist[0].id])
        console.log(`  · 已更新 #${exist[0].id} ${b.title}`)
      } else {
        const [r] = await c.query(
          `INSERT INTO banners (image_url, title, link_type, content_rich, sort, is_active, created_by)
           VALUES (?,?,'detail',?,?,1,'seed')`,
          [b.image_url, b.title, b.content_rich, b.sort])
        console.log(`  ✓ 已新建 #${r.insertId} ${b.title}`)
      }
    }
    console.log('\n三条测试 Banner 就绪（图片为占位，请在后台「活动Banner」页更换为设计稿）')
  } finally {
    await c.end()
  }
}

main().catch(e => { console.error('执行失败：', e.message); process.exit(1) })
