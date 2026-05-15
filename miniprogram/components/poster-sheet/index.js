const { hueToColor, getInitial } = require('../../utils/color')

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    diary: {
      type: Object,
      value: null,
    },
  },

  data: {
    avatarColor: '#8B7A4A',
    avatarInitial: '?',
    contentExcerpt: '',
  },

  observers: {
    'diary': function(d) {
      if (d) {
        const lines = (d.content || '').split('\n').filter(l => l.trim())
        const excerpt = lines.slice(0, 5).join('\n')
        this.setData({
          avatarColor: hueToColor(d.avatarHue || 60),
          avatarInitial: getInitial(d.author),
          contentExcerpt: excerpt,
        })
      }
    },
  },

  methods: {
    onMaskTap() {
      this.triggerEvent('close')
    },

    onSheetTap(e) {
      e.stopPropagation()
    },

    onSaveImage() {
      wx.showToast({ title: '保存功能需要真机', icon: 'none', duration: 2000 })
    },

    onShareWechat() {
      wx.showToast({ title: '请使用右上角分享', icon: 'none', duration: 2000 })
    },
  },
})
