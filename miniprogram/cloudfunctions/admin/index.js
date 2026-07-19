// 管理后台统一云函数 — action 路由 + 密码登录 + HMAC token 鉴权
// 由 Web 管理后台通过 @cloudbase/js-sdk 调用，不依赖 wx-server-sdk
// event: { action, token?, payload? }，login 之外的 action 均需有效 token
const crypto = require('crypto')
const db = require('./db')
const { ADMIN_PASSWORD } = require('./secret')

const TOKEN_TTL = 12 * 3600 * 1000

// token = exp.base64url(JSON{uid,role}).sig —— 首段保留过期戳（Web 端本地判过期读 split('.')[0]，
// 部署窗口期旧 Web 不被破坏）。uid=0 为全局密码超管；uid>0 为 admin_accounts.id。
// 密钥沿用 ADMIN_PASSWORD：改密码即全部 token 失效（改密全员下线）。旧两段式 token 签名必失败 → -401 重登。
function sign(data) {
  return crypto.createHmac('sha256', ADMIN_PASSWORD).update(data).digest('hex')
}

// base64url 手工实现（兼容旧 Node 运行时，不依赖 'base64url' 编码名）
const b64u = {
  enc: s => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
}

function issueToken(uid, role) {
  const exp = Date.now() + TOKEN_TTL
  const payload = b64u.enc(JSON.stringify({ uid, role }))
  return exp + '.' + payload + '.' + sign(exp + '.' + payload)
}

// 通过返回 {uid, role}，失败返回 null
function verifyToken(token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return null
  const [exp, payload, sig] = parts
  if (Number(exp) < Date.now()) return null
  const expect = sign(exp + '.' + payload)
  if (sig.length !== expect.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null
  try {
    const { uid, role } = JSON.parse(b64u.dec(payload))
    return { uid: Number(uid) || 0, role }
  } catch (e) { return null }
}

// 密码哈希：scrypt$<salt hex>$<hash hex>（Node 内置 crypto，不引第三方）
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  return 'scrypt$' + salt + '$' + crypto.scryptSync(String(password), salt, 64).toString('hex')
}

function checkPassword(password, stored) {
  const [algo, salt, hash] = String(stored || '').split('$')
  if (algo !== 'scrypt' || !salt || !hash) return false
  const calc = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return calc.length === hash.length &&
    crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))
}

const VALID_ROLES = ['super', 'content', 'activity', 'member']

// 角色入参规整：数组或逗号分隔字符串 → 去重合法数组（顺序按 VALID_ROLES）
function normRoles(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split(',')
  const set = new Set(arr.map(s => String(s).trim()).filter(Boolean))
  for (const r of set) if (!VALID_ROLES.includes(r)) throw new Error('角色取值非法: ' + r)
  return VALID_ROLES.filter(r => set.has(r))
}

// 每请求回查账号构造操作上下文：禁用/改角色即时生效（token 内 role 仅供前端展示，服务端以 DB 为准）
// 一个账号可同时持多个角色（role 列逗号分隔）；scopeUserId = 绑定会员 users.id（activity 域主理人匹配依据）
async function buildCtx(auth) {
  if (!auth.uid) return { uid: 0, roles: ['super'], isSuper: true, scopeUserId: null, operator: 'super' }
  const [rows] = await db.query(
    'SELECT id, user_id, role FROM admin_accounts WHERE id = ? AND is_active = 1', [auth.uid])
  if (!rows.length) return null
  const roles = String(rows[0].role || '').split(',').map(s => s.trim()).filter(Boolean)
  return { uid: rows[0].id, roles, isSuper: roles.includes('super'), scopeUserId: rows[0].user_id, operator: 'au:' + rows[0].id }
}

// 活动数据范围守卫：super 全量；activity 角色仅可操作自己主理（owner_user_id = 绑定会员）的活动
async function assertActivityScope(activityId, ctx) {
  if (!activityId) throw new Error('缺少活动 ID')
  const [rows] = await db.query('SELECT owner_user_id FROM activities WHERE id = ?', [activityId])
  if (!rows.length) throw new Error('活动不存在')
  if (ctx.isSuper) return
  if (!ctx.scopeUserId || Number(rows[0].owner_user_id) !== Number(ctx.scopeUserId)) throw new Error('无权操作该活动')
}

// action → 可用角色白名单（不在表内的 action 视为未知）。
// activity 角色的活动域 action 另经 assertActivityScope 收窄数据范围到自己主理的活动。
const ROLE_ALL = ['super', 'content', 'activity', 'member']
const ACL = {
  // 看板（全站数据含营收）仅超管
  kpi: ['super'], activity: ['super'], trend: ['super'],
  // 用户：content 只读（代发故事选作者用）
  users: ['super', 'content', 'member'], userDetail: ['super', 'content', 'member'],
  updateUser: ['super', 'member'], updateReferrer: ['super', 'member'],
  // 故事 / 善选 / 互动
  stories: ['super', 'content'], storyDetail: ['super', 'content'],
  updateStory: ['super', 'content'], createStory: ['super', 'content'],
  deleteStory: ['super', 'content'], deleteStories: ['super', 'content'],
  tagList: ['super', 'content'],
  featuredRank: ['super', 'content'], featuredAdd: ['super', 'content'],
  featuredUpdate: ['super', 'content'], featuredToggle: ['super', 'content'],
  featuredList: ['super', 'content'], featuredDetail: ['super', 'content'],
  comments: ['super', 'content'], deleteComment: ['super', 'content'],
  // 活动（typeSave 是全局配置仅超管）
  typeList: ['super', 'activity'], typeSave: ['super'],
  activityList: ['super', 'activity'], activitySave: ['super', 'activity'],
  activitySignups: ['super', 'activity'], inviteQr: ['super', 'activity'],
  attendanceSave: ['super', 'activity'], activityUpload: ['super', 'activity'],
  postListAdmin: ['super', 'activity'], postDeleteAdmin: ['super', 'activity'],
  // 公共
  fileUrls: ROLE_ALL,
  // 订单（member 不含退费）
  orderList: ['super', 'member'], orderDetail: ['super', 'member'],
  userOrders: ['super', 'member'], createOrder: ['super', 'member'],
  refundPreview: ['super'], refundOrder: ['super'],
  // 运营账号管理（仅超管）
  accountList: ['super'], accountSave: ['super'],
  accountDisable: ['super'], accountResetPwd: ['super'],
  // 搜会员（选主理人/加工作人员）与活动工作人员白名单
  memberSearch: ['super', 'activity'],
  staffList: ['super', 'activity'], staffAdd: ['super', 'activity'], staffRemove: ['super', 'activity'],
}

async function auditLog(action, targetType, targetId, detail, operator = 'admin-web') {
  await db.query(
    'INSERT INTO admin_logs (admin_openid, action, target_type, target_id, detail, created_by) VALUES (?,?,?,?,?,?)',
    [operator, action, targetType, String(targetId), JSON.stringify(detail || {}), operator]
  )
}

// ---- 查询片段（返回字段名与 admin 前端 mock 数据形状一致）----

const USER_SELECT = `
  SELECT u.id, u.nickname, COALESCE(u.real_name,'') AS realName, COALESCE(u.phone,'') AS phone,
         COALESCE(u.gender,'') AS gender,
         u.avatar_hue AS avatarHue,
         CASE WHEN u.member_until IS NOT NULL AND u.member_until >= CURDATE() THEN 'member'
              WHEN u.identity = 'guest' THEN 'guest' ELSE 'authed' END AS identity,
         u.identity AS authState,
         (u.member_until IS NOT NULL AND u.member_until >= CURDATE()) AS isMember,
         DATE_FORMAT(u.member_from, '%Y-%m-%d') AS memberFrom,
         DATE_FORMAT(u.member_until, '%Y-%m-%d') AS memberUntil,
         GREATEST(COALESCE(DATEDIFF(u.member_until, CURDATE()), 0), 0) AS daysLeft,
         u.story_count AS stories,
         (SELECT COALESCE(SUM(d.like_count),0) FROM stories d WHERE d.user_id = u.id AND d.status = 'active') AS likes,
         (SELECT COALESCE(SUM(d.fav_count),0) FROM stories d WHERE d.user_id = u.id AND d.status = 'active') AS favorites,
         (SELECT COALESCE(SUM(d.comment_count),0) FROM stories d WHERE d.user_id = u.id AND d.status = 'active') AS comments,
         (SELECT COALESCE(SUM(d.share_count),0) FROM stories d WHERE d.user_id = u.id AND d.status = 'active') AS shares,
         DATE_FORMAT(u.created_at, '%Y-%m-%d') AS registeredAt,
         DATE_FORMAT(u.updated_at, '%Y-%m-%d') AS lastActive,
         u.referrer_user_id AS referrerId, r.nickname AS referrerName
  FROM users u LEFT JOIN users r ON u.referrer_user_id = r.id`

// 详情用：全文
const STORY_SELECT = `
  SELECT d.id, d.title, d.content, d.publish_status AS publishStatus, d.is_featured AS isFeatured, d.status,
         DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i') AS createdAt,
         d.content_edited_at AS editedAt,
         d.like_count AS likes, d.fav_count AS favorites,
         d.comment_count AS comments, d.share_count AS shares,
         u.nickname AS author, u.id AS authorId,
         (SELECT GROUP_CONCAT(t.name ORDER BY t.name) FROM story_tags st JOIN tags t ON t.id = st.tag_id WHERE st.story_id = d.id) AS tags_csv
  FROM stories d JOIN users u ON d.user_id = u.id`

// 列表用：正文仅取前 80 字摘要（避免几千篇全文撑爆 callFunction 返回体）
const STORY_LIST_SELECT = STORY_SELECT.replace('d.content,', 'LEFT(d.content, 80) AS content,')

// 分页参数规整：page≥1，pageSize 限 1..100
// 北京时间的"现在"（云函数运行时为 UTC，+8 后用 toISOString/getUTC* 读取，避免午夜 0~8 点日期差一天）
function bjNow(offsetMs = 0) {
  return new Date(Date.now() + 8 * 3600 * 1000 + offsetMs)
}

function pageArgs({ page = 1, pageSize = 20 } = {}) {
  const ps = Math.min(Math.max(Number(pageSize) || 20, 1), 100)
  const p = Math.max(Number(page) || 1, 1)
  return { limit: ps, offset: (p - 1) * ps, page: p, pageSize: ps }
}

const COMMENT_SELECT = `
  SELECT c.id, c.story_id AS storyId, d.title AS storyTitle,
         u.nickname AS user, c.user_id AS userId, c.content,
         DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i') AS time
  FROM comments c JOIN users u ON c.user_id = u.id JOIN stories d ON c.story_id = d.id`

// 订单查询：附用户信息 + 据 valid_until 实时计算状态（active/expiring≤15天/expired/pending）
// 注：不含 proof_url（凭证 base64 较大），仅 orderDetail 单独取，避免列表/历史返回过重
const ORDER_SELECT = `
  SELECT o.id, o.user_id AS userId, u.nickname AS userName, COALESCE(u.phone,'') AS userPhone,
         u.avatar_hue AS avatarHue, o.amount, o.plan, o.method, o.status,
         o.member_days AS memberDays, o.related_order_id AS relatedOrderId,
         o.note, COALESCE(o.created_by, '后台') AS createdBy,
         DATE_FORMAT(o.valid_from, '%Y-%m-%d') AS validFrom,
         DATE_FORMAT(o.valid_until, '%Y-%m-%d') AS validUntil,
         DATE_FORMAT(o.payment_time, '%Y-%m-%d %H:%i') AS paymentTime,
         DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i') AS createdAt,
         DATEDIFF(o.valid_until, CURDATE()) AS daysToExpiry
  FROM orders o JOIN users u ON o.user_id = u.id`

// 依 status 与到期天数派生展示态：pending/refunded/cancelled 原样返回；paid 再分 active/expiring/expired
function orderState(row) {
  if (row.status !== 'paid') return row.status
  const d = row.daysToExpiry
  if (d == null) return 'active'
  if (d < 0) return 'expired'
  if (d <= 15) return 'expiring'
  return 'active'
}
function rowToOrder(r) {
  const state = orderState(r)
  delete r.daysToExpiry
  return { ...r, state }
}

// 会员退费试算：定位该会员最近一张缴费单并按规则计算可退金额（refundPreview 展示、refundOrder 落库共用）
// 规则：支付日起 7 天内全额退款；过 7 天按剩余天数折算（金额 × 剩余天数 ÷ 订单总天数），已过期不可退
async function refundCalc(userId) {
  if (!userId) throw new Error('缺少用户 ID')
  // 会员资格按 member_until 判定（与登录态无关——退出登录的会员同样可退费）
  const [users] = await db.query(
    'SELECT id, (member_until IS NOT NULL AND member_until >= CURDATE()) AS isMember FROM users WHERE id = ?', [userId])
  if (!users.length) throw new Error('用户不存在')
  if (!users[0].isMember) throw new Error('该用户当前不是会员，无可退订单')
  const [orders] = await db.query(
    `SELECT o.id, o.amount, o.plan, o.method,
            DATE_FORMAT(o.valid_from,'%Y-%m-%d') AS validFrom,
            DATE_FORMAT(o.valid_until,'%Y-%m-%d') AS validUntil,
            DATE_FORMAT(o.payment_time,'%Y-%m-%d %H:%i') AS paymentTime,
            DATEDIFF(CURDATE(), DATE(o.payment_time)) AS daysSincePay,
            DATEDIFF(o.valid_until, CURDATE()) AS remainingDays,
            DATEDIFF(o.valid_until, o.valid_from) AS totalDays
     FROM orders o WHERE o.user_id = ? AND o.status = 'paid'
     ORDER BY o.created_at DESC, o.id DESC LIMIT 1`, [userId])
  if (!orders.length) throw new Error('未找到该用户的缴费订单')
  const order = orders[0]
  const [refunded] = await db.query(
    "SELECT id FROM orders WHERE related_order_id = ? AND status = 'refunded'", [order.id])
  if (refunded.length) throw new Error(`该缴费单已退费（退款单 ${refunded[0].id}）`)
  if (order.remainingDays == null || order.remainingDays <= 0) throw new Error('会员已过期，无剩余天数可退')
  const amount = Number(order.amount)
  let rule, refundAmount
  if (order.daysSincePay != null && order.daysSincePay <= 7) {
    rule = 'full'
    refundAmount = amount
  } else {
    rule = 'prorated'
    const total = order.totalDays > 0 ? order.totalDays : 1
    refundAmount = Math.min(amount, Math.round(amount * order.remainingDays / total * 100) / 100)
  }
  return {
    order,
    daysSincePay: order.daysSincePay,
    remainingDays: order.remainingDays,
    totalDays: order.totalDays,
    rule,
    refundAmount,
  }
}

function rowToStory(r) {
  const tags = r.tags_csv ? r.tags_csv.split(',') : []
  delete r.tags_csv
  return { ...r, tags }
}

// 软删故事并联动清理互动 + 善选副本下架（updated_by 为用户 id 整型列，管理员操作不写入，审计走 admin_logs）
async function deleteStoryById(id) {
  const [rows] = await db.query("SELECT id, user_id FROM stories WHERE id = ? AND status = 'active'", [id])
  if (!rows.length) throw new Error('故事不存在或已删除')
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query("UPDATE stories SET status = 'deleted', is_featured = 0 WHERE id = ?", [id])
    await conn.query("UPDATE featured_stories SET status = 'offline' WHERE story_id = ?", [id])
    await conn.query('UPDATE comments SET is_deleted = 1 WHERE story_id = ?', [id])
    await conn.query("DELETE FROM interactions WHERE target_type = 'story' AND target_id = ?", [id])
    await conn.query('UPDATE users SET story_count = GREATEST(story_count - 1, 0) WHERE id = ?', [rows[0].user_id])
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// ---- action 处理器 ----

const handlers = {
  async users({ identity, authState, member, keyword, page, pageSize } = {}) {
    const where = [], params = []
    // 两字段语义：identity 列只存授权态，会员按 member_until 派生。
    // 新口径（Users 页两轴筛选）：authState 筛授权态原值、member 筛会员资格，二者独立可组合
    if (authState === 'guest' || authState === 'authed') {
      where.push('u.identity = ?'); params.push(authState)
    }
    if (member === '1' || member === 1) {
      where.push('u.member_until IS NOT NULL AND u.member_until >= CURDATE()')
    } else if (member === '0' || member === 0) {
      where.push('(u.member_until IS NULL OR u.member_until < CURDATE())')
    }
    // 旧口径（派生三态互斥）保留兼容
    if (identity === 'member') {
      where.push('u.member_until IS NOT NULL AND u.member_until >= CURDATE()')
    } else if (identity === 'authed') {
      where.push("u.identity <> 'guest' AND (u.member_until IS NULL OR u.member_until < CURDATE())")
    } else if (identity === 'guest') {
      where.push("u.identity = 'guest' AND (u.member_until IS NULL OR u.member_until < CURDATE())")
    }
    if (keyword) {
      where.push('(u.nickname LIKE ? OR u.phone LIKE ? OR u.real_name LIKE ? OR u.id = ?)')
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, Number(keyword) || 0)
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const [[{ total }]] = await db.query(`SELECT COUNT(*) total FROM users u ${whereSql}`, params)
    const { limit, offset, page: p, pageSize: ps } = pageArgs({ page, pageSize })
    const [rows] = await db.query(
      `${USER_SELECT} ${whereSql} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset])
    return { list: rows, total, page: p, pageSize: ps }
  },

  async userDetail({ id } = {}) {
    const [users] = await db.query(`${USER_SELECT} WHERE u.id = ?`, [id])
    if (!users.length) throw new Error('用户不存在')
    // D 档：微信身份标识（openid/unionid）单独取，仅详情返回，不进列表
    const [[ids]] = await db.query(
      "SELECT openid, COALESCE(unionid,'') AS unionid FROM users WHERE id = ?", [id])
    const user = { ...users[0], openid: ids.openid, unionid: ids.unionid }
    const [stories] = await db.query(
      `${STORY_LIST_SELECT} WHERE d.user_id = ? AND d.status = 'active' ORDER BY d.created_at DESC`, [id])
    // v2.2 "他推荐的用户"
    const [referred] = await db.query(
      `SELECT id, nickname,
              CASE WHEN member_until IS NOT NULL AND member_until >= CURDATE() THEN 'member'
                   WHEN identity = 'guest' THEN 'guest' ELSE 'authed' END AS identity,
              DATE_FORMAT(created_at, '%Y-%m-%d') AS registeredAt
       FROM users WHERE referrer_user_id = ? ORDER BY created_at DESC`, [id])
    return { user, stories: stories.map(rowToStory), referred }
  },

  // B 档：管理员编辑用户资料（昵称/真实姓名/手机号 + 会员身份/有效期），写审计
  // identity 传入时同步会员期：改为 member 须带 memberFrom/memberUntil；改为非 member 则清空会员期。
  async updateUser({ userId, nickname, realName, phone, gender, identity, memberFrom, memberUntil } = {}, ctx) {
    if (!userId) throw new Error('缺少用户 ID')
    const [users] = await db.query(
      `SELECT nickname, real_name AS realName, phone, COALESCE(gender,'') AS gender, identity,
              DATE_FORMAT(member_from,'%Y-%m-%d') AS memberFrom,
              DATE_FORMAT(member_until,'%Y-%m-%d') AS memberUntil FROM users WHERE id = ?`, [userId])
    if (!users.length) throw new Error('用户不存在')
    const before = users[0]
    const fields = [], values = []
    if (nickname !== undefined) { fields.push('nickname = ?'); values.push(nickname) }
    if (realName !== undefined) { fields.push('real_name = ?'); values.push(realName) }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone) }
    if (gender !== undefined) { fields.push('gender = ?'); values.push(gender || null) }
    if (identity !== undefined) {
      if (!['guest', 'authed', 'member'].includes(identity)) throw new Error('身份取值非法')
      // 两字段语义：identity 列只存授权态（guest/authed），会员资格 = member_until。
      // 表单选"会员"→ 只写会员期（授权态提为 authed，除非本就已授权）；选非会员 → 写授权态并清会员期。
      if (identity === 'member') {
        const dateRe = /^\d{4}-\d{2}-\d{2}$/
        if (!dateRe.test(memberFrom || '') || !dateRe.test(memberUntil || '')) throw new Error('会员有效期日期格式无效')
        if (memberUntil <= memberFrom) throw new Error('会员失效日期须晚于生效日期')
        fields.push("identity = IF(identity = 'guest', 'guest', 'authed')")
        fields.push('member_from = ?', 'member_until = ?'); values.push(memberFrom, memberUntil)
      } else {
        fields.push('identity = ?'); values.push(identity)
        fields.push('member_from = NULL', 'member_until = NULL')
      }
    }
    if (!fields.length) throw new Error('无可更新字段')
    values.push(userId)
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
    await auditLog('updateUser', 'user', userId, { before, after: { nickname, realName, phone, gender, identity, memberFrom, memberUntil } }, ctx.operator)
    const [after] = await db.query(`${USER_SELECT} WHERE u.id = ?`, [userId])
    return { user: after[0] }
  },

  // B 档：管理员编辑故事（标题/正文/发布状态/标签），置 content_edited_at，写审计
  async updateStory({ id, title, content, publishStatus, tags } = {}, ctx) {
    if (!id) throw new Error('缺少故事 ID')
    if (publishStatus !== undefined && !['draft', 'published'].includes(publishStatus)) throw new Error('发布状态非法')
    const [rows] = await db.query("SELECT id FROM stories WHERE id = ? AND status = 'active'", [id])
    if (!rows.length) throw new Error('故事不存在或已删除')
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      const fields = [], values = []
      if (title !== undefined) { fields.push('title = ?'); values.push(title) }
      // 后台改的是纯文本，同时清掉样式版，防旧样式盖新文
      if (content !== undefined) { fields.push('content = ?'); values.push(content); fields.push('content_rich = NULL') }
      if (publishStatus !== undefined) { fields.push('publish_status = ?'); values.push(publishStatus) }
      if (title !== undefined || content !== undefined || publishStatus !== undefined || tags !== undefined) {
        fields.push('content_edited_at = NOW()')
      }
      if (fields.length) {
        values.push(id)
        await conn.query(`UPDATE stories SET ${fields.join(', ')} WHERE id = ?`, values)
      }
      if (tags !== undefined) {
        await conn.query('DELETE FROM story_tags WHERE story_id = ?', [id])
        for (const name of tags) {
          let [t] = await conn.query('SELECT id FROM tags WHERE name = ?', [name])
          const tagId = t.length ? t[0].id
            : (await conn.query('INSERT INTO tags (name, usage_count) VALUES (?, 0)', [name]))[0].insertId
          await conn.query('INSERT INTO story_tags (story_id, tag_id) VALUES (?, ?)', [id, tagId])
        }
      }
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
    await auditLog('updateStory', 'story', id, { title, publishStatus }, ctx.operator)
    const [d] = await db.query(`${STORY_SELECT} WHERE d.id = ?`, [id])
    return { story: rowToStory(d[0]) }
  },

  // C 档：后台代发故事（以指定用户身份发布），写审计
  async createStory({ authorId, title, content, publishStatus = 'published', tags = [] } = {}, ctx) {
    if (!authorId) throw new Error('缺少作者 ID')
    if (!title || !content) throw new Error('标题和内容不能为空')
    if (!['draft', 'published'].includes(publishStatus)) throw new Error('发布状态非法')
    const [author] = await db.query('SELECT id FROM users WHERE id = ?', [authorId])
    if (!author.length) throw new Error('作者不存在')
    const conn = await db.getConnection()
    let storyId
    try {
      await conn.beginTransaction()
      // created_by 为 INT（用户 id 列），代发以作者 id 记录；管理员留痕走 admin_logs
      const [r] = await conn.query(
        'INSERT INTO stories (user_id, title, content, publish_status, created_by) VALUES (?,?,?,?,?)',
        [authorId, title, content, publishStatus, authorId])
      storyId = r.insertId
      for (const name of tags) {
        let [t] = await conn.query('SELECT id FROM tags WHERE name = ?', [name])
        const tagId = t.length ? t[0].id
          : (await conn.query('INSERT INTO tags (name, usage_count) VALUES (?, 0)', [name]))[0].insertId
        await conn.query('INSERT INTO story_tags (story_id, tag_id) VALUES (?, ?)', [storyId, tagId])
      }
      await conn.query('UPDATE users SET story_count = story_count + 1 WHERE id = ?', [authorId])
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
    await auditLog('createStory', 'story', storyId, { authorId, title }, ctx.operator)
    const [d] = await db.query(`${STORY_SELECT} WHERE d.id = ?`, [storyId])
    return { story: rowToStory(d[0]) }
  },

  // v2.2 管理员修改推荐人：非本人、不得互为推荐循环，写审计（旧值→新值）
  async updateReferrer({ userId, referrerId = null } = {}, ctx) {
    if (!userId) throw new Error('缺少用户 ID')
    const [users] = await db.query('SELECT id, referrer_user_id FROM users WHERE id = ?', [userId])
    if (!users.length) throw new Error('用户不存在')
    if (referrerId != null) {
      if (Number(referrerId) === Number(userId)) throw new Error('推荐人不能是用户本人')
      const [refs] = await db.query('SELECT id, referrer_user_id FROM users WHERE id = ?', [referrerId])
      if (!refs.length) throw new Error('推荐人不存在')
      if (refs[0].referrer_user_id != null && Number(refs[0].referrer_user_id) === Number(userId)) {
        throw new Error('不能形成互为推荐的循环')
      }
    }
    await db.query('UPDATE users SET referrer_user_id = ? WHERE id = ?', [referrerId, userId])
    await auditLog('updateReferrer', 'user', userId, { from: users[0].referrer_user_id, to: referrerId }, ctx.operator)
    return true
  },

  async stories({ keyword, publishStatus, featured, tag, page, pageSize } = {}) {
    const where = ["d.status = 'active'"], params = []
    if (keyword) {
      where.push('(d.title LIKE ? OR d.content LIKE ? OR u.nickname LIKE ? OR d.id = ?)')
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, Number(keyword) || 0)
    }
    if (publishStatus) { where.push('d.publish_status = ?'); params.push(publishStatus) }
    if (featured !== undefined && featured !== '') { where.push('d.is_featured = ?'); params.push(featured ? 1 : 0) }
    if (tag) {
      where.push('EXISTS (SELECT 1 FROM story_tags st2 JOIN tags t2 ON t2.id = st2.tag_id WHERE st2.story_id = d.id AND t2.name = ?)')
      params.push(tag)
    }
    const whereSql = 'WHERE ' + where.join(' AND ')
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) total FROM stories d JOIN users u ON d.user_id = u.id ${whereSql}`, params)
    const { limit, offset, page: p, pageSize: ps } = pageArgs({ page, pageSize })
    const [rows] = await db.query(
      `${STORY_LIST_SELECT} ${whereSql} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset])
    return { list: rows.map(rowToStory), total, page: p, pageSize: ps }
  },

  async storyDetail({ id } = {}) {
    const [rows] = await db.query(`${STORY_SELECT} WHERE d.id = ?`, [id])
    if (!rows.length) throw new Error('故事不存在')
    const [comments] = await db.query(
      `${COMMENT_SELECT} WHERE c.story_id = ? AND c.is_deleted = 0 ORDER BY c.created_at ASC`, [id])
    return { story: rowToStory(rows[0]), comments }
  },

  // 系统标签名列表（供故事编辑/代发的标签选择器）
  async tagList() {
    const [rows] = await db.query("SELECT name FROM tags WHERE is_active = 1 ORDER BY usage_count DESC, name ASC")
    return { list: rows.map(r => r.name) }
  },

  async comments({ keyword, userId } = {}) {
    const where = ['c.is_deleted = 0'], params = []
    if (keyword) { where.push('c.content LIKE ?'); params.push(`%${keyword}%`) }
    if (userId) { where.push('c.user_id = ?'); params.push(userId) }
    const [rows] = await db.query(
      `${COMMENT_SELECT} WHERE ${where.join(' AND ')} ORDER BY c.created_at DESC LIMIT 200`, params)
    return { list: rows, total: rows.length }
  },

  async kpi() {
    const count = async sql => (await db.query(sql))[0][0].c
    const users = await count('SELECT COUNT(*) c FROM users')
    const usersNew = await count('SELECT COUNT(*) c FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)')
    const members = await count("SELECT COUNT(*) c FROM users WHERE member_until IS NOT NULL AND member_until >= CURDATE()")
    const membersNew = await count("SELECT COUNT(*) c FROM users WHERE member_until IS NOT NULL AND member_until >= CURDATE() AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)")
    const stories = await count("SELECT COUNT(*) c FROM stories WHERE status = 'active'")
    const storiesNew = await count("SELECT COUNT(*) c FROM stories WHERE status = 'active' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)")
    const inter = await count('SELECT COUNT(*) c FROM interactions') +
      await count('SELECT COUNT(*) c FROM comments WHERE is_deleted = 0')
    const interNew = await count("SELECT COUNT(*) c FROM interactions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)") +
      await count("SELECT COUNT(*) c FROM comments WHERE is_deleted = 0 AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)")
    const [[{ s: revenue }]] = await db.query("SELECT COALESCE(SUM(amount),0) s FROM orders WHERE status = 'paid'")
    const [[{ s: revenueNew }]] = await db.query("SELECT COALESCE(SUM(amount),0) s FROM orders WHERE status = 'paid' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)")
    const delta = (part, total) => total ? Math.round(part / total * 1000) / 10 : 0
    return {
      users: { value: users, delta: delta(usersNew, users) },
      members: { value: members, delta: delta(membersNew, members) },
      stories: { value: stories, delta: delta(storiesNew, stories) },
      interactions: { value: inter, delta: delta(interNew, inter) },
      revenue: { value: Number(revenue), delta: delta(Number(revenueNew), Number(revenue)) },
    }
  },

  async activity() {
    const [stories] = await db.query(
      `SELECT u.nickname, d.title, d.created_at FROM stories d JOIN users u ON d.user_id = u.id
       WHERE d.status = 'active' ORDER BY d.created_at DESC LIMIT 5`)
    const [users] = await db.query(
      'SELECT nickname, created_at FROM users ORDER BY created_at DESC LIMIT 5')
    const [orders] = await db.query(
      `SELECT u.nickname, o.plan, o.created_at FROM orders o JOIN users u ON o.user_id = u.id
       WHERE o.status = 'paid' ORDER BY o.created_at DESC LIMIT 5`)
    const fmt = t => {
      const s = String(t)
      const m = s.replace('T', ' ').match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/)
      return m ? `${m[1]} ${m[2]}` : s.slice(0, 16)
    }
    const items = [
      ...stories.map(r => ({ type: 'story', text: `${r.nickname} 发布《${r.title}》`, time: fmt(r.created_at), ts: +new Date(r.created_at) })),
      ...users.map(r => ({ type: 'user', text: `${r.nickname} 完成注册`, time: fmt(r.created_at), ts: +new Date(r.created_at) })),
      ...orders.map(r => ({ type: 'order', text: `为「${r.nickname}」确认${r.plan}订单`, time: fmt(r.created_at), ts: +new Date(r.created_at) })),
    ].sort((a, b) => b.ts - a.ts).slice(0, 8)
    return items.map(({ ts, ...rest }) => rest)
  },

  async trend() {
    const daily = async (table, extra = '') => {
      const [rows] = await db.query(
        `SELECT DATE(created_at) d, COUNT(*) c FROM ${table}
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) ${extra} GROUP BY DATE(created_at)`)
      const map = {}
      rows.forEach(r => { map[String(r.d).slice(0, 10)] = r.c })
      return map
    }
    const u = await daily('users')
    const d = await daily('stories', "AND status = 'active'")
    const i = await daily('interactions')
    const out = []
    for (let n = 29; n >= 0; n--) {
      const dt = bjNow(-n * 86400000)
      const key = dt.toISOString().slice(0, 10)
      out.push({
        date: `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`,
        newUsers: u[key] || 0,
        newStories: d[key] || 0,
        interactions: i[key] || 0,
      })
    }
    return out
  },

  async deleteStory({ id } = {}, ctx) {
    await deleteStoryById(id)
    await auditLog('deleteStory', 'story', id, {}, ctx.operator)
    return true
  },

  // 批量删除：逐条独立事务，单条失败不影响其余；汇总写一条审计
  async deleteStories({ ids } = {}, ctx) {
    if (!Array.isArray(ids) || !ids.length) throw new Error('缺少故事 ID 列表')
    const deleted = [], failed = []
    for (const id of ids) {
      try { await deleteStoryById(id); deleted.push(id) }
      catch (err) { failed.push({ id, msg: err.message }) }
    }
    await auditLog('deleteStories', 'story', ids.join(','), { deleted, failed }, ctx.operator)
    return { deleted, failed }
  },

  // ── 善选故事（面向公众的修订副本；互动/计数共享原故事）──
  // 热度榜：未善选（无任何副本，含 offline）的已发布故事按加权计数排序
  async featuredRank({ dateFrom, dateTo, wLike = 1, wFav = 1, wComment = 1, page, pageSize } = {}) {
    const w = k => { const n = Number(k); if (isNaN(n) || n < 0 || n > 100) throw new Error('权重须为 0~100 的数字'); return n }
    const weights = [w(wLike), w(wFav), w(wComment)]
    const where = ["d.status = 'active'", "d.publish_status = 'published'",
      'NOT EXISTS (SELECT 1 FROM featured_stories f WHERE f.story_id = d.id)']
    const params = []
    if (dateFrom) { where.push('DATE(d.created_at) >= ?'); params.push(dateFrom) }
    if (dateTo) { where.push('DATE(d.created_at) <= ?'); params.push(dateTo) }
    const whereSql = 'WHERE ' + where.join(' AND ')
    const [[{ total }]] = await db.query(`SELECT COUNT(*) total FROM stories d ${whereSql}`, params)
    const { limit, offset, page: p, pageSize: ps } = pageArgs({ page, pageSize })
    const [rows] = await db.query(
      `SELECT d.id, d.title, LEFT(d.content, 80) AS excerpt,
              d.like_count AS likes, d.fav_count AS favorites, d.comment_count AS comments, d.share_count AS shares,
              (d.like_count * ? + d.fav_count * ? + d.comment_count * ?) AS score,
              u.nickname AS author, u.id AS authorId,
              DATE_FORMAT(d.created_at, '%Y-%m-%d') AS createdAt
       FROM stories d JOIN users u ON d.user_id = u.id
       ${whereSql}
       ORDER BY score DESC, d.id DESC LIMIT ? OFFSET ?`,
      [...weights, ...params, limit, offset])
    return { list: rows.map(r => ({ ...r, score: Number(r.score) })), total, page: p, pageSize: ps }
  },

  // 纳入善选：拷贝原文建副本（管理员可再修订），原故事标记 is_featured
  async featuredAdd({ storyId } = {}, ctx) {
    if (!storyId) throw new Error('缺少故事 ID')
    const conn = await db.getConnection()
    let featuredId
    try {
      await conn.beginTransaction()
      const [r] = await conn.query(
        `INSERT INTO featured_stories (story_id, title, content, content_rich, images)
         SELECT id, title, content, content_rich, images FROM stories
         WHERE id = ? AND status = 'active' AND publish_status = 'published'`, [storyId])
      if (!r.affectedRows) throw new Error('故事不存在或未发布')
      featuredId = r.insertId
      await conn.query('UPDATE stories SET is_featured = 1 WHERE id = ?', [storyId])
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      if (err.code === 'ER_DUP_ENTRY') throw new Error('该故事已在善选中')
      throw err
    } finally {
      conn.release()
    }
    await auditLog('featuredAdd', 'featured', featuredId, { storyId }, ctx.operator)
    return { id: featuredId }
  },

  // 修订副本：只动 featured_stories，不影响原作者故事原文
  async featuredUpdate({ id, title, content, contentRich, images } = {}, ctx) {
    if (!id) throw new Error('缺少善选 ID')
    const fields = [], values = []
    if (title !== undefined) { fields.push('title = ?'); values.push(title) }
    if (content !== undefined) {
      fields.push('content = ?'); values.push(content)
      // 与故事编辑同规则：只改纯文本未带样式版时清掉旧样式，防旧样式盖新文
      if (contentRich === undefined) fields.push('content_rich = NULL')
    }
    if (contentRich !== undefined) { fields.push('content_rich = ?'); values.push(contentRich || null) }
    if (images !== undefined) { fields.push('images = ?'); values.push(images && images.length ? JSON.stringify(images) : null) }
    if (!fields.length) throw new Error('无可更新字段')
    values.push(id)
    const [r] = await db.query(`UPDATE featured_stories SET ${fields.join(', ')} WHERE id = ?`, values)
    if (!r.affectedRows) throw new Error('善选故事不存在')
    await auditLog('featuredUpdate', 'featured', id, { title }, ctx.operator)
    return true
  },

  // 上/下架：offline 后公众侧消失，原故事 is_featured 同步（会员端眼睛徽章随之隐藏）
  async featuredToggle({ id, status } = {}, ctx) {
    if (!id) throw new Error('缺少善选 ID')
    if (!['online', 'offline'].includes(status)) throw new Error('状态须为 online/offline')
    const [rows] = await db.query('SELECT story_id FROM featured_stories WHERE id = ?', [id])
    if (!rows.length) throw new Error('善选故事不存在')
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query('UPDATE featured_stories SET status = ? WHERE id = ?', [status, id])
      await conn.query('UPDATE stories SET is_featured = ? WHERE id = ?', [status === 'online' ? 1 : 0, rows[0].story_id])
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
    await auditLog('featuredToggle', 'featured', id, { storyId: rows[0].story_id, status }, ctx.operator)
    return true
  },

  async featuredList({ keyword, status, page, pageSize } = {}) {
    const where = ['1=1'], params = []
    if (keyword) { where.push('(f.title LIKE ? OR f.content LIKE ? OR u.nickname LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`) }
    if (status) { where.push('f.status = ?'); params.push(status) }
    const whereSql = 'WHERE ' + where.join(' AND ')
    const base = `FROM featured_stories f JOIN stories d ON f.story_id = d.id JOIN users u ON d.user_id = u.id`
    const [[{ total }]] = await db.query(`SELECT COUNT(*) total ${base} ${whereSql}`, params)
    const { limit, offset, page: p, pageSize: ps } = pageArgs({ page, pageSize })
    const [rows] = await db.query(
      `SELECT f.id, f.story_id AS storyId, f.title, LEFT(f.content, 80) AS excerpt, f.status,
              d.status AS storyStatus, d.like_count AS likes, d.fav_count AS favorites, d.comment_count AS comments,
              u.nickname AS author,
              DATE_FORMAT(f.created_at, '%Y-%m-%d %H:%i') AS featuredAt,
              DATE_FORMAT(f.updated_at, '%Y-%m-%d %H:%i') AS updatedAt
       ${base} ${whereSql} ORDER BY f.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset])
    return { list: rows, total, page: p, pageSize: ps }
  },

  // 副本全文 + 原文对照（修订用）
  async featuredDetail({ id } = {}) {
    const [rows] = await db.query(
      `SELECT f.id, f.story_id AS storyId, f.title, f.content, f.content_rich AS contentRich, f.images, f.status,
              d.title AS originTitle, d.content AS originContent, d.status AS storyStatus,
              u.nickname AS author, u.id AS authorId
       FROM featured_stories f JOIN stories d ON f.story_id = d.id JOIN users u ON d.user_id = u.id
       WHERE f.id = ?`, [id])
    if (!rows.length) throw new Error('善选故事不存在')
    return rows[0]
  },

  // ── 活动分类（typeSave 同时承担启停 is_active）──
  async typeList() {
    const [rows] = await db.query(
      'SELECT id, name, channel, schedule_hint, sort, is_active FROM activity_types ORDER BY sort, id')
    return rows
  },

  async typeSave({ id, name, channel, schedule_hint = '', sort = 0, is_active = 1 } = {}, ctx) {
    if (!name || !String(name).trim()) throw new Error('类型名称必填')
    if (!['online', 'offline'].includes(channel)) throw new Error('渠道须为 online/offline')
    if (id) {
      await db.query(
        'UPDATE activity_types SET name=?, channel=?, schedule_hint=?, sort=?, is_active=? WHERE id=?',
        [String(name).trim(), channel, schedule_hint, sort, is_active ? 1 : 0, id])
      await auditLog('typeUpdate', 'activityType', id, { name, channel, is_active }, ctx.operator)
      return { id }
    }
    // created_by 统一存用户表 id：管理后台操作非小程序用户，置 NULL（审计走 admin_logs）
    const [r] = await db.query(
      'INSERT INTO activity_types (name, channel, schedule_hint, sort, is_active) VALUES (?,?,?,?,?)',
      [String(name).trim(), channel, schedule_hint, sort, is_active ? 1 : 0])
    await auditLog('typeCreate', 'activityType', r.insertId, { name, channel }, ctx.operator)
    return { id: r.insertId }
  },

  // ── 活动管理（M1.5.1 MVP）──
  // activity 角色仅见/仅管自己主理（owner_user_id = 绑定会员）的活动；super 全量
  async activityList(_, ctx) {
    const where = [], params = []
    if (!ctx.isSuper) { where.push('a.owner_user_id = ?'); params.push(ctx.scopeUserId || 0) }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const [rows] = await db.query(
      `SELECT a.id, a.title, a.type, a.type_id, t.name AS typeName,
              a.city, a.location, a.latitude, a.longitude,
              a.organizer, a.owner_user_id AS ownerUserId, ou.nickname AS ownerNickname,
              a.capacity, a.price, a.signup_count AS signedUp, a.status,
              a.content, a.cover_url, a.images, a.review_content,
              DATE_FORMAT(a.start_time, '%Y-%m-%d %H:%i') AS startTime,
              DATE_FORMAT(a.end_time, '%Y-%m-%d %H:%i') AS endTime,
              DATE_FORMAT(a.signup_deadline, '%Y-%m-%d %H:%i') AS deadline
       FROM activities a LEFT JOIN activity_types t ON a.type_id = t.id
       LEFT JOIN users ou ON a.owner_user_id = ou.id
       ${whereSql} ORDER BY a.created_at DESC`, params)
    return { list: rows, total: rows.length }
  },

  async activitySave({ id, title, cover_url = '', content = '', images = [], start_time, end_time = null,
                       type = 'offline', type_id = null, city = '', location = '', organizer = '醒书运营组',
                       ownerUserId, latitude = null, longitude = null,
                       capacity = 0, price = 0, signup_deadline = null, status = 'draft',
                       review_content = null, review_images = null } = {}, ctx) {
    if (!title || !start_time) throw new Error('标题与开始时间必填')
    price = Math.max(0, Number(price) || 0)
    // 关联分类时以分类的渠道覆写 type（冗余同步的唯一写点）；不关联则沿用提交值（兼容历史）
    if (type_id) {
      const [t] = await db.query('SELECT channel FROM activity_types WHERE id = ?', [type_id])
      if (!t.length) throw new Error('活动类型不存在')
      type = t[0].channel
    } else {
      type_id = null
    }
    if (ownerUserId) {
      const [u] = await db.query('SELECT id FROM users WHERE id = ?', [ownerUserId])
      if (!u.length) throw new Error('主理人用户不存在')
    }
    const imagesJson = images && images.length ? JSON.stringify(images) : null
    const reviewImagesJson = review_images && review_images.length ? JSON.stringify(review_images) : null
    if (id) {
      await assertActivityScope(id, ctx)
      // 主理人字段仅 super 可改（activity 角色传入忽略，防转移归属）
      const ownerSet = ctx.isSuper && ownerUserId !== undefined ? ', owner_user_id=?' : ''
      const ownerVal = ownerSet ? [ownerUserId || null] : []
      await db.query(
        `UPDATE activities SET title=?, cover_url=?, content=?, images=?, start_time=?, end_time=?,
         type=?, type_id=?, city=?, location=?, latitude=?, longitude=?, organizer=?, capacity=?, price=?,
         signup_deadline=?, status=?,
         review_content=?, review_images=?, updated_by=NULL${ownerSet} WHERE id=?`,
        [title, cover_url, content, imagesJson, start_time, end_time, type, type_id, city, location,
         latitude, longitude, organizer, capacity, price, signup_deadline, status, review_content, reviewImagesJson,
         ...ownerVal, id])
      await auditLog('activityUpdate', 'activity', id, { title, status }, ctx.operator)
      return { id }
    }
    // 新建：super 可显式指定主理人；activity 角色自动落自己绑定的会员
    const owner = ctx.isSuper ? (ownerUserId || null) : ctx.scopeUserId
    const [r] = await db.query(
      `INSERT INTO activities (title, cover_url, content, images, start_time, end_time, type, type_id, city,
        location, latitude, longitude, organizer, owner_user_id, capacity, price, signup_deadline, status,
        review_content, review_images)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [title, cover_url, content, imagesJson, start_time, end_time, type, type_id, city, location,
       latitude, longitude, organizer, owner, capacity, price, signup_deadline, status, review_content, reviewImagesJson])
    await auditLog('activityCreate', 'activity', r.insertId, { title, status }, ctx.operator)
    return { id: r.insertId }
  },

  async activitySignups({ id } = {}, ctx) {
    await assertActivityScope(id, ctx)
    const [rows] = await db.query(
      `SELECT s.id, s.name, s.contact, s.attended, s.paid, u.nickname, u.phone,
              DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i') AS signedAt
       FROM activity_signups s JOIN users u ON s.user_id = u.id
       WHERE s.activity_id = ? ORDER BY s.created_at ASC`, [id])
    const [[a]] = await db.query('SELECT price FROM activities WHERE id = ?', [id])
    return { list: rows, total: rows.length, price: a ? a.price : 0 }
  },

  // ── 活动现场分享（管理端全量含已删行，利于审计追溯）──
  // 邀请函二维码：生成该活动的带参小程序码（scene "a=<id>"，同 generateMiniCode 约定），
  // 以 base64 dataURL 直接返回——Web 端 canvas 出图无跨域问题，也不落云存储
  async inviteQr({ activityId } = {}, ctx) {
    await assertActivityScope(activityId, ctx)
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: `a=${activityId}`,
      page: 'pages/activity-detail/index',
      width: 430,
      checkPath: false,
    })
    return { dataUrl: `data:image/png;base64,${Buffer.from(result.buffer).toString('base64')}` }
  },

  // 云存储 fileID 批量换临时 URL：服务端权限换链，规避 Web 端匿名登录读不到存储的 ACL 限制
  // （wx-server-sdk 惰性加载，仅此 action 使用，不影响其余 action 与本地测试 harness）
  async fileUrls({ fileIDs = [] } = {}) {
    if (!Array.isArray(fileIDs) || !fileIDs.length) return {}
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    const res = await cloud.getTempFileURL({ fileList: fileIDs.slice(0, 50) })
    const map = {}
    for (const f of res.fileList || []) map[f.fileID] = f.tempFileURL || ''
    return map
  },

  // 实际参与 + 已收费名单：整场覆盖式保存勾选结果（前端一次提交两组全量 ID）；
  // ID 按 activity_id 约束，只能勾本活动的报名者
  async attendanceSave({ activityId, attendedIds = [], paidIds = [] } = {}, ctx) {
    await assertActivityScope(activityId, ctx)
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query('UPDATE activity_signups SET attended = 0, paid = 0 WHERE activity_id = ?', [activityId])
      if (attendedIds.length) {
        const ph = attendedIds.map(() => '?').join(',')
        await conn.query(
          `UPDATE activity_signups SET attended = 1 WHERE activity_id = ? AND id IN (${ph})`,
          [activityId, ...attendedIds])
      }
      if (paidIds.length) {
        const ph = paidIds.map(() => '?').join(',')
        await conn.query(
          `UPDATE activity_signups SET paid = 1 WHERE activity_id = ? AND id IN (${ph})`,
          [activityId, ...paidIds])
      }
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
    await auditLog('attendanceSave', 'activity', activityId, { attendedCount: attendedIds.length, paidCount: paidIds.length }, ctx.operator)
    const [[{ c }]] = await db.query(
      'SELECT COUNT(*) c FROM activity_signups WHERE activity_id = ? AND attended = 1', [activityId])
    const [[{ p }]] = await db.query(
      'SELECT COUNT(*) p FROM activity_signups WHERE activity_id = ? AND paid = 1', [activityId])
    return { attended: c, paid: p }
  },

  // 活动介绍配图上传：Web 端 base64 → 服务端 cloud.uploadFile 存云存储，返回 fileID
  // （服务端上传规避 Web 匿名登录写云存储的 ACL 限制，与 fileUrls 换链同思路）
  async activityUpload({ base64 = '', ext = 'png' } = {}) {
    if (!base64) throw new Error('缺少图片数据')
    const safeExt = /^(jpe?g|png|webp|gif)$/i.test(ext) ? ext.toLowerCase() : 'png'
    const buf = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    if (buf.length > 5 * 1024 * 1024) throw new Error('图片过大，请压缩到 5MB 内')
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    const cloudPath = `activities/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${safeExt}`
    const res = await cloud.uploadFile({ cloudPath, fileContent: buf })
    return { fileID: res.fileID }
  },

  async postListAdmin({ activityId, page = 1, pageSize = 20 } = {}, ctx) {
    await assertActivityScope(activityId, ctx)
    page = Math.max(1, parseInt(page, 10) || 1)
    pageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) AS total FROM activity_posts WHERE activity_id = ?', [activityId])
    const [rows] = await db.query(
      `SELECT p.id, p.content, p.images, p.status, u.nickname,
              DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS createdAt
       FROM activity_posts p JOIN users u ON p.user_id = u.id
       WHERE p.activity_id = ? ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [activityId, pageSize, (page - 1) * pageSize])
    return { list: rows.map(p => ({ ...p, images: p.images || [] })), total, page, pageSize }
  },

  async postDeleteAdmin({ id } = {}, ctx) {
    const [rows] = await db.query("SELECT activity_id FROM activity_posts WHERE id = ? AND status = 'active'", [id])
    if (!rows.length) throw new Error('分享不存在或已删除')
    await assertActivityScope(rows[0].activity_id, ctx)
    await db.query("UPDATE activity_posts SET status = 'deleted' WHERE id = ?", [id])
    await auditLog('deletePost', 'activityPost', id, { activityId: rows[0].activity_id }, ctx.operator)
    return true
  },

  async deleteComment({ id } = {}, ctx) {
    const [rows] = await db.query('SELECT story_id FROM comments WHERE id = ? AND is_deleted = 0', [id])
    if (!rows.length) throw new Error('评论不存在或已删除')
    await db.query('UPDATE comments SET is_deleted = 1 WHERE id = ?', [id])
    await db.query('UPDATE stories SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?', [rows[0].story_id])
    await auditLog('deleteComment', 'comment', id, { storyId: rows[0].story_id }, ctx.operator)
    return true
  },

  // ── 会员订单管理（v2.4：线下转账开通/续期会员）──
  async orderList({ keyword, status, page, pageSize } = {}) {
    const where = [], params = []
    if (keyword) {
      where.push('(o.id LIKE ? OR u.nickname LIKE ? OR u.phone LIKE ?)')
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
    }
    // 状态下推 SQL（服务端分页要求）：active/expiring(≤15天)/expired 由 valid_until 与今日派生
    if (status === 'active') where.push("(o.status='paid' AND (o.valid_until IS NULL OR DATEDIFF(o.valid_until,CURDATE())>15))")
    else if (status === 'expiring') where.push("(o.status='paid' AND DATEDIFF(o.valid_until,CURDATE()) BETWEEN 0 AND 15)")
    else if (status === 'expired') where.push("(o.status='paid' AND DATEDIFF(o.valid_until,CURDATE())<0)")
    else if (status) where.push('o.status = ?'), params.push(status)
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) total FROM orders o JOIN users u ON o.user_id = u.id ${whereSql}`, params)
    const { limit, offset, page: p, pageSize: ps } = pageArgs({ page, pageSize })
    const [rows] = await db.query(
      `${ORDER_SELECT} ${whereSql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset])
    return { list: rows.map(rowToOrder), total, page: p, pageSize: ps }
  },

  async orderDetail({ id } = {}) {
    const [rows] = await db.query(`${ORDER_SELECT} WHERE o.id = ?`, [id])
    if (!rows.length) throw new Error('订单不存在')
    const order = rowToOrder(rows[0])
    // 凭证 base64 单独取，仅详情需要
    const [[proof]] = await db.query('SELECT proof_url AS proofUrl FROM orders WHERE id = ?', [id])
    order.proofUrl = proof.proofUrl || ''
    return { order }
  },

  async userOrders({ userId } = {}) {
    if (!userId) throw new Error('缺少用户 ID')
    const [rows] = await db.query(
      `${ORDER_SELECT} WHERE o.user_id = ? ORDER BY o.created_at DESC`, [userId])
    return { list: rows.map(rowToOrder), total: rows.length }
  },

  // 建单即开通：记录一笔已完成的线下转账，直接 paid 并激活/续期会员
  // 有效期（valid_from/valid_until）：操作者可在建单向导显式指定（默认生效日=支付日、失效日=生效日+1年）；
  // 未传时回退为自动计算——现会员从原到期日顺延（时长叠加），否则今日起 +memberDays。
  async createOrder({ userId, amount, plan = '年度会员', method = 'offline',
                      memberDays = 365, paymentTime = null, note = '', proofUrl = null,
                      validFrom = null, validUntil = null } = {}, ctx) {
    if (!userId) throw new Error('缺少用户 ID')
    const amt = Number(amount)
    if (!amt || isNaN(amt) || amt <= 0) throw new Error('金额无效')
    const days = Number(memberDays) || 365

    const [users] = await db.query(
      `SELECT id, identity, DATE_FORMAT(member_from,'%Y-%m-%d') AS memberFrom, member_until,
              (member_until IS NOT NULL AND member_until >= CURDATE()) AS isMember FROM users WHERE id = ?`,
      [userId])
    if (!users.length) throw new Error('用户不存在')
    const user = users[0]
    if (user.identity === 'guest' && !user.isMember) throw new Error('游客不可开通会员，需先登录')

    const todayStr = bjNow().toISOString().slice(0, 10)
    const payTime = paymentTime || bjNow().toISOString().slice(0, 19).replace('T', ' ')
    const payDate = payTime.slice(0, 10)  // 支付日（生效日默认取此）
    let vFrom, vUntil
    if (validFrom || validUntil) {
      // 操作者显式指定有效期
      const dateRe = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRe.test(validFrom || '') || !dateRe.test(validUntil || '')) throw new Error('有效期日期格式无效')
      if (validUntil <= validFrom) throw new Error('失效日期须晚于生效日期')
      vFrom = validFrom
      vUntil = validUntil
    } else {
      // 未指定 → 生效日默认取支付日；现会员（member_until 未过期）仍从原到期日顺延叠加，否则支付日 +days
      const [[calc]] = await db.query(
        `SELECT CASE WHEN ? = 1 THEN DATE_FORMAT(?, '%Y-%m-%d') ELSE ? END AS base`,
        [user.isMember ? 1 : 0, user.member_until, payDate])
      vFrom = payDate
      const [[dates]] = await db.query(
        'SELECT DATE_FORMAT(DATE_ADD(?, INTERVAL ? DAY), "%Y-%m-%d") AS validUntil', [calc.base, days])
      vUntil = dates.validUntil
    }
    // 首次开通用生效日为 member_from，续期保留原 member_from
    const memberFrom = (user.isMember && user.memberFrom) ? user.memberFrom : vFrom

    const orderId = 'XS-' + todayStr.replace(/-/g, '') + '-' +
      Math.floor(Math.random() * 10000).toString().padStart(4, '0')

    // 续费/重开自动关联该用户上一张缴费单（首单为 NULL）
    const [prevPaid] = await db.query(
      "SELECT id FROM orders WHERE user_id = ? AND status = 'paid' ORDER BY created_at DESC, id DESC LIMIT 1",
      [userId])
    const relatedOrderId = prevPaid.length ? prevPaid[0].id : null

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(
        `INSERT INTO orders (id, user_id, amount, plan, method, status, member_days,
           related_order_id, valid_from, valid_until, payment_time, note, proof_url)
         VALUES (?,?,?,?,?,'paid',?,?,?,?,?,?,?)`,
        [orderId, userId, amt, plan, method, days, relatedOrderId, vFrom, vUntil, payTime, note, proofUrl])
      // 两字段语义：只写会员期（授权态不动——用户若处退出态，重新登录即以会员身份生效）
      await conn.query(
        'UPDATE users SET member_from = ?, member_until = ? WHERE id = ?',
        [memberFrom, vUntil, userId])
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
    await auditLog('createOrder', 'order', orderId, { userId, amount: amt, validUntil: vUntil, renew: !!user.isMember }, ctx.operator)
    const [orderRows] = await db.query(`${ORDER_SELECT} WHERE o.id = ?`, [orderId])
    return { order: rowToOrder(orderRows[0]), validUntil: vUntil }
  },

  // 会员退费试算（只读）：返回最近缴费单、规则口径与应退金额，供确认弹窗展示
  async refundPreview({ userId } = {}) {
    return refundCalc(userId)
  },

  // 会员退费：服务端重算金额（不信任前端传值），事务内建退款单（关联原缴费单）+ 会员即时失效。
  // 小程序权限同步依赖既有机制：内容闸/发文守卫实时读 DB（member_until 已清即拒），前端缓存下次启动 login 自愈。
  async refundOrder({ userId } = {}, ctx) {
    const calc = await refundCalc(userId)
    const todayStr = bjNow().toISOString().slice(0, 10)
    const now = bjNow().toISOString().slice(0, 19).replace('T', ' ')
    const refundId = 'XS-' + todayStr.replace(/-/g, '') + '-' +
      Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    const note = calc.rule === 'full'
      ? `退费：入会 7 天内全额退款，原单 ${calc.order.id}`
      : `退费：按剩余 ${calc.remainingDays}/${calc.totalDays} 天折算，原单 ${calc.order.id}`

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(
        `INSERT INTO orders (id, user_id, amount, plan, method, status, member_days,
           related_order_id, payment_time, note)
         VALUES (?,?,?,?,?,'refunded',0,?,?,?)`,
        [refundId, userId, calc.refundAmount, calc.order.plan, calc.order.method,
         calc.order.id, now, note])
      // 两字段语义：退费只清会员期（授权态不动——用户若处退出态不应被误改为已授权）
      await conn.query(
        'UPDATE users SET member_from = NULL, member_until = NULL WHERE id = ?',
        [userId])
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
    await auditLog('refundOrder', 'order', refundId,
      { userId, relatedOrderId: calc.order.id, refundAmount: calc.refundAmount, rule: calc.rule }, ctx.operator)
    const [rows] = await db.query(`${ORDER_SELECT} WHERE o.id = ?`, [refundId])
    return { order: rowToOrder(rows[0]), refundAmount: calc.refundAmount, rule: calc.rule }
  },

  // ── 运营账号管理（仅超管）──
  async accountList({ keyword, page, pageSize } = {}) {
    const where = [], params = []
    if (keyword) { where.push('(a.name LIKE ? OR a.phone LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`) }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const [[{ total }]] = await db.query(`SELECT COUNT(*) total FROM admin_accounts a ${whereSql}`, params)
    const { limit, offset, page: p, pageSize: ps } = pageArgs({ page, pageSize })
    const [rows] = await db.query(
      `SELECT a.id, a.name, a.phone, a.role, a.user_id AS userId, u.nickname AS userNickname,
              a.is_active AS isActive,
              DATE_FORMAT(a.last_login_at, '%Y-%m-%d %H:%i') AS lastLoginAt,
              DATE_FORMAT(a.created_at, '%Y-%m-%d') AS createdAt
       FROM admin_accounts a LEFT JOIN users u ON a.user_id = u.id
       ${whereSql} ORDER BY a.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset])
    // role CSV → roles 数组（前端徽章逐个渲染）
    const list = rows.map(r => ({ ...r, roles: String(r.role || '').split(',').filter(Boolean) }))
    return { list, total, page: p, pageSize: ps }
  },

  // 新建/编辑账号：role 支持多值（数组或逗号分隔，落库 CSV）；含 activity 角色必绑会员（主理人匹配依据）；
  // 编辑不传 password 则不改密
  async accountSave({ id, name, phone, role, roles, userId = null, password } = {}, ctx) {
    if (!name || !String(name).trim()) throw new Error('姓名必填')
    if (!/^1\d{10}$/.test(String(phone || ''))) throw new Error('手机号格式无效')
    const roleList = normRoles(roles !== undefined ? roles : role)
    if (!roleList.length) throw new Error('至少选择一个角色')
    if (roleList.includes('activity') && !userId) throw new Error('含活动运营角色须绑定会员用户（主理人匹配用）')
    if (userId) {
      const [u] = await db.query('SELECT id FROM users WHERE id = ?', [userId])
      if (!u.length) throw new Error('绑定的会员用户不存在')
    }
    const roleCsv = roleList.join(',')
    try {
      if (id) {
        const fields = ['name = ?', 'phone = ?', 'role = ?', 'user_id = ?']
        const values = [String(name).trim(), phone, roleCsv, userId]
        if (password) {
          if (String(password).length < 6) throw new Error('密码至少 6 位')
          fields.push('password_hash = ?'); values.push(hashPassword(password))
        }
        values.push(id)
        const [r] = await db.query(`UPDATE admin_accounts SET ${fields.join(', ')} WHERE id = ?`, values)
        if (!r.affectedRows) throw new Error('账号不存在')
        await auditLog('accountUpdate', 'adminAccount', id, { name, phone, roles: roleCsv, userId }, ctx.operator)
        return { id }
      }
      if (!password || String(password).length < 6) throw new Error('初始密码至少 6 位')
      const [r] = await db.query(
        'INSERT INTO admin_accounts (name, phone, password_hash, role, user_id, created_by) VALUES (?,?,?,?,?,?)',
        [String(name).trim(), phone, hashPassword(password), roleCsv, userId, ctx.operator])
      await auditLog('accountCreate', 'adminAccount', r.insertId, { name, phone, roles: roleCsv, userId }, ctx.operator)
      return { id: r.insertId }
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new Error('该手机号已有账号')
      throw err
    }
  },

  async accountDisable({ id, isActive } = {}, ctx) {
    if (!id) throw new Error('缺少账号 ID')
    const [r] = await db.query('UPDATE admin_accounts SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id])
    if (!r.affectedRows) throw new Error('账号不存在')
    await auditLog('accountDisable', 'adminAccount', id, { isActive: !!isActive }, ctx.operator)
    return { id, isActive: !!isActive }
  },

  async accountResetPwd({ id, password } = {}, ctx) {
    if (!id) throw new Error('缺少账号 ID')
    if (!password || String(password).length < 6) throw new Error('新密码至少 6 位')
    const [r] = await db.query('UPDATE admin_accounts SET password_hash = ? WHERE id = ?', [hashPassword(password), id])
    if (!r.affectedRows) throw new Error('账号不存在')
    await auditLog('accountResetPwd', 'adminAccount', id, {}, ctx.operator)
    return { id }
  },

  // 搜用户（选主理人/加工作人员）：手机号/昵称/姓名模糊或 id 精确，仅返回基本信息
  async memberSearch({ keyword, page, pageSize } = {}) {
    if (!keyword || !String(keyword).trim()) return { list: [], total: 0 }
    const kw = `%${String(keyword).trim()}%`
    const params = [kw, kw, kw, Number(keyword) || 0]
    const whereSql = 'WHERE (u.nickname LIKE ? OR u.phone LIKE ? OR u.real_name LIKE ? OR u.id = ?)'
    const [[{ total }]] = await db.query(`SELECT COUNT(*) total FROM users u ${whereSql}`, params)
    const { limit, offset } = pageArgs({ page, pageSize })
    const [rows] = await db.query(
      `SELECT u.id, u.nickname, COALESCE(u.real_name,'') AS realName, COALESCE(u.phone,'') AS phone,
              u.avatar_hue AS avatarHue,
              (u.member_until IS NOT NULL AND u.member_until >= CURDATE()) AS isMember
       FROM users u ${whereSql} ORDER BY u.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset])
    return { list: rows, total }
  },

  // ── 活动工作人员白名单（移动端报名数据查看授权；super 或该活动主理人可管）──
  async staffList({ activityId } = {}, ctx) {
    await assertActivityScope(activityId, ctx)
    const [rows] = await db.query(
      `SELECT s.user_id AS userId, u.nickname, COALESCE(u.phone,'') AS phone, u.avatar_hue AS avatarHue,
              s.added_by AS addedBy, DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i') AS createdAt
       FROM activity_staff s JOIN users u ON s.user_id = u.id
       WHERE s.activity_id = ? ORDER BY s.id ASC`, [activityId])
    return { list: rows, total: rows.length }
  },

  async staffAdd({ activityId, userId } = {}, ctx) {
    await assertActivityScope(activityId, ctx)
    if (!userId) throw new Error('缺少用户 ID')
    const [u] = await db.query('SELECT id FROM users WHERE id = ?', [userId])
    if (!u.length) throw new Error('用户不存在')
    // 重复添加幂等（uk_activity_user）
    await db.query(
      'INSERT IGNORE INTO activity_staff (activity_id, user_id, added_by) VALUES (?,?,?)',
      [activityId, userId, ctx.operator])
    await auditLog('staffAdd', 'activity', activityId, { userId }, ctx.operator)
    return true
  },

  async staffRemove({ activityId, userId } = {}, ctx) {
    await assertActivityScope(activityId, ctx)
    if (!userId) throw new Error('缺少用户 ID')
    await db.query('DELETE FROM activity_staff WHERE activity_id = ? AND user_id = ?', [activityId, userId])
    await auditLog('staffRemove', 'activity', activityId, { userId }, ctx.operator)
    return true
  },
}

exports.main = async (event) => {
  const { action, token, payload = {} } = event || {}
  try {
    if (action === 'login') {
      // 账号模式：payload 带 phone → 手机号+密码（admin_accounts）；否则原全局密码超管模式
      if (payload.phone) {
        const [accts] = await db.query(
          'SELECT id, name, role, password_hash FROM admin_accounts WHERE phone = ? AND is_active = 1', [payload.phone])
        if (!accts.length || !checkPassword(payload.password, accts[0].password_hash)) {
          return { code: -1, msg: '手机号或密码错误' }
        }
        await db.query('UPDATE admin_accounts SET last_login_at = NOW() WHERE id = ?', [accts[0].id])
        // role 为逗号分隔多值，原样进 token payload 与返回（前端按逗号拆）
        return { code: 0, data: { token: issueToken(accts[0].id, accts[0].role), role: accts[0].role, name: accts[0].name } }
      }
      if (!ADMIN_PASSWORD || payload.password !== ADMIN_PASSWORD) return { code: -1, msg: '密码错误' }
      return { code: 0, data: { token: issueToken(0, 'super'), role: 'super', name: '超级管理员' } }
    }
    const auth = verifyToken(token)
    if (!auth) return { code: -401, msg: '未登录或登录已过期' }
    const ctx = await buildCtx(auth)
    if (!ctx) return { code: -401, msg: '账号已停用或不存在' }
    const handler = handlers[action]
    if (!handler) return { code: -1, msg: `未知操作: ${action}` }
    const allow = ACL[action]
    // 多角色：账号任一角色命中 action 白名单即放行
    if (!allow || !allow.some(r => ctx.roles.includes(r))) return { code: -403, msg: '无权限操作' }
    return { code: 0, data: await handler(payload, ctx) }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
