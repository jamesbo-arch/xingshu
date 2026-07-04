// 数组 → 布尔查找表（WXML 里用 set[key] 判断选中，避免不可靠的 .indexOf() 表达式）
function toSet(arr) {
  const o = {}
  ;(arr || []).forEach(x => { o[x] = true })
  return o
}

Component({
  // 允许 app.wxss 全局类（seal-tag/.selected/btn-ghost/btn-primary）穿透组件样式隔离
  options: { addGlobalClass: true },
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    filters: {
      type: Object,
      value: {},
    },
    allTags: {
      type: Array,
      value: [],
    },
  },

  data: {
    _mounted: false,
    _show: false,
    localFilters: {
      tags: [],
      author: '',
      timeMode: 'quick',
      quickRange: 'all',
      dateFrom: '',
      dateTo: '',
      years: [],
      months: [],
    },
    // 选中集合（WXML 不可靠支持 .indexOf()，改为在 JS 预算布尔查找表）
    tagSet: {},
    yearSet: {},
    monthSet: {},
    timeTabs: ['快速', '起止日期', '年 / 月'],
    quickRanges: [
      { key: 'all', label: '全部时间' },
      { key: 'today', label: '今天' },
      { key: 'yesterday', label: '昨天' },
      { key: 'week', label: '本周' },
      { key: 'month', label: '本月' },
      { key: 'last-month', label: '上月' },
      { key: 'half-year', label: '近半年' },
      { key: 'year', label: '近一年' },
    ],
    availableYears: [2023, 2024, 2025, 2026],
    availableMonths: [
      { n: 1, label: '一月' }, { n: 2, label: '二月' }, { n: 3, label: '三月' },
      { n: 4, label: '四月' }, { n: 5, label: '五月' }, { n: 6, label: '六月' },
      { n: 7, label: '七月' }, { n: 8, label: '八月' }, { n: 9, label: '九月' },
      { n: 10, label: '十月' }, { n: 11, label: '十一月' }, { n: 12, label: '十二月' },
    ],
  },

  observers: {
    'visible': function(val) {
      if (val) {
        this.setData({ _mounted: true })
        setTimeout(() => this.setData({ _show: true }), 20)
      } else {
        this.setData({ _show: false })
        setTimeout(() => this.setData({ _mounted: false }), 320)
      }
    },
    'filters': function(val) {
      if (val) {
        const tags = val.tags ? [...val.tags] : []
        const years = val.years ? [...val.years] : []
        const months = val.months ? [...val.months] : []
        this.setData({
          localFilters: {
            tags,
            author: val.author || '',
            timeMode: val.timeMode || 'quick',
            quickRange: val.quickRange || 'all',
            dateFrom: val.dateFrom || '',
            dateTo: val.dateTo || '',
            years,
            months,
          },
          tagSet: toSet(tags),
          yearSet: toSet(years),
          monthSet: toSet(months),
        })
      }
    },
  },

  methods: {
    onMaskTap() {
      this.triggerEvent('close')
    },

    onSheetTap(e) {
      e.stopPropagation()
    },

    toggleTag(e) {
      const tag = e.currentTarget.dataset.tag
      const tags = [...this.data.localFilters.tags]
      const idx = tags.indexOf(tag)
      if (idx >= 0) {
        tags.splice(idx, 1)
      } else {
        tags.push(tag)
      }
      this.setData({ 'localFilters.tags': tags, tagSet: toSet(tags) })
    },

    onAuthorInput(e) {
      this.setData({ 'localFilters.author': e.detail.value })
    },

    setTimeMode(e) {
      const idx = e.currentTarget.dataset.index
      const modes = ['quick', 'range', 'ym']
      this.setData({ 'localFilters.timeMode': modes[idx] })
    },

    setQuickRange(e) {
      const key = e.currentTarget.dataset.key
      this.setData({ 'localFilters.quickRange': key })
    },

    onDateFromChange(e) {
      this.setData({ 'localFilters.dateFrom': e.detail.value })
    },

    onDateToChange(e) {
      this.setData({ 'localFilters.dateTo': e.detail.value })
    },

    toggleYear(e) {
      // 强制转 Number：dataset 数字值可能变字符串，与 wxml 里数字 item 比较会不匹配、选中态加不上
      const year = Number(e.currentTarget.dataset.year)
      const years = [...this.data.localFilters.years]
      const idx = years.indexOf(year)
      if (idx >= 0) {
        years.splice(idx, 1)
      } else {
        years.push(year)
      }
      this.setData({ 'localFilters.years': years, yearSet: toSet(years) })
    },

    toggleMonth(e) {
      const month = Number(e.currentTarget.dataset.month)
      const months = [...this.data.localFilters.months]
      const idx = months.indexOf(month)
      if (idx >= 0) {
        months.splice(idx, 1)
      } else {
        months.push(month)
      }
      this.setData({ 'localFilters.months': months, monthSet: toSet(months) })
    },

    onReset() {
      this.setData({
        localFilters: {
          tags: [],
          author: '',
          timeMode: 'quick',
          quickRange: 'all',
          dateFrom: '',
          dateTo: '',
          years: [],
          months: [],
        },
        tagSet: {},
        yearSet: {},
        monthSet: {},
      })
    },

    onApply() {
      this.triggerEvent('apply', { filters: this.data.localFilters })
    },
  },
})
