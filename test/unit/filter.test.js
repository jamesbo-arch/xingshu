// utils/filter.js 单元测试 — applyFilters 的模式预筛选、搜索、标签、作者与时间筛选
const { test } = require('node:test')
const assert = require('node:assert')
const { applyFilters } = require('../../miniprogram/utils/filter')

const pad = n => String(n).padStart(2, '0')
const ts = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 10:00`
const daysAgo = n => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return ts(d)
}

const DIARIES = [
  { id: 1, title: '晨跑记录', content: '今天跑了五公里', author: '砚秋', tags: ['运动'], permission: 'public', isFavorited: true, isMine: false, timestamp: daysAgo(0) },
  { id: 2, title: '读书笔记', content: '读完了一本小说', author: '我', tags: ['读书'], permission: 'private', isFavorited: false, isMine: true, timestamp: daysAgo(3) },
  { id: 3, title: '旅行日记', content: '去了海边', author: '陆明远', tags: ['旅行', '摄影'], permission: 'member', isFavorited: false, isMine: false, timestamp: '2025-01-15 09:00' },
  { id: 4, title: '他人私密', content: '不应出现在广场', author: '叶清和', tags: [], permission: 'private', isFavorited: true, isMine: false, timestamp: daysAgo(1) },
]

const NO_FILTERS = {}

test('square 模式排除他人私密日记，保留自己的私密日记', () => {
  const r = applyFilters(DIARIES, 'square', '', NO_FILTERS)
  const ids = r.map(d => d.id)
  assert.ok(!ids.includes(4), '他人私密日记不应出现')
  assert.ok(ids.includes(2), '自己的私密日记应保留')
})

test('collections 模式只保留已收藏', () => {
  const r = applyFilters(DIARIES, 'collections', '', NO_FILTERS)
  assert.deepStrictEqual(r.map(d => d.id), [1, 4])
})

test('mine 模式只保留自己的日记', () => {
  const r = applyFilters(DIARIES, 'mine', '', NO_FILTERS)
  assert.deepStrictEqual(r.map(d => d.id), [2])
})

test('搜索关键词匹配标题或正文', () => {
  assert.strictEqual(applyFilters(DIARIES, 'square', '晨跑', NO_FILTERS).length, 1)
  assert.strictEqual(applyFilters(DIARIES, 'square', '海边', NO_FILTERS)[0].id, 3)
  assert.strictEqual(applyFilters(DIARIES, 'square', '不存在的词', NO_FILTERS).length, 0)
})

test('标签筛选：任一标签命中即保留', () => {
  const r = applyFilters(DIARIES, 'square', '', { tags: ['摄影', '读书'] })
  assert.deepStrictEqual(r.map(d => d.id).sort(), [2, 3])
})

test('作者筛选：子串匹配', () => {
  const r = applyFilters(DIARIES, 'square', '', { author: '明远' })
  assert.deepStrictEqual(r.map(d => d.id), [3])
})

test('quick 时间筛选：today 只保留今天', () => {
  const r = applyFilters(DIARIES, 'square', '', { timeMode: 'quick', quickRange: 'today' })
  assert.deepStrictEqual(r.map(d => d.id), [1])
})

test('quick 时间筛选：week 保留最近 7 天', () => {
  const r = applyFilters(DIARIES, 'square', '', { timeMode: 'quick', quickRange: 'week' })
  assert.deepStrictEqual(r.map(d => d.id).sort(), [1, 2])
})

test('range 时间筛选：起止日期闭区间', () => {
  const r = applyFilters(DIARIES, 'square', '', { timeMode: 'range', dateFrom: '2025-01-01', dateTo: '2025-01-31' })
  assert.deepStrictEqual(r.map(d => d.id), [3])
})

test('ym 时间筛选：按年月匹配', () => {
  const r = applyFilters(DIARIES, 'square', '', { timeMode: 'ym', years: [2025], months: [1] })
  assert.deepStrictEqual(r.map(d => d.id), [3])
  const none = applyFilters(DIARIES, 'square', '', { timeMode: 'ym', years: [2020], months: [] })
  assert.strictEqual(none.length, 0)
})

test('无 timestamp 的日记在时间筛选下被排除', () => {
  const r = applyFilters([{ ...DIARIES[0], timestamp: undefined }], 'square', '', { timeMode: 'quick', quickRange: 'today' })
  assert.strictEqual(r.length, 0)
})
