<template>
  <div>
    <router-link to="/stories" class="back-link">← 返回故事列表</router-link>
    <div v-if="story" class="detail-card">
      <h1>{{ story.title }}</h1>
      <div class="info-grid">
        <div><label>ID</label><span>{{ story.id }}</span></div>
        <div><label>作者</label><span>{{ story.author }}</span></div>
        <div><label>发布时间</label><span>{{ story.createdAt }}</span></div>
        <div><label>状态</label><span class="badge" :class="'badge-'+story.publishStatus">{{ statusLabel(story.publishStatus) }}</span></div>
        <div><label>善选</label><span>{{ story.isFeatured ? '已纳入善选' : '未善选' }}</span></div>
        <div><label>点赞</label><span>{{ story.likes }}</span></div>
        <div><label>收藏</label><span>{{ story.favorites }}</span></div>
        <div><label>评论</label><span>{{ story.comments }}</span></div>
        <div><label>分享</label><span>{{ story.shares }}</span></div>
        <div><label>标签</label><span>{{ (story.tags||[]).join(' / ') }}</span></div>
      </div>
      <div class="content-box">{{ story.content }}</div>
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
import { getStoryDetail, deleteComment } from '../api/index.js'

const route = useRoute()
const story = ref(null), comments = ref([])

onMounted(async () => {
  const data = await getStoryDetail(route.params.id)
  story.value = data.story; comments.value = data.comments
})

function statusLabel(p) { return { published: '已发布', draft: '暂存' }[p] || p }
async function onDeleteComment(c) {
  if (!confirm('确定删除该评论？')) return
  await deleteComment(c.id)
  comments.value = comments.value.filter(x => x.id !== c.id)
}
</script>
