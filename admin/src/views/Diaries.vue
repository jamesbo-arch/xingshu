<template>
  <div>
    <h1 class="page-title">日记管理</h1>
    <div class="filter-bar">
      <input v-model="keyword" placeholder="搜索标题/内容" class="input" @input="search" />
      <select v-model="permission" class="select" @change="search">
        <option value="">全部权限</option><option value="public">公众</option><option value="member">会员</option><option value="private">私密</option>
      </select>
    </div>
    <table class="data-table">
      <thead><tr>
        <th>ID</th><th>标题</th><th>作者</th><th>时间</th><th>权限</th><th>点赞</th><th>收藏</th><th>评论</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr v-for="d in filtered" :key="d.id">
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
import { ref, onMounted } from 'vue'
import { getDiaries, deleteDiary } from '../api/index.js'

const diaries = ref([]), filtered = ref([]), keyword = ref(''), permission = ref('')

onMounted(async () => { diaries.value = (await getDiaries()).list; filtered.value = diaries.value })
function permLabel(p) { return { public:'公众', member:'会员', private:'私密' }[p] || p }
function search() {
  filtered.value = diaries.value.filter(d =>
    (!keyword.value || d.title.includes(keyword.value) || d.content.includes(keyword.value)) &&
    (!permission.value || d.permission === permission.value)
  )
}
async function onDelete(d) {
  if (!confirm('确定删除该日记？相关互动数据将同步删除。')) return
  await deleteDiary(d.id)
  diaries.value = diaries.value.filter(x => x.id !== d.id)
  search()
}
</script>

<style scoped>
.page-title { font-size:22px; font-weight:700; margin-bottom:24px; }
.filter-bar { display:flex; gap:12px; margin-bottom:16px; }
.input, .select { padding:8px 12px; border:1px solid #E5E7EB; border-radius:6px; font-size:14px; }
.input { width:280px; }
.data-table { width:100%; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06); border-collapse:collapse; }
.data-table th { background:#F9FAFB; padding:10px 14px; text-align:left; font-size:13px; font-weight:600; color:#6B7280; border-bottom:1px solid #E5E7EB; }
.data-table td { padding:10px 14px; font-size:14px; border-bottom:1px solid #F3F4F6; }
.badge { padding:2px 8px; border-radius:4px; font-size:12px; }
.badge-public { background:#D1FAE5; color:#065F46; } .badge-member { background:#FEF3C7; color:#92400E; } .badge-private { background:#F3F4F6; color:#6B7280; }
.link { color:#3578F6; text-decoration:none; }
.btn { padding:4px 12px; border:none; border-radius:4px; font-size:13px; cursor:pointer; }
.btn-danger { background:#FF6B6B; color:#fff; }
</style>
