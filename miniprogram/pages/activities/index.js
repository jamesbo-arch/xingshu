// 醒书活动页（重构版）：双页签——「活动分享」跨活动瀑布流（默认）+「全部活动」简洁列表（时间倒序）
const activityApi = require('../../api/activity')
const { throttle } = require('../../utils/guard')
const { hueToColor, getInitial } = require('../../utils/color')
const { formatTime } = require('../../utils/mapper')

const CN_DIGIT = '〇一二三四五六七八九'
const CN_MONTH = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']

Page({
  data: {
    statusBarHeight: 0,
    tab: 'share',       // share=活动分享（默认） | all=全部活动
    refreshing: false,
    actBannerCount: 0,  // 预告轮播场次数（组件回报，控制容器显隐与让位）
    // 活动分享瀑布流（双列 JS 分配）
    colL: [],
    colR: [],
    feedPage: 1,
    feedHasMore: false,
    feedLoaded: false,
    // 全部活动
    actItems: [],       // 平铺行 + 月份分隔（kind: 'month' | 'act'）
    allLoaded: false,
    types: [],
    activeTypeId: 0,    // 0 = 全部
  },

  onLoad() {
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 0 })
    this._loadTypes()
    this._loadFeed(true)
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab })
    // 全部活动首次进入才拉取
    if (tab === 'all' && !this.data.allLoaded) this._loadAll()
  },

  onActBannerChange(e) {
    this.setData({ actBannerCount: e.detail.count })
  },

  async onRefresh() {
    this.setData({ refreshing: true })
    try {
      if (this.data.tab === 'share') {
        const banner = this.selectComponent('#actBanner')
        await Promise.all([this._loadFeed(true), banner ? banner.load(true) : null])
      } else {
        await Promise.all([this._loadAll(), this._loadTypes()])
      }
    } finally {
      this.setData({ refreshing: false })
    }
  },

  // ── 页签一：活动分享瀑布流 ──

  async _loadFeed(reset) {
    if (this._feedLoading) return
    this._feedLoading = true
    try {
      const page = reset ? 1 : this.data.feedPage
      const data = await activityApi.getFeed(page)
      if (!data) return
      if (reset) { this._hL = 0; this._hR = 0 }
      const colL = reset ? [] : this.data.colL
      const colR = reset ? [] : this.data.colR
      for (const p of data.list.map(this._mapPost)) {
        // 估高分列：累计高度短的一列插入（图卡按固定档位高，文本卡按行数估）
        const h = this._estHeight(p)
        if (this._hL <= this._hR) { colL.push(p); this._hL += h } else { colR.push(p); this._hR += h }
      }
      this.setData({
        colL, colR,
        feedPage: page + 1,
        feedHasMore: page * data.pageSize < data.total,
        feedLoaded: true,
      })
    } finally {
      this._feedLoading = false
    }
  },

  _mapPost(p) {
    const images = p.images || []
    return {
      id: p.id,
      activityId: p.activity_id,
      image: images[0] || '',
      // 图卡高度取三档（按 id 稳定散布），瀑布流有节奏且估高准确
      imgH: [260, 320, 380][p.id % 3],
      imgCount: images.length,
      text: p.content || '',
      nickname: p.nickname,
      avatarUrl: p.avatar_url || '',
      avatarColor: hueToColor(p.avatar_hue),
      initial: getInitial(p.nickname),
      actLabel: p.type_name || p.activity_title,
      timeText: formatTime(p.created_at),
    }
  },

  _estHeight(p) {
    let h = 90 // 底部作者栏 + 边距
    if (p.image) h += p.imgH
    if (p.text) {
      const lines = Math.min(Math.ceil(p.text.length / 13), p.image ? 2 : 6)
      h += lines * 34 + 20
    }
    return h
  },

  onFeedMore() {
    if (this.data.feedHasMore) this._loadFeed(false)
  },

  // 分享卡点击 → 该活动详情并定位到现场分享区
  onOpenPost(e) {
    const id = Number(e.currentTarget.dataset.aid)
    if (id) throttle(this, 'open', () => wx.navigateTo({ url: `/pages/activity-detail/index?id=${id}&to=posts` }))
  },

  onGoAll() {
    this.setData({ tab: 'all' })
    if (!this.data.allLoaded) this._loadAll()
  },

  // ── 页签二：全部活动 ──

  async _loadTypes() {
    const types = await activityApi.getTypes()
    if (types) this.setData({ types })
  },

  async _loadAll() {
    const data = await activityApi.getList(this.data.activeTypeId || undefined, 'all')
    if (!data) return
    const now = Date.now()
    const items = []
    let lastMonth = ''
    for (const a of data.list) {
      const month = String(a.start_time).slice(0, 7)
      if (month !== lastMonth) {
        items.push({ kind: 'month', key: 'm' + month, label: this._cnMonth(month) })
        lastMonth = month
      }
      items.push({ kind: 'act', key: 'a' + a.id, ...this._decorateAct(a, now) })
    }
    this.setData({ actItems: items, allLoaded: true })
  },

  // 状态三分：报名中（未开始）/ 进行中（已开始未结束，无 end_time 按开始后 24h 内）/ 已结束
  _decorateAct(a, now) {
    const start = new Date(String(a.start_time).replace(/-/g, '/')).getTime()
    const end = a.end_time
      ? new Date(String(a.end_time).replace(/-/g, '/')).getTime()
      : start + 24 * 3600 * 1000
    let st = 'done', stLabel = '已结束'
    if (a.status !== 'finished') {
      if (now < start) { st = 'open'; stLabel = '报名中' }
      else if (now <= end) { st = 'live'; stLabel = '进行中' }
    }
    const full = st === 'open' && a.capacity > 0 && a.signup_count >= a.capacity
    const type = this._typeStyle(a.type_name, a.type)
    return {
      id: a.id,
      title: a.title,
      st, stLabel, full,
      timeText: this._rowTime(a.start_time),
      place: a.type === 'online' ? '线上' : (a.city || '线下'),
      typeName: a.type_name || (a.type === 'online' ? '线上活动' : '线下活动'),
      tico: type.ico,
      tcls: type.cls,
    }
  },

  // 类型 → 图标/配色（按名称关键词，兜底按渠道：线上→月牙、线下→篝火）
  _typeStyle(name, channel) {
    const n = name || ''
    if (n.indexOf('咖啡') >= 0) return { ico: 'coffee', cls: 'tc-brown' }
    if (n.indexOf('观影') >= 0 || n.indexOf('电影') >= 0) return { ico: 'film', cls: 'tc-blue' }
    if (n.indexOf('巧克力') >= 0) return { ico: 'choco', cls: 'tc-cocoa' }
    if (n.indexOf('厨房') >= 0 || n.indexOf('餐') >= 0) return { ico: 'pot', cls: 'tc-gold' }
    if (n.indexOf('故事') >= 0) {
      return channel === 'online' ? { ico: 'moon', cls: 'tc-blue' } : { ico: 'fire', cls: 'tc-red' }
    }
    return channel === 'online' ? { ico: 'moon', cls: 'tc-blue' } : { ico: 'fire', cls: 'tc-red' }
  },

  // "2026-07-15 08:30" → "07-15 周三 08:30"
  _rowTime(t) {
    const s = String(t)
    const d = new Date(s.replace(/-/g, '/'))
    const week = isNaN(d.getTime()) ? '' : ' 周' + '日一二三四五六'[d.getDay()]
    return s.slice(5, 10) + week + ' ' + s.slice(11, 16)
  },

  // "2026-07" → "二〇二六 · 七月"
  _cnMonth(ym) {
    const [y, m] = ym.split('-')
    const yCn = y.split('').map(c => CN_DIGIT[+c]).join('')
    return `${yCn} · ${CN_MONTH[+m - 1]}月`
  },

  onTypeTap(e) {
    const id = Number(e.currentTarget.dataset.id) || 0
    if (id === this.data.activeTypeId) return
    this.setData({ activeTypeId: id }, () => this._loadAll())
  },

  onOpen(e) {
    const id = e.currentTarget.dataset.id
    throttle(this, 'open', () => wx.navigateTo({ url: `/pages/activity-detail/index?id=${id}` }))
  },
})
