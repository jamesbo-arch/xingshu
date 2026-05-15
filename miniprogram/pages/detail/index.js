const app = getApp()
const { hueToColor, getInitial } = require('../../utils/color')

Page({
  data: {
    diary: null,
    comments: [],
    avatarColor: '#8B7A4A',
    avatarInitial: '?',
    commentInput: '',
    showCommentInput: false,
    userAvatarColor: '#8B7A4A',
    userAvatarInitial: '?',
  },

  onLoad(options) {
    const id = options.id ? parseInt(options.id, 10) || options.id : null
    if (id !== null) {
      this._loadDiary(id)
    }
  },

  onShow() {
    if (this.data.diary) {
      this._loadDiary(this.data.diary.id)
    }
  },

  _loadDiary(id) {
    const diaries = app.globalData.diaries
    const diary = diaries.find(d => d.id == id)
    if (!diary) {
      wx.showToast({ title: '日记不存在', icon: 'none', duration: 1500 })
      return
    }
    const comments = app.globalData.comments.filter(c => c.diaryId == id)
    const user = app.globalData.user

    this.setData({
      diary,
      comments,
      avatarColor: hueToColor(diary.avatarHue),
      avatarInitial: getInitial(diary.author),
      userAvatarColor: hueToColor(user.avatarHue),
      userAvatarInitial: getInitial(user.nickname || user.wechatName),
    })

    wx.setNavigationBarTitle({ title: '日记' })
  },

  onLike() {
    const diary = this.data.diary
    if (!diary) return
    app.toggleLike(diary.id)
    this._loadDiary(diary.id)
  },

  onFav() {
    const diary = this.data.diary
    if (!diary) return
    const nowFav = app.toggleFav(diary.id)
    wx.showToast({
      title: nowFav ? '已收藏' : '已取消收藏',
      icon: 'none',
      duration: 1500,
    })
    this._loadDiary(diary.id)
  },

  onShowCommentInput() {
    this.setData({ showCommentInput: true })
  },

  onHideCommentInput() {
    this.setData({ showCommentInput: false, commentInput: '' })
  },

  onCommentInput(e) {
    this.setData({ commentInput: e.detail.value })
  },

  onSubmitComment() {
    const text = this.data.commentInput.trim()
    if (!text) return

    const diary = this.data.diary
    const user = app.globalData.user
    const newComment = {
      id: 'c' + Date.now(),
      diaryId: diary.id,
      user: user.nickname || user.wechatName,
      avatarHue: user.avatarHue,
      content: text,
      time: '刚刚',
      replies: [],
      isMine: true,
    }

    app.globalData.comments.push(newComment)
    app.updateDiary(diary.id, { comments: diary.comments + 1 })
    this.setData({ commentInput: '', showCommentInput: false })
    this._loadDiary(diary.id)
    wx.showToast({ title: '评论已发布', icon: 'none', duration: 1500 })
  },

  onShareApp() {
    wx.showToast({ title: '请使用右上角分享', icon: 'none', duration: 2000 })
  },

  onBack() {
    wx.navigateBack()
  },

  getCommentAvatarColor(hue) {
    return hueToColor(hue)
  },

  getCommentInitial(name) {
    return getInitial(name)
  },
})
