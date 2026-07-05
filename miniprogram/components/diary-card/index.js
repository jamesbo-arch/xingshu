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

    onLike(e) {
      e.stopPropagation()
      this.triggerEvent('like', { id: this.data.diary.id })
      this.setData({ showLikeAnim: true })
      setTimeout(() => this.setData({ showLikeAnim: false }), 800)
    },

    onFav(e) {
      e.stopPropagation()
      this.triggerEvent('fav', { id: this.data.diary.id })
    },

    onEdit(e) {
      e.stopPropagation()
      this.triggerEvent('edit', { id: this.data.diary.id })
    },

    onDelete(e) {
      e.stopPropagation()
      this.triggerEvent('delete', { id: this.data.diary.id })
    },

    onShare(e) {
      e.stopPropagation()
      this.triggerEvent('share', { id: this.data.diary.id })
    },

    getPermLabel(perm) {
      if (perm === 'public') return '公众'
      if (perm === 'member') return '会员'
      if (perm === 'private') return '私密'
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
