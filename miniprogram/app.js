const { TAGS, SEED_DIARIES, SEED_COMMENTS, CURRENT_USER, ADMIN_CONTACT } = require('./data/mock')

App({
  globalData: {
    tags: TAGS,
    diaries: JSON.parse(JSON.stringify(SEED_DIARIES)),
    comments: JSON.parse(JSON.stringify(SEED_COMMENTS)),
    user: JSON.parse(JSON.stringify(CURRENT_USER)),
    adminContact: ADMIN_CONTACT,
  },

  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: 'awakebook-env-1g0oford0bea44cc',
        traceUser: true,
      })
    }
  },

  toggleLike(id) {
    const diaries = this.globalData.diaries
    const d = diaries.find(x => x.id === id)
    if (d) {
      d.isLiked = !d.isLiked
      d.likes += d.isLiked ? 1 : -1
    }
  },

  toggleFav(id) {
    const diaries = this.globalData.diaries
    const d = diaries.find(x => x.id === id)
    if (d) {
      d.isFavorited = !d.isFavorited
      d.favorites += d.isFavorited ? 1 : -1
      return d.isFavorited
    }
    return false
  },

  addDiary(diary) {
    const newD = {
      id: Date.now(),
      author: '我',
      avatarHue: 60,
      isMine: true,
      time: '刚刚',
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      likes: 0,
      favorites: 0,
      comments: 0,
      shares: 0,
      isLiked: false,
      isFavorited: false,
      authorIsMember: false,
      ...diary,
    }
    this.globalData.diaries.unshift(newD)
    return newD
  },

  updateDiary(id, patch) {
    const diaries = this.globalData.diaries
    const idx = diaries.findIndex(x => x.id === id)
    if (idx >= 0) Object.assign(diaries[idx], patch)
  },

  deleteDiary(id) {
    this.globalData.diaries = this.globalData.diaries.filter(x => x.id !== id)
  },

  updateUser(patch) {
    Object.assign(this.globalData.user, patch)
  },
})
