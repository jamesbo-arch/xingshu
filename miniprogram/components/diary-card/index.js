const { hueToColor, getInitial } = require('../../utils/color')

Component({
  // 允许 app.wxss 全局类（seal-tag/perm-badge 等）穿透组件样式隔离
  options: { addGlobalClass: true },
  properties: {
    diary: {
      type: Object,
      value: {},
    },
    showActions: {
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
      this.triggerEvent('open', { id: this.data.diary.id })
    },

    // 以下五个由 wxml 的 catch:tap 绑定阻止冒泡到卡片 onTap（小程序无 e.stopPropagation）
    onLike() {
      this.triggerEvent('like', { id: this.data.diary.id })
      this.setData({ showLikeAnim: true })
      setTimeout(() => this.setData({ showLikeAnim: false }), 800)
    },

    onFav() {
      this.triggerEvent('fav', { id: this.data.diary.id })
    },

    onEdit() {
      this.triggerEvent('edit', { id: this.data.diary.id })
    },

    onDelete() {
      this.triggerEvent('delete', { id: this.data.diary.id })
    },

    onShare() {
      this.triggerEvent('share', { id: this.data.diary.id })
    },

    getPermLabel(perm) {
      if (perm === 'public') return '公众可读'
      if (perm === 'member') return '会员可读'
      if (perm === 'private') return '个人草稿'
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
      this._updateAvatar(this.data.diary)
    },
  },

  observers: {
    'diary': function(d) {
      this._updateAvatar(d)
    },
  },

  data: {
    avatarColor: '#8B7A4A',
    avatarInitial: '?',
    showLikeAnim: false,
  },
})
