<template>
  <div>
    <h1 class="page-title">日记管理</h1>
    <div class="filter-bar">
      <input v-model="keyword" placeholder="搜索标题/内容/作者/ID" class="input" @input="search" />
      <select v-model="permission" class="select" @change="search">
        <option value="">全部权限</option><option value="public">公众</option><option value="member">会员</option><option value="private">私密</option>
      </select>
      <select v-model="tag" class="select" @change="search">
        <option value="">全部标签</option>
        <option v-for="t in allTags" :key="t" :value="t">{{ t }}</option>
      </select>
      <button class="btn btn-primary" @click="onExport">导出 Excel（{{ filtered.length }}）</button>
      <button class="btn btn-danger" :disabled="!selected.length" @click="onBatchDelete">
        批量删除{{ selected.length ? `（${selected.length}）` : '' }}
      </button>
    </div>
    <table class="data-table">
      <thead><tr>
        <th style="width:36px"><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
        <th>ID</th><th>标题</th><th>作者</th><th>标签</th><th>时间</th><th>权限</th>
        <th>赞</th><th>藏</th><th>评</th><th>转</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr v-for="d in filtered" :key="d.id">
          <td><input type="checkbox" :value="d.id" v-model="selected" /></td>
          <td>{{ d.id }}</td>
          <td>
            <router-link :to="'/diaries/'+d.id" class="link">{{ d.title }}</router-link>
            <div class="excerpt">{{ excerpt(d.content) }}</div>
          </td>
          <td>{{ d.author }}</td>
          <td>
            <span v-for="t in (d.tags||[]).slice(0,2)" :key="t" class="seal-tag">{{ t }}</span>
            <span v-if="(d.tags||[]).length > 2" class="tag-more">+{{ d.tags.length - 2 }}</span>
          </td>
          <td class="dim">{{ d.createdAt }}</td>
          <td><span class="badge" :class="'badge-'+d.permission">{{ permLabel(d.permission) }}</span></td>
          <td>{{ d.likes }}</td><td>{{ d.favorites }}</td><td>{{ d.comments }}</td><td>{{ d.shares }}</td>
          <td><button class="btn btn-danger" @click="onDelete(d)">删除</button></td>
        </tr>
        <tr v-if="!filtered.length"><td colspan="12" class="empty">暂无日记</td></tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getDiaries, deleteDiary, deleteDiaries } from '../api/index.js'
import { exportCsv } from '../utils/csv.js'

const diaries = ref([]), filtered = ref([]), keyword = ref(''), permission = ref(''), tag = ref('')
const selected = ref([])
const allTags = ref([])

onMounted(async () => {
  diaries.value = (await getDiaries()).list
  filtered.value = diaries.value
  // 标签筛选下拉：从已加载日记动态聚合去重（与原型一致，纯前端）
  allTags.value = [...new Set(diaries.value.flatMap(d => d.tags || []))].sort()
})
function permLabel(p) { return { public:'公众', member:'会员', private:'私密' }[p] || p }
function excerpt(c) { return c ? (c.length > 50 ? c.slice(0, 50) + '…' : c) : '' }
function search() {
  const k = keyword.value.trim()
  filtered.value = diaries.value.filter(d =>
    (!k || (d.title||'').includes(k) || (d.content||'').includes(k) || (d.author||'').includes(k) || String(d.id) === k) &&
    (!permission.value || d.permission === permission.value) &&
    (!tag.value || (d.tags || []).includes(tag.value))
  )
  selected.value = selected.value.filter(id => filtered.value.some(d => d.id === id))
}
const allChecked = computed(() =>
  filtered.value.length > 0 && filtered.value.every(d => selected.value.includes(d.id)))
function toggleAll(e) {
  selected.value = e.target.checked ? filtered.value.map(d => d.id) : []
}
function interTotal(d) { return (d.likes||0) + (d.favorites||0) + (d.comments||0) + (d.shares||0) }
async function onDelete(d) {
  if (!confirm(`确定删除《${d.title}》（作者 ${d.author}）？\n该日记及其 ${interTotal(d)} 条互动数据将同步从小程序移除，无法恢复。`)) return
  await deleteDiary(d.id)
  removeLocal([d.id])
}
async function onBatchDelete() {
  const total = selected.value.reduce((s, id) => {
    const d = diaries.value.find(x => x.id === id)
    return s + (d ? interTotal(d) : 0)
  }, 0)
  if (!confirm(`确定删除选中的 ${selected.value.length} 篇日记？\n连同约 ${total} 条互动数据一并永久删除，无法恢复。`)) return
  const r = await deleteDiaries(selected.value)
  removeLocal(r.deleted)
  if (r.failed.length) alert(`${r.failed.length} 篇删除失败：${r.failed.map(f => f.id).join(', ')}`)
}
function removeLocal(ids) {
  diaries.value = diaries.value.filter(x => !ids.includes(x.id))
  selected.value = selected.value.filter(id => !ids.includes(id))
  search()
}
function onExport() {
  exportCsv(
    `醒书日记列表-${new Date().toISOString().slice(0, 10)}.csv`,
    ['日记ID', '标题', '作者', '发布时间', '权限', '标签', '点赞', '收藏', '评论', '转发'],
    filtered.value.map(d => [d.id, d.title, d.author, d.createdAt, permLabel(d.permission),
      (d.tags || []).join('、'), d.likes, d.favorites, d.comments, d.shares])
  )
}
</script>

<style scoped>
.excerpt { font-size: 12px; color: var(--ink-4); margin-top: 3px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.seal-tag {
  display: inline-block; padding: 1px 6px; margin-right: 4px;
  font-family: var(--font-serif); font-size: 11px; color: var(--vermilion);
  border: 0.5px solid var(--vermilion); border-radius: 2px;
  background: rgba(182,69,47,0.04); white-space: nowrap;
}
.tag-more { font-size: 11px; color: var(--ink-4); }
.dim { color: #A8A39B; font-size: 12px; }
.empty { text-align: center; color: #A8A39B; padding: 24px; }
</style>
