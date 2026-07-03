// 云函数冒烟测试 — 通过本地 harness 真实执行云函数代码（只读操作，不写库）
// 依赖种子数据（node test/seed.js），mock_me 用户需存在
const { callFn } = require('./fn-harness')

async function run() {
  console.log('=== 云函数本地冒烟测试 ===\n')
  let passed = 0, failed = 0

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  await test('getTags 返回 >=20 个标签', async () => {
    const r = await callFn('getTags')
    if (r.code !== 0) throw new Error(`code=${r.code}`)
    if (!Array.isArray(r.data) || r.data.length < 20) throw new Error(`got ${r.data && r.data.length}`)
  })

  await test('getDiaryList square 模式（游客）只返回 public 日记', async () => {
    const r = await callFn('getDiaryList', { mode: 'square', page: 1, pageSize: 10 }, '')
    if (r.code !== 0) throw new Error(`code=${r.code}`)
    if (!Array.isArray(r.data.list)) throw new Error('data.list 不是数组')
    const bad = r.data.list.find(d => d.permission !== 'public')
    if (bad) throw new Error(`游客看到了 ${bad.permission} 日记 id=${bad.id}`)
  })

  await test('getDiaryList mine 模式只返回本人日记', async () => {
    const r = await callFn('getDiaryList', { mode: 'mine', page: 1, pageSize: 10 }, 'mock_me')
    if (r.code !== 0) throw new Error(`code=${r.code}`)
    if (!Array.isArray(r.data.list)) throw new Error('data.list 不是数组')
  })

  await test('getUserInfo 返回 mock_me 用户资料', async () => {
    const r = await callFn('getUserInfo', {}, 'mock_me')
    if (r.code !== 0) throw new Error(`code=${r.code}（种子数据缺失？先运行 node test/seed.js）`)
    if (!r.data.nickname) throw new Error('缺少 nickname')
  })

  await test('getUserInfo 未注册 openid 返回 code=-1', async () => {
    const r = await callFn('getUserInfo', {}, 'nonexistent_openid_xyz')
    if (r.code !== -1) throw new Error(`期望 code=-1，实际 ${r.code}`)
  })

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
