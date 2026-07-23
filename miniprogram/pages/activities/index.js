// 醒书活动页（v2.0 单页版，同时是小程序首页）：
//   顶部可手动拨动的 Banner 轮播（后台管理）+ 下方活动列表（原「全部活动」）
// 「活动分享」瀑布流子栏目暂时隐藏——SHOW_FEED 置回 true 即可恢复，相关代码全部保留。
const SHOW_FEED = false
const activityApi = require('../../api/activity')
const toast = require('../../utils/toast')
const { throttle, lock } = require('../../utils/guard')
const { ensureLogin, handleLoginSuccess } = require('../../utils/auth-guard')
const { hueToColor, getInitial } = require('../../utils/color')
const { formatTime } = require('../../utils/mapper')
const splash = require('../../utils/splash')
const cache = require('../../utils/cache')

const CN_DIGIT = '〇一二三四五六七八九'
const CN_MONTH = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']

// "2026-07-12" → "7月12日（周六）"——分享卡活动标签后的场次日期
function actDateLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(String(dateStr).replace(/-/g, '/'))
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}月${d.getDate()}日（周${'日一二三四五六'[d.getDay()]}）`
}

Page({
  data: {
    statusBarHeight: 0,
    showFeed: SHOW_FEED,
    tab: SHOW_FEED ? 'share' : 'all',  // share=活动分享 | all=全部活动（隐藏分享后恒为 all）
    refreshing: false,
    banners: [],        // v2.0 顶部轮播（后台管理，免登录可见）
    // 活动分享瀑布流（双列 JS 分配）
    colL: [],
    colR: [],
    feedPage: 1,
    feedHasMore: false,
    feedLoaded: false,
    // 全部活动
    allActs: [],        // 一次取回的全量（含 month/typeId），筛选在本地做
    actItems: [],       // 平铺行 + 月份分隔（kind: 'month' | 'act'），供渲染
    allLoaded: false,
    types: [],
    months: [],         // 由活动实际分布派生的月份候选
    activeTypeId: 0,    // 0 = 全部类型
    activeMonth: '',    // '' = 全部时间
    typeLabel: '全部类型',
    monthLabel: '全部时间',
    filterActive: false,
    showTypeDrop: false,   // 类型下拉展开中
    showMonthDrop: false,  // 月份下拉展开中
    // FAB 直达发布分享（带场次选择）
    showLoginSheet: false,
    showPostSheet: false,
    _postShow: false,
    postContent: '',
    postImages: [],
    postVideo: '',       // 本地视频临时路径（与照片互斥，最多 1 段）
    postables: [],       // 可分享场次：已报名且已开始，按活动时间倒序
    postableTitles: [],
    postActIndex: 0,
    isGuest: true,      // 未授权：视频卡渲染占位块，点击先拉登录
    showSplash: false,  // 冷启动品牌蒙布（v2.0 起本页为启动首页，由本页认领）
  },

  onLoad() {
    const info = wx.getWindowInfo()
    this.setData({
      statusBarHeight: info.statusBarHeight || 0,
      showSplash: splash.claim('home'),
    })
    this._syncGuest()
    this._loadBanners()
    this._loadTypes()
    if (SHOW_FEED) this._loadFeed(true)
    else this._loadAll()
  },

  onSplashEnter() {
    this.setData({ showSplash: false })
    this._tabBar(false)
  },

  // ── 顶部 Banner 轮播 ──

  async _loadBanners(force) {
    // 冷启动首屏先用缓存（轮播是首页第一屏内容，等网络会明显空一块）
    if (!force && !this.data.banners.length) {
      const cached = cache.get('banners')
      if (cached) this.setData({ banners: cached })
    }
    const list = await activityApi.getBanners()
    if (list) {
      this.setData({ banners: list })
      cache.set('banners', list, 30)
    }
  },

  // 仅 link_type='detail' 的 Banner 可点进详情；纯展示不响应
  onBannerTap(e) {
    const { id, link } = e.currentTarget.dataset
    if (link !== 'detail') return
    throttle(this, 'banner', () => wx.navigateTo({ url: '/pages/banner-detail/index?id=' + id }))
  },

  // 未授权态：视频卡不渲染 video 组件（原生组件盖不住，无法拦截点击），
  // 改渲染占位块，点击走 onOpenPost 拉登录；登录后重新同步即可播放
  _syncGuest() {
    const identity = (getApp().globalData.user || {}).identity || 'guest'
    this.setData({ isGuest: identity === 'guest' })
  },

  onShow() {
    this._syncGuest()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().refresh('pages/activities/index')
    }
    // 从活动详情返回时同步报名/收藏状态（详情内报名或收藏后，列表状态需重新派生）
    if (this.data.tab === 'all' && this.data.allLoaded) this._loadAll()
    // tab-bar 是独立层会盖在页面级蒙布之上，须隐藏；onLoad 时 getTabBar() 尚未就绪，故放这里
    if (this.data.showSplash) this._tabBar(true)
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab })
    // 全部活动首次进入才拉取
    if (tab === 'all' && !this.data.allLoaded) this._loadAll()
  },

  async onRefresh() {
    this.setData({ refreshing: true })
    try {
      if (this.data.tab === 'share') {
        await this._loadFeed(true)
      } else {
        await Promise.all([this._loadAll(), this._loadTypes(), this._loadBanners(true)])
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
      video: p.video || '',
      videoPoster: p.video_poster || '',
      // 图卡高度取三档（按 id 稳定散布），瀑布流有节奏且估高准确
      imgH: [260, 320, 380][p.id % 3],
      imgCount: images.length,
      text: p.content || '',
      nickname: p.nickname,
      avatarUrl: p.avatar_url || '',
      avatarColor: hueToColor(p.avatar_hue),
      initial: getInitial(p.nickname),
      actLabel: p.type_name || p.activity_title,
      actDate: actDateLabel(p.activity_date),
      timeText: formatTime(p.created_at),
      likeCount: p.like_count || 0,
      isLiked: !!p.isLiked,
    }
  },

  // 分享点赞：乐观翻转（双列各自定位补丁），失败回滚，成功用后端权威值校准
  onLikePost(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (!ensureLogin(this, () => this.onLikePost(e))) return
    return lock(this, 'plike' + id, async () => {
      const flip = (p) => ({ ...p, isLiked: !p.isLiked, likeCount: Math.max(0, p.likeCount + (p.isLiked ? -1 : 1)) })
      this._patchPost(id, flip)
      const r = await activityApi.likePost(id)
      if (!r) { this._patchPost(id, flip); return }
      this._patchPost(id, p => ({ ...p, isLiked: r.liked, likeCount: r.likeCount }))
    })
  },

  _patchPost(id, fn) {
    const patch = {}
    ;['colL', 'colR'].forEach(col => {
      const i = this.data[col].findIndex(p => p.id === id)
      if (i >= 0) patch[`${col}[${i}]`] = fn(this.data[col][i])
    })
    if (Object.keys(patch).length) this.setData(patch)
  },

  // 视频卡 catchtap 占位：拦截冒泡防误入详情（播放交互交给 video 组件自身）
  noop() {},

  _estHeight(p) {
    let h = 90 // 底部作者栏 + 边距
    if (p.video) h += 320
    else if (p.image) h += p.imgH
    if (p.text) {
      const lines = Math.min(Math.ceil(p.text.length / 13), (p.image || p.video) ? 2 : 6)
      h += lines * 34 + 20
    }
    return h
  },

  onFeedMore() {
    if (this.data.feedHasMore) this._loadFeed(false)
  },

  // 分享卡点击 → 该活动详情并定位到现场分享区；未登录先在本页拉起登录弹窗（同全部活动列表）
  onOpenPost(e) {
    const id = Number(e.currentTarget.dataset.aid)
    if (!id) return
    const open = () => throttle(this, 'open', () => wx.navigateTo({ url: `/pages/activity-detail/index?id=${id}&to=posts` }))
    if (!ensureLogin(this, open)) return
    open()
  },

  onGoAll() {
    this.setData({ tab: 'all' })
    if (!this.data.allLoaded) this._loadAll()
  },

  // ── 页签二：全部活动 ──

  async _loadTypes() {
    const types = await activityApi.getTypes()
    // types 到位后重算标签（首屏 _applyFilter 可能先于本请求返回）
    if (types) this.setData({ types }, () => { if (this.data.allLoaded) this._applyFilter() })
  },

  // 一次取回全部活动（后端 mode:'all' 本就不分页），类型与月份筛选都在本地做——
  // 切筛选条件即时生效、无网络往返，月份候选也能直接从真实数据里派生
  async _loadAll() {
    const data = await activityApi.getList(undefined, 'all')
    if (!data) return
    const now = Date.now()
    const all = data.list.map(a => ({
      ...this._decorateAct(a, now),
      month: String(a.start_time).slice(0, 7),
      typeId: a.type_id || 0,
    }))
    // 月份候选按活动实际分布派生（已按开始时间倒序，去重即为倒序月份）
    const months = []
    for (const a of all) {
      if (!months.some(m => m.key === a.month)) {
        // 跨年时只写「七月」会有歧义，故带上年份
        months.push({ key: a.month, label: `${a.month.slice(0, 4)}年${+a.month.slice(5)}月` })
      }
    }
    this.setData({ allActs: all, months, allLoaded: true }, () => this._applyFilter())
  },

  // 按当前类型/月份筛选并插入月份分隔行
  _applyFilter() {
    const { allActs, activeTypeId, activeMonth } = this.data
    const items = []
    let lastMonth = ''
    for (const a of allActs) {
      if (activeTypeId && a.typeId !== activeTypeId) continue
      if (activeMonth && a.month !== activeMonth) continue
      if (a.month !== lastMonth) {
        items.push({ kind: 'month', key: 'm' + a.month, label: this._cnMonth(a.month) })
        lastMonth = a.month
      }
      items.push({ kind: 'act', key: 'a' + a.id, ...a })
    }
    const type = this.data.types.find(t => t.id === activeTypeId)
    const month = this.data.months.find(m => m.key === activeMonth)
    this.setData({
      actItems: items,
      typeLabel: type ? type.name : '全部类型',
      monthLabel: month ? month.label : '全部时间',
      filterActive: !!(activeTypeId || activeMonth),
    })
  },

  // 状态：已报名（未开始且本人已报）> 报名中（未开始）/ 进行中（已开始未结束，无 end_time 按开始后 24h 内）/ 已结束
  _decorateAct(a, now) {
    const start = new Date(String(a.start_time).replace(/-/g, '/')).getTime()
    const end = a.end_time
      ? new Date(String(a.end_time).replace(/-/g, '/')).getTime()
      : start + 24 * 3600 * 1000
    let st = 'done', stLabel = '已结束'
    if (a.status !== 'finished') {
      if (now < start) {
        if (a.isSignedUp) { st = 'signed'; stLabel = '已报名' }
        else { st = 'open'; stLabel = '报名中' }
      }
      else if (now <= end) { st = 'live'; stLabel = '进行中' }
    }
    const full = st === 'open' && a.capacity > 0 && a.signup_count >= a.capacity
    const type = this._typeStyle(a.type_name, a.type)
    return {
      id: a.id,
      title: a.title,
      st, stLabel, full,
      timeText: this._rowTime(a.start_time, a.end_time),
      formText: this._rowForm(a),
      ownerText: this._rowOwner(a),
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

  // "2026-07-15 08:30" + "2026-07-15 12:00" → "07-15 周三 08:30-12:00"
  // 跨天则结束端补上日期："07-15 周三 08:30 → 07-16 10:00"；无结束时间只显开始
  _rowTime(t, endT) {
    const s = String(t)
    const d = new Date(s.replace(/-/g, '/'))
    const week = isNaN(d.getTime()) ? '' : ' 周' + '日一二三四五六'[d.getDay()]
    const head = s.slice(5, 10) + week + ' ' + s.slice(11, 16)
    if (!endT) return head
    const e = String(endT)
    if (e.slice(0, 10) === s.slice(0, 10)) return head + '-' + e.slice(11, 16)
    return head + ' → ' + e.slice(5, 10) + ' ' + e.slice(11, 16)
  },

  // 形式行：线下→活动地点，线上→会议号。
  // 线上的 location 是腾讯会议号，云函数**只对已报名者下发**，未报名时拿到的是空串，
  // 故这里不需要（也无法）自己判断报名态——有值即显示会议号，无值只写「线上」。
  _rowForm(a) {
    if (a.type === 'online') {
      return a.location ? '会议号：' + a.location : '线上'
    }
    const spot = a.location || a.city
    return spot ? '活动地点：' + spot : '线下'
  },

  // 共创组织者行：只取 owner_name（云函数按 owner_user_id 关联 users 得来）。
  // **不兜底 a.organizer**——那是遗留文本列，全库都是默认值「醒书运营组」，
  // 拿它兜底会让未指派主理人的活动也显示这行；未填就整行不显示。
  _rowOwner(a) {
    return a.owner_name ? '共创组织者：' + a.owner_name : ''
  },

  // "2026-07" → "二〇二六 · 七月"
  _cnMonth(ym) {
    const [y, m] = ym.split('-')
    const yCn = y.split('').map(c => CN_DIGIT[+c]).join('')
    return `${yCn} · ${CN_MONTH[+m - 1]}月`
  },

  // ── 筛选下拉（类型 / 月份互斥展开，选中即收起）──
  // 面板贴着筛选栏往下展开、不到底部，故无需像底部弹层那样收起 tab-bar

  onOpenTypeDrop() {
    this.setData({ showTypeDrop: !this.data.showTypeDrop, showMonthDrop: false })
  },
  onOpenMonthDrop() {
    this.setData({ showMonthDrop: !this.data.showMonthDrop, showTypeDrop: false })
  },
  onCloseDrop() { this.setData({ showTypeDrop: false, showMonthDrop: false }) },

  onTypeTap(e) {
    const id = Number(e.currentTarget.dataset.id) || 0
    this.setData({ activeTypeId: id, showTypeDrop: false }, () => this._applyFilter())
  },

  onMonthTap(e) {
    const key = e.currentTarget.dataset.ym || ''
    this.setData({ activeMonth: key, showMonthDrop: false }, () => this._applyFilter())
  },

  onResetFilter() {
    this.setData({ activeTypeId: 0, activeMonth: '', showTypeDrop: false, showMonthDrop: false },
      () => this._applyFilter())
  },

  // 未登录点活动行：先在列表页拉起登录弹窗（同广场故事列表），登录成功自动进详情
  onOpen(e) {
    const id = e.currentTarget.dataset.id
    const open = () => throttle(this, 'open', () => wx.navigateTo({ url: `/pages/activity-detail/index?id=${id}` }))
    if (!ensureLogin(this, open)) return
    open()
  },

  // ── FAB 直达发布分享 ──

  _tabBar(hidden) { const tb = this.getTabBar && this.getTabBar(); if (tb) tb.setData({ hidden }) },

  onLoginClose() {
    this.setData({ showLoginSheet: false })
    this._tabBar(false)
    this._pendingLoginAction = null
  },
  onLoginSuccess() { this._syncGuest(); handleLoginSuccess(this) },

  // FAB：登录 → 取可分享场次（已报名且已开始，list mode:all 已按时间倒序）→ 打开发布弹窗
  onShareFab() {
    if (!ensureLogin(this, () => this.onShareFab())) return
    return lock(this, 'sharefab', async () => {
      const data = await activityApi.getList(undefined, 'all')
      if (!data) return
      const now = Date.now()
      const postables = (data.list || []).filter(a =>
        a.isSignedUp && new Date(String(a.start_time).replace(/-/g, '/')).getTime() <= now)
      if (!postables.length) {
        wx.showModal({
          title: '暂无可分享的活动',
          content: '报名参加活动、活动开始后即可分享现场。去「全部活动」看看近期场次吧。',
          showCancel: false,
          confirmText: '知道了',
        })
        return
      }
      this.setData({
        postables,
        postableTitles: postables.map(a => `${a.title}（${String(a.start_time).slice(5, 16)}）`),
        postActIndex: 0,
        postContent: '',
        postImages: [],
        postVideo: '',
        showPostSheet: true,
      })
      this._tabBar(true)
      setTimeout(() => this.setData({ _postShow: true }), 20)
    })
  },

  onPostActChange(e) { this.setData({ postActIndex: Number(e.detail.value) || 0 }) },
  onClosePostSheet() {
    this.setData({ _postShow: false })
    this._tabBar(false)
    setTimeout(() => this.setData({ showPostSheet: false }), 300)
  },
  onPostInput(e) { this.setData({ postContent: e.detail.value }) },
  // 媒体二选一：最多 9 张照片 或 1 段视频。未选任何媒体时可挑照片或视频；已有照片则只能续加照片
  onAddPostImage() {
    if (this.data.postVideo) return
    const remaining = 9 - this.data.postImages.length
    if (remaining <= 0) return
    const hasImages = this.data.postImages.length > 0
    wx.chooseMedia({
      count: remaining,   // 一次可多选（朋友圈式）；mix 模式下选到视频仅取 1 段
      mediaType: hasImages ? ['image'] : ['mix'],
      maxDuration: 60,
      sourceType: ['album', 'camera'],
      success: res => {
        const files = res.tempFiles || []
        if (!files.length) return
        if (!hasImages && files[0].fileType === 'video') {
          const v = files[0]
          if (v.duration && v.duration > 181) { toast.info('视频不超过 3 分钟', 2000); return }
          if (v.size && v.size > 100 * 1024 * 1024) { toast.info('视频不超过 100MB，请压缩后再传', 2000); return }
          // thumbTempFilePath 为微信给出的视频首帧缩略图，随视频一并上传作封面
          this._postVideoThumb = v.thumbTempFilePath || ''
          this.setData({ postVideo: v.tempFilePath })
          return
        }
        const paths = files.filter(f => f.fileType !== 'video').map(f => f.tempFilePath)
        if (paths.length < files.length) toast.info('照片与视频不能混发', 2000)
        if (paths.length) this.setData({ postImages: [...this.data.postImages, ...paths].slice(0, 9) })
      },
    })
  },
  onRemovePostImage(e) {
    const images = [...this.data.postImages]
    images.splice(Number(e.currentTarget.dataset.index), 1)
    this.setData({ postImages: images })
  },
  onRemovePostVideo() {
    this._postVideoThumb = ''
    this.setData({ postVideo: '' })
  },
  onPreviewPickImage(e) {
    wx.previewImage({
      current: this.data.postImages[Number(e.currentTarget.dataset.index)],
      urls: this.data.postImages,
    })
  },

  async onSubmitPost() {
    return lock(this, 'submitPost', async () => {
      const act = this.data.postables[this.data.postActIndex]
      if (!act) return
      const content = this.data.postContent.trim()
      if (!content && !this.data.postImages.length && !this.data.postVideo) { toast.info('写点文字、选张照片或视频吧'); return }
      // 本地媒体上传云存储换 fileID（同活动详情发布弹层，前缀 activity-posts/）
      let images = [], video = '', videoPoster = ''
      try {
        if (this.data.postImages.length) wx.showLoading({ title: '上传照片中…', mask: true })
        for (const img of this.data.postImages) {
          if (img.indexOf('cloud://') === 0) { images.push(img); continue }
          const extMatch = img.match(/\.(\w+)$/)
          const ext = extMatch ? extMatch[1] : 'jpg'
          const cloudPath = `activity-posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
          const res = await wx.cloud.uploadFile({ cloudPath, filePath: img })
          images.push(res.fileID)
        }
        if (this.data.postVideo) {
          wx.showLoading({ title: '上传视频中…', mask: true })
          const extMatch = this.data.postVideo.match(/\.(\w+)$/)
          const ext = extMatch ? extMatch[1] : 'mp4'
          const cloudPath = `activity-posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
          const res = await wx.cloud.uploadFile({ cloudPath, filePath: this.data.postVideo })
          video = res.fileID
          // 首帧封面（失败不影响发布，前端回退占位块）
          if (this._postVideoThumb) {
            try {
              const tp = `activity-posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-poster.jpg`
              const tr = await wx.cloud.uploadFile({ cloudPath: tp, filePath: this._postVideoThumb })
              videoPoster = tr.fileID
            } catch (e) { console.warn('[post] 视频封面上传失败，跳过') }
          }
        }
      } catch (err) {
        wx.hideLoading()
        toast.error('媒体上传失败，请重试')
        return
      }
      if (this.data.postImages.length || this.data.postVideo) wx.hideLoading()
      const r = await activityApi.createPost(act.id, { content, images, video, videoPoster })
      if (r) {
        toast.success('已分享')
        this.onClosePostSheet()
        this._loadFeed(true)
      }
    })
  },
})
