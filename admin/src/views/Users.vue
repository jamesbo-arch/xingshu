<template>
  <div>
    <h1 class="page-title">用户管理</h1>
    <div class="filter-bar">
      <input v-model="keyword" placeholder="搜索昵称/手机号" class="input" @input="search" />
      <select v-model="identity" class="select" @change="search">
        <option value="">全部身份</option>
        <option value="guest">游客</option>
        <option value="authed">已授权</option>
        <option value="member">会员</option>
      </select>
      <button class="btn btn-primary" @click="onExport">导出 Excel（{{ filtered.length }}）</button>
    </div>
    <table class="data-table">
      <thead><tr>
        <th>ID</th><th>昵称</th><th>手机号</th><th>身份</th><th>会员到期</th><th>日记数</th><th>推荐人</th><th>注册时间</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr v-for="u in filtered" :key="u.id">
          <td>{{ u.id }}</td>
          <td>{{ u.nickname || '-' }}</td>
          <td>{{ u.phone || '-' }}</td>
          <td><span class="badge" :class="'badge-'+u.identity">{{ identityLabel(u.identity) }}</span></td>
          <td>{{ u.memberUntil || '-' }}</td>
          <td>{{ u.diaries }}</td>
          <td>{{ u.referrerName || '-' }}</td>
          <td>{{ u.registeredAt }}</td>
          <td><router-link :to="'/users/'+u.id" class="link">详情</router-link></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getUsers } from '../api/index.js'
import { exportCsv } from '../utils/csv.js'

const users = ref([]), filtered = ref([]), keyword = ref(''), identity = ref('')

onMounted(async () => { users.value = await (await getUsers()).list; filtered.value = users.value })
function identityLabel(i) { return { guest:'游客', authed:'已授权', member:'会员' }[i] || i }
function onExport() {
  exportCsv(
    `醒书用户列表-${new Date().toISOString().slice(0, 10)}.csv`,
    ['用户ID', '昵称', '真实姓名', '手机号', '身份', '会员到期', '剩余天数', '日记数', '获赞数', '注册时间', '最后活跃'],
    filtered.value.map(u => [u.id, u.nickname, u.realName, u.phone, identityLabel(u.identity),
      u.memberUntil || '', u.daysLeft || 0, u.diaries, u.likes, u.registeredAt, u.lastActive])
  )
}
function search() {
  filtered.value = users.value.filter(u =>
    (!keyword.value || u.nickname.includes(keyword.value) || u.phone.includes(keyword.value)) &&
    (!identity.value || u.identity === identity.value)
  )
}
</script>
