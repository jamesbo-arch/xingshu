const app = getApp()
const storyApi = require('../../api/story')
const { throttle } = require('../../utils/guard')

// 数组 → 布尔查找表（WXML 里用 set[key] 判断选中，避免不可靠的 .indexOf() 表达式）
function toTagSet(arr) {
  const o = {}
  ;(arr || []).forEach(t => { o[t] = true })
  return o
}

// 旧故事只有纯文本：转义后按换行转 <br>，供 editor.setContents({html}) 回填
function plainToHtml(s) {
  const esc = String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return '<p>' + esc.replace(/\n/g, '<br>') + '</p>'
}

Page({
  data: {
    storyId: null,
    isEditing: false,
    title: '',
    content: '',
    images: [],
    maxImages: 9,
    selectedTags: [],
    // 两态：暂存(draft 仅自己可见) / 发布(published 面向会员)，公众可见性由后台善选决定
    publishStatus: 'published',
    showTagPicker: false,
    allTags: [],
    pickerSelectedTags: [],
    pickerTagSet: {},
    maxTitle: 30,
    maxContent: 3000,
    statusBarHeight: 0,
    // 富文本工具条：编辑正文时常驻；fmt* 高亮选区已有格式；barBottom 为工具条距底像素（键盘高度+拖拽偏移）
    // barCollapsed：展开/缩小（默认展开），点击把手缩为右侧小把手，缩小态仍可拖拽
    showFormatBar: false,
    barCollapsed: false,
    barBottom: 0,
    fmtBold: false,
    fmtItalic: false,
    fmtUnderline: false,
    fmtOl: false,
    fmtUl: false,
    fmtCenter: false,
    activeColor: '',
    formatColors: [
      { name: '黑', value: '#2A2723' },
      { name: '深红', value: '#B6452F' },
      { name: '黄', value: '#C29013' },
      { name: '蓝', value: '#3A6B9E' },
      { name: '绿', value: '#5B8F6C' },
    ],
  },

  onLoad(options) {
    const info = wx.getWindowInfo()
    this.setData({ statusBarHeight: info.statusBarHeight || 0, allTags: app.globalData.tags })
    // 工具条跟随键盘（editor 不自动避让键盘，官方 editor demo 同款做法）+ 可拖拽上下移
    const safeBottom = info.safeArea ? Math.max(0, (info.screenHeight || 0) - info.safeArea.bottom) : 0
    this._winHeight = info.windowHeight || 667
    this._barBase = Math.round(130 * (info.windowWidth || 375) / 750) + safeBottom // 键盘收起时的默认底距（≈底部操作栏上方）
    this._kb = 0
    this._barOffset = 0 // 用户拖拽的额外抬升量
    this._updateBar()
    this._onKb = res => {
      this._kb = res.height || 0
      // 键盘弹出/高度变化（如候选词栏）时清空拖拽偏移，自动贴键盘顶端；之后仍可手动拖走
      if (this._kb > 0) this._barOffset = 0
      this._updateBar()
    }
    wx.onKeyboardHeightChange(this._onKb)
    // 离开前脏检查的基线：新建为默认值，编辑为加载到的原值
    this._html = ''
    this._original = this._snapshot()

    if (options.storyId) {
      const id = parseInt(options.storyId, 10) || options.storyId
      storyApi.getDetail(id).then(story => {
        if (story) {
          this.setData({
            storyId: story.id, isEditing: true,
            title: story.title || '', content: story.content || '',
            images: story.images || [],
            selectedTags: story.tags || [], publishStatus: story.publish_status || 'published',
          })
          // 正文回填编辑器：有样式版用样式版，旧纯文本故事转义回填；editor 可能尚未 ready，暂存待用
          // 注意 getDetail 返回云函数原始行（snake_case，未过 mapper），样式版字段是 content_rich
          this._pendingHtml = story.content_rich || plainToHtml(story.content || '')
          if (this.editorCtx) this._applyHtml(this._pendingHtml)
        }
      })
    }
  },

  onUnload() {
    if (this._onKb) wx.offKeyboardHeightChange(this._onKb)
  },

  // ===== 富文本编辑器 =====
  onEditorReady() {
    wx.createSelectorQuery().in(this).select('#content-editor').context(res => {
      this.editorCtx = res.context
      if (this._pendingHtml) this._applyHtml(this._pendingHtml)
    }).exec()
  },

  // 回填 html 并以回填后的实际内容为脏检查基线
  _applyHtml(html) {
    this._pendingHtml = null
    this.editorCtx.setContents({
      html,
      success: () => {
        this.editorCtx.getContents({
          success: r => {
            this._html = r.html
            this.setData({ content: (r.text || '').replace(/\n$/, '') })
            this._original = this._snapshot()
          },
        })
      },
    })
  },

  // 输入：text 供计数/必填校验，html 存实例变量（避免每键 setData 大字符串）
  onEditorInput(e) {
    this._html = e.detail.html
    this.setData({ content: (e.detail.text || '').replace(/\n$/, '') })
  },

  // 选区样式变化：按选区已有格式高亮按钮。
  // 注意：statuschange 在选中「无格式纯文本」时不触发（真机验证），不能用它控制工具条显隐，
  // 故工具条改为聚焦常驻（官方 editor demo 同款），仅用本事件做高亮。
  onEditorStatus(e) {
    const f = e.detail || {}
    const color = (f.color || '').toLowerCase()
    const match = this.data.formatColors.find(c => c.value.toLowerCase() === color)
    this.setData({
      fmtBold: !!f.bold, fmtItalic: !!f.italic, fmtUnderline: !!f.underline,
      fmtOl: f.list === 'ordered', fmtUl: f.list === 'bullet', fmtCenter: f.align === 'center',
      activeColor: match ? match.value : '',
    })
  },

  // 工具条底距 = 键盘高度（收起时用默认底距）+ 拖拽偏移；全屏夹取防出界
  _updateBar() {
    const base = this._kb > 0 ? this._kb : this._barBase
    const bottom = Math.min(this._winHeight - 60, Math.max(0, base + this._barOffset))
    this.setData({ barBottom: bottom })
  },

  // 拖拽把手：点住上下移动工具条（catch 阻止页面滚动），范围开放全屏（屏底 ~ 屏顶留自身高度）。
  // 移动未超阈值视为「点击」：缩小态点击展开、展开态点把手缩回右侧。
  onBarDragStart(e) {
    this._dragY = e.touches[0].clientY
    this._dragStartOffset = this._barOffset
    this._dragMoved = false
  },
  onBarDragMove(e) {
    const delta = this._dragY - e.touches[0].clientY // 上移为正
    if (Math.abs(delta) > 8) this._dragMoved = true
    const base = this._kb > 0 ? this._kb : this._barBase
    const min = -base                            // 最低：贴屏幕底边
    const max = this._winHeight - base - 60      // 最高：屏顶留工具条自身高度
    this._barOffset = Math.min(max, Math.max(min, this._dragStartOffset + delta))
    this._updateBar()
  },
  // 展开态把手：拖=移动，点=缩回
  onBarDragEnd() {
    if (!this._dragMoved) this.setData({ barCollapsed: true })
  },
  // 缩小态小把手：拖=移动，点=展开
  onBarTabEnd() {
    if (!this._dragMoved) this.setData({ barCollapsed: false })
  },

  // 编辑正文时工具条常驻键盘上方；失焦（键盘收起）隐藏
  onEditorFocus() {
    this.setData({ showFormatBar: true })
  },

  onEditorBlur() {
    this.setData({
      showFormatBar: false,
      fmtBold: false, fmtItalic: false, fmtUnderline: false,
      fmtOl: false, fmtUl: false, fmtCenter: false, activeColor: '',
    })
  },

  // 应用格式（catch:touchend 触发，保持编辑器焦点与选区）
  onFormat(e) {
    if (!this.editorCtx) return
    const { name, value } = e.currentTarget.dataset
    this.editorCtx.format(name, value)
  },

  // 当前表单快照，用于对比是否有未保存改动
  _snapshot() {
    const { title, content, images, selectedTags } = this.data
    return {
      title: (title || '').trim(),
      content: (content || '').trim(),
      rich: this._html || '',  // 纯格式调整（文字未变）也算改动
      images: (images || []).join(','),
      tags: (selectedTags || []).join(','),
    }
  },
  _isDirty() {
    const a = this._snapshot()
    const b = this._original || {}
    return a.title !== b.title || a.content !== b.content || a.rich !== b.rich ||
      a.images !== b.images || a.tags !== b.tags
  },
  // 有未保存内容时二次确认，确认后才返回；无改动直接返回
  _confirmLeave() {
    // 防连点：无改动时防双击两次 navigateBack；有改动时防弹出两个 modal
    throttle(this, 'leave', () => {
      if (!this._isDirty()) { wx.navigateBack(); return }
      wx.showModal({
        title: this.data.isEditing ? '放弃修改' : '放弃故事',
        content: '当前内容尚未保存，确定要放弃并返回吗？',
        confirmText: '放弃',
        cancelText: '继续编辑',
        confirmColor: '#B23B3B',
        success: res => { if (res.confirm) wx.navigateBack() },
      })
    })
  },
  onCancel() { this._confirmLeave() },

  onTitleInput(e) { this.setData({ title: e.detail.value }) },

  onAddImage() {
    const remaining = this.data.maxImages - this.data.images.length
    if (remaining <= 0) return
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: res => {
        const paths = res.tempFiles.map(f => f.tempFilePath)
        this.setData({ images: [...this.data.images, ...paths] })
      },
    })
  },
  onRemoveImage(e) {
    const images = [...this.data.images]
    images.splice(e.currentTarget.dataset.index, 1)
    this.setData({ images })
  },
  onPreviewImage(e) {
    wx.previewImage({
      current: this.data.images[e.currentTarget.dataset.index],
      urls: this.data.images,
    })
  },
  // 将本地临时图片上传到云存储，已是 fileID 的（编辑模式保留图）原样返回
  async uploadImages() {
    const uploaded = []
    for (const img of this.data.images) {
      if (img.indexOf('cloud://') === 0) { uploaded.push(img); continue }
      const extMatch = img.match(/\.(\w+)$/)
      const ext = extMatch ? extMatch[1] : 'jpg'
      const cloudPath = `story-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const res = await wx.cloud.uploadFile({ cloudPath, filePath: img })
      uploaded.push(res.fileID)
    }
    return uploaded
  },
  removeTag(e) {
    this.setData({ selectedTags: this.data.selectedTags.filter(t => t !== e.currentTarget.dataset.tag) })
  },
  // WXML 不可靠支持 .indexOf()，选中态改绑布尔查找表 pickerTagSet
  onOpenTagPicker() {
    const tags = [...this.data.selectedTags]
    this.setData({ showTagPicker: true, pickerSelectedTags: tags, pickerTagSet: toTagSet(tags) })
  },
  onCloseTagPicker() { this.setData({ showTagPicker: false }) },
  togglePickerTag(e) {
    const tag = e.currentTarget.dataset.tag
    const tags = [...this.data.pickerSelectedTags]
    const idx = tags.indexOf(tag)
    idx >= 0 ? tags.splice(idx, 1) : tags.push(tag)
    this.setData({ pickerSelectedTags: tags, pickerTagSet: toTagSet(tags) })
  },
  onClearPickerTags() { this.setData({ pickerSelectedTags: [], pickerTagSet: {} }) },
  onConfirmTags() { this.setData({ selectedTags: [...this.data.pickerSelectedTags], showTagPicker: false }) },

  onBack() { this._confirmLeave() },

  // 发布前从编辑器取权威内容（text 纯文本 + html 样式版），编辑器未就绪时回退 data
  _getContents() {
    return new Promise(resolve => {
      if (!this.editorCtx) return resolve(null)
      this.editorCtx.getContents({ success: r => resolve(r), fail: () => resolve(null) })
    })
  },

  // 暂存/发布共用提交入口：按钮 dataset.status 决定 publishStatus（draft/published）
  async onSubmit(e) {
    // 防双击：图片上传拉长提交耗时，重复点击会创建重复故事
    if (this._publishing) return
    this._publishing = true
    const publishStatus = (e.currentTarget.dataset.status === 'draft') ? 'draft' : 'published'
    const { title, selectedTags, isEditing, storyId } = this.data
    const c = await this._getContents()
    const content = ((c ? c.text : this.data.content) || '').replace(/\n$/, '')
    const contentRich = c ? c.html : this._html
    if (!title.trim() || !content.trim()) {
      wx.showToast({ title: '标题和内容不能为空', icon: 'none', duration: 1500 })
      this._publishing = false
      return
    }
    // editor 无 maxlength，超长在提交时拦截
    if (content.length > this.data.maxContent) {
      wx.showToast({ title: `正文超出 ${this.data.maxContent} 字上限`, icon: 'none', duration: 2000 })
      this._publishing = false
      return
    }
    try {
      let images
      try {
        if (this.data.images.length) wx.showLoading({ title: '上传图片中…', mask: true })
        images = await this.uploadImages()
      } catch (err) {
        wx.hideLoading()
        wx.showToast({ title: '图片上传失败，请重试', icon: 'none', duration: 1500 })
        return
      }
      if (this.data.images.length) wx.hideLoading()
      const data = { title: title.trim(), content: content.trim(), contentRich, images, tags: selectedTags, publishStatus }
      const okTitle = publishStatus === 'draft' ? '已暂存' : '发布成功'
      if (isEditing && storyId) {
        const result = await storyApi.update(storyId, data)
        if (result) { wx.showToast({ title: okTitle, icon: 'success', duration: 1500 }); wx.navigateBack() }
      } else {
        const result = await storyApi.create(data)
        if (result) { wx.showToast({ title: okTitle, icon: 'success', duration: 1500 }); wx.navigateBack() }
      }
    } finally {
      this._publishing = false
    }
  },
})
