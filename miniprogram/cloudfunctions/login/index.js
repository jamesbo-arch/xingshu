const cloud = require('wx-server-sdk')
const db = require('./db')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 从启动 scene（如 "d=12&s=8" 或 "a=3&s=8"）中解析分享人用户 ID
function parseSharerId(scene) {
  if (!scene) return null
  const m = String(scene).match(/(?:^|&)s=(\d+)/)
  return m ? Number(m[1]) : null
}

exports.main = async (event, context) => {
  const { OPENID, UNIONID } = cloud.getWXContext()

  const [rows] = await db.query(
    "SELECT *, (identity='member' AND (member_until IS NULL OR member_until < CURDATE())) AS memberExpired FROM users WHERE openid = ?",
    [OPENID])

  if (rows.length > 0) {
    // 老用户扫码只跳转，不改变推荐关系；v2.3 顺带补录 unionid（历史用户为空时）
    const user = rows[0]
    // 会员到期自愈：身份仍为 member 但 member_until 已过（< 今天）→ 回落 authed 并清空到期日
    if (user.memberExpired) {
      await db.query(
        "UPDATE users SET last_active = NOW(), unionid = IFNULL(unionid, ?), identity = 'authed', member_until = NULL WHERE id = ?",
        [UNIONID || null, user.id])
      user.identity = 'authed'
      user.member_until = null
    } else {
      await db.query(
        'UPDATE users SET last_active = NOW(), unionid = IFNULL(unionid, ?) WHERE id = ?',
        [UNIONID || null, user.id])
    }
    delete user.memberExpired
    return { code: 0, data: user }
  }

  // v2.2 推荐人绑定：仅新用户首次登录时生效；分享人须真实存在且不是本人（新用户不可能是本人，但防御性校验 scene 有效性）
  let referrerId = parseSharerId(event.scene)
  if (referrerId) {
    const [ref] = await db.query('SELECT id FROM users WHERE id = ?', [referrerId])
    if (!ref.length) referrerId = null
  }

  const [result] = await db.query(
    `INSERT INTO users (openid, unionid, nickname, identity, avatar_hue, referrer_user_id, created_by)
     VALUES (?, ?, ?, 'guest', ?, ?, ?)`,
    [OPENID, UNIONID || null, event.nickname || '微信用户', event.avatarHue || 60, referrerId, OPENID]
  )

  const [newUser] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId])
  return { code: 0, data: newUser[0] }
}
