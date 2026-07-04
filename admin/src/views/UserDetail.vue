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
      <!-- v2.4 开通/续费会员入口（游客不可开通） -->
      <div v-if="user.identity !== 'guest'" style="margin-top:16px">
        <router-link :to="'/orders?create='+user.id" class="btn btn-danger">
          {{ user.identity === 'member' ? '续费会员' : '开通会员' }}
        </router-link>
      </div>
    </div>

    <!-- A档 互动统计五格 -->
    <div v-if="user" class="section">
      <h2>互动统计</h2>
      <div class="stat-grid">
        <div class="stat-cell"><div class="stat-num">{{ user.diaries || 0 }}</div><div class="stat-lbl">日记</div></div>
        <div class="stat-cell"><div class="stat-num">{{ user.likes || 0 }}</div><div class="stat-lbl">获赞</div></div>
        <div class="stat-cell"><div class="stat-num">{{ user.favorites || 0 }}</div><div class="stat-lbl">被收藏</div></div>
        <div class="stat-cell"><div class="stat-num">{{ user.comments || 0 }}</div><div class="stat-lbl">评论</div></div>
        <div class="stat-cell"><div class="stat-num">{{ user.shares || 0 }}</div><div class="stat-lbl">转发</div></div>
      </div>
    </div>

    <!-- v2.4 会员订单历史 -->
    <div v-if="orders.length" class="section">
      <h2>会员订单 ({{ orders.length }})</h2>
      <table class="data-table">
        <thead><tr><th>订单号</th><th>金额</th><th>支付方式</th><th>支付时间</th><th>有效期</th><th>状态</th></tr></thead>
        <tbody><tr v-for="o in orders" :key="o.id">
          <td class="mono">{{ o.id }}</td><td>¥{{ o.amount }}</td><td>{{ o.method }}</td>
          <td>{{ o.paymentTime || '-' }}</td><td>{{ o.validFrom }} → {{ o.validUntil }}</td>
          <td><span class="badge" :class="'badge-'+o.state">{{ stateLabel(o.state) }}</span></td>
        </tr></tbody>
      </table>
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
import { getUserDetail, getUsers, updateReferrer, getUserOrders } from '../api/index.js'

const route = useRoute()
const user = ref(null), diaries = ref([]), referred = ref([]), orders = ref([])
const showRefEdit = ref(false), refKeyword = ref(''), refSelected = ref(null)
const allUsers = ref([]), candidates = ref([])

onMounted(load)
async function load() {
  const data = await getUserDetail(route.params.id)
  user.value = data.user; diaries.value = data.diaries; referred.value = data.referred || []
  orders.value = (await getUserOrders(route.params.id)).list
}

function identityLabel(i) { return { guest:'游客', authed:'已授权', member:'会员' }[i] || i }
function stateLabel(s) { return { active:'生效中', expiring:'即将到期', expired:'已过期', pending:'待生效', refunded:'已退款', cancelled:'已取消' }[s] || s }

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
.stat-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.stat-cell {
  background: var(--bg-content);
  border: 0.5px solid var(--tbl-border);
  border-radius: 10px;
  padding: 16px 12px;
  text-align: center;
}
.stat-num { font-family: var(--font-serif); font-size: 24px; font-weight: 700; color: var(--ink); }
.stat-lbl { font-size: 12px; color: var(--ink-3); margin-top: 4px; letter-spacing: 1px; }
</style>
