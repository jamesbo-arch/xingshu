// 问答卡片 — 醒书问答列表 / 我的问答 / 我的收藏（问答段）复用
const { hueToColor, getInitial } = require('../../utils/color')

Component({
  // 允许 app.wxss 全局类（perm-badge / ic-* 等）穿透组件样式隔离
  options: { addGlobalClass: true },

  properties: {
    question: { type: Object, value: {} },
    // 作者视角（我的问答页）：显示编辑/删除按钮，不做互动
    showActions: { type: Boolean, value: false },
  },

  data: {
    avatarColor: '#8B7A4A',
    avatarInitial: '?',
    showLikeAnim: false,
  },

  lifetimes: {
    attached() { this._syncAvatar(this.data.question) },
  },

  observers: {
    'question': function (q) { this._syncAvatar(q) },
  },

  methods: {
    _syncAvatar(q) {
      if (!q) return
      this.setData({
        avatarColor: hueToColor(q.avatar_hue),
        avatarInitial: getInitial(q.nickname || '?'),
      })
    },

    onTap() { this.triggerEvent('open', { id: this.data.question.id }) },

    // 以下均由 wxml 的 catch:tap 绑定阻止冒泡到卡片 onTap
    onLike() {
      this.triggerEvent('like', { id: this.data.question.id })
      this.setData({ showLikeAnim: true })
      setTimeout(() => this.setData({ showLikeAnim: false }), 800)
    },
    onFav() { this.triggerEvent('fav', { id: this.data.question.id }) },
    onEdit() { this.triggerEvent('edit', { id: this.data.question.id }) },
    onDelete() { this.triggerEvent('delete', { id: this.data.question.id }) },
  },
})
