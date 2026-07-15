const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { diaryId } = event
  if (!diaryId) return { code: -1, msg: '缺少日记ID' }

  // 用户与日记两条查询互相独立，并行执行
  const [[users], [diaries]] = await Promise.all([
    db.query(
      "SELECT id, identity, (identity <> 'guest' AND member_until IS NOT NULL AND member_until >= CURDATE()) AS validMember FROM users WHERE openid = ?",
      [OPENID]),
    // 作者徽章（author_identity）按会员资格（member_until）派生，与作者登录态无关
    db.query(
      `SELECT d.*, u.nickname AS author_name, u.avatar_hue AS author_avatar_hue,
              IF(u.member_until IS NOT NULL AND u.member_until >= CURDATE(), 'member', 'authed') AS author_identity
       FROM diaries d JOIN users u ON d.user_id = u.id
       WHERE d.id = ? AND d.status = ?`, [diaryId, 'active']
    ),
  ])
  const userId = users.length ? users[0].id : null
  // 两字段语义：identity 存授权态，会员资格由 member_until 派生（过期即按 authed）
  const userIdentity = (!users.length || users[0].identity === 'guest') ? 'guest'
    : (users[0].validMember ? 'member' : 'authed')
  if (!diaries.length) return { code: -1, msg: '日记不存在' }

  const diary = diaries[0]
  const isAuthor = userId && diary.user_id === userId

  // v2.3 权限矩阵：未登录不可读任何日记详情——含自己写的（退出登录即回游客视角，与列表页拦截口径一致）
  if (userIdentity === 'guest') {
    return { code: -3, msg: '登录后即可阅读' }
  }
  if (diary.permission === 'private' && !isAuthor) {
    return { code: -1, msg: '日记不存在' }
  }
  // v2.1 内容墙：已授权非会员读会员日记 → 服务端截断前 30% + 渐隐标记
  if (!isAuthor && diary.permission === 'member' && userIdentity !== 'member') {
    const full = diary.content || ''
    diary.content = full.slice(0, Math.max(1, Math.floor(full.length * 0.3)))
    diary.truncated = true
    diary.fullLength = full.length
    delete diary.content_rich // 样式版为全文，截断响应中必须剔除防泄露
  }

  // 标签必取；点赞/收藏态仅登录用户需要——三条并行（未登录用空结果占位）
  const emptyRows = Promise.resolve([[]])
  const [[tags], [liked], [faved]] = await Promise.all([
    db.query('SELECT t.name FROM tags t JOIN diary_tags dt ON t.id = dt.tag_id WHERE dt.diary_id = ?', [diaryId]),
    userId ? db.query(
      'SELECT action FROM interactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND action = ?',
      [userId, 'diary', diaryId, 'like']
    ) : emptyRows,
    userId ? db.query(
      'SELECT action FROM interactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND action = ?',
      [userId, 'diary', diaryId, 'favorite']
    ) : emptyRows,
  ])
  diary.tags = tags.map(t => t.name)
  if (userId) {
    diary.isLiked = liked.length > 0
    diary.isFavorited = faved.length > 0
  }

  return { code: 0, data: diary }
}
