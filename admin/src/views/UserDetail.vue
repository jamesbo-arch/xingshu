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
        <div>
          <label>推荐人</label>
          <span>{{ user.referrerName || '无' }}<a class="link edit-ref" @click="openReferrerEdit">修改</a></span>
        </div>
      </div>
    </div>

    <!-- v2.2 修改推荐人弹窗 -->
    <div v-if="showRefEdit" class="modal-mask" @click.self="showRefEdit = false">
      <div class="modal">
        <h2 class="modal-title">修改推荐人 · {{ user.nickname }}</h2>
        <input v-model="refKeyword" class="input-full" placeholder="搜索昵称或手机号" @input="filterCandidates" />
        <div class="candidate-list">
          <div v-for="c in candidates" :key="c.id" class="candidate"
               :class="{ selected: refSelected === c.id }" @click="refSelected = c.id">
            {{ c.nickname }}（ID {{ c.id }}{{ c.phone ? ' · ' + c.phone : '' }}）
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="onClearReferrer">清空推荐人</button>
          <button class="btn btn-ghost" @click="showRefEdit = false">取消</button>
          <button class="btn btn-primary" :disabled="!refSelected" @click="onSaveReferrer">保存</button>
        </div>
      </div>
    </div>

    <div v-if="referred.length" class="section">
      <h2>他推荐的用户 ({{ referred.length }})</h2>
      <table class="data-table">
        <thead><tr><th>ID</th><th>昵称</th><th>身份</th><th>注册时间</th></tr></thead>
        <tbody><tr v-for="r in referred" :key="r.id">
          <td>{{ r.id }}</td>
          <td><router-link :to="'/users/'+r.id" class="link">{{ r.nickname }}</router-link></td>
          <td>{{ identityLabel(r.identity) }}</td><td>{{ r.registeredAt }}</td>
        </tr></tbody>
      </table>
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
import { getUserDetail, getUsers, updateReferrer } from '../api/index.js'

const route = useRoute()
const user = ref(null), diaries = ref([]), referred = ref([])
const showRefEdit = ref(false), refKeyword = ref(''), refSelected = ref(null)
const allUsers = ref([]), candidates = ref([])

onMounted(load)
async function load() {
  const data = await getUserDetail(route.params.id)
  user.value = data.user; diaries.value = data.diaries; referred.value = data.referred || []
}

function identityLabel(i) { return { guest:'游客', authed:'已授权', member:'会员' }[i] || i }

async function openReferrerEdit() {
  if (!allUsers.value.length) allUsers.value = (await getUsers()).list
  refKeyword.value = ''; refSelected.value = null
  filterCandidates()
  showRefEdit.value = true
}
function filterCandidates() {
  const k = refKeyword.value.trim()
  candidates.value = allUsers.value
    .filter(u => u.id !== user.value.id)
    .filter(u => !k || u.nickname.includes(k) || (u.phone || '').includes(k))
    .slice(0, 20)
}
async function onSaveReferrer() {
  try {
    await updateReferrer(user.value.id, refSelected.value)
    showRefEdit.value = false
    await load()
  } catch (e) { alert(e.message) }
}
async function onClearReferrer() {
  try {
    await updateReferrer(user.value.id, null)
    showRefEdit.value = false
    await load()
  } catch (e) { alert(e.message) }
}
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
.link { color:#3578F6; text-decoration:none; cursor:pointer; }
.edit-ref { margin-left:10px; font-size:12px; }
.modal-mask { position:fixed; inset:0; background:rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; z-index:50; }
.modal { background:#fff; border-radius:12px; padding:24px 28px; width:480px; max-height:80vh; overflow-y:auto; }
.modal-title { font-size:16px; font-weight:700; margin-bottom:14px; }
.input-full { width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid #E5E7EB; border-radius:6px; font-size:14px; margin-bottom:10px; }
.candidate-list { max-height:280px; overflow-y:auto; border:1px solid #F3F4F6; border-radius:6px; }
.candidate { padding:8px 12px; font-size:14px; cursor:pointer; border-bottom:1px solid #F9FAFB; }
.candidate:hover { background:#F3F4F6; }
.candidate.selected { background:#DBEAFE; color:#1E40AF; }
.modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:16px; }
.btn { padding:6px 12px; border:none; border-radius:6px; font-size:13px; cursor:pointer; }
.btn-primary { background:#3578F6; color:#fff; }
.btn-ghost { background:#F3F4F6; color:#4B5563; border:1px solid #E5E7EB; }
.btn:disabled { opacity:.45; cursor:not-allowed; }
</style>
