const { hueToColor, getInitial } = require('../../utils/color')
const { formatTime } = require('../../utils/mapper')
const storyApi = require('../../api/story')

// 读者/互动人员清单弹窗（作者视角）——type：read/like/favorite/comment
Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
    type: { type: String, value: 'read' },
    storyId: { type: null, value: null },
  },

  data: {
    _mounted: false,
    _show: false,
    list: [],
    total: 0,
    page: 1,
    hasMore: false,
    loading: false,
  },

  observers: {
    'visible': function(val) {
      if (val) {
        // 每次打开重置并加载首页（type/storyId 与 visible 同帧下发，此时已是最新值）
        this.setData({ _mounted: true, list: [], total: 0, page: 1, hasMore: false })
        setTimeout(() => this.setData({ _show: true }), 20)
        this._load(true)
      } else {
        this.setData({ _show: false })
        setTimeout(() => this.setData({ _mounted: false }), 320)
      }
    },
  },

  methods: {
    async _load(reset) {
      if (this.data.loading) return
      if (!reset && !this.data.hasMore) return
      const page = reset ? 1 : this.data.page
      this.setData({ loading: true })
      try {
        const data = await storyApi.getAudience(this.data.storyId, this.data.type, page)
        if (!data) return
        const rows = data.list.map(r => {
          const name = r.user_name || ''
          const hue = r.user_avatar_hue
          return {
            content: r.content || '',
            displayName: name || '匿名读者',
            avatarColor: hue != null ? hueToColor(hue) : '#B0AAA0',
            avatarInitial: name ? getInitial(name) : '读',
            timeText: formatTime(r.created_at),
          }
        })
        const list = reset ? rows : this.data.list.concat(rows)
        this.setData({
          list,
          total: data.total,
          page: page + 1,
          hasMore: list.length < data.total,
        })
      } finally {
        this.setData({ loading: false })
      }
    },

    onReachBottom() {
      this._load(false)
    },

    onClose() {
      this.triggerEvent('close')
    },

    // 阻止点击面板内容穿透到遮罩
    noop() {},
  },
})
