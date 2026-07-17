const app = getApp()
const { hueToColor, getInitial } = require('../../utils/color')
const storyApi = require('../../api/story')
const socialApi = require('../../api/social')
const mapper = require('../../utils/mapper')
const { lock, throttle } = require('../../utils/guard')

Page({
  data: {
    story: null,
    comments: [],
    commentPage: 1,
    avatarColor: '#8B7A4A',
    avatarInitial: '?',
    commentInput: '',
    showCommentInput: false,
    replyTo: null,
    showPosterSheet: false,
    showLoginSheet: false,
    memberWall: false, // 非会员打开未善选故事：全屏会员引导
    userAvatarColor: '#8B7A4A',
    userAvatarInitial: '?',
  },

  onLoad(options) {
    let id = options.id ? (parseInt(options.id, 10) || options.id) : null
    // 扫码/转发以本页为启动页时，id 藏在 scene（"d=12&s=8"）里
    if (!id && options.scene) {
      const m = decodeURIComponent(options.scene).match(/(?:^|&)d=(\d+)/)
      if (m) id = parseInt(m[1], 10)
    }
    if (id) this._loadStory(id)
  },

  onShow() {
    if (this.data.story) this._loadStory(this.data.story.id)
  },

  // 微信「…」菜单转发给好友：分享当前故事，带分享人 ID（s=）延续推荐人机制
  onShareAppMessage() {
    const d = this.data.story || {}
    const sharerId = (app.globalData.user || {}).id
    return {
      title: d.title || '醒书故事',
      path: `/pages/detail/index?id=${d.id}${sharerId ? '&s=' + sharerId : ''}`,
    }
  },
  // 分享到朋友圈
  onShareTimeline() {
    const d = this.data.story || {}
    const sharerId = (app.globalData.user || {}).id
    return {
      title: d.title || '醒书故事',
      query: `id=${d.id}${sharerId ? '&s=' + sharerId : ''}`,
    }
  },

  async _loadStory(id) {
    // 详情与评论并行拉取，避免两次云函数往返串行（首屏打开慢的主因）
    const [res, commentsData] = await Promise.all([
      storyApi.getDetailRaw(id),
      socialApi.getComments(id, 1),
    ])
    // v2.3：未登录 → 原页拉起微信登录弹窗，登录成功后重载本故事
    if (res.code === -3) {
      this._pendingId = id
      this.setData({ showLoginSheet: true })
      return
    }
    // v3.0：非会员打开未善选的会员故事（分享/深链直达）→ 全屏会员引导墙
    if (res.code === -2) {
      this.setData({ memberWall: true, story: null })
      wx.setNavigationBarTitle({ title: '故事' })
      return
    }
    if (res.code !== 0 || !res.data) {
      wx.showToast({ title: res.msg || '故事不存在', icon: 'none', duration: 1500 })
      setTimeout(() => this._goBack(), 1200)
      return
    }
    const raw = res.data
    const story = mapper.story(raw)
    const comments = commentsData ? commentsData.list.map(mapper.comment) : []
    const user = app.globalData.user || {}

    this.setData({
      story,
      comments,
      commentPage: 2,
      avatarColor: hueToColor(story.avatarHue || 60),
      avatarInitial: getInitial(story.author || '?'),
      userAvatarColor: hueToColor(user.avatarHue || user.avatar_hue || 60),
      userAvatarInitial: getInitial(user.nickname || '?'),
    })
    wx.setNavigationBarTitle({ title: '故事' })
  },

  onPreviewImage(e) {
    const images = this.data.story.images || []
    wx.previewImage({ current: images[e.currentTarget.dataset.index], urls: images })
  },

  onGoMember() { throttle(this, 'nav', () => wx.switchTab({ url: '/pages/member/index' })) },

  onLike() {
    return lock(this, 'like', async () => {
      const story = this.data.story
      if (!story) return
      const result = await socialApi.toggleLike(story.id, 'story')
      if (result) {
        this.setData({
          story: { ...story, isLiked: result.liked, likes: story.likes + (result.liked ? 1 : -1) }
        })
      }
    })
  },

  onFav() {
    return lock(this, 'fav', async () => {
      const story = this.data.story
      if (!story) return
      const result = await socialApi.toggleFav(story.id)
      if (result) {
        wx.showToast({ title: result.favorited ? '已收藏' : '已取消收藏', icon: 'none', duration: 1500 })
        this.setData({
          story: { ...story, isFavorited: result.favorited, favorites: story.favorites + (result.favorited ? 1 : -1) }
        })
      }
    })
  },

  // 发一级评论：清空 replyTo（回复态）
  onShowCommentInput() { this.setData({ showCommentInput: true, replyTo: null }) },
  onHideCommentInput() { this.setData({ showCommentInput: false, commentInput: '', replyTo: null }) },
  onCommentInput(e) { this.setData({ commentInput: e.detail.value }) },

  // 点某条评论的「回复」→ 打开输入框，占位显示 "回复 @昵称"
  onReplyComment(e) {
    const { id, user } = e.currentTarget.dataset
    this.setData({ replyTo: { id, user }, showCommentInput: true })
  },

  onSubmitComment() {
    return lock(this, 'comment', async () => {
      const text = this.data.commentInput.trim()
      if (!text) return
      const story = this.data.story
      const replyTo = this.data.replyTo
      const result = await socialApi.createComment(story.id, text, replyTo ? replyTo.id : undefined)
      if (!result) return
      const mapped = { ...mapper.comment(result), isMine: true }
      if (replyTo) {
        // 二级回复：并入所属评论的 replies（后端不计入故事评论数，故 story.comments 不变）
        const comments = this.data.comments.map(c => {
          if (c.id !== replyTo.id) return c
          return { ...c, replies: [...(c.replies || []), mapped] }
        })
        this.setData({ commentInput: '', showCommentInput: false, replyTo: null, comments })
        wx.showToast({ title: '回复已发布', icon: 'none', duration: 1500 })
      } else {
        this.setData({
          commentInput: '', showCommentInput: false,
          comments: [mapped, ...this.data.comments],
          story: { ...story, comments: story.comments + 1 },
        })
        wx.showToast({ title: '评论已发布', icon: 'none', duration: 1500 })
      }
    })
  },

  onDeleteComment(e) {
    const { id } = e.currentTarget.dataset
    return lock(this, 'delComment', async () => {
      const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '删除此评论?', success: r }))
      if (res.confirm) {
        await socialApi.deleteComment(id)
        this.setData({ comments: this.data.comments.filter(c => c.id !== id) })
      }
    })
  },

  // 删除自己的二级回复：仅从所属评论的 replies 移除（故事评论数不受影响）
  onDeleteReply(e) {
    const { id, parent } = e.currentTarget.dataset
    return lock(this, 'delReply' + id, async () => {
      const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '删除此回复?', success: r }))
      if (!res.confirm) return
      await socialApi.deleteComment(id)
      const comments = this.data.comments.map(c => {
        if (c.id !== parent) return c
        return { ...c, replies: (c.replies || []).filter(rp => rp.id !== id) }
      })
      this.setData({ comments })
    })
  },

  // 若本页是启动页（转发/扫码直达，栈内仅本页），navigateBack 无上一页会报错 → 改回首页
  _goBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/square/index' })
  },

  // v2.3 登录弹窗：未登录时不展示内容，取消登录则返回上一页
  onLoginClose() {
    this.setData({ showLoginSheet: false })
    if (!this.data.story) this._goBack()
  },
  onLoginSuccess() {
    this.setData({ showLoginSheet: false })
    if (this._pendingId) this._loadStory(this._pendingId)
  },

  onShare() { this.setData({ showPosterSheet: true }) },
  onPosterClose() { this.setData({ showPosterSheet: false }) },
  onShareApp() { wx.showToast({ title: '请使用右上角分享', icon: 'none', duration: 2000 }) },
  onBack() { throttle(this, 'nav', () => this._goBack()) },

  getCommentAvatarColor(hue) { return hueToColor(hue) },
  getCommentInitial(name) { return getInitial(name) },
})
