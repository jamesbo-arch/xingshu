Component({
  properties: {
    visible: { type: Boolean, value: false },
    identity: { type: String, value: 'guest' }, // 'guest' | 'authed'
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
