// 活动分类体系测试 — TYPE-A01 ~ A09（活动分类表/关联/筛选/停用）
// 测试类型以 test_ 前缀创建，测试活动以 test_ 前缀创建，结束时硬删
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

async function run() {
  console.log('=== 活动分类体系测试（TYPE-A01~A09）===\n')
  let passed = 0, failed = 0, token = null
  const createdActs = [], createdTypes = []

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const act = (action, payload, openid = 'mock_me') => callFn('activity', { action, payload }, openid)
  const admin = (action, payload) => callFn('admin', { action, token, payload })
  const conn = await mysql.createConnection(DB)

  const login = await callFn('admin', { action: 'login', payload: { password: DB.adminPassword } })
  token = login.data.token

  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 19).replace('T', ' ')
  const futureDeadline = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 19).replace('T', ' ')
  async function makeActivity(patch = {}) {
    const r = await admin('activitySave', {
      title: 'test_类型活动' + Math.random().toString(36).slice(2, 6),
      content: '测试', images: [],
      start_time: future, signup_deadline: futureDeadline,
      type: 'offline', city: '广州', location: '测试地点',
      capacity: 3, status: 'online', ...patch,
    })
    if (r.code !== 0) throw new Error('前置建活动失败: ' + r.msg)
    createdActs.push(r.data.id)
    return r.data.id
  }

  await test('TYPE-A01 activity_types 表存在且种子 6 条（渠道正确）', async () => {
    // created_by 已改存用户 id（种子为 NULL），种子 6 类按固定名称集识别
    const [rows] = await conn.query(
      "SELECT name, channel FROM activity_types WHERE name IN ('月度故事会','醒书咖啡','线下观影会','线下故事会','巧克力工坊','醒书厨房') ORDER BY sort")
    if (rows.length !== 6) throw new Error(`种子=${rows.length} 条`)
    const expect = {
      '月度故事会': 'online', '醒书咖啡': 'online',
      '线下观影会': 'offline', '线下故事会': 'offline', '巧克力工坊': 'offline', '醒书厨房': 'offline',
    }
    for (const r of rows) {
      if (expect[r.name] !== r.channel) throw new Error(`${r.name} 渠道=${r.channel}`)
    }
  })

  await test('TYPE-A02 小程序 typeList 仅返回启用项且按 sort 排序', async () => {
    const r = await act('typeList')
    if (r.code !== 0) throw new Error(r.msg)
    if (!Array.isArray(r.data) || r.data.length < 6) throw new Error(`返回 ${r.data && r.data.length} 条`)
    for (const t of r.data) {
      for (const k of ['id', 'name', 'channel', 'schedule_hint']) {
        if (!(k in t)) throw new Error(`缺字段 ${k}`)
      }
    }
    const sorts = r.data.map(t => t.id)
    const [dbRows] = await conn.query('SELECT id FROM activity_types WHERE is_active=1 ORDER BY sort, id')
    if (JSON.stringify(sorts) !== JSON.stringify(dbRows.map(x => x.id))) throw new Error('排序不符')
  })

  let typeId
  await test('TYPE-A03 admin typeSave 新建/编辑 + 审计', async () => {
    const r = await admin('typeSave', { name: 'test_晨读会', channel: 'online', schedule_hint: '每天 7:00', sort: 99 })
    if (r.code !== 0) throw new Error(r.msg)
    typeId = r.data.id
    createdTypes.push(typeId)
    const upd = await admin('typeSave', { id: typeId, name: 'test_晨读会', channel: 'online', schedule_hint: '每天 7:30', sort: 98, is_active: 1 })
    if (upd.code !== 0) throw new Error(upd.msg)
    const [[row]] = await conn.query('SELECT schedule_hint, sort FROM activity_types WHERE id=?', [typeId])
    if (row.schedule_hint !== '每天 7:30' || row.sort !== 98) throw new Error('编辑未生效')
    const [[{ c }]] = await conn.query("SELECT COUNT(*) c FROM admin_logs WHERE action IN ('typeCreate','typeUpdate') AND target_id=?", [String(typeId)])
    if (c < 2) throw new Error(`审计条数=${c}`)
  })

  await test('TYPE-A04 停用后小程序 typeList 不含、admin typeList 仍含', async () => {
    const r = await admin('typeSave', { id: typeId, name: 'test_晨读会', channel: 'online', schedule_hint: '每天 7:30', sort: 98, is_active: 0 })
    if (r.code !== 0) throw new Error(r.msg)
    const mini = await act('typeList')
    if (mini.data.some(t => t.id === typeId)) throw new Error('停用项泄露到小程序')
    const adm = await admin('typeList')
    if (adm.code !== 0) throw new Error(adm.msg)
    const found = adm.data.find(t => t.id === typeId)
    if (!found || found.is_active !== 0) throw new Error('admin 全量列表缺停用项')
  })

  let onlineTypeId, actWithType
  await test('TYPE-A05 activitySave 带 type_id → type 被 channel 覆写；list/detail 带类型', async () => {
    const [[t]] = await conn.query("SELECT id FROM activity_types WHERE name='月度故事会'")
    onlineTypeId = t.id
    // 故意提交 type:'offline'，应被 online 类型覆写
    actWithType = await makeActivity({ type_id: onlineTypeId, type: 'offline' })
    const [[a]] = await conn.query('SELECT type, type_id FROM activities WHERE id=?', [actWithType])
    if (a.type !== 'online' || a.type_id !== onlineTypeId) throw new Error(`type=${a.type} type_id=${a.type_id}`)
    const l = await act('list')
    const row = l.data.upcoming.find(x => x.id === actWithType)
    if (!row || row.type_id !== onlineTypeId || row.type_name !== '月度故事会') throw new Error('list 未带类型')
    const d = await act('detail', { id: actWithType })
    if (d.data.type_name !== '月度故事会' || !('schedule_hint' in d.data)) throw new Error('detail 未带类型')
  })

  await test('TYPE-A06 activitySave 传不存在的 type_id → 报错', async () => {
    const r = await admin('activitySave', {
      title: 'test_坏类型', start_time: future, type: 'offline', status: 'draft', type_id: 999999,
    })
    if (r.code === 0) { createdActs.push(r.data.id); throw new Error('不存在的类型不应通过') }
  })

  await test('TYPE-A07 list 按 typeId 筛选', async () => {
    const [[t2]] = await conn.query("SELECT id FROM activity_types WHERE name='醒书咖啡'")
    const other = await makeActivity({ type_id: t2.id })
    const r = await act('list', { typeId: onlineTypeId })
    const ids = [...r.data.upcoming, ...r.data.past].map(a => a.id)
    if (!ids.includes(actWithType)) throw new Error('目标类型活动缺失')
    if (ids.includes(other)) throw new Error('其他类型活动混入')
  })

  await test('TYPE-A08 停用类型的历史活动 detail 仍带 type_name', async () => {
    // 用 test_晨读会（已停用）关联一个活动：先临时启用建活动，再停用
    await admin('typeSave', { id: typeId, name: 'test_晨读会', channel: 'online', schedule_hint: '', sort: 98, is_active: 1 })
    const aid = await makeActivity({ type_id: typeId })
    await admin('typeSave', { id: typeId, name: 'test_晨读会', channel: 'online', schedule_hint: '', sort: 98, is_active: 0 })
    const d = await act('detail', { id: aid })
    if (d.data.type_name !== 'test_晨读会') throw new Error(`type_name=${d.data.type_name}`)
  })

  await test('TYPE-A09 activitySave 不传 type_id（历史路径）仍可用', async () => {
    const aid = await makeActivity({ type: 'online' })
    const [[a]] = await conn.query('SELECT type, type_id FROM activities WHERE id=?', [aid])
    if (a.type !== 'online' || a.type_id !== null) throw new Error(`type=${a.type} type_id=${a.type_id}`)
  })

  // 清理
  if (createdActs.length) {
    await conn.query(`DELETE FROM activity_signups WHERE activity_id IN (${createdActs.map(() => '?').join(',')})`, createdActs)
    await conn.query(`DELETE FROM activities WHERE id IN (${createdActs.map(() => '?').join(',')})`, createdActs)
  }
  await conn.query("DELETE FROM activity_types WHERE name LIKE 'test_%'")
  await conn.query("DELETE FROM admin_logs WHERE action IN ('activityCreate','activityUpdate','typeCreate','typeUpdate')")
  console.log('\n  测试数据已清理')
  await conn.end()

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
