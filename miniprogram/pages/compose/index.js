const app = getApp()
const diaryApi = require('../../api/diary')

Page({
  data: {
    diaryId: null,
    isEditing: false,
    title: '',
    content: '',
    images: [],
    maxImages: 9,
    selectedTags: [],
    permission: 'public',
    showTagPicker: false,
    allTags: [],
    pickerSelectedTags: [],
    permOptions: [
      { key: 'public', label: '公众', desc: '所有人可见', icon: '◎' },
      { key: 'member', label: '会员', desc: '仅会员可见', icon: '★' },
      { key: 'private', label: '私密', desc: '仅自己可见', icon: '○' },
    ],
    maxTitle: 30,
    maxContent: 3000,
    statusBarHeight: 0,
  },

  onLoad(options) {
    const info = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 0, allTags: app.globalData.tags })

    if (options.diaryId) {
      const id = parseInt(options.diaryId, 10) || options.diaryId
      diaryApi.getDetail(id).then(diary => {
        if (diary) {
          this.setData({
            diaryId: diary.id, isEditing: true,
            title: diary.title || '', content: diary.content || '',
            images: diary.images || [],
            selectedTags: diary.tags || [], permission: diary.permission || 'public',
          })
        }
      })
    }
  },

  onTitleInput(e) { this.setData({ title: e.detail.value }) },
  onContentInput(e) { this.setData({ content: e.detail.value }) },

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
      const cloudPath = `diary-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const res = await wx.cloud.uploadFile({ cloudPath, filePath: img })
      uploaded.push(res.fileID)
    }
    return uploaded
  },
  setPermission(e) { this.setData({ permission: e.currentTarget.dataset.key }) },
  removeTag(e) {
    this.setData({ selectedTags: this.data.selectedTags.filter(t => t !== e.currentTarget.dataset.tag) })
  },
  onOpenTagPicker() { this.setData({ showTagPicker: true, pickerSelectedTags: [...this.data.selectedTags] }) },
  onCloseTagPicker() { this.setData({ showTagPicker: false }) },
  togglePickerTag(e) {
    const tag = e.currentTarget.dataset.tag
    const tags = [...this.data.pickerSelectedTags]
    const idx = tags.indexOf(tag)
    idx >= 0 ? tags.splice(idx, 1) : tags.push(tag)
    this.setData({ pickerSelectedTags: tags })
  },
  onClearPickerTags() { this.setData({ pickerSelectedTags: [] }) },
  onConfirmTags() { this.setData({ selectedTags: [...this.data.pickerSelectedTags], showTagPicker: false }) },

  canPublish() {
    return this.data.title.trim().length > 0 && this.data.content.trim().length > 0
  },
  onBack() { wx.navigateBack() },

  async onPublish() {
    const { title, content, selectedTags, permission, isEditing, diaryId } = this.data
    if (!this.canPublish()) {
      wx.showToast({ title: '标题和内容不能为空', icon: 'none', duration: 1500 })
      return
    }
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
    const data = { title: title.trim(), content: content.trim(), images, tags: selectedTags, permission }
    if (isEditing && diaryId) {
      const result = await diaryApi.update(diaryId, data)
      if (result) { wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 }); wx.navigateBack() }
    } else {
      const result = await diaryApi.create(data)
      if (result) { wx.showToast({ title: '发布成功', icon: 'success', duration: 1500 }); wx.navigateBack() }
    }
  },
})
