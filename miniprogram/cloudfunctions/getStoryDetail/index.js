const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 故事详情（v3.0 精选版）
// 作者/member → 原文全文；非会员（含未登录 guest）→ 已精选（副本上架）用副本内容覆盖返回
// （计数/互动仍挂原故事，读全文无需授权），未精选 → -2 会员专享；暂存稿非作者 → -1
// preferFeatured=true：会员/作者也取精选副本内容（分享海报、会员星标筛选态阅读）
// silent=true：不落阅读记录（海报生成用——那不是一次真实阅读）
// 返回体带 viaFeatured，前端据此判定是否为公众版视图（公众版一律无评论区）
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { storyId, preferFeatured, silent } = event
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
  // 阅读记录用：无论授权态都记到实际 users 行（guest 也有 users 行）
  const readerId = users.length ? users[0].id : null

  if (!stories.length) return { code: -1, msg: '故事不存在' }

  const story = stories[0]
  const isAuthor = userId && story.user_id === userId

  // 暂存（draft）仅作者可见，他人一律按不存在处理
  if (story.publish_status === 'draft' && !isAuthor) {
    return { code: -1, msg: '故事不存在' }
  }
  // 非会员（含未登录 guest）只可读精选故事：命中上架副本则用副本内容覆盖（互动/计数仍挂原故事）；
  // preferFeatured 时会员/作者同样取副本（海报与星标筛选态用运营修订版），无副本则回落原文
  const publicView = !isAuthor && userIdentity !== 'member'
  let viaFeatured = false
  if (publicView || preferFeatured) {
    const [featured] = await db.query(
      "SELECT title, content, content_rich, images FROM featured_stories WHERE story_id = ? AND status = 'online'",
      [storyId])
    if (!featured.length) {
      if (publicView) return { code: -2, msg: '会员专享故事' }
    } else {
      const f = featured[0]
      story.title = f.title
      story.content = f.content
      story.content_rich = f.content_rich
      story.images = f.images
      viaFeatured = true
    }
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

  // 阅读记录：每次成功阅读落一行（作者自读、silent 的海报取副本不计），失败不影响正常返回
  if (!isAuthor && !silent) {
    try {
      await db.query(
        'INSERT INTO story_reads (story_id, user_id, identity, via_featured) VALUES (?, ?, ?, ?)',
        [storyId, readerId, userIdentity, viaFeatured ? 1 : 0])
    } catch (e) { console.warn('story_reads insert failed:', e.message) }
  }

  // 前端据此隐藏评论区：公众版（精选副本）一律不提供评论
  story.viaFeatured = viaFeatured
  return { code: 0, data: story }
}
