function applyFilters(stories, mode, search, filters) {
  let arr = [...stories]

  if (mode === 'collections') arr = arr.filter(d => d.isFavorited)
  if (mode === 'mine') arr = arr.filter(d => d.isMine || d.author === '我')
  if (mode === 'stories') arr = arr.filter(d => d.publishStatus !== 'draft' || d.isMine)

  if (search && search.trim()) {
    const s = search.trim()
    arr = arr.filter(d => d.title.includes(s) || d.content.includes(s))
  }

  if (filters.tags && filters.tags.length) {
    arr = arr.filter(d => filters.tags.some(t => d.tags.includes(t)))
  }

  if (filters.author && filters.author.trim()) {
    arr = arr.filter(d => d.author.includes(filters.author.trim()))
  }

  const tmode = filters.timeMode || 'quick'

  const tsDate = (d) => {
    const m = (d.timestamp || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
  }

  if (tmode === 'quick' && filters.quickRange && filters.quickRange !== 'all') {
    const now = new Date()
    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    arr = arr.filter(d => {
      const dt = tsDate(d)
      if (!dt) return false
      const diff = Math.floor((today0 - dt) / 86400000)
      switch (filters.quickRange) {
        case 'today': return diff === 0
        case 'yesterday': return diff === 1
        case 'week': return diff >= 0 && diff < 7
        case 'month':
          return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth()
        case 'last-month': {
          const lm = new Date(now.getFullYear(), now.getMonth() - 1)
          return dt.getFullYear() === lm.getFullYear() && dt.getMonth() === lm.getMonth()
        }
        case 'half-year': return diff >= 0 && diff < 183
        case 'year': return diff >= 0 && diff < 365
        default: return true
      }
    })
  }

  if (tmode === 'range' && (filters.dateFrom || filters.dateTo)) {
    arr = arr.filter(d => {
      const ts = (d.timestamp || '').slice(0, 10)
      if (filters.dateFrom && ts < filters.dateFrom) return false
      if (filters.dateTo && ts > filters.dateTo) return false
      return true
    })
  }

  if (
    tmode === 'ym' &&
    ((filters.years && filters.years.length) || (filters.months && filters.months.length))
  ) {
    arr = arr.filter(d => {
      const m = (d.timestamp || '').match(/^(\d{4})-(\d{2})/)
      if (!m) return false
      const y = +m[1]
      const mo = +m[2]
      if (filters.years && filters.years.length && !filters.years.includes(y)) return false
      if (filters.months && filters.months.length && !filters.months.includes(mo)) return false
      return true
    })
  }

  return arr
}

// 将筛选条件转为 getStoryList 服务端参数（标签取首个、作者、时间三模式），undefined 项不传
function listQuery(filters = {}) {
  const q = {
    tag: (filters.tags && filters.tags[0]) || undefined,
    author: (filters.author && filters.author.trim()) || undefined,
  }
  const mode = filters.timeMode || 'quick'
  if (mode === 'quick' && filters.quickRange && filters.quickRange !== 'all') {
    q.timeMode = 'quick'; q.quickRange = filters.quickRange
  } else if (mode === 'range' && (filters.dateFrom || filters.dateTo)) {
    q.timeMode = 'range'; q.dateFrom = filters.dateFrom || undefined; q.dateTo = filters.dateTo || undefined
  } else if (mode === 'ym' && ((filters.years && filters.years.length) || (filters.months && filters.months.length))) {
    q.timeMode = 'ym'; q.years = filters.years || []; q.months = filters.months || []
  }
  return q
}

module.exports = { applyFilters, listQuery }
