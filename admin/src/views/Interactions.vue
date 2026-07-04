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
