const app = getApp()
const { hueToColor, getInitial } = require('../../utils/color')
const diaryApi = require('../../api/diary')
const socialApi = require('../../api/social')
const mapper = require('../../utils/mapper')

Page({
  data: {
    diary: null,
    comments: [],
    commentPage: 1,
    avatarColor: '#8B7A4A',
    avatarInitial: '?',
    commentInput: '',
    showCommentInput: false,
    showPosterSheet: false,
    userAvatarColor: '#8B7A4A',
    userAvatarInitial: '?',
  },

  onLoad(options) {
    const id = options.id ? (parseInt(options.id, 10) || options.id) : null
    if (id) this._loadDiary(id)
  },

  onShow() {
    if (this.data.diary) this._loadDiary(this.data.diary.id)
  },

  async _loadDiary(id) {
    const res = await diaryApi.getDetailRaw(id)
    // v2.1：未验证手机号 → 邀请式验证引导，验证成功直达本日记
    if (res.code === -3) {
      wx.redirectTo({
        url: `/pages/auth/index?redirect=${encodeURIComponent('/pages/detail/index?id=' + id)}`,
      })
      return
    }
    if (res.code !== 0 || !res.data) {
      wx.showToast({ title: res.msg || '日记不存在', icon: 'none', duration: 1500 })
      setTimeout(() => wx.navigateBack(), 1200)
      return
    }
    const raw = res.data
    const diary = mapper.diary(raw)
    const commentsData = await socialApi.getComments(id, 1)
    const comments = commentsData ? commentsData.list.map(mapper.comment) : []
    const user = app.globalData.user || {}

    this.setData({
      diary,
      comments,
      commentPage: 2,
      avatarColor: hueToColor(diary.avatarHue || 60),
      avatarInitial: getInitial(diary.author || '?'),
      userAvatarColor: hueToColor(user.avatarHue || user.avatar_hue || 60),
      userAvatarInitial: getInitial(user.nickname || '?'),
    })
    wx.setNavigationBarTitle({ title: '日记' })
  },

  onPreviewImage(e) {
    const images = this.data.diary.images || []
    wx.previewImage({ current: images[e.currentTarget.dataset.index], urls: images })
  },

  onGoMember() { wx.switchTab({ url: '/pages/member/index' }) },

  async onLike() {
    const diary = this.data.diary
    if (!diary) return
    const result = await socialApi.toggleLike(diary.id, 'diary')
    if (result) {
      this.setData({
        diary: { ...diary, isLiked: result.liked, likes: diary.likes + (result.liked ? 1 : -1) }
      })
    }
  },

  async onFav() {
    const diary = this.data.diary
    if (!diary) return
    const result = await socialApi.toggleFav(diary.id)
    if (result) {
      wx.showToast({ title: result.favorited ? '已收藏' : '已取消收藏', icon: 'none', duration: 1500 })
      this.setData({
        diary: { ...diary, isFavorited: result.favorited, favorites: diary.favorites + (result.favorited ? 1 : -1) }
      })
    }
  },

  onShowCommentInput() { this.setData({ showCommentInput: true }) },
  onHideCommentInput() { this.setData({ showCommentInput: false, commentInput: '' }) },
  onCommentInput(e) { this.setData({ commentInput: e.detail.value }) },

  async onSubmitComment() {
    const text = this.data.commentInput.trim()
    if (!text) return
    const diary = this.data.diary
    const result = await socialApi.createComment(diary.id, text)
    if (result) {
      const mapped = mapper.comment(result)
      this.setData({
        commentInput: '', showCommentInput: false,
        comments: [mapped, ...this.data.comments],
        diary: { ...diary, comments: diary.comments + 1 },
      })
      wx.showToast({ title: '评论已发布', icon: 'none', duration: 1500 })
    }
  },

  async onDeleteComment(e) {
    const { id } = e.currentTarget.dataset
    const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '删除此评论?', success: r }))
    if (res.confirm) {
      await socialApi.deleteComment(id)
      this.setData({ comments: this.data.comments.filter(c => c.id !== id) })
    }
  },

  onShare() { this.setData({ showPosterSheet: true }) },
  onPosterClose() { this.setData({ showPosterSheet: false }) },
  onShareApp() { wx.showToast({ title: '请使用右上角分享', icon: 'none', duration: 2000 }) },
  onBack() { wx.navigateBack() },

  getCommentAvatarColor(hue) { return hueToColor(hue) },
  getCommentInitial(name) { return getInitial(name) },
})
