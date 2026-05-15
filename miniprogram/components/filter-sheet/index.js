Component({
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
    timeTabs: ['快速', '区间', '年月'],
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
    'filters': function(val) {
      if (val) {
        this.setData({
          localFilters: {
            tags: val.tags ? [...val.tags] : [],
            author: val.author || '',
            timeMode: val.timeMode || 'quick',
            quickRange: val.quickRange || 'all',
            dateFrom: val.dateFrom || '',
            dateTo: val.dateTo || '',
            years: val.years ? [...val.years] : [],
            months: val.months ? [...val.months] : [],
          },
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
      this.setData({ 'localFilters.tags': tags })
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
      const year = e.currentTarget.dataset.year
      const years = [...this.data.localFilters.years]
      const idx = years.indexOf(year)
      if (idx >= 0) {
        years.splice(idx, 1)
      } else {
        years.push(year)
      }
      this.setData({ 'localFilters.years': years })
    },

    toggleMonth(e) {
      const month = e.currentTarget.dataset.month
      const months = [...this.data.localFilters.months]
      const idx = months.indexOf(month)
      if (idx >= 0) {
        months.splice(idx, 1)
      } else {
        months.push(month)
      }
      this.setData({ 'localFilters.months': months })
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
      })
    },

    onApply() {
      this.triggerEvent('apply', { filters: this.data.localFilters })
    },
  },
})
