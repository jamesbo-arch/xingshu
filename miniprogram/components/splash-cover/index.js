// 冷启动品牌蒙布：每日首次冷启动全屏展示一次，用户点「我要进入」后播「开启」动效再退场
// 由 utils/splash.js 的 claim() 决定弹在广场还是详情页，挂载方见各启动页 onLoad
const OPEN_MS = 560   // 开启动效总时长（钤印 220ms + 推开 340ms），须与 wxss 保持一致

Component({
  // 允许 app.wxss 的全局类（paper-bg / serif / btn-primary）穿透组件样式隔离
  options: { addGlobalClass: true },

  properties: {
    visible: { type: Boolean, value: false },
  },

  data: {
    _mounted: false,
    _show: false,
    _opening: false,
  },

  lifetimes: {
    // 挂载方在 onLoad 即置 visible=true，此时 visible 是首渲染的初始属性值，
    // observer 不触发会导致蒙布永不挂载（与 login-sheet 同一个坑）——attached 补挂载一次
    attached() {
      if (this.data.visible && !this.data._mounted) this._mount()
    },
  },

  observers: {
    'visible': function(val) {
      if (val && !this.data._mounted) this._mount()
    },
  },

  methods: {
    _mount() {
      this.setData({ _mounted: true })
      setTimeout(() => this.setData({ _show: true }), 20)
    },

    noop() {},

    onEnter() {
      if (this.data._opening) return   // 防连点触发两次退场
      this.setData({ _opening: true })
      setTimeout(() => {
        this.setData({ _mounted: false, _show: false, _opening: false })
        this.triggerEvent('enter')
      }, OPEN_MS)
    },
  },
})
