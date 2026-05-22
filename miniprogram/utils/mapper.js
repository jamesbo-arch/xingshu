function diary(item) {
  if (!item) return item
  return {
    ...item,
    author: item.author_name || item.author,
    authorIsMember: (item.author_identity || '') === 'member',
    author_identity: item.author_identity,
    avatarHue: item.author_avatar_hue || item.avatarHue,
    likes: item.like_count != null ? item.like_count : item.likes,
    favorites: item.fav_count != null ? item.fav_count : item.favorites,
    comments: item.comment_count != null ? item.comment_count : item.comments,
    shares: item.share_count != null ? item.share_count : item.shares,
    time: item.created_at || item.time,
    timestamp: item.created_at || item.timestamp,
    created_at_text: formatTime(item.created_at),
  }
}

function user(item) {
  if (!item) return item
  return {
    ...item,
    wechatName: item.nickname || item.wechat_name || item.wechatName,
    realName: item.real_name || item.realName,
    avatarUrl: item.avatar_url || item.avatarUrl || '',
    avatarHue: item.avatar_hue || item.avatarHue,
    memberUntil: item.member_until || item.memberUntil,
    daysLeft: item.days_left != null ? item.days_left : item.daysLeft,
  }
}

function comment(item) {
  if (!item) return item
  return {
    ...item,
    user: item.user_name || item.user,
    avatarHue: item.user_avatar_hue || item.avatarHue,
    time: item.created_at || item.time,
    replies: item.replies ? item.replies.map(comment) : undefined,
  }
}

function formatTime(t) {
  if (!t) return ''
  const s = String(t).replace('T', ' ')
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/)
  if (m) {
    const now = new Date()
    const d = new Date(m[1], m[2] - 1, m[3], m[4], m[5])
    const diff = now - d
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
    if (diff < 172800000) return '昨天 ' + m[4] + ':' + m[5]
    return m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5]
  }
  return s.substring(0, 16)
}

module.exports = { diary, user, comment }
