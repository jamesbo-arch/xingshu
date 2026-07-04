// utils/guard.js 单元测试 — 防连点（lock 异步防重 / throttle 同步防连点）
const { test } = require('node:test')
const assert = require('node:assert')

const { lock, throttle } = require('../../miniprogram/utils/guard')

test('lock：进行中重复触发被忽略，仅执行一次', async () => {
  const ctx = {}
  let calls = 0
  let release
  const task = () => new Promise(r => { calls++; release = r })
  // 首次触发进入 in-flight，第二次在完成前触发应被忽略
  const p1 = lock(ctx, 'submit', task)
  const p2 = lock(ctx, 'submit', task)
  assert.strictEqual(calls, 1)
  release()
  await Promise.all([p1, p2])
  assert.strictEqual(calls, 1)
})

test('lock：完成后可再次触发', async () => {
  const ctx = {}
  let calls = 0
  const task = async () => { calls++ }
  await lock(ctx, 'submit', task)
  await lock(ctx, 'submit', task)
  assert.strictEqual(calls, 2)
})

test('lock：不同 key 互不影响', async () => {
  const ctx = {}
  let a = 0, b = 0
  await Promise.all([
    lock(ctx, 'a', async () => { a++ }),
    lock(ctx, 'b', async () => { b++ }),
  ])
  assert.strictEqual(a, 1)
  assert.strictEqual(b, 1)
})

test('lock：task 抛错后锁被释放，可再次触发', async () => {
  const ctx = {}
  let calls = 0
  await assert.rejects(lock(ctx, 'k', async () => { calls++; throw new Error('boom') }))
  await lock(ctx, 'k', async () => { calls++ })
  assert.strictEqual(calls, 2)
})

test('throttle：cooldown 内重复触发被忽略', () => {
  const ctx = {}
  let calls = 0
  const fn = () => { calls++ }
  throttle(ctx, 'nav', fn, 600)
  throttle(ctx, 'nav', fn, 600)
  assert.strictEqual(calls, 1)
})

test('throttle：超过 cooldown 后可再次触发', () => {
  const ctx = {}
  let calls = 0
  const fn = () => { calls++ }
  throttle(ctx, 'nav', fn, 10)
  // 手动把上次时间戳回拨到 cooldown 之前，模拟已过冷却
  ctx._throttle.nav = Date.now() - 20
  throttle(ctx, 'nav', fn, 10)
  assert.strictEqual(calls, 2)
})

test('throttle：不同 key 互不影响', () => {
  const ctx = {}
  let calls = 0
  throttle(ctx, 'open', () => { calls++ })
  throttle(ctx, 'edit', () => { calls++ })
  assert.strictEqual(calls, 2)
})
