// 提问 / 编辑问题（会员专享）：仅正文 + 匿名开关 + 暂存/发布双按钮
const qaApi = require('../../api/qa')
const toast = require('../../utils/toast')
const { lock } = require('../../utils/guard')

const MAX = 2000

Page({
  data: {
    id: null,          // 有值即编辑模式
    content: '',
    isAnonymous: false,
    statusBarHeight: 0,
    max: MAX,
  },

  onLoad(options) {
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 0 })
    const id = options.id ? parseInt(options.id, 10) : null
    if (id) {
      this.setData({ id })
      this._loadForEdit(id)
    }
  },

  async _loadForEdit(id) {
    const res = await qaApi.getDetailRaw(id)
    if (res.code !== 0 || !res.data) {
      toast.error(res.msg || '问题不存在')
      setTimeout(() => wx.navigateBack(), 1200)
      return
    }
    const q = res.data.question
    this.setData({ content: q.content, isAnonymous: !!q.is_anonymous })
  },

  onContentInput(e) { this.setData({ content: e.detail.value }) },
  onToggleAnonymous(e) { this.setData({ isAnonymous: e.detail.value }) },

  onSaveDraft() { this._submit('draft') },
  onPublish() { this._submit('published') },

  _submit(publishStatus) {
    const content = this.data.content.trim()
    if (!content) { toast.info('写点什么再提交吧'); return }
    if (content.length > MAX) { toast.info(`问题不超过 ${MAX} 字`); return }
    return lock(this, 'submit', async () => {
      const payload = { content, isAnonymous: this.data.isAnonymous, publishStatus }
      const r = this.data.id
        ? await qaApi.update(this.data.id, payload)
        : await qaApi.create(payload)
      if (!r) return
      toast.success(publishStatus === 'draft' ? '已暂存' : '已发布')
      setTimeout(() => wx.navigateBack(), 900)
    })
  },

  onBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/qa/index' }) })
  },
})
