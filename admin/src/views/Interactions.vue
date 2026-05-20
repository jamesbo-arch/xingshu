<template>
  <div>
    <h1 class="page-title">互动数据管理</h1>
    <div class="tabs">
      <button v-for="t in tabs" :key="t.key" class="tab" :class="{active:tab===t.key}" @click="tab=t.key">{{ t.label }}</button>
    </div>
    <div class="filter-bar">
      <input v-model="keyword" placeholder="搜索内容" class="input" @input="search" />
    </div>
    <table class="data-table">
      <thead><tr>
        <th>ID</th><th>日记</th><th>用户</th><th>内容</th><th>时间</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr v-for="c in filtered" :key="c.id">
          <td>{{ c.id }}</td>
          <td>{{ c.diaryTitle }}</td>
          <td>{{ c.user }}</td>
          <td>{{ c.content }}</td>
          <td>{{ c.time }}</td>
          <td><button class="btn btn-danger" @click="onDelete(c)">删除</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getComments, deleteComment } from '../api/index.js'

const tab = ref('comments'), keyword = ref(''), allComments = ref([]), filtered = ref([])
const tabs = [
  { key:'comments', label:'评论记录' },
]

onMounted(async () => { allComments.value = (await getComments()).list; filtered.value = allComments.value })
function search() {
  filtered.value = allComments.value.filter(c => !keyword.value || c.content.includes(keyword.value) || c.user.includes(keyword.value))
}
async function onDelete(c) {
  if (!confirm('确定删除该评论？')) return
  await deleteComment(c.id)
  allComments.value = allComments.value.filter(x => x.id !== c.id)
  search()
}
</script>

<style scoped>
.page-title { font-size:22px; font-weight:700; margin-bottom:24px; }
.tabs { display:flex; gap:0; margin-bottom:16px; }
.tab { padding:8px 20px; border:1px solid #E5E7EB; background:#fff; font-size:14px; cursor:pointer; border-radius:0; }
.tab:first-child { border-radius:6px 0 0 6px; } .tab:last-child { border-radius:0 6px 6px 0; }
.tab.active { background:#3578F6; color:#fff; border-color:#3578F6; }
.filter-bar { display:flex; gap:12px; margin-bottom:16px; }
.input { padding:8px 12px; border:1px solid #E5E7EB; border-radius:6px; font-size:14px; width:280px; }
.data-table { width:100%; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06); border-collapse:collapse; }
.data-table th { background:#F9FAFB; padding:10px 14px; text-align:left; font-size:13px; font-weight:600; color:#6B7280; border-bottom:1px solid #E5E7EB; }
.data-table td { padding:10px 14px; font-size:14px; border-bottom:1px solid #F3F4F6; }
.btn { padding:4px 12px; border:none; border-radius:4px; font-size:13px; cursor:pointer; }
.btn-danger { background:#FF6B6B; color:#fff; }
</style>
