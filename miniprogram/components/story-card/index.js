const { hueToColor, getInitial } = require('../../utils/color')

Component({
  // 允许 app.wxss 全局类（seal-tag/perm-badge 等）穿透组件样式隔离
  options: { addGlobalClass: true },
  properties: {
    story: {
      type: Object,
      value: {},
    },
    showActions: {
      type: Boolean,
      value: false,
    },
    // 作者数据视角（我的故事页）：统计项改为查看人员清单，不做互动
    ownerStats: {
      type: Boolean,
      value: false,
    },
  },

  computed: {},

  methods: {
    getAvatarColor(hue) {
      return hueToColor(hue)
    },

    getInitialChar(name) {
      return getInitial(name)
    },

    onTap() {
      this.triggerEvent('open', { id: this.data.story.id })
    },

    // 以下五个由 wxml 的 catch:tap 绑定阻止冒泡到卡片 onTap（小程序无 e.stopPropagation）
    onLike() {
      this.triggerEvent('like', { id: this.data.story.id })
      this.setData({ showLikeAnim: true })
      setTimeout(() => this.setData({ showLikeAnim: false }), 800)
    },

    onFav() {
      this.triggerEvent('fav', { id: this.data.story.id })
    },

    onEdit() {
      this.triggerEvent('edit', { id: this.data.story.id })
    },

    onDelete() {
      this.triggerEvent('delete', { id: this.data.story.id })
    },

    onShare() {
      this.triggerEvent('share', { id: this.data.story.id })
    },

    // 作者数据视角：查看阅读/点赞/收藏/评论人员清单（由 catch:tap 阻止冒泡到卡片 onTap）
    onViewRead() {
      this.triggerEvent('viewread', { id: this.data.story.id })
    },
    onViewLike() {
      this.triggerEvent('viewlike', { id: this.data.story.id })
    },
    onViewFav() {
      this.triggerEvent('viewfav', { id: this.data.story.id })
    },
    onViewComment() {
      this.triggerEvent('viewcomment', { id: this.data.story.id })
    },

    getPermLabel(status) {
      if (status === 'draft') return '暂存'
      if (status === 'published') return '已发布'
      return ''
    },

    // 自定义方法须置于 methods 内，否则 this._updateAvatar 取不到（报 not a function）
    _updateAvatar(d) {
      if (!d) return
      const hue = d.author_avatar_hue || d.avatarHue
      const name = d.author_name || d.author
      const patch = {}
      if (hue !== undefined) {
        patch.avatarColor = hueToColor(hue)
        patch.avatarInitial = getInitial(name || '?')
      }
      if (d.created_at && !d.created_at_text) {
        const t = d.created_at.replace('T', ' ').substring(5, 16)
        patch.created_at_text = t
      }
      if (Object.keys(patch).length) this.setData(patch)
    },
  },

  lifetimes: {
    attached() {
      this._updateAvatar(this.data.story)
    },
  },

  observers: {
    'story': function(d) {
      this._updateAvatar(d)
    },
  },

  data: {
    avatarColor: '#8B7A4A',
    avatarInitial: '?',
    showLikeAnim: false,
  },
})
