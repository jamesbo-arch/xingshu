// utils/cache.js 单元测试 — TTL 缓存封装（mock 全局 wx 存储 API）
const { test, beforeEach } = require('node:test')
const assert = require('node:assert')

const store = new Map()
global.wx = {
  setStorageSync: (k, v) => store.set(k, v),
  getStorageSync: k => (store.has(k) ? store.get(k) : ''),
  removeStorageSync: k => store.delete(k),
}

const cache = require('../../miniprogram/utils/cache')

beforeEach(() => store.clear())

test('set 后未过期可 get 到原值', () => {
  cache.set('k', { a: 1 }, 10)
  assert.deepStrictEqual(cache.get('k'), { a: 1 })
})

test('过期后 get 返回 null', () => {
  cache.set('k', 'v', 10)
  const raw = store.get('xs_cache:k')
  raw.expires = Date.now() - 1
  assert.strictEqual(cache.get('k'), null)
})

test('不存在的 key 返回 null', () => {
  assert.strictEqual(cache.get('nope'), null)
})

test('remove 后返回 null', () => {
  cache.set('k', 'v', 10)
  cache.remove('k')
  assert.strictEqual(cache.get('k'), null)
})

test('存储异常静默降级', () => {
  const orig = global.wx.setStorageSync
  global.wx.setStorageSync = () => { throw new Error('quota exceeded') }
  assert.doesNotThrow(() => cache.set('k', 'v', 10))
  assert.strictEqual(cache.get('k'), null)
  global.wx.setStorageSync = orig
})

test('key 带统一前缀，避免污染业务存储', () => {
  cache.set('k', 'v', 10)
  assert.ok(store.has('xs_cache:k'))
})
