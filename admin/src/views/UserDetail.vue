<template>
  <div>
    <router-link to="/users" class="back-link">← 返回用户列表</router-link>
    <div v-if="user" class="detail-card">
      <div class="card-head">
        <h1>{{ user.nickname || '未命名用户' }}</h1>
        <button v-if="!editing" class="btn btn-ghost" @click="startEdit">编辑资料</button>
        <span v-else>
          <button class="btn btn-ghost" @click="editing = false">取消</button>
          <button class="btn btn-primary" @click="onSaveProfile">保存</button>
        </span>
      </div>

      <!-- 查看态 -->
      <div v-if="!editing" class="info-grid">
        <div><label>ID</label><span>{{ user.id }}</span></div>
        <div><label>手机号</label><span>{{ user.phone || '-' }}</span></div>
        <div><label>真实姓名</label><span>{{ user.realName || '-' }}</span></div>
        <div><label>身份</label><span class="badge" :class="'badge-'+user.identity">{{ identityLabel(user.identity) }}</span></div>
        <div><label>会员生效</label><span>{{ user.memberFrom || '-' }}</span></div>
        <div><label>会员到期</label><span>{{ user.memberUntil || '-' }}<span v-if="user.memberUntil" class="dim"> · 剩 {{ user.daysLeft }} 天</span></span></div>
        <div><label>注册时间</label><span>{{ user.registeredAt }}</span></div>
        <div><label>最后活跃</label><span>{{ user.lastActive }}</span></div>
        <div>
          <label>推荐人</label>
          <span>{{ user.referrerName || '无' }}<a class="link edit-ref" @click="openReferrerEdit">修改</a></span>
        </div>
      </div>

      <!-- 编辑态（B 档：昵称/真实姓名/手机号 + 会员身份/有效期；微信授权名不可改） -->
      <div v-else>
        <div class="edit-grid">
          <label>昵称<input v-model="form.nickname" class="input-full" maxlength="16" /></label>
          <label>真实姓名<input v-model="form.realName" class="input-full" maxlength="16" placeholder="线下核对用" /></label>
          <label>手机号<input v-model="form.phone" class="input-full" maxlength="11" placeholder="可手动修正" /></label>
          <label>会员身份
            <select v-model="form.identity" class="input-full" @change="onIdentityChange">
              <option value="guest">游客</option>
              <option value="authed">已授权</option>
              <option value="member">会员</option>
            </select>
          </label>
          <label v-if="form.identity==='member'">会员生效日期
            <input v-model="form.memberFrom" type="date" class="input-full" @change="onMemberFrom" />
          </label>
          <label v-if="form.identity==='member'">会员失效日期
            <input v-model="form.memberUntil" type="date" class="input-full" />
          </label>
        </div>
        <p class="edit-hint">改为「会员」须填生效/失效日期（失效默认生效日 +1 年，可改）；改为非会员将清空会员有效期。</p>
      </div>

      <!-- v2.4 开通/续费会员入口（游客不可开通） -->
      <div v-if="!editing && user.identity !== 'guest'" style="margin-top:16px">
        <router-link :to="'/orders?create='+user.id" class="btn btn-danger">
          {{ user.identity === 'member' ? '续费会员' : '开通会员' }}
        </router-link>
      </div>
    </div>

    <!-- D 档 身份标识（微信身份，只读 + 一键复制） -->
    <div v-if="user" class="section">
      <h2>身份标识</h2>
      <div class="id-card">
        <div class="id-row">
          <span class="id-k">系统 ID<span class="id-pk">主键</span></span>
          <span class="id-v mono">{{ user.id }}</span>
          <button class="btn btn-ghost id-copy" @click="copy(String(user.id))">复制</button>
        </div>
        <div class="id-row">
          <span class="id-k">WeChat OpenID</span>
          <span class="id-v mono">{{ user.openid || '—' }}</span>
          <button class="btn btn-ghost id-copy" :disabled="!user.openid" @click="copy(user.openid)">复制</button>
        </div>
        <div class="id-row">
          <span class="id-k">WeChat UnionID</span>
          <span class="id-v mono" :class="{ empty: !user.unionid }">{{ user.unionid || '未获取' }}</span>
          <button class="btn btn-ghost id-copy" :disabled="!user.unionid" @click="copy(user.unionid)">复制</button>
        </div>
        <p class="id-note">系统 ID 为数据库主键；OpenID 是用户在本小程序的唯一标识；UnionID 用于同主体多应用打通（需绑定微信开放平台，未绑定时为空）。</p>
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
import { getUserDetail, getUsers, updateReferrer, getUserOrders, updateUser } from '../api/index.js'

const route = useRoute()
const user = ref(null), diaries = ref([]), referred = ref([]), orders = ref([])
const showRefEdit = ref(false), refKeyword = ref(''), refSelected = ref(null)
const allUsers = ref([]), candidates = ref([])
const editing = ref(false), form = ref({})

onMounted(load)
async function load() {
  const data = await getUserDetail(route.params.id)
  user.value = data.user; diaries.value = data.diaries; referred.value = data.referred || []
  orders.value = (await getUserOrders(route.params.id)).list
}

function identityLabel(i) { return { guest:'游客', authed:'已授权', member:'会员' }[i] || i }
function stateLabel(s) { return { active:'生效中', expiring:'即将到期', expired:'已过期', pending:'待生效', refunded:'已退款', cancelled:'已取消' }[s] || s }

// 本地日期工具（避免 toISOString 的 UTC 偏移）
function fmtDate(dt) { const p = n => String(n).padStart(2, '0'); return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}` }
function todayStr() { return fmtDate(new Date()) }
function addYear(s) { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return fmtDate(new Date(y + 1, m - 1, d)) }

function startEdit() {
  form.value = {
    nickname: user.value.nickname || '', realName: user.value.realName || '', phone: user.value.phone || '',
    identity: user.value.identity, memberFrom: user.value.memberFrom || '', memberUntil: user.value.memberUntil || '',
  }
  editing.value = true
}
// 身份改为会员且未填有效期 → 默认生效=今日、失效=今日+1年
function onIdentityChange() {
  if (form.value.identity === 'member' && !form.value.memberFrom) {
    const t = todayStr(); form.value.memberFrom = t; form.value.memberUntil = addYear(t)
  }
}
// 生效日期变更：失效日期为空则自动 +1 年
function onMemberFrom() {
  if (!form.value.memberUntil) form.value.memberUntil = addYear(form.value.memberFrom)
}
async function onSaveProfile() {
  if (!form.value.nickname.trim()) { alert('昵称不能为空'); return }
  const isMember = form.value.identity === 'member'
  if (isMember && (!form.value.memberFrom || !form.value.memberUntil)) { alert('会员须填写生效与失效日期'); return }
  if (isMember && form.value.memberUntil <= form.value.memberFrom) { alert('会员失效日期须晚于生效日期'); return }
  try {
    await updateUser({
      userId: user.value.id, nickname: form.value.nickname.trim(), realName: form.value.realName.trim(), phone: form.value.phone.trim(),
      identity: form.value.identity,
      memberFrom: isMember ? form.value.memberFrom : null,
      memberUntil: isMember ? form.value.memberUntil : null,
    })
    editing.value = false
    await load()
  } catch (e) { alert('保存失败：' + e.message) }
}
async function copy(text) {
  if (!text) return
  try { await navigator.clipboard.writeText(text) } catch { /* 忽略 */ }
}

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

.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.card-head h1 { margin: 0; }
.card-head .btn { margin-left: 8px; }
.dim { color: var(--ink-4); font-size: 12px; }

.edit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.edit-grid label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--ink-3); font-family: var(--font-serif); letter-spacing: 1px; }
.edit-hint { margin: 12px 0 0; font-size: 12px; color: var(--ink-4); line-height: 1.6; }

.id-card { background: var(--bg-content); border: 0.5px solid var(--tbl-border); border-radius: 12px; padding: 6px 18px; box-shadow: var(--shadow-1); }
.id-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 0.5px solid var(--tbl-border); }
.id-row:last-of-type { border-bottom: none; }
.id-k { width: 160px; flex-shrink: 0; font-size: 13px; color: var(--ink-3); font-family: var(--font-serif); letter-spacing: 1px; }
.id-pk { display: inline-block; margin-left: 8px; padding: 1px 6px; font-size: 10px; border-radius: 3px; background: var(--gold-soft); color: var(--gold-deep); }
.id-v { flex: 1; font-size: 13px; color: var(--ink-2); word-break: break-all; }
.id-v.empty { color: var(--ink-4); }
.id-copy { flex-shrink: 0; }
.id-note { font-size: 11px; color: var(--ink-4); line-height: 1.7; padding: 12px 0 4px; margin: 0; }
</style>
