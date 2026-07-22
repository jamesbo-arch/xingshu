// 问答详情：问题正文 + 回复区
// 会员可回复（支持匿名）；非会员（含 guest）读精选副本 + 全部回复但只读；未精选 → -2 引导
const app = getApp()
const qaApi = require('../../api/qa')
const toast = require('../../utils/toast')
const { ensureLogin, handleLoginSuccess } = require('../../utils/auth-guard')
const { lock } = require('../../utils/guard')
const splash = require('../../utils/splash')
const { hueToColor } = require('../../utils/color')

// 头像底色：匿名用云函数派生的 anon_hue（同一串问答里同人同色、异人异色），
// 实名用本人 avatar_hue。WXML 不能调函数，故在 JS 预算好。
function avatarColor(row) {
  return hueToColor(row.is_anonymous ? row.anon_hue : row.avatar_hue)
}

Page({
  data: {
    question: null,
    comments: [],
    canReply: false,     // 有效会员才能发回复
    viaFeatured: false,  // 当前读的是精选副本（公众版）
    replyInput: '',
    maxReply: 1000,      // 与云函数 qa 的 MAX_COMMENT 保持一致
    replyAnonymous: false,
    replyTo: null,       // { id, user } 追评目标
    showReplyInput: false,
    showLoginSheet: false,
    statusBarHeight: 0,
    showSplash: false,
  },

  onLoad(options) {
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 0, showSplash: splash.claim('detail') })
    const id = options.id ? parseInt(options.id, 10) : null
    if (id) { this._id = id; this._load(id) }
  },

  onShow() {
    // 从编辑页返回时重新拉取（正文可能已改）
    if (this._id && this.data.question) this._load(this._id)
  },

  onSplashEnter() { this.setData({ showSplash: false }) },

  async _load(id) {
    const [res, comments] = await Promise.all([
      qaApi.getDetailRaw(id),
      qaApi.getComments(id),
    ])
    // -2 会员专享：未登录先拉登录窗（可能本就是会员），登录后仍非会员则转问答页看精选
    if (res.code === -2) {
      const identity = (app.globalData.user || {}).identity || 'guest'
      if (identity === 'guest') {
        this.setData({ showLoginSheet: true })
        return
      }
      toast.info('该问答为会员专享，先看看精选问答吧', 2000)
      setTimeout(() => wx.switchTab({ url: '/pages/qa/index' }), 1600)
      return
    }
    if (res.code !== 0 || !res.data) {
      toast.error(res.msg || '问题不存在')
      setTimeout(() => this._goBack(), 1200)
      return
    }
    this.setData({
      question: { ...res.data.question, avatarColor: avatarColor(res.data.question) },
      canReply: !!res.data.canReply,
      viaFeatured: !!res.data.viaFeatured,
      comments: this._decorate(comments),
    })
  },

  // 给每条回答与其下追评补上头像底色
  _decorate(comments) {
    return (comments || []).map(c => ({
      ...c,
      avatarColor: avatarColor(c),
      replies: (c.replies || []).map(r => ({ ...r, avatarColor: avatarColor(r) })),
    }))
  },

  _goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/qa/index' }) })
  },
  onBack() { this._goBack() },

  onLoginClose() {
    this.setData({ showLoginSheet: false })
    this._pendingLoginAction = null
    // 登录墙下没内容可看，直接退回列表
    if (!this.data.question) this._goBack()
  },
  onLoginSuccess() {
    handleLoginSuccess(this)
    if (this._id) this._load(this._id)
  },

  // ── 回复 ──

  onShowReplyInput() { this.setData({ showReplyInput: true, replyTo: null }) },
  onHideReplyInput() { this.setData({ showReplyInput: false, replyInput: '', replyTo: null }) },
  onReplyInput(e) { this.setData({ replyInput: e.detail.value }) },
  onToggleReplyAnonymous() { this.setData({ replyAnonymous: !this.data.replyAnonymous }) },

  onReplyTo(e) {
    const { id, user } = e.currentTarget.dataset
    this.setData({ showReplyInput: true, replyTo: { id: Number(id), user } })
  },

  onSubmitReply() {
    const content = this.data.replyInput.trim()
    if (!content) { toast.info('说点什么吧'); return }
    return lock(this, 'reply', async () => {
      const parentId = this.data.replyTo ? this.data.replyTo.id : null
      const r = await qaApi.createComment(this._id, content, parentId, this.data.replyAnonymous)
      if (!r) return
      this.onHideReplyInput()
      const comments = await qaApi.getComments(this._id)
      if (comments) this.setData({ comments: this._decorate(comments) })
      toast.success('已回复')
    })
  },

  onDeleteReply(e) {
    const id = Number(e.currentTarget.dataset.id)
    return lock(this, 'delreply' + id, async () => {
      const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '删除后不可恢复', success: r }))
      if (!res.confirm) return
      const ok = await qaApi.deleteComment(id)
      if (!ok) return
      const comments = await qaApi.getComments(this._id)
      if (comments) this.setData({ comments: this._decorate(comments) })
    })
  },

  // ── 互动 ──

  onLike() {
    if (!ensureLogin(this, () => this.onLike())) return
    return lock(this, 'like', () => this._toggle('isLiked', qaApi.toggleLike))
  },

  onFav() {
    if (!ensureLogin(this, () => this.onFav())) return
    return lock(this, 'fav', () => this._toggle('isFavorited', qaApi.toggleFav))
  },

  async _toggle(field, fn) {
    const before = this.data.question[field]
    this.setData({ [`question.${field}`]: !before })
    const r = await fn(this._id)
    this.setData({ [`question.${field}`]: r ? r.active : before })
  },

  onShareAppMessage() {
    const sharerId = (app.globalData.user || {}).id
    return {
      title: '醒书问答',
      path: `/pages/qa-detail/index?id=${this._id}${sharerId ? '&s=' + sharerId : ''}`,
    }
  },
})
