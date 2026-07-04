<template>
  <div>
    <router-link to="/diaries" class="back-link">← 返回日记列表</router-link>
    <div v-if="diary" class="detail-card">
      <h1>{{ diary.title }}</h1>
      <div class="info-grid">
        <div><label>ID</label><span>{{ diary.id }}</span></div>
        <div><label>作者</label><span>{{ diary.author }}</span></div>
        <div><label>发布时间</label><span>{{ diary.createdAt }}</span></div>
        <div><label>权限</label><span class="badge" :class="'badge-'+diary.permission">{{ permLabel(diary.permission) }}</span></div>
        <div><label>点赞</label><span>{{ diary.likes }}</span></div>
        <div><label>收藏</label><span>{{ diary.favorites }}</span></div>
        <div><label>评论</label><span>{{ diary.comments }}</span></div>
        <div><label>分享</label><span>{{ diary.shares }}</span></div>
        <div><label>标签</label><span>{{ (diary.tags||[]).join(' / ') }}</span></div>
      </div>
      <div class="content-box">{{ diary.content }}</div>
    </div>
    <div class="section" v-if="comments.length">
      <h2>评论列表 ({{ comments.length }})</h2>
      <table class="data-table">
        <thead><tr><th>ID</th><th>用户</th><th>内容</th><th>时间</th><th>操作</th></tr></thead>
        <tbody><tr v-for="c in comments" :key="c.id">
          <td>{{ c.id }}</td><td>{{ c.user }}</td><td>{{ c.content }}</td><td>{{ c.time }}</td>
          <td><button class="btn btn-danger" @click="onDeleteComment(c)">删除</button></td>
        </tr></tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getDiaryDetail, deleteComment } from '../api/index.js'

const route = useRoute()
const diary = ref(null), comments = ref([])

onMounted(async () => {
  const data = await getDiaryDetail(route.params.id)
  diary.value = data.diary; comments.value = data.comments
})

function permLabel(p) { return { public:'公众', member:'会员', private:'私密' }[p] || p }
async function onDeleteComment(c) {
  if (!confirm('确定删除该评论？')) return
  await deleteComment(c.id)
  comments.value = comments.value.filter(x => x.id !== c.id)
}
</script>
