<template>
  <div>
    <h1 class="page-title">日记管理</h1>
    <div class="filter-bar">
      <input v-model="keyword" placeholder="搜索标题/内容" class="input" @input="search" />
      <select v-model="permission" class="select" @change="search">
        <option value="">全部权限</option><option value="public">公众</option><option value="member">会员</option><option value="private">私密</option>
      </select>
      <button class="btn btn-primary" @click="onExport">导出 Excel（{{ filtered.length }}）</button>
      <button class="btn btn-danger" :disabled="!selected.length" @click="onBatchDelete">
        批量删除{{ selected.length ? `（${selected.length}）` : '' }}
      </button>
    </div>
    <table class="data-table">
      <thead><tr>
        <th style="width:36px"><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
        <th>ID</th><th>标题</th><th>作者</th><th>时间</th><th>权限</th><th>点赞</th><th>收藏</th><th>评论</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr v-for="d in filtered" :key="d.id">
          <td><input type="checkbox" :value="d.id" v-model="selected" /></td>
          <td>{{ d.id }}</td>
          <td><router-link :to="'/diaries/'+d.id" class="link">{{ d.title }}</router-link></td>
          <td>{{ d.author }}</td>
          <td>{{ d.createdAt }}</td>
          <td><span class="badge" :class="'badge-'+d.permission">{{ permLabel(d.permission) }}</span></td>
          <td>{{ d.likes }}</td><td>{{ d.favorites }}</td><td>{{ d.comments }}</td>
          <td><button class="btn btn-danger" @click="onDelete(d)">删除</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getDiaries, deleteDiary, deleteDiaries } from '../api/index.js'
import { exportCsv } from '../utils/csv.js'

const diaries = ref([]), filtered = ref([]), keyword = ref(''), permission = ref('')
const selected = ref([])

onMounted(async () => { diaries.value = (await getDiaries()).list; filtered.value = diaries.value })
function permLabel(p) { return { public:'公众', member:'会员', private:'私密' }[p] || p }
function search() {
  filtered.value = diaries.value.filter(d =>
    (!keyword.value || d.title.includes(keyword.value) || d.content.includes(keyword.value)) &&
    (!permission.value || d.permission === permission.value)
  )
  selected.value = selected.value.filter(id => filtered.value.some(d => d.id === id))
}
const allChecked = computed(() =>
  filtered.value.length > 0 && filtered.value.every(d => selected.value.includes(d.id)))
function toggleAll(e) {
  selected.value = e.target.checked ? filtered.value.map(d => d.id) : []
}
async function onDelete(d) {
  if (!confirm('确定删除该日记？相关互动数据将同步删除。')) return
  await deleteDiary(d.id)
  removeLocal([d.id])
}
async function onBatchDelete() {
  if (!confirm(`确定删除选中的 ${selected.value.length} 篇日记？相关互动数据将同步删除。`)) return
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
