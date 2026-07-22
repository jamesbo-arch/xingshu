// admin 多运营角色权限测试 — 双模式登录、scrypt 密码、ACL 矩阵、活动 owner 数据范围、
// 账号 CRUD、工作人员白名单、token 兼容、审计操作者（测试数据自动清理）
const mysql = require('mysql2/promise')
const DB = require('../config/db')
const { callFn } = require('./fn-harness')

const P = 'test_roles_'          // 测试数据前缀
const PWD = 'pass-123456'

async function run() {
  console.log('=== admin 多角色权限测试 ===\n')
  let passed = 0, failed = 0
  const conn = await mysql.createConnection(DB)

  async function test(name, fn) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++ }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++ }
  }

  const login = payload => callFn('admin', { action: 'login', payload })
  const admin = (token, action, payload) => callFn('admin', { action, token, payload })

  // ── 造数：会员 A（活动账号绑定）、会员 B（活动 Y 主理人）、活动 X（owner=A）/ Y（owner=B）──
  const [ra] = await conn.query(
    `INSERT INTO users (openid, nickname, identity) VALUES (?, ?, 'authed')`, [P + 'owner_a', P + 'A'])
  const userA = ra.insertId
  const [rb] = await conn.query(
    `INSERT INTO users (openid, nickname, identity) VALUES (?, ?, 'authed')`, [P + 'owner_b', P + 'B'])
  const userB = rb.insertId
  const [rx] = await conn.query(
    `INSERT INTO activities (title, start_time, status, owner_user_id) VALUES (?, NOW(), 'online', ?)`,
    [P + 'X', userA])
  const actX = rx.insertId
  const [ry] = await conn.query(
    `INSERT INTO activities (title, start_time, status, owner_user_id) VALUES (?, NOW(), 'online', ?)`,
    [P + 'Y', userB])
  const actY = ry.insertId

  let superToken = null
  const tokens = {}          // role → token
  const accountIds = {}      // role → admin_accounts.id
  const phones = { content: '19900000001', activity: '19900000002', member: '19900000003' }
  const createdActs = []     // 测试中新建的活动，清理用

  try {
    await test('超管密码登录（旧路径回归）→ 三段式 token', async () => {
      const r = await login({ password: DB.adminPassword })
      if (r.code !== 0) throw new Error(r.msg)
      superToken = r.data.token
      if (superToken.split('.').length !== 3) throw new Error('token 应为三段式')
      if (r.data.role !== 'super') throw new Error('超管 role 应为 super')
    })

    await test('accountSave 建三角色账号（activity 绑定会员 A），哈希为 scrypt$ 格式', async () => {
      for (const role of ['content', 'activity', 'member']) {
        const r = await admin(superToken, 'accountSave', {
          name: P + role, phone: phones[role], role, password: PWD,
          userId: role === 'activity' ? userA : null,
        })
        if (r.code !== 0) throw new Error(`${role}: ${r.msg}`)
        accountIds[role] = r.data.id
      }
      const [[row]] = await conn.query('SELECT password_hash FROM admin_accounts WHERE id = ?', [accountIds.content])
      if (!row.password_hash.startsWith('scrypt$')) throw new Error('哈希格式非 scrypt$：' + row.password_hash.slice(0, 12))
    })

    await test('accountSave 校验：手机号重复拒、activity 缺 userId 拒、短密码拒', async () => {
      let r = await admin(superToken, 'accountSave', { name: 'x', phone: phones.content, role: 'content', password: PWD })
      if (r.code === 0) throw new Error('重复手机号不应成功')
      r = await admin(superToken, 'accountSave', { name: 'x', phone: '19900000009', role: 'activity', password: PWD })
      if (r.code === 0) throw new Error('activity 缺 userId 不应成功')
      r = await admin(superToken, 'accountSave', { name: 'x', phone: '19900000008', role: 'content', password: '123' })
      if (r.code === 0) throw new Error('短密码不应成功')
    })

    await test('手机号+密码登录成功；错密码拒', async () => {
      for (const role of ['content', 'activity', 'member']) {
        const r = await login({ phone: phones[role], password: PWD })
        if (r.code !== 0) throw new Error(`${role}: ${r.msg}`)
        if (r.data.role !== role) throw new Error(`期望 role=${role}，实际 ${r.data.role}`)
        tokens[role] = r.data.token
      }
      const bad = await login({ phone: phones.content, password: 'wrong-pass' })
      if (bad.code === 0) throw new Error('错密码不应登录成功')
    })

    await test('ACL 拒绝：content→orderList / member→refundOrder / activity→typeSave / 非超管→accountList 均 -403', async () => {
      const cases = [
        [tokens.content, 'orderList'], [tokens.content, 'accountList'],
        [tokens.member, 'refundOrder'], [tokens.member, 'deleteStory'],
        [tokens.activity, 'typeSave'], [tokens.activity, 'users'],
        // v2.0：问答属内容运营、Banner 属活动运营，互相越界须拒
        [tokens.activity, 'questionList'], [tokens.activity, 'qaFeaturedAdd'],
        [tokens.content, 'bannerListAdmin'], [tokens.member, 'questionList'],
      ]
      for (const [tk, action] of cases) {
        const r = await admin(tk, action, {})
        if (r.code !== -403) throw new Error(`${action} 期望 -403，实际 ${r.code}`)
      }
    })

    await test('ACL 放行：content→stories/featuredList、member→orderList、activity→typeList', async () => {
      for (const [tk, action] of [
        [tokens.content, 'stories'], [tokens.content, 'featuredList'],
        [tokens.member, 'orderList'], [tokens.activity, 'typeList'],
        // v2.0 新增：问答归内容运营、Banner 归活动运营
        [tokens.content, 'questionList'], [tokens.activity, 'bannerListAdmin'],
      ]) {
        const r = await admin(tk, action, {})
        if (r.code !== 0) throw new Error(`${action}: ${r.msg}`)
      }
    })

    await test('多角色账号：content+member 双角色同时可访问故事与订单，仍拒退费', async () => {
      const r = await admin(superToken, 'accountSave', {
        name: P + 'multi', phone: '19900000004', roles: ['member', 'content'], password: PWD })
      if (r.code !== 0) throw new Error(r.msg)
      accountIds.multi = r.data.id
      const lg = await login({ phone: '19900000004', password: PWD })
      if (lg.code !== 0) throw new Error(lg.msg)
      if (lg.data.role !== 'content,member') throw new Error('role CSV 应按固定顺序 content,member，实际 ' + lg.data.role)
      for (const action of ['stories', 'orderList']) {
        const rr = await admin(lg.data.token, action, {})
        if (rr.code !== 0) throw new Error(`${action}: ${rr.msg}`)
      }
      const deny = await admin(lg.data.token, 'refundPreview', {})
      if (deny.code !== -403) throw new Error(`refundPreview 期望 -403，实际 ${deny.code}`)
    })

    await test('owner 过滤：activity 账号 activityList 只见自己主理的活动', async () => {
      const r = await admin(tokens.activity, 'activityList', {})
      if (r.code !== 0) throw new Error(r.msg)
      const ids = r.data.list.map(a => a.id)
      if (!ids.includes(actX)) throw new Error('应包含自己主理的活动 X')
      if (ids.includes(actY)) throw new Error('不应见他人主理的活动 Y')
      if (ids.some(id => ![actX].includes(id))) throw new Error('列表含非自己主理的活动')
    })

    await test('owner 守卫：activity 账号对活动 Y 的 activitySignups/activitySave/attendanceSave 均拒', async () => {
      let r = await admin(tokens.activity, 'activitySignups', { id: actY })
      if (r.code === 0) throw new Error('activitySignups(Y) 不应成功')
      r = await admin(tokens.activity, 'activitySave', { id: actY, title: 'hack', start_time: '2026-08-01 08:00:00' })
      if (r.code === 0) throw new Error('activitySave(Y) 不应成功')
      r = await admin(tokens.activity, 'attendanceSave', { activityId: actY })
      if (r.code === 0) throw new Error('attendanceSave(Y) 不应成功')
    })

    await test('activity 新建活动自动落 owner=绑定会员；传 ownerUserId 被忽略', async () => {
      const r = await admin(tokens.activity, 'activitySave', {
        title: P + 'new_by_activity', start_time: '2026-09-01 08:00:00', ownerUserId: userB })
      if (r.code !== 0) throw new Error(r.msg)
      createdActs.push(r.data.id)
      const [[row]] = await conn.query('SELECT owner_user_id FROM activities WHERE id = ?', [r.data.id])
      if (Number(row.owner_user_id) !== userA) throw new Error(`owner 应为绑定会员 ${userA}，实际 ${row.owner_user_id}`)
    })

    await test('super 新建/编辑可显式指定主理人', async () => {
      const r = await admin(superToken, 'activitySave', {
        title: P + 'new_by_super', start_time: '2026-09-02 08:00:00', ownerUserId: userB })
      if (r.code !== 0) throw new Error(r.msg)
      createdActs.push(r.data.id)
      const [[row]] = await conn.query('SELECT owner_user_id FROM activities WHERE id = ?', [r.data.id])
      if (Number(row.owner_user_id) !== userB) throw new Error('super 指定主理人未生效')
      const r2 = await admin(superToken, 'activitySave', {
        id: r.data.id, title: P + 'new_by_super', start_time: '2026-09-02 08:00:00', ownerUserId: userA })
      if (r2.code !== 0) throw new Error(r2.msg)
      const [[row2]] = await conn.query('SELECT owner_user_id FROM activities WHERE id = ?', [r.data.id])
      if (Number(row2.owner_user_id) !== userA) throw new Error('super 编辑改主理人未生效')
    })

    await test('工作人员：owner 可 staffAdd/staffList/staffRemove，重复添加幂等，对他人活动拒', async () => {
      let r = await admin(tokens.activity, 'staffAdd', { activityId: actX, userId: userB })
      if (r.code !== 0) throw new Error(r.msg)
      r = await admin(tokens.activity, 'staffAdd', { activityId: actX, userId: userB })
      if (r.code !== 0) throw new Error('重复添加应幂等成功')
      r = await admin(tokens.activity, 'staffList', { activityId: actX })
      if (r.code !== 0 || r.data.list.length !== 1) throw new Error('staffList 应恰有 1 人')
      if (r.data.list[0].userId !== userB) throw new Error('staff 成员不符')
      const deny = await admin(tokens.activity, 'staffAdd', { activityId: actY, userId: userA })
      if (deny.code === 0) throw new Error('对他人活动 staffAdd 不应成功')
      r = await admin(tokens.activity, 'staffRemove', { activityId: actX, userId: userB })
      if (r.code !== 0) throw new Error(r.msg)
      r = await admin(tokens.activity, 'staffList', { activityId: actX })
      if (r.data.list.length !== 0) throw new Error('移除后应为空')
    })

    await test('审计操作者：运营账号操作写 au:<id>', async () => {
      await admin(tokens.activity, 'staffAdd', { activityId: actX, userId: userB })
      const [rows] = await conn.query(
        `SELECT admin_openid FROM admin_logs WHERE action = 'staffAdd' AND target_id = ? ORDER BY id DESC LIMIT 1`,
        [String(actX)])
      if (!rows.length || rows[0].admin_openid !== 'au:' + accountIds.activity) {
        throw new Error(`期望 au:${accountIds.activity}，实际 ${rows.length ? rows[0].admin_openid : '无记录'}`)
      }
    })

    await test('accountResetPwd：旧密码失效、新密码可登录', async () => {
      const r = await admin(superToken, 'accountResetPwd', { id: accountIds.content, password: 'new-pass-888' })
      if (r.code !== 0) throw new Error(r.msg)
      const old = await login({ phone: phones.content, password: PWD })
      if (old.code === 0) throw new Error('旧密码不应可登录')
      const fresh = await login({ phone: phones.content, password: 'new-pass-888' })
      if (fresh.code !== 0) throw new Error('新密码应可登录')
    })

    await test('accountDisable：停用后既有 token 即时失效（每请求回查）、登录拒', async () => {
      const r = await admin(superToken, 'accountDisable', { id: accountIds.member, isActive: false })
      if (r.code !== 0) throw new Error(r.msg)
      const call = await admin(tokens.member, 'orderList', {})
      if (call.code !== -401) throw new Error(`既有 token 期望 -401，实际 ${call.code}`)
      const relogin = await login({ phone: phones.member, password: PWD })
      if (relogin.code === 0) throw new Error('停用账号不应可登录')
    })

    await test('token 兼容：旧两段式 -401；篡改 payload 段 -401', async () => {
      const legacy = await admin((Date.now() + 9999999) + '.deadbeef', 'users', {})
      if (legacy.code !== -401) throw new Error(`旧格式期望 -401，实际 ${legacy.code}`)
      const [exp, , sig] = superToken.split('.')
      const forged = exp + '.' + Buffer.from(JSON.stringify({ uid: 0, role: 'super' })).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + 'x.' + sig
      const r = await admin(forged, 'users', {})
      if (r.code !== -401) throw new Error(`篡改 payload 期望 -401，实际 ${r.code}`)
    })
  } finally {
    // ── 清理（顺序：日志 → staff → 账号 → 活动 → 用户）──
    const auOps = Object.values(accountIds).map(id => 'au:' + id)
    if (auOps.length) {
      await conn.query(`DELETE FROM admin_logs WHERE admin_openid IN (${auOps.map(() => '?').join(',')})`, auOps)
    }
    await conn.query("DELETE FROM admin_logs WHERE target_type = 'adminAccount'")
    const actIds = [actX, actY, ...createdActs]
    await conn.query(`DELETE FROM admin_logs WHERE target_type = 'activity' AND target_id IN (${actIds.map(() => '?').join(',')})`, actIds.map(String))
    await conn.query(`DELETE FROM activity_staff WHERE activity_id IN (${actIds.map(() => '?').join(',')})`, actIds)
    await conn.query('DELETE FROM admin_accounts WHERE phone LIKE ?', ['1990000000%'])
    await conn.query(`DELETE FROM activities WHERE id IN (${actIds.map(() => '?').join(',')})`, actIds)
    await conn.query('DELETE FROM users WHERE openid LIKE ?', [P + '%'])
    await conn.end()
    console.log('\n  测试数据已清理')
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed ? 1 : 0)  // 云函数 db.js 连接池 keepAlive 会挂住事件循环，须显式退出
}

run().catch(e => { console.error('测试异常：', e); process.exit(1) })
