<template>
  <div>
    <h1 class="page-title">用户管理</h1>
    <div class="filter-bar">
      <input v-model="keyword" placeholder="搜索昵称/真实姓名/手机号/ID" class="input" @input="search" />
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
        <th>ID</th><th>用户</th><th>真实姓名</th><th>手机号</th><th>身份</th>
        <th>会员有效期</th><th>日记</th><th>互动</th><th>推荐人</th><th>注册</th><th>最后活跃</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr v-for="u in filtered" :key="u.id">
          <td>{{ u.id }}</td>
          <td>
            <span class="u-cell">
              <span class="avx-sm" :style="{ background: hue(u.avatarHue) }">{{ initial(u.nickname) }}</span>
              {{ u.nickname || '-' }}
            </span>
          </td>
          <td>{{ u.realName || '—' }}</td>
          <td>{{ u.phone || '-' }}</td>
          <td><span class="badge" :class="'badge-'+u.identity">{{ identityLabel(u.identity) }}</span></td>
          <td>
            <template v-if="u.memberUntil">{{ u.memberUntil }}<span class="dim"> · 剩 {{ u.daysLeft }} 天</span></template>
            <template v-else>—</template>
          </td>
          <td>{{ u.diaries }}</td>
          <td>{{ (u.likes||0) + (u.favorites||0) + (u.comments||0) + (u.shares||0) }}</td>
          <td>{{ u.referrerName || '-' }}</td>
          <td>{{ u.registeredAt }}</td>
          <td class="dim">{{ u.lastActive }}</td>
          <td><router-link :to="'/users/'+u.id" class="link">详情</router-link></td>
        </tr>
        <tr v-if="!filtered.length"><td colspan="12" class="empty">暂无用户</td></tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getUsers } from '../api/index.js'
import { exportCsv } from '../utils/csv.js'

const users = ref([]), filtered = ref([]), keyword = ref(''), identity = ref('')

onMounted(async () => { users.value = (await getUsers()).list; filtered.value = users.value })
function identityLabel(i) { return { guest:'游客', authed:'已授权', member:'会员' }[i] || i }
function hue(h) { return `hsl(${h == null ? 60 : h}, 30%, 45%)` }
function initial(name) { return name ? name.trim()[0] : '?' }
function onExport() {
  exportCsv(
    `醒书用户列表-${new Date().toISOString().slice(0, 10)}.csv`,
    ['用户ID', '昵称', '真实姓名', '手机号', '身份', '会员到期', '剩余天数', '日记数', '获赞', '收藏', '评论', '转发', '注册时间', '最后活跃'],
    filtered.value.map(u => [u.id, u.nickname, u.realName, u.phone, identityLabel(u.identity),
      u.memberUntil || '', u.daysLeft || 0, u.diaries, u.likes, u.favorites, u.comments, u.shares, u.registeredAt, u.lastActive])
  )
}
function search() {
  const k = keyword.value.trim()
  filtered.value = users.value.filter(u =>
    (!k || (u.nickname || '').includes(k) || (u.realName || '').includes(k) || (u.phone || '').includes(k) || String(u.id) === k) &&
    (!identity.value || u.identity === identity.value)
  )
}
</script>

<style scoped>
.u-cell { display: inline-flex; align-items: center; gap: 8px; }
.avx-sm {
  width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
  color: #fff; display: inline-grid; place-items: center;
  font-family: var(--font-serif); font-size: 13px;
}
.dim { color: #A8A39B; font-size: 12px; }
.empty { text-align: center; color: #A8A39B; padding: 24px; }
</style>
