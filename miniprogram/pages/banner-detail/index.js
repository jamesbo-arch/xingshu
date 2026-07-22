// Banner 详情：活动介绍类图文（后台富文本编辑），免登录可读
const activityApi = require('../../api/activity')
const toast = require('../../utils/toast')

Page({
  data: {
    banner: null,
    nodes: '',
    statusBarHeight: 0,
  },

  onLoad(options) {
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 0 })
    const id = options.id ? parseInt(options.id, 10) : null
    if (id) this._load(id)
  },

  async _load(id) {
    const data = await activityApi.getBannerDetail(id)
    if (!data) {
      toast.error('内容不存在')
      setTimeout(() => this.onBack(), 1200)
      return
    }
    this.setData({ banner: data, nodes: data.content_rich || '' })
    if (data.title) wx.setNavigationBarTitle({ title: data.title })
  },

  onBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/activities/index' }) })
  },

  onShareAppMessage() {
    const b = this.data.banner || {}
    return {
      title: b.title || '醒书活动',
      path: `/pages/banner-detail/index?id=${b.id}`,
    }
  },
})
