const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 故事详情（v3.0 善选版）
// 作者/member → 原文全文；非会员（含未登录 guest）→ 已善选（副本上架）用副本内容覆盖返回
// （计数/评论/互动仍挂原故事，读全文无需授权），未善选 → -2 会员专享；暂存稿非作者 → -1
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { storyId } = event
  if (!storyId) return { code: -1, msg: '缺少故事ID' }

  // 用户与故事两条查询互相独立，并行执行
  const [[users], [stories]] = await Promise.all([
    db.query(
      "SELECT id, identity, (identity <> 'guest' AND member_until IS NOT NULL AND member_until >= CURDATE()) AS validMember FROM users WHERE openid = ?",
      [OPENID]),
    // 作者徽章（author_identity）按会员资格（member_until）派生，与作者登录态无关
    db.query(
      `SELECT d.*, u.nickname AS author_name, u.avatar_hue AS author_avatar_hue,
              IF(u.member_until IS NOT NULL AND u.member_until >= CURDATE(), 'member', 'authed') AS author_identity
       FROM stories d JOIN users u ON d.user_id = u.id
       WHERE d.id = ? AND d.status = ?`, [storyId, 'active']
    ),
  ])
  // 两字段语义：identity 存授权态，会员资格由 member_until 派生（过期即按 authed）
  const userIdentity = (!users.length || users[0].identity === 'guest') ? 'guest'
    : (users[0].validMember ? 'member' : 'authed')
  // 退出登录即回游客视角：作者特权与互动态一律按授权态取，退出态用户不认作者、不带出历史点赞
  const userId = (users.length && userIdentity !== 'guest') ? users[0].id : null

  if (!stories.length) return { code: -1, msg: '故事不存在' }

  const story = stories[0]
  const isAuthor = userId && story.user_id === userId

  // 暂存（draft）仅作者可见，他人一律按不存在处理
  if (story.publish_status === 'draft' && !isAuthor) {
    return { code: -1, msg: '故事不存在' }
  }
  // 非会员（含未登录 guest）只可读善选故事：命中上架副本则用副本内容覆盖（互动/计数仍挂原故事）
  if (!isAuthor && userIdentity !== 'member') {
    const [featured] = await db.query(
      "SELECT title, content, content_rich, images FROM featured_stories WHERE story_id = ? AND status = 'online'",
      [storyId])
    if (!featured.length) {
      return { code: -2, msg: '会员专享故事' }
    }
    const f = featured[0]
    story.title = f.title
    story.content = f.content
    story.content_rich = f.content_rich
    story.images = f.images
  }

  // 标签必取；点赞/收藏态仅登录用户需要——三条并行（未登录用空结果占位）
  const emptyRows = Promise.resolve([[]])
  const [[tags], [liked], [faved]] = await Promise.all([
    db.query('SELECT t.name FROM tags t JOIN story_tags st ON t.id = st.tag_id WHERE st.story_id = ?', [storyId]),
    userId ? db.query(
      'SELECT action FROM interactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND action = ?',
      [userId, 'story', storyId, 'like']
    ) : emptyRows,
    userId ? db.query(
      'SELECT action FROM interactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND action = ?',
      [userId, 'story', storyId, 'favorite']
    ) : emptyRows,
  ])
  story.tags = tags.map(t => t.name)
  if (userId) {
    story.isLiked = liked.length > 0
    story.isFavorited = faved.length > 0
  }

  return { code: 0, data: story }
}
