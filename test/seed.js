// 种子数据脚本 — 将 mock.js 数据写入 MySQL
const mysql = require('mysql2/promise')

const DB = require('../config/db')

const USERS = [
  { openid: 'mock_yanqiu',    nickname: '砚秋',   avatarHue: 35,  identity: 'member' },
  { openid: 'mock_luminyuan', nickname: '陆明远', avatarHue: 200, identity: 'member' },
  { openid: 'mock_yeqinghe',  nickname: '叶清和', avatarHue: 280, identity: 'member' },
  { openid: 'mock_linzhiwei', nickname: '林知微', avatarHue: 15,  identity: 'authed' },
  { openid: 'mock_me',        nickname: '清逸',   avatarHue: 60,  identity: 'authed' },
  { openid: 'mock_sujingxing',nickname: '苏景行', avatarHue: 100, identity: 'member' },
  { openid: 'mock_hehuaijin', nickname: '何怀瑾', avatarHue: 240, identity: 'authed' },
]

const TAGS = [
  '积极主动', '以终为始', '要事第一', '双赢思维',
  '移情聆听', '统合综效', '知止有定', '修身为本',
  '格物致知', '君子慎独', '诚中形外', '十目所视',
  '有斐君子', '克明峻德', '日新又新', '听讼无讼',
  '正心修身', '絜矩之道', '生财有道', '以义为利',
]

const DIARIES = [
  { author: 'mock_yanqiu',     title: '晨起读《大学》三十分钟',   content: '今日五点半起床，泡一壶老白茶，翻开《大学》。\n\n"知止而后有定，定而后能静，静而后能安，安而后能虑，虑而后能得"。每读一次，体会更深一层。今日所悟：知止，并非止步不前，而是知所止——明确边界与方向。心若无止，则终日逐物，劳而无功。\n\n记下三件今日要事：写完季度复盘、与父母通话、整理书柜。先做要紧不紧急之事。', permission: 'public',  tags: ['修身为本','知止有定','要事第一'], likes: 48,  favorites: 12, comments: 6,  createdAt: '2026-05-14 06:42:00' },
  { author: 'mock_luminyuan',  title: '与同事一次艰难的谈话',     content: '今天和团队成员谈绩效问题。本想直接指出问题，但提醒自己——先理解，再被理解。\n\n听他讲了二十分钟，了解到家中情况的变化。后面的对话变得顺畅许多。最终我们一起制定了下一阶段的目标。\n\n移情聆听不是技巧，是修养。', permission: 'member', tags: ['移情聆听','双赢思维'], likes: 124, favorites: 38, comments: 21, createdAt: '2026-05-13 22:18:00' },
  { author: 'mock_yeqinghe',   title: '关于"慎独"的一点思考',   content: '《中庸》言："君子慎其独也"。独处时所为，最见心性。今日独自在家，本想刷一晚短视频，转念把手机放进抽屉，读完了搁置许久的《明史纪事本末》第三卷。\n\n慎独不在大事，而在不被看见的小事里。', permission: 'member', tags: ['君子慎独','修身为本'], likes: 86,  favorites: 24, comments: 11, createdAt: '2026-05-12 23:05:00' },
  { author: 'mock_linzhiwei',  title: '今日的复盘与明日的清单',   content: '日新又新——这是今天反复想到的四个字。每一天若不是新的，便是浪费的。\n\n复盘今日：上午写作两小时（达标）、下午会议偏多（待优化）、晚间陪孩子读书四十分钟（满意）。\n\n明日要事：① 完成提案初稿 ② 跑步五公里 ③ 给久未联系的老友打电话。', permission: 'public',  tags: ['日新又新','要事第一'], likes: 32,  favorites: 9,  comments: 3,  createdAt: '2026-05-11 21:30:00' },
  { author: 'mock_me',         title: '私密 · 关于父亲的一段记忆', content: '只写给自己看。\n\n父亲今天来电话，说院里的桂花树开了。', permission: 'private', tags: ['诚中形外'], likes: 0,   favorites: 0,  comments: 0,  createdAt: '2026-05-10 19:00:00' },
  { author: 'mock_sujingxing', title: '生财有道，先义而后利',     content: '《大学》后篇专论"生财之大道"。生之者众，食之者寡，为之者疾，用之者舒，则财恒足矣。\n\n创业八年，越来越觉得：长久的利，必先源于义。短期的取巧，往往是长期的损失。', permission: 'public',  tags: ['生财有道','以义为利'], likes: 215, favorites: 67, comments: 38, createdAt: '2026-05-09 15:40:00' },
  { author: 'mock_hehuaijin',  title: '统合综效 · 一次跨部门协作', content: '今天主持的项目协调会，财务、技术、市场三方意见相左。会前我做了一件事：把每个部门的核心诉求各自梳理一遍，会上请他们先听对方，再讲自己。\n\n一加一不是二，是三、是更多——这便是统合综效。', permission: 'public',  tags: ['统合综效','双赢思维'], likes: 67,  favorites: 18, comments: 7,  createdAt: '2026-05-08 18:12:00' },
  { author: 'mock_yanqiu',     title: '格物致知 · 一杯茶的滋味', content: '友人寄来一饼老白茶，我连泡了七道，每一道留心其香、其色、其韵。\n\n格物，是细察万物之理；致知，是由物及心。一杯茶里有四季，也有节制与丰饶之道。', permission: 'public',  tags: ['格物致知'], likes: 54,  favorites: 16, comments: 4,  createdAt: '2026-05-07 10:25:00' },
]

async function seed() {
  const db = await mysql.createConnection(DB)
  console.log('连接数据库成功\n')

  // 1. 插入标签（忽略重复）
  console.log('[1/4] 写入标签...')
  for (const name of TAGS) {
    await db.query(
      'INSERT IGNORE INTO tags (name, created_by) VALUES (?, ?)',
      [name, 'seed']
    )
  }
  console.log(`  ✓ ${TAGS.length} 个标签`)

  // 2. 插入用户
  console.log('[2/4] 写入用户...')
  const userIdMap = {}
  for (const u of USERS) {
    const [existing] = await db.query('SELECT id FROM users WHERE openid=?', [u.openid])
    if (existing.length > 0) {
      userIdMap[u.openid] = existing[0].id
      console.log(`  ↩ ${u.nickname} 已存在`)
      continue
    }
    const [r] = await db.query(
      `INSERT INTO users (openid, nickname, identity, avatar_hue, created_by, registered_at, last_active)
       VALUES (?, ?, ?, ?, 'seed', NOW(), NOW())`,
      [u.openid, u.nickname, u.identity, u.avatarHue]
    )
    userIdMap[u.openid] = r.insertId
    console.log(`  ✓ ${u.nickname} (id=${r.insertId})`)
  }

  // 3. 读取标签 id 映射
  const [tagRows] = await db.query('SELECT id, name FROM tags')
  const tagIdMap = {}
  for (const row of tagRows) tagIdMap[row.name] = row.id

  // 4. 插入日记 + diary_tags
  console.log('[3/4] 写入日记...')
  const diaryIds = []
  for (const d of DIARIES) {
    const userId = userIdMap[d.author]
    const [r] = await db.query(
      `INSERT INTO diaries (user_id, title, content, permission, like_count, fav_count, comment_count, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, d.title, d.content, d.permission, d.likes, d.favorites, d.comments, userId, d.createdAt, d.createdAt]
    )
    const diaryId = r.insertId
    diaryIds.push(diaryId)

    for (const tagName of d.tags) {
      const tagId = tagIdMap[tagName]
      if (tagId) {
        await db.query(
          'INSERT IGNORE INTO diary_tags (diary_id, tag_id, created_by) VALUES (?, ?, ?)',
          [diaryId, tagId, userId]
        )
        await db.query('UPDATE tags SET usage_count = usage_count + 1 WHERE id=?', [tagId])
      }
    }
    console.log(`  ✓ 《${d.title}》(id=${diaryId})`)
  }

  // 5. 更新用户日记计数
  console.log('[4/4] 更新用户日记计数...')
  for (const openid of Object.keys(userIdMap)) {
    const uid = userIdMap[openid]
    await db.query(
      'UPDATE users SET diary_count = (SELECT COUNT(*) FROM diaries WHERE user_id=? AND status="active") WHERE id=?',
      [uid, uid]
    )
  }

  // 6. 插入评论（日记1的评论）
  const diary1Id = diaryIds[0]
  const comment1UserId = userIdMap['mock_luminyuan']
  const [c1] = await db.query(
    'INSERT INTO comments (user_id, diary_id, content, created_by, created_at) VALUES (?, ?, ?, ?, ?)',
    [comment1UserId, diary1Id, '"虑而后能得"——今天读到这里也停了很久。', comment1UserId, '2026-05-14 08:30:00']
  )
  await db.query(
    'INSERT INTO comments (user_id, diary_id, parent_id, content, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userIdMap['mock_yanqiu'], diary1Id, c1.insertId, '同道。共勉。', userIdMap['mock_yanqiu'], '2026-05-14 09:15:00']
  )
  await db.query(
    'INSERT INTO comments (user_id, diary_id, content, created_by, created_at) VALUES (?, ?, ?, ?, ?)',
    [userIdMap['mock_yeqinghe'], diary1Id, '请问砚秋老师，老白茶是哪个山头的？', userIdMap['mock_yeqinghe'], '2026-05-14 10:00:00']
  )
  console.log('  ✓ 3 条评论')

  console.log('\n=== 种子数据写入完成 ===')
  await db.end()
}

seed().catch(e => { console.error(e); process.exit(1) })
