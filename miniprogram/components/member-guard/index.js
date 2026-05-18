Component({
  properties: {
    visible: { type: Boolean, value: false },
    identity: { type: String, value: 'guest' },
  },

  data: {
    _mounted: false,
    _show: false,
  },

  observers: {
    'visible': function(val) {
      if (val) {
        this.setData({ _mounted: true })
        setTimeout(() => this.setData({ _show: true }), 20)
      } else {
        this.setData({ _show: false })
        setTimeout(() => this.setData({ _mounted: false }), 320)
      }
    },
  },

  methods: {
    onClose() {
      this.triggerEvent('close')
    },

    onAuthorize() {
      this.triggerEvent('authorize')
    },

    onJoinMember() {
      this.triggerEvent('joinMember')
    },
  },
})
