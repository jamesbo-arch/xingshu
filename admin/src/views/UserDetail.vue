<template>
  <div>
    <router-link to="/users" class="back-link">← 返回用户列表</router-link>
    <div v-if="user" class="detail-card">
      <h1>{{ user.nickname || '未命名用户' }}</h1>
      <div class="info-grid">
        <div><label>ID</label><span>{{ user.id }}</span></div>
        <div><label>手机号</label><span>{{ user.phone || '-' }}</span></div>
        <div><label>真实姓名</label><span>{{ user.realName || '-' }}</span></div>
        <div><label>身份</label><span class="badge" :class="'badge-'+user.identity">{{ identityLabel(user.identity) }}</span></div>
        <div><label>会员到期</label><span>{{ user.memberUntil || '-' }}</span></div>
        <div><label>注册时间</label><span>{{ user.registeredAt }}</span></div>
        <div><label>最后活跃</label><span>{{ user.lastActive }}</span></div>
      </div>
    </div>
    <div v-if="diaries.length" class="section">
      <h2>发布日记 ({{ diaries.length }})</h2>
      <table class="data-table">
        <thead><tr><th>ID</th><th>标题</th><th>时间</th><th>权限</th><th>点赞</th><th>收藏</th><th>评论</th></tr></thead>
        <tbody><tr v-for="d in diaries" :key="d.id">
          <td>{{ d.id }}</td><td><router-link :to="'/diaries/'+d.id" class="link">{{ d.title }}</router-link></td>
          <td>{{ d.createdAt }}</td><td>{{ d.permission }}</td><td>{{ d.likes }}</td><td>{{ d.favorites }}</td><td>{{ d.comments }}</td>
        </tr></tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getUserDetail } from '../api/index.js'

const route = useRoute()
const user = ref(null), diaries = ref([])

onMounted(async () => {
  const data = await getUserDetail(route.params.id)
  user.value = data.user; diaries.value = data.diaries
})

function identityLabel(i) { return { guest:'游客', authed:'已授权', member:'会员' }[i] || i }
</script>

<style scoped>
.back-link { color:#3578F6; text-decoration:none; font-size:14px; display:inline-block; margin-bottom:20px; }
.detail-card { background:#fff; border-radius:8px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,.06); margin-bottom:24px; }
.detail-card h1 { font-size:20px; margin-bottom:20px; }
.info-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.info-grid div { font-size:14px; } .info-grid label { display:block; color:#9CA3AF; font-size:12px; margin-bottom:2px; }
.badge { padding:2px 8px; border-radius:4px; font-size:12px; }
.badge-member { background:#FEF3C7; color:#92400E; } .badge-authed { background:#DBEAFE; color:#1E40AF; } .badge-guest { background:#F3F4F6; color:#6B7280; }
.section h2 { font-size:16px; font-weight:600; margin-bottom:16px; }
.data-table { width:100%; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06); border-collapse:collapse; margin-bottom:20px; }
.data-table th { background:#F9FAFB; padding:10px 14px; text-align:left; font-size:13px; font-weight:600; color:#6B7280; border-bottom:1px solid #E5E7EB; }
.data-table td { padding:10px 14px; font-size:14px; border-bottom:1px solid #F3F4F6; }
.link { color:#3578F6; text-decoration:none; }
</style>
