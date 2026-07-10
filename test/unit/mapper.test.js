// utils/mapper.js 单元测试 — MySQL snake_case → 前端 camelCase 映射
const { test } = require('node:test')
const assert = require('node:assert')
const mapper = require('../../miniprogram/utils/mapper')

test('diary：数据库行映射为前端字段', () => {
  const row = {
    id: 1,
    author_name: '砚秋',
    author_identity: 'member',
    author_avatar_hue: 35,
    like_count: 12,
    fav_count: 3,
    comment_count: 5,
    share_count: 1,
    created_at: '2025-01-15 09:00:00',
  }
  const d = mapper.diary(row)
  assert.strictEqual(d.author, '砚秋')
  assert.strictEqual(d.authorIsMember, true)
  assert.strictEqual(d.avatarHue, 35)
  assert.strictEqual(d.likes, 12)
  assert.strictEqual(d.favorites, 3)
  assert.strictEqual(d.comments, 5)
  assert.strictEqual(d.shares, 1)
  assert.strictEqual(d.timestamp, '2025-01-15 09:00')  // 详情：年月日 时分
  assert.strictEqual(d.dateText, '2025-01-15')          // 海报：年月日
})

test('diary：时间按字符串字面解析（DB 已存北京时间，不做时区换算）', () => {
  const d = mapper.diary({ created_at: '2026-06-19T12:04:28.000Z' })
  assert.strictEqual(d.timestamp, '2026-06-19 12:04')  // 字面 12:04，不偏移
  assert.strictEqual(d.dateText, '2026-06-19')
})

test('diary：like_count 为 0 时不回退到 likes 字段', () => {
  const d = mapper.diary({ like_count: 0, likes: 99 })
  assert.strictEqual(d.likes, 0)
})

test('diary：非会员作者 authorIsMember 为 false', () => {
  assert.strictEqual(mapper.diary({ author_identity: 'authed' }).authorIsMember, false)
  assert.strictEqual(mapper.diary({}).authorIsMember, false)
})

test('diary：images 缺失时兜底为空数组，存在时透传', () => {
  assert.deepStrictEqual(mapper.diary({}).images, [])
  assert.deepStrictEqual(mapper.diary({ images: ['cloud://a.jpg'] }).images, ['cloud://a.jpg'])
})

test('diary：null/undefined 原样返回', () => {
  assert.strictEqual(mapper.diary(null), null)
  assert.strictEqual(mapper.diary(undefined), undefined)
})

test('user：数据库行映射为前端字段', () => {
  const u = mapper.user({
    nickname: '清逸',
    real_name: '张三',
    avatar_url: 'http://x/a.png',
    avatar_hue: 60,
    member_until: '2026-12-31',
    days_left: 180,
  })
  assert.strictEqual(u.realName, '张三')
  assert.strictEqual(u.avatarUrl, 'http://x/a.png')
  assert.strictEqual(u.avatarHue, 60)
  assert.strictEqual(u.memberUntil, '2026-12-31')
  assert.strictEqual(u.daysLeft, 180)
})

test('user：days_left 为 0 时不回退', () => {
  assert.strictEqual(mapper.user({ days_left: 0, daysLeft: 99 }).daysLeft, 0)
})

test('user：avatar_url 缺失时兜底为空字符串', () => {
  assert.strictEqual(mapper.user({}).avatarUrl, '')
})

test('comment：嵌套 replies 递归映射，time 格式化为相对时间样式', () => {
  const c = mapper.comment({
    user_name: '甲',
    user_avatar_hue: 10,
    created_at: '2025-06-01 08:00:00',
    replies: [{ user_name: '乙', created_at: '2025-06-01 09:00:00' }],
  })
  assert.strictEqual(c.user, '甲')
  assert.strictEqual(c.avatarHue, 10)
  assert.strictEqual(c.replies[0].user, '乙')
  assert.strictEqual(c.replies[0].time, '06-01 09:00')  // 久远日期 → MM-DD HH:MM
})

test('diary：created_at_text 对久远日期输出 MM-DD HH:MM', () => {
  const d = mapper.diary({ created_at: '2020-03-05 14:30:00' })
  assert.strictEqual(d.created_at_text, '03-05 14:30')
})

test('diary：created_at 为空时 created_at_text 为空字符串', () => {
  assert.strictEqual(mapper.diary({}).created_at_text, '')
})
