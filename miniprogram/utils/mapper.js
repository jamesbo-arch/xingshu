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
    timestamp: absTime(item.created_at || item.timestamp, true),  // 详情：年月日 时分
    dateText: absTime(item.created_at || item.time || item.timestamp, false),  // 海报：年月日
    created_at_text: formatTime(item.created_at),
    images: item.images || [],
  }
}

function user(item) {
  if (!item) return item
  return {
    ...item,
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

// DB 的 created_at 存的是 UTC（服务器会话时区 UTC，NOW()=UTC）。以下时间函数统一
// 把 DB 时间当 UTC 解析，再 +8 转北京时间展示——用 getUTC* 读取，与设备时区无关。
// DB 时间形如 "YYYY-MM-DD HH:MM:SS" 或 ISO "…T…Z"。
function parseUTCms(t) {
  const m = String(t || '').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))
}

// 绝对时间（北京时间）：withTime=true → "YYYY-MM-DD HH:MM"（详情）；false → "YYYY-MM-DD"（海报）
function absTime(t, withTime) {
  const ms = parseUTCms(t)
  if (ms === null) return t ? String(t).substring(0, withTime ? 16 : 10) : ''
  const bj = new Date(ms + 8 * 3600 * 1000)
  const p = n => String(n).padStart(2, '0')
  const date = `${bj.getUTCFullYear()}-${p(bj.getUTCMonth() + 1)}-${p(bj.getUTCDate())}`
  return withTime ? `${date} ${p(bj.getUTCHours())}:${p(bj.getUTCMinutes())}` : date
}

// 相对时间：diff 用真实瞬间计算（时区无关）；昨天/更早显示北京时间的时分
function formatTime(t) {
  const ms = parseUTCms(t)
  if (ms === null) return ''
  const diff = Date.now() - ms
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  const bj = new Date(ms + 8 * 3600 * 1000)
  const p = n => String(n).padStart(2, '0')
  const hm = `${p(bj.getUTCHours())}:${p(bj.getUTCMinutes())}`
  if (diff < 172800000) return '昨天 ' + hm
  return `${p(bj.getUTCMonth() + 1)}-${p(bj.getUTCDate())} ${hm}`
}

module.exports = { diary, user, comment }
