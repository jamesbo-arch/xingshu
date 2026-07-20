const app = getApp()
const { hueToColor, getInitial } = require('../../utils/color')
const storyApi = require('../../api/story')
const socialApi = require('../../api/social')
const mapper = require('../../utils/mapper')
const { lock, throttle } = require('../../utils/guard')
const { ensureLogin } = require('../../utils/auth-guard')
const splash = require('../../utils/splash')

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
    userAvatarColor: '#8B7A4A',
    userAvatarInitial: '?',
    showSplash: false, // 冷启动品牌蒙布（扫码/转发直达本页时由本页认领）
  },

  onLoad(options) {
    let id = options.id ? (parseInt(options.id, 10) || options.id) : null
    // 扫码/转发以本页为启动页时，id 藏在 scene（"d=12&s=8"）里
    if (!id && options.scene) {
      const m = decodeURIComponent(options.scene).match(/(?:^|&)d=(\d+)/)
      if (m) id = parseInt(m[1], 10)
    }
    if (id) this._loadStory(id)
    this.setData({ showSplash: splash.claim('detail') })
  },

  onSplashEnter() { this.setData({ showSplash: false }) },

  onShow() {
    if (this.data.story) this._loadStory(this.data.story.id)
  },

  // 微信「…」菜单转发给好友：分享当前故事，带分享人 ID（s=）延续推荐人机制
  onShareAppMessage() {
    const d = this.data.story || {}
    const sharerId = (app.globalData.user || {}).id
    // 转发卡片标题统一为品牌词「醒书故事」；imageUrl 显式指定，避免自动截屏发白
    return {
      title: '醒书故事',
      path: `/pages/detail/index?id=${d.id}${sharerId ? '&s=' + sharerId : ''}`,
      imageUrl: this._shareImg || '/images/consulting-banner.png',
    }
  },
  // 分享到朋友圈
  onShareTimeline() {
    const d = this.data.story || {}
    const sharerId = (app.globalData.user || {}).id
    return {
      title: '醒书故事',
      query: `id=${d.id}${sharerId ? '&s=' + sharerId : ''}`,
      imageUrl: this._shareImg || '/images/consulting-banner.png',
    }
  },

  async _loadStory(id) {
    // 详情与评论并行拉取，避免两次云函数往返串行（首屏打开慢的主因）
    const [res, commentsData] = await Promise.all([
      storyApi.getDetailRaw(id),
      socialApi.getComments(id, 1),
    ])
    // v3.1：非会员打开未善选的会员故事（右上角转发链接直达）——
    // 未登录先拉起登录窗（可能本就是会员）；登录后仍非会员 → 提示并转广场看善选列表
    if (res.code === -2) {
      const identity = (app.globalData.user || {}).identity || 'guest'
      if (identity === 'guest') {
        this._pendingId = id
        this.setData({ showLoginSheet: true })
        return
      }
      wx.showToast({ title: '该故事为会员专享，先看看善选故事吧', icon: 'none', duration: 2000 })
      setTimeout(() => wx.switchTab({ url: '/pages/square/index' }), 1600)
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
    this._resolveShareImg(story)
  },

  // 转发卡片缩略图：用故事海报的生成样式（未显式指定时微信自动截屏会发白）。
  // 先给首图或本地品牌图兜底（不发白、分享即时可用），再后台静默生成海报覆盖为最终缩略图。
  async _resolveShareImg(story) {
    // 1) 兜底缩略图
    this._shareImg = '/images/consulting-banner.png'
    const src = (story.images && story.images[0]) || ''
    if (/^https?:\/\//.test(src)) this._shareImg = src
    else if (/^cloud:\/\//.test(src)) {
      try {
        const r = await wx.cloud.getTempFileURL({ fileList: [src] })
        const url = r.fileList && r.fileList[0] && r.fileList[0].tempFileURL
        if (url) this._shareImg = url
      } catch (e) { /* 保持本地兜底图 */ }
    }
    // 2) 后台静默生成 5:4 海报样式缩略图（品牌头+标题+摘要，无小程序码/不下载配图，轻量），
    //    就绪后作为最终转发缩略图；失败保留兜底
    setTimeout(() => {
      const ps = this.selectComponent('#posterSheet')
      if (ps && ps.genShareThumb) ps.genShareThumb((path) => { if (path) this._shareImg = path })
    }, 1200)
  },

  onPreviewImage(e) {
    const images = this.data.story.images || []
    wx.previewImage({ current: images[e.currentTarget.dataset.index], urls: images })
  },

  // 以下互动均需授权：guest 可读善选全文，但点赞/收藏/评论/分享在点击那刻拉起登录，登录后自动续做
  onLike() {
    if (!ensureLogin(this, () => this.onLike())) return
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
    if (!ensureLogin(this, () => this.onFav())) return
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
  onShowCommentInput() {
    if (!ensureLogin(this, () => this.onShowCommentInput())) return
    this.setData({ showCommentInput: true, replyTo: null })
  },
  onHideCommentInput() { this.setData({ showCommentInput: false, commentInput: '', replyTo: null }) },
  onCommentInput(e) { this.setData({ commentInput: e.detail.value }) },

  // 点某条评论的「回复」→ 打开输入框，占位显示 "回复 @昵称"
  // 事件对象在异步回调中会被复用，故先取出 id/user 再闭包给登录续做
  onReplyComment(e) {
    const { id, user } = e.currentTarget.dataset
    const open = () => this.setData({ replyTo: { id, user }, showCommentInput: true })
    if (!ensureLogin(this, open)) return
    open()
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

  // 登录弹窗关闭：有内容则继续浏览；-2 流程拉起的（无内容可看）转广场看善选列表
  onLoginClose() {
    this.setData({ showLoginSheet: false })
    this._pendingLoginAction = null
    if (!this.data.story) {
      this._pendingId = null
      wx.switchTab({ url: '/pages/square/index' })
    }
  },
  // 先重载拿到本人互动态（isLiked/isFavorited），再续做被拦下的操作，避免续做基于陈旧状态；
  // -2 流程拉起的登录用 _pendingId 重载——若仍非会员，重载会再次落入 -2 分支并转广场
  async onLoginSuccess() {
    this.setData({ showLoginSheet: false })
    const action = this._pendingLoginAction
    this._pendingLoginAction = null
    const reloadId = this._pendingId || (this.data.story && this.data.story.id)
    this._pendingId = null
    if (reloadId) await this._loadStory(reloadId)
    if (typeof action === 'function') action()
  },

  onShare() {
    if (!ensureLogin(this, () => this.onShare())) return
    this.setData({ showPosterSheet: true })
  },
  onPosterClose() { this.setData({ showPosterSheet: false }) },
  onShareApp() { wx.showToast({ title: '请使用右上角分享', icon: 'none', duration: 2000 }) },
  onBack() { throttle(this, 'nav', () => this._goBack()) },

  getCommentAvatarColor(hue) { return hueToColor(hue) },
  getCommentInitial(name) { return getInitial(name) },
})
