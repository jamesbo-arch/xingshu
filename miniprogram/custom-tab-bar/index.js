Component({
  data: {
    selected: 0,
    color: '#A8A39B',
    selectedColor: '#2A2723',
    list: [
      { pagePath: 'pages/square/index', text: '醒书广场', icon: '◎', activeIcon: '◉' },
      { pagePath: 'pages/activities/index', text: '醒书活动', icon: '▢', activeIcon: '▣' },
      { pagePath: 'pages/collections/index', text: '我的收藏', icon: '◇', activeIcon: '◆' },
      { pagePath: 'pages/mine/index', text: '我的日记', icon: '○', activeIcon: '●' },
      { pagePath: 'pages/member/index', text: '会员中心', icon: '☆', activeIcon: '★' },
    ],
  },
  methods: {
    switchTab(e) {
      const { index, path } = e.currentTarget.dataset
      wx.switchTab({ url: '/' + path })
      this.setData({ selected: index })
    },
  },
})
