const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  // 互动统计按其名下故事实算（users.*_count 未维护、废弃，不能用）
  const [rows] = await db.query(
    `SELECT u.*,
       (u.identity <> 'guest' AND u.member_until IS NOT NULL AND u.member_until >= CURDATE()) AS validMember,
       (SELECT COUNT(*) FROM stories d WHERE d.user_id=u.id AND d.status='active') AS statStories,
       (SELECT COALESCE(SUM(d.like_count),0)    FROM stories d WHERE d.user_id=u.id AND d.status='active') AS statLikes,
       (SELECT COALESCE(SUM(d.fav_count),0)     FROM stories d WHERE d.user_id=u.id AND d.status='active') AS statFavorites,
       (SELECT COALESCE(SUM(d.comment_count),0) FROM stories d WHERE d.user_id=u.id AND d.status='active') AS statComments,
       (SELECT COALESCE(SUM(d.share_count),0)   FROM stories d WHERE d.user_id=u.id AND d.status='active') AS statShares
     FROM users u WHERE u.openid = ?`,
    [OPENID])
  if (!rows.length) return { code: -1, msg: 'user not found' }
  const user = rows[0]
  // 两字段语义：identity 只存授权态，会员由 member_until 派生（member 为派生值，过期即回落 authed，无需改写库）
  user.identity = user.identity === 'guest' ? 'guest' : (user.validMember ? 'member' : 'authed')
  const stats = {
    stories: Number(user.statStories) || 0,
    likes: Number(user.statLikes) || 0,
    favorites: Number(user.statFavorites) || 0,
    comments: Number(user.statComments) || 0,
    shares: Number(user.statShares) || 0,
  }
  ;['validMember', 'statStories', 'statLikes', 'statFavorites', 'statComments', 'statShares'].forEach(k => delete user[k])
  return { code: 0, data: { ...user, stats } }
}
