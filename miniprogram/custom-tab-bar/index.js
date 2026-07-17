const { isValidMember } = require('../utils/auth-guard')

// 全量页签；按身份裁剪（v3.0）：
//   guest 未授权 → 广场 / 活动 / 会员中心（收藏与我的故事无内容可看，藏起来）
//   authed 已授权非会员 → 再加「我的收藏」
//   member 有效会员 → 再加「我的故事」（写故事为会员专享）
// ic 为 app.wxss 里线性图标类前缀，激活态自动拼 -on（对齐原型 lucide 导航图标）
const FULL_LIST = [
  { pagePath: 'pages/square/index', text: '醒书广场', ic: 'nav-square', minRole: 'guest' },
  { pagePath: 'pages/collections/index', text: '我的收藏', ic: 'nav-collect', minRole: 'authed' },
  { pagePath: 'pages/activities/index', text: '醒书活动', ic: 'nav-act', minRole: 'guest' },
  { pagePath: 'pages/mine/index', text: '我的故事', ic: 'nav-mine', minRole: 'member' },
  { pagePath: 'pages/member/index', text: '会员中心', ic: 'nav-member', minRole: 'guest' },
]

const RANK = { guest: 0, authed: 1, member: 2 }

Component({
  // 允许 app.wxss 的全局线性图标类（nav-*）穿透组件样式隔离
  options: { addGlobalClass: true },
  data: {
    selected: 0,
    hidden: false,  // 底部弹层打开时隐藏，避免遮挡弹层按钮
    color: '#A8A39B',
    selectedColor: '#2A2723',
    list: FULL_LIST.filter(t => t.minRole === 'guest'),
  },
  methods: {
    switchTab(e) {
      const { path } = e.currentTarget.dataset
      wx.switchTab({ url: '/' + path })
      // selected 由目标页 onShow 的 refresh(pagePath) 落定，避免动态列表下索引错位
    },

    // 按当前身份裁剪页签并高亮所在页。宿主页 onShow 传自己的 pagePath；
    // 身份变化（登录/退出/开通会员）时由 app.setUser 无参调用，沿用上次的 pagePath。
    refresh(pagePath) {
      if (pagePath) this._path = pagePath
      const user = (getApp().globalData || {}).user || {}
      const identity = isValidMember(user) ? 'member' : (user.identity === 'guest' || !user.identity ? 'guest' : 'authed')
      const list = FULL_LIST.filter(t => RANK[t.minRole] <= RANK[identity])
      const selected = Math.max(0, list.findIndex(t => t.pagePath === this._path))
      this.setData({ list, selected })
    },
  },
})
