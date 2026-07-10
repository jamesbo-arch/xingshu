// utils/optimistic.js 纯函数单测 — 乐观更新的状态翻转（幂等、计数不为负）
const { test } = require('node:test')
const assert = require('node:assert')
const { setLiked, setFaved } = require('../../miniprogram/utils/optimistic')

const LIST = [
  { id: 1, isLiked: false, likes: 3, isFavorited: true, favorites: 2 },
  { id: 2, isLiked: true, likes: 1, isFavorited: false, favorites: 0 },
]

test('setLiked：翻转目标卡片并 ±1，其他卡片不动', () => {
  const r = setLiked(LIST, 1, true)
  assert.strictEqual(r[0].isLiked, true)
  assert.strictEqual(r[0].likes, 4)
  assert.strictEqual(r[1], LIST[1]) // 引用不变
})

test('setLiked：已是目标态则幂等（计数不重复加减）', () => {
  const r = setLiked(LIST, 2, true)
  assert.strictEqual(r[1].likes, 1)
})

test('setLiked：取消点赞计数不为负', () => {
  const r = setLiked([{ id: 3, isLiked: true, likes: 0 }], 3, false)
  assert.strictEqual(r[0].likes, 0)
})

test('setFaved：翻转收藏态与计数', () => {
  const r = setFaved(LIST, 1, false)
  assert.strictEqual(r[0].isFavorited, false)
  assert.strictEqual(r[0].favorites, 1)
})

test('setFaved：favorites 缺失时按 0 起算', () => {
  const r = setFaved([{ id: 4, isFavorited: false }], 4, true)
  assert.strictEqual(r[0].favorites, 1)
})
