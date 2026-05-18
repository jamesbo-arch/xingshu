const { hueToColor, getInitial } = require('../../utils/color')

Component({
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
  },

  lifetimes: {
    attached() {
      const d = this.data.diary
      if (d && d.avatarHue !== undefined) {
        this.setData({
          avatarColor: hueToColor(d.avatarHue),
          avatarInitial: getInitial(d.author),
        })
      }
    },
  },

  observers: {
    'diary': function(d) {
      if (d && d.avatarHue !== undefined) {
        this.setData({
          avatarColor: hueToColor(d.avatarHue),
          avatarInitial: getInitial(d.author),
        })
      }
    },
  },

  data: {
    avatarColor: '#8B7A4A',
    avatarInitial: '?',
    showLikeAnim: false,
  },
})
