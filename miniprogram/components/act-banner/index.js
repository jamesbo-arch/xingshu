// 近期活动预告轮播（广场页 / 活动页共用）：自取数据（与广场同一 10 分钟缓存），
// 多场自动轮播（10s），点击进活动详情；数量变化时 triggerEvent('change', { count })，
// 宿主页据此做让位（列表底部 padding、FAB 上移）。定位（fixed 容器)由宿主页提供。
const activityApi = require('../../api/activity')
const cache = require('../../utils/cache')
const { throttle } = require('../../utils/guard')

// 手动关闭标记：内存标记 + 本地存储（12 小时）双保险——纯内存标记在部分环境/在途请求竞态下
// 会被绕过（关闭后下拉刷新轮播复活），存储化后关闭状态跨页面、跨会话稳定生效，12 小时后自动恢复
let dismissed = false
const DISMISS_KEY = 'actbanner:dismissed'
const DISMISS_TTL_MIN = 12 * 60

function isDismissed() {
  return dismissed || !!require('../../utils/cache').get(DISMISS_KEY)
}

Component({
  options: { addGlobalClass: true },

  data: { banners: [] },

  lifetimes: {
    attached() { this.load() },
  },

  methods: {
    // force=true 绕过缓存强制重取（下拉刷新时新发活动立即可见），并视为用户主动召回——
    // 清除手动关闭标记重新展示；非 force（onShow/切页）则维持关闭状态
    async load(force) {
      if (force) {
        dismissed = false
        cache.remove(DISMISS_KEY)
      }
      if (isDismissed()) {
        this.setData({ banners: [] })
        this.triggerEvent('change', { count: 0 })
        return
      }
      let list = force ? null : cache.get('square:actbanners2')
      if (list === null) {
        const data = await activityApi.getList()
        if (!data) return
        list = (data.upcoming || []).map(a => ({ id: a.id, title: a.title, start_time: a.start_time, type: a.type }))
        cache.set('square:actbanners2', list, 10)
      }
      // 网络在途期间被手动关闭 → 丢弃本次结果，避免关闭后又被画回来
      if (isDismissed()) return
      const banners = this._decorate(list)
      this.setData({ banners })
      this.triggerEvent('change', { count: banners.length })
    },

    // 未开始过滤 + 展示字段派生统一放读取侧：无论数据来自网络还是缓存，周几/线上线下都现算
    _decorate(list) {
      const now = Date.now()
      return (list || [])
        .filter(a => new Date(String(a.start_time).replace(/-/g, '/')).getTime() > now)
        .map(a => ({
          ...a,
          week: this._weekOf(a.start_time),
          channelText: a.type === 'online' ? '线上' : '线下',
        }))
    },

    // 「周几」文案：start_time 为 "YYYY-MM-DD HH:mm" 北京时间字面量，iOS 解析需 '/'
    _weekOf(t) {
      const d = new Date(String(t).replace(/-/g, '/'))
      return isNaN(d.getTime()) ? '' : '周' + '日一二三四五六'[d.getDay()]
    },

    onTap(e) {
      const id = Number(e.currentTarget.dataset.id)
      if (id) throttle(this, 'actbanner', () => wx.navigateTo({ url: `/pages/activity-detail/index?id=${id}` }))
    },

    // 手动关闭：12 小时内不再显示（所有页面同步，跨会话生效，到期自动恢复）
    onClose() {
      dismissed = true
      cache.set(DISMISS_KEY, 1, DISMISS_TTL_MIN)
      this.setData({ banners: [] })
      this.triggerEvent('change', { count: 0 })
    },
  },
})
