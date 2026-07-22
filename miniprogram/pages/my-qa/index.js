// 我的问答（非页签，入口在醒书会员页）：自己的全部问题，含暂存稿
const qaApi = require('../../api/qa')
const toast = require('../../utils/toast')
const { ensureMember } = require('../../utils/auth-guard')
const { lock, throttle } = require('../../utils/guard')

Page({
  data: {
    questions: [],
    page: 1,
    hasMore: true,
    refreshing: false,
    loaded: false,
    statusBarHeight: 0,
  },

  onLoad() {
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 0 })
  },

  onShow() { this._load(true) },

  onBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/member/index' }) })
  },

  async _load(reset) {
    if (this._loading) return
    this._loading = true
    const page = reset ? 1 : this.data.page
    const data = await qaApi.getList({ mode: 'mine', page })
    if (data) {
      this.setData({
        questions: reset ? data.list : [...this.data.questions, ...data.list],
        page: page + 1,
        hasMore: data.list.length >= data.pageSize,
        loaded: true,
      })
    }
    this._loading = false
  },

  onCardOpen(e) {
    throttle(this, 'open', () => wx.navigateTo({ url: '/pages/qa-detail/index?id=' + e.detail.id }))
  },

  onCardEdit(e) {
    ensureMember(this, () => throttle(this, 'edit',
      () => wx.navigateTo({ url: '/pages/qa-compose/index?id=' + e.detail.id })))
  },

  onCardDelete(e) {
    const { id } = e.detail
    return lock(this, 'del' + id, async () => {
      const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '删除后不可恢复', success: r }))
      if (!res.confirm) return
      const ok = await qaApi.remove(id)
      if (!ok) return
      this.setData({ questions: this.data.questions.filter(q => q.id !== id) })
      toast.success('删除成功')
    })
  },

  onFabTap() {
    ensureMember(this, () => throttle(this, 'fab', () => wx.navigateTo({ url: '/pages/qa-compose/index' })))
  },

  onReachBottom() { if (this.data.hasMore) this._load(false) },

  async onRefresh() {
    this.setData({ refreshing: true })
    try { await this._load(true) } finally { this.setData({ refreshing: false }) }
  },
})
