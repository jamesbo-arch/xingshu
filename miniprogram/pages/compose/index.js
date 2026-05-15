const app = getApp()

Page({
  data: {
    diaryId: null,
    isEditing: false,
    title: '',
    content: '',
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
    this.setData({
      statusBarHeight: info.statusBarHeight || 0,
      allTags: app.globalData.tags,
    })

    if (options.diaryId) {
      const id = parseInt(options.diaryId, 10) || options.diaryId
      const diary = app.globalData.diaries.find(d => d.id == id)
      if (diary) {
        this.setData({
          diaryId: diary.id,
          isEditing: true,
          title: diary.title,
          content: diary.content,
          selectedTags: [...(diary.tags || [])],
          permission: diary.permission || 'public',
        })
        wx.setNavigationBarTitle({ title: '编辑日记' })
      }
    }
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  setPermission(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ permission: key })
  },

  removeTag(e) {
    const tag = e.currentTarget.dataset.tag
    const tags = this.data.selectedTags.filter(t => t !== tag)
    this.setData({ selectedTags: tags })
  },

  onOpenTagPicker() {
    this.setData({
      showTagPicker: true,
      pickerSelectedTags: [...this.data.selectedTags],
    })
  },

  onCloseTagPicker() {
    this.setData({ showTagPicker: false })
  },

  togglePickerTag(e) {
    const tag = e.currentTarget.dataset.tag
    const tags = [...this.data.pickerSelectedTags]
    const idx = tags.indexOf(tag)
    if (idx >= 0) {
      tags.splice(idx, 1)
    } else {
      tags.push(tag)
    }
    this.setData({ pickerSelectedTags: tags })
  },

  onClearPickerTags() {
    this.setData({ pickerSelectedTags: [] })
  },

  onConfirmTags() {
    this.setData({
      selectedTags: [...this.data.pickerSelectedTags],
      showTagPicker: false,
    })
  },

  canPublish() {
    const { title, content } = this.data
    return title.trim().length > 0 && content.trim().length > 0
  },

  onBack() {
    wx.navigateBack()
  },

  onPublish() {
    const { title, content, selectedTags, permission, isEditing, diaryId } = this.data
    if (!this.canPublish()) {
      wx.showToast({ title: '标题和内容不能为空', icon: 'none', duration: 1500 })
      return
    }

    const patch = {
      title: title.trim(),
      content: content.trim(),
      tags: selectedTags,
      permission,
    }

    if (isEditing && diaryId !== null) {
      app.updateDiary(diaryId, patch)
      wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 })
    } else {
      app.addDiary(patch)
      wx.showToast({ title: '发布成功', icon: 'success', duration: 1500 })
    }

    wx.navigateBack()
  },
})
