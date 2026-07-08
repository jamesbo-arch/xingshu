const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  // 互动统计按其名下日记实算（users.*_count 未维护、废弃，不能用）
  const [rows] = await db.query(
    `SELECT u.*,
       (u.identity='member' AND (u.member_until IS NULL OR u.member_until < CURDATE())) AS memberExpired,
       (SELECT COUNT(*) FROM diaries d WHERE d.user_id=u.id AND d.status='active') AS statDiaries,
       (SELECT COALESCE(SUM(d.like_count),0)    FROM diaries d WHERE d.user_id=u.id AND d.status='active') AS statLikes,
       (SELECT COALESCE(SUM(d.fav_count),0)     FROM diaries d WHERE d.user_id=u.id AND d.status='active') AS statFavorites,
       (SELECT COALESCE(SUM(d.comment_count),0) FROM diaries d WHERE d.user_id=u.id AND d.status='active') AS statComments,
       (SELECT COALESCE(SUM(d.share_count),0)   FROM diaries d WHERE d.user_id=u.id AND d.status='active') AS statShares
     FROM users u WHERE u.openid = ?`,
    [OPENID])
  if (!rows.length) return { code: -1, msg: 'user not found' }
  const user = rows[0]
  // 会员到期自愈：身份仍为 member 但 member_until 已过 → 回落 authed 并清空到期日
  if (user.memberExpired) {
    await db.query("UPDATE users SET identity = 'authed', member_until = NULL WHERE id = ?", [user.id])
    user.identity = 'authed'
    user.member_until = null
  }
  const stats = {
    diaries: Number(user.statDiaries) || 0,
    likes: Number(user.statLikes) || 0,
    favorites: Number(user.statFavorites) || 0,
    comments: Number(user.statComments) || 0,
    shares: Number(user.statShares) || 0,
  }
  ;['memberExpired', 'statDiaries', 'statLikes', 'statFavorites', 'statComments', 'statShares'].forEach(k => delete user[k])
  return { code: 0, data: { ...user, stats } }
}
