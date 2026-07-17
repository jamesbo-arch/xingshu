Component({
  // 允许 app.wxss 的全局线性图标类（nav-*）穿透组件样式隔离
  options: { addGlobalClass: true },
  data: {
    selected: 0,
    hidden: false,  // 底部弹层打开时隐藏，避免遮挡弹层按钮
    color: '#A8A39B',
    selectedColor: '#2A2723',
    // ic 为 app.wxss 里线性图标类前缀，激活态自动拼 -on（对齐原型 lucide 导航图标）
    list: [
      { pagePath: 'pages/square/index', text: '醒书广场', ic: 'nav-square' },
      { pagePath: 'pages/collections/index', text: '我的收藏', ic: 'nav-collect' },
      { pagePath: 'pages/activities/index', text: '醒书活动', ic: 'nav-act' },
      { pagePath: 'pages/mine/index', text: '我的故事', ic: 'nav-mine' },
      { pagePath: 'pages/member/index', text: '会员中心', ic: 'nav-member' },
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
