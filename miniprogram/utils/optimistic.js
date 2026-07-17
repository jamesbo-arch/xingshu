// 列表页点赞/收藏的乐观更新：点击立即改 UI 秒响应，后台失败回滚（错误 toast 由 request 层统一弹出）
const socialApi = require('../api/social')

// 把 id 对应卡片置为目标点赞态（幂等：已是目标态则原样返回，计数不重复加减）
function setLiked(list, id, liked) {
  return list.map(d => (d.id === id && d.isLiked !== liked)
    ? { ...d, isLiked: liked, likes: Math.max(0, (d.likes || 0) + (liked ? 1 : -1)) }
    : d)
}

function setFaved(list, id, favorited) {
  return list.map(d => (d.id === id && d.isFavorited !== favorited)
    ? { ...d, isFavorited: favorited, favorites: Math.max(0, (d.favorites || 0) + (favorited ? 1 : -1)) }
    : d)
}

// 乐观点赞：立即翻转 → 调后台 → 失败回滚；服务端实际态与预期不同（并发等）以服务端为准
async function optimisticLike(page, id) {
  const cur = page.data.stories.find(d => d.id === id)
  if (!cur) return
  const next = !cur.isLiked
  page.setData({ stories: setLiked(page.data.stories, id, next) })
  const result = await socialApi.toggleLike(id, 'story')
  if (!result) page.setData({ stories: setLiked(page.data.stories, id, !next) })
  else if (result.liked !== next) page.setData({ stories: setLiked(page.data.stories, id, result.liked) })
}

// 乐观收藏：removeOnUnfav=true（我的收藏页）时取消收藏立即移除卡片，失败原位恢复
async function optimisticFav(page, id, { removeOnUnfav } = {}) {
  const list = page.data.stories
  const idx = list.findIndex(d => d.id === id)
  if (idx < 0) return
  const next = !list[idx].isFavorited
  const snapshot = list[idx]
  if (!next && removeOnUnfav) {
    page.setData({ stories: list.filter(d => d.id !== id) })
  } else {
    page.setData({ stories: setFaved(list, id, next) })
  }
  wx.showToast({ title: next ? '已收藏' : '已取消收藏', icon: 'none', duration: 1500 })
  const result = await socialApi.toggleFav(id)
  if (!result) {
    if (!next && removeOnUnfav) {
      const cur = [...page.data.stories]
      cur.splice(Math.min(idx, cur.length), 0, snapshot)
      page.setData({ stories: cur })
    } else {
      page.setData({ stories: setFaved(page.data.stories, id, !next) })
    }
  } else if (result.favorited !== next) {
    if (removeOnUnfav && !result.favorited) {
      page.setData({ stories: page.data.stories.filter(d => d.id !== id) })
    } else {
      page.setData({ stories: setFaved(page.data.stories, id, result.favorited) })
    }
  }
}

module.exports = { optimisticLike, optimisticFav, setLiked, setFaved }
