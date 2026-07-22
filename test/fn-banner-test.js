// 活动页 Banner 测试 — BAN-01 ~ 09（v2.0 新增）
// 覆盖：admin CRUD + 审计、小程序端只见启用项且按 sort 排序、详情页跳转约束、ACL
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

async function run() {
  console.log('=== 活动页 Banner 测试（BAN-01~09）===\n')
  let passed = 0, failed = 0, token = null
  const created = []

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const admin = (action, payload) => callFn('admin', { action, token, payload })
  const act = (action, payload, openid = 'mock_me') => callFn('activity', { action, payload }, openid)
  const conn = await mysql.createConnection(DB)

  const login = await callFn('admin', { action: 'login', payload: { password: DB.adminPassword } })
  token = login.data.token

  let plainId, detailId, offId

  await test('BAN-01 banners 表存在且字段齐全', async () => {
    const [cols] = await conn.query('SHOW COLUMNS FROM banners')
    const names = cols.map(c => c.Field)
    for (const k of ['image_url', 'title', 'link_type', 'content_rich', 'sort', 'is_active']) {
      if (!names.includes(k)) throw new Error(`缺列 ${k}`)
    }
  })

  await test('BAN-02 新建纯展示 Banner（link_type=none）+ 审计', async () => {
    const r = await admin('bannerSave', {
      imageUrl: 'cloud://fake/banner1.jpg', title: 'test_ban 纯展示', linkType: 'none', sort: 2,
    })
    if (r.code !== 0) throw new Error(r.msg)
    plainId = r.data.id; created.push(plainId)
    const [[{ c }]] = await conn.query(
      "SELECT COUNT(*) c FROM admin_logs WHERE action='bannerCreate' AND target_id=?", [String(plainId)])
    if (!c) throw new Error('缺审计')
  })

  await test('BAN-03 选「跳详情页」但详情为空 → 拒绝', async () => {
    const r = await admin('bannerSave', {
      imageUrl: 'cloud://fake/banner2.jpg', title: 'test_ban 空详情', linkType: 'detail', contentRich: '   ',
    })
    if (r.code === 0) { created.push(r.data.id); throw new Error('空详情不应通过') }
    if (!r.msg.includes('详情内容')) throw new Error('提示不符: ' + r.msg)
  })

  await test('BAN-04 新建带详情的 Banner + 小程序可读详情', async () => {
    const r = await admin('bannerSave', {
      imageUrl: 'cloud://fake/banner3.jpg', title: 'test_ban 图文介绍',
      linkType: 'detail', contentRich: '<p>醒书线下活动介绍</p>', sort: 1,
    })
    if (r.code !== 0) throw new Error(r.msg)
    detailId = r.data.id; created.push(detailId)
    const d = await act('bannerDetail', { id: detailId })
    if (d.code !== 0) throw new Error(d.msg)
    if (d.data.contentRich !== undefined) throw new Error('小程序端字段名应为 content_rich')
    if (!d.data.content_rich.includes('醒书线下活动介绍')) throw new Error('详情内容不符')
  })

  await test('BAN-05 小程序 bannerList 只见启用项，按 sort 升序', async () => {
    const off = await admin('bannerSave', {
      imageUrl: 'cloud://fake/banner4.jpg', title: 'test_ban 已停用', linkType: 'none', sort: 0, isActive: 0,
    })
    offId = off.data.id; created.push(offId)
    const l = await act('bannerList', {})
    if (l.code !== 0) throw new Error(l.msg)
    const ids = l.data.map(b => b.id)
    if (ids.includes(offId)) throw new Error('停用项泄露到小程序')
    if (!ids.includes(plainId) || !ids.includes(detailId)) throw new Error('启用项缺失')
    // sort 小的在前：detailId(1) 应排在 plainId(2) 之前
    if (ids.indexOf(detailId) > ids.indexOf(plainId)) throw new Error('未按 sort 升序')
    // 列表不应外泄富文本（体积大且无用）
    if ('content_rich' in l.data[0]) throw new Error('列表泄露了 content_rich')
  })

  await test('BAN-06 纯展示 Banner 无详情页（bannerDetail 拒）', async () => {
    const d = await act('bannerDetail', { id: plainId })
    if (d.code === 0) throw new Error('link_type=none 不应有详情页')
  })

  await test('BAN-07 停用的 Banner 详情也不可读', async () => {
    await admin('bannerSave', {
      id: detailId, imageUrl: 'cloud://fake/banner3.jpg', title: 'test_ban 图文介绍',
      linkType: 'detail', contentRich: '<p>醒书线下活动介绍</p>', sort: 1, isActive: 0,
    })
    const d = await act('bannerDetail', { id: detailId })
    if (d.code === 0) throw new Error('停用后不应可读详情')
    // 还原
    await admin('bannerSave', {
      id: detailId, imageUrl: 'cloud://fake/banner3.jpg', title: 'test_ban 图文介绍',
      linkType: 'detail', contentRich: '<p>醒书线下活动介绍</p>', sort: 1, isActive: 1,
    })
  })

  await test('BAN-08 admin 后台列表含停用项；删除 + 审计', async () => {
    const la = await admin('bannerListAdmin', {})
    if (la.code !== 0) throw new Error(la.msg)
    if (!la.data.some(b => b.id === offId)) throw new Error('后台列表应含停用项')
    const del = await admin('bannerDelete', { id: offId })
    if (del.code !== 0) throw new Error(del.msg)
    const [[{ c }]] = await conn.query('SELECT COUNT(*) c FROM banners WHERE id = ?', [offId])
    if (c) throw new Error('删除未生效')
    const [[{ a }]] = await conn.query(
      "SELECT COUNT(*) a FROM admin_logs WHERE action='bannerDelete' AND target_id=?", [String(offId)])
    if (!a) throw new Error('缺审计')
  })

  await test('BAN-09 详情正文里的 cloud:// 配图换成可访问链接', async () => {
    // rich-text 的 <img> 渲染不了 cloud://，正文入库存 fileID、读取时服务端换链
    const fid = 'cloud://fake-env/banner-body-1.jpg'
    const r = await admin('bannerSave', {
      imageUrl: 'cloud://fake/banner9.jpg', title: 'test_ban 配图', linkType: 'detail',
      contentRich: `<p style="margin:0 0 24rpx;">图文</p><img src="${fid}" style="width:100%">`,
      sort: 9, isActive: 1,
    })
    if (r.code !== 0) throw new Error(r.msg)
    created.push(r.data.id)
    const d = await act('bannerDetail', { id: r.data.id })
    if (d.code !== 0) throw new Error(d.msg)
    const html = d.data.content_rich || ''
    if (html.includes('cloud://')) throw new Error('正文仍残留 cloud://，未换链')
    if (!html.includes('https://fake.cdn/')) throw new Error('未换成可访问链接')
    if (!html.includes('24rpx')) throw new Error('换链不应动其余样式')
  })

  // 清理
  if (created.length) {
    await conn.query(`DELETE FROM banners WHERE id IN (${created.map(() => '?').join(',')})`, created)
  }
  await conn.query("DELETE FROM admin_logs WHERE action IN ('bannerCreate','bannerUpdate','bannerDelete')")
  await conn.end()
  console.log('\n  测试数据已清理')

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
