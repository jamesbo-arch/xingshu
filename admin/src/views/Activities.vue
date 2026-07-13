<template>
  <div>
    <h1 class="page-title">活动管理</h1>
    <div class="filter-bar">
      <button class="btn btn-primary" @click="openForm()">+ 发布活动</button>
      <button class="btn btn-ghost" @click="openTypes">类型管理</button>
    </div>
    <table class="data-table">
      <thead><tr>
        <th>ID</th><th>标题</th><th>类型</th><th>时间</th><th>形式</th><th>报名</th><th>状态</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr v-for="a in list" :key="a.id">
          <td>{{ a.id }}</td>
          <td>{{ a.title }}</td>
          <td>{{ a.typeName || '-' }}</td>
          <td>{{ a.startTime }}</td>
          <td>{{ a.type === 'online' ? '线上' : '线下·' + a.city }}</td>
          <td><a class="link" @click="openSignups(a)">{{ a.signedUp }}/{{ a.capacity }}</a></td>
          <td><span class="badge" :class="'badge-'+a.status">{{ statusLabel(a.status) }}</span></td>
          <td>
            <button class="btn btn-ghost" @click="openForm(a)">编辑</button>
            <a class="link" @click="openPosts(a)">分享</a>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 活动编辑弹窗 -->
    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="modal">
        <h2 class="modal-title">{{ form.id ? '编辑活动' : '发布活动' }}</h2>
        <div class="form-grid">
          <label>活动标题 *<input v-model="form.title" class="input-full" /></label>
          <label>活动类型
            <select v-model="form.type_id" class="input-full">
              <option :value="null">不关联（自选形式）</option>
              <option v-for="t in formTypeOptions" :key="t.id" :value="t.id">
                {{ t.name }}（{{ t.channel === 'online' ? '线上' : '线下' }}）{{ t.is_active ? '' : '·已停用' }}
              </option>
            </select>
          </label>
          <label>开始时间 *<input v-model="form.start_time" type="datetime-local" class="input-full" /></label>
          <label>结束时间<input v-model="form.end_time" type="datetime-local" class="input-full" /></label>
          <label>报名截止<input v-model="form.signup_deadline" type="datetime-local" class="input-full" /></label>
          <label>活动形式{{ form.type_id ? '（随类型自动）' : '' }}
            <select v-model="form.type" class="input-full" :disabled="!!form.type_id">
              <option value="offline">线下</option><option value="online">线上</option>
            </select>
          </label>
          <template v-if="effectiveType === 'online'">
            <label>腾讯会议号<input v-model="form.location" class="input-full" placeholder="仅报名用户可见" /></label>
          </template>
          <template v-else>
            <label>城市<input v-model="form.city" class="input-full" placeholder="如：广州" /></label>
            <label>活动地址
              <span class="addr-row">
                <input v-model="form.location" class="input-full" placeholder="详细地址，可地图选点" />
                <button v-if="mapEnabled" class="btn btn-ghost addr-map-btn" @click="showMap = true">地图选点</button>
              </span>
              <span v-if="form.latitude" class="addr-coord">已定位：{{ form.latitude }}, {{ form.longitude }}</span>
            </label>
          </template>
          <label>名额上限<input v-model.number="form.capacity" type="number" class="input-full" /></label>
          <label>状态
            <select v-model="form.status" class="input-full">
              <option value="draft">草稿（不可见）</option>
              <option value="online">上线（可报名）</option>
              <option value="finished">已结束（往期回顾）</option>
            </select>
          </label>
          <!-- 循环活动：仅新建时可设，按规则批量生成多场（每场一条记录，标题自动带日期） -->
          <template v-if="!form.id">
            <label>重复
              <select v-model="form.repeat" class="input-full">
                <option value="">不重复</option>
                <option value="weekly">每周（与开始时间同星期）</option>
                <option value="monthly">每月（第 N 个星期 X，取自开始时间）</option>
              </select>
            </label>
            <label v-if="form.repeat">重复截止日期<input v-model="form.repeat_until" type="date" class="input-full" /></label>
          </template>
        </div>
        <p v-if="repeatPreview" class="repeat-hint">{{ repeatPreview }}</p>
        <label class="block-label">活动介绍<textarea v-model="form.content" class="textarea" rows="5" /></label>
        <label v-if="form.status === 'finished'" class="block-label">回顾图文<textarea v-model="form.review_content" class="textarea" rows="4" placeholder="活动结束后的图文回顾" /></label>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showForm = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="onSave">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 腾讯地图选点（需 VITE_TMAP_KEY，选点后自动回填地址与坐标） -->
    <div v-if="showMap" class="modal-mask" @click.self="showMap = false">
      <div class="modal map-modal">
        <h2 class="modal-title">地图选点 · 在地图上选择后点「确认」自动回填</h2>
        <iframe class="map-frame" :src="mapSrc" frameborder="0" allow="geolocation"></iframe>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showMap = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 报名名单弹窗 -->
    <div v-if="showSignups" class="modal-mask" @click.self="showSignups = false">
      <div class="modal">
        <h2 class="modal-title">报名名单 · {{ signupsActivity.title }}（{{ signups.length }} 人）</h2>
        <table class="data-table">
          <thead><tr><th>称呼</th><th>联系方式</th><th>昵称</th><th>手机号</th><th>报名时间</th></tr></thead>
          <tbody>
            <tr v-for="s in signups" :key="s.id">
              <td>{{ s.name }}</td><td>{{ s.contact || '-' }}</td>
              <td>{{ s.nickname }}</td><td>{{ s.phone || '-' }}</td><td>{{ s.signedAt }}</td>
            </tr>
          </tbody>
        </table>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showSignups = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 类型管理弹窗 -->
    <div v-if="showTypes" class="modal-mask" @click.self="showTypes = false">
      <div class="modal">
        <h2 class="modal-title">活动类型管理</h2>
        <table class="data-table">
          <thead><tr><th>名称</th><th>渠道</th><th>时间说明</th><th>排序</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="t in types" :key="t.id">
              <td>{{ t.name }}</td>
              <td>{{ t.channel === 'online' ? '线上' : '线下' }}</td>
              <td>{{ t.schedule_hint || '-' }}</td>
              <td>{{ t.sort }}</td>
              <td><span class="badge" :class="t.is_active ? 'badge-online' : 'badge-draft'">{{ t.is_active ? '启用' : '停用' }}</span></td>
              <td>
                <button class="btn btn-ghost" @click="editType(t)">编辑</button>
                <a class="link" @click="toggleType(t)">{{ t.is_active ? '停用' : '启用' }}</a>
              </td>
            </tr>
          </tbody>
        </table>
        <h3 class="modal-title" style="margin-top:16px;font-size:14px;">{{ typeForm.id ? '编辑类型' : '新增类型' }}</h3>
        <div class="form-grid">
          <label>名称 *<input v-model="typeForm.name" class="input-full" /></label>
          <label>渠道
            <select v-model="typeForm.channel" class="input-full">
              <option value="online">线上</option><option value="offline">线下</option>
            </select>
          </label>
          <label>时间说明<input v-model="typeForm.schedule_hint" class="input-full" placeholder="如：每周六 8:30-9:30" /></label>
          <label>排序<input v-model.number="typeForm.sort" type="number" class="input-full" /></label>
        </div>
        <div class="modal-actions">
          <button v-if="typeForm.id" class="btn btn-ghost" @click="resetTypeForm">取消编辑</button>
          <button class="btn btn-primary" @click="onSaveType">{{ typeForm.id ? '保存修改' : '新增' }}</button>
          <button class="btn btn-ghost" @click="showTypes = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 现场分享弹窗 -->
    <div v-if="showPosts" class="modal-mask" @click.self="showPosts = false">
      <div class="modal">
        <h2 class="modal-title">现场分享 · {{ postsActivity.title }}（{{ postsTotal }} 条）</h2>
        <table class="data-table">
          <thead><tr><th>昵称</th><th>内容</th><th>照片</th><th>时间</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="p in posts" :key="p.id" :style="p.status === 'deleted' ? 'opacity:.45' : ''">
              <td>{{ p.nickname }}</td>
              <td style="max-width:260px;white-space:pre-wrap;">{{ p.content || '-' }}</td>
              <td>
                <a v-for="(img, i) in p.images" :key="i" :href="imgUrls[img] || '#'" target="_blank">
                  <img :src="imgUrls[img]" style="width:44px;height:44px;object-fit:cover;border-radius:4px;margin-right:4px;" />
                </a>
                <span v-if="!p.images.length">-</span>
              </td>
              <td>{{ p.createdAt }}</td>
              <td><span class="badge" :class="p.status === 'active' ? 'badge-online' : 'badge-draft'">{{ p.status === 'active' ? '正常' : '已删' }}</span></td>
              <td><a v-if="p.status === 'active'" class="link" @click="onDeletePost(p)">删除</a></td>
            </tr>
            <tr v-if="!posts.length"><td colspan="6" style="text-align:center;color:#999;">暂无分享</td></tr>
          </tbody>
        </table>
        <div class="modal-actions">
          <button v-if="postsPage > 1" class="btn btn-ghost" @click="loadPosts(postsPage - 1)">上一页</button>
          <button v-if="postsPage * 20 < postsTotal" class="btn btn-ghost" @click="loadPosts(postsPage + 1)">下一页</button>
          <button class="btn btn-ghost" @click="showPosts = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  getActivities, saveActivity, getActivitySignups,
  getActivityTypes, saveActivityType, getActivityPosts, deleteActivityPost, resolveFileUrls,
} from '../api/index.js'

const list = ref([])
const types = ref([])
const showForm = ref(false), form = ref({}), saving = ref(false)
// 腾讯地图选点：需在 admin/.env.local 配置 VITE_TMAP_KEY（腾讯位置服务 key，WebServiceAPI 无需白名单）
const TMAP_KEY = import.meta.env.VITE_TMAP_KEY || ''
const mapEnabled = !!TMAP_KEY
const showMap = ref(false)
// coord 给默认中心（广州），浏览器拒绝定位时选点组件也能正常出附近地点列表
const mapSrc = computed(() =>
  `https://apis.map.qq.com/tools/locpicker?search=1&type=1&coord=23.105,113.325&key=${TMAP_KEY}&referer=xingshu-admin`)
const showSignups = ref(false), signups = ref([]), signupsActivity = ref({})
const showTypes = ref(false), typeForm = ref({ channel: 'offline', sort: 0 })
const showPosts = ref(false), posts = ref([]), postsActivity = ref({}), postsTotal = ref(0), postsPage = ref(1)
const imgUrls = ref({})

onMounted(async () => { await Promise.all([load(), loadTypes()]) })
async function load() { list.value = (await getActivities()).list }
async function loadTypes() { types.value = await getActivityTypes() }
function statusLabel(s) { return { draft: '草稿', online: '上线', finished: '已结束' }[s] || s }

// 表单类型选项：启用项 +（编辑回显时）当前活动已关联但被停用的类型
const formTypeOptions = computed(() => {
  const active = types.value.filter(t => t.is_active)
  const cur = form.value.type_id && types.value.find(t => t.id === form.value.type_id && !t.is_active)
  return cur ? [...active, cur] : active
})

// datetime-local（"YYYY-MM-DDTHH:mm"）↔ 后端（"YYYY-MM-DD HH:mm:ss"）
function toLocal(s) { return s ? String(s).replace(' ', 'T').slice(0, 16) : '' }
function fromLocal(v) { return v ? v.replace('T', ' ') + ':00' : null }

// 生效形式：关联类型时随类型渠道，否则取表单所选（控制会议号/地址字段切换）
const effectiveType = computed(() => {
  if (form.value.type_id) {
    const t = types.value.find(x => x.id === form.value.type_id)
    if (t) return t.channel
  }
  return form.value.type
})

function openForm(a) {
  form.value = a
    ? { id: a.id, title: a.title, start_time: toLocal(a.startTime), end_time: toLocal(a.endTime),
        signup_deadline: toLocal(a.deadline),
        type: a.type, type_id: a.type_id || null, city: a.city, capacity: a.capacity, status: a.status,
        location: a.location || '', latitude: a.latitude || null, longitude: a.longitude || null,
        organizer: a.organizer || '醒书运营组',
        content: a.content || '', review_content: a.review_content || '', cover_url: a.cover_url || '' }
    : { type: 'offline', type_id: null, status: 'draft', capacity: 12, organizer: '醒书运营组',
        latitude: null, longitude: null, repeat: '', repeat_until: '' }
  showForm.value = true
}

// ── 循环活动：每周同星期 / 每月第 N 个星期 X（均取自开始时间），生成到重复截止日 ──
function nthWeekdayOfMonth(year, month, n, weekday) {
  const first = new Date(year, month, 1)
  let day = 1 + ((weekday - first.getDay() + 7) % 7) + (n - 1) * 7
  const d = new Date(year, month, day)
  return d.getMonth() === month ? d : null // 当月无第 N 个该星期（如第 5 个）则跳过
}

function buildOccurrences() {
  const f = form.value
  const base = new Date(f.start_time)
  if (!f.repeat) return [base]
  if (!f.repeat_until) return null
  const until = new Date(f.repeat_until + 'T23:59:59')
  const occ = []
  if (f.repeat === 'weekly') {
    for (let d = new Date(base); d <= until && occ.length < 60; d.setDate(d.getDate() + 7)) {
      occ.push(new Date(d))
    }
  } else {
    const n = Math.ceil(base.getDate() / 7)
    const wd = base.getDay()
    for (let y = base.getFullYear(), m = base.getMonth(), i = 0; i < 24; i++, m++) {
      const d = nthWeekdayOfMonth(y + Math.floor(m / 12), ((m % 12) + 12) % 12, n, wd)
      if (!d) continue
      d.setHours(base.getHours(), base.getMinutes(), 0, 0)
      if (d > until) break
      if (d >= base) occ.push(d)
    }
  }
  return occ
}

const repeatPreview = computed(() => {
  const f = form.value
  if (f.id || !f.repeat || !f.start_time) return ''
  if (!f.repeat_until) return '请选择重复截止日期'
  const occ = buildOccurrences()
  if (!occ || !occ.length) return '该规则在截止日期内无可生成场次'
  const fmt = d => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `将生成 ${occ.length} 场：${fmt(occ[0])} ~ ${fmt(occ[occ.length - 1])}（每场独立报名，标题自动带日期）`
})

async function onSave() {
  const f = form.value
  if (!f.title || !f.start_time) { alert('活动标题与开始时间必填'); return }
  if (saving.value) return
  saving.value = true
  try {
    const payload = { ...f }
    delete payload.repeat; delete payload.repeat_until
    payload.start_time = fromLocal(f.start_time)
    payload.end_time = fromLocal(f.end_time)
    payload.signup_deadline = fromLocal(f.signup_deadline)
    if (f.id || !f.repeat) {
      await saveActivity(payload)
    } else {
      // 循环建场：按开始时间平移结束/截止时间，标题加「（MM-DD）」区分
      const occ = buildOccurrences()
      if (!occ || !occ.length) { alert('循环规则无可生成场次，请检查重复截止日期'); return }
      if (!confirm(`将按规则生成 ${occ.length} 场活动，确认？`)) return
      const base = new Date(f.start_time)
      for (const d of occ) {
        const delta = d.getTime() - base.getTime()
        const shift = (v) => {
          if (!v) return null
          const t = new Date(v.replace(' ', 'T'))
          const s = new Date(t.getTime() + delta)
          const p = n => String(n).padStart(2, '0')
          return `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())} ${p(s.getHours())}:${p(s.getMinutes())}:00`
        }
        const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        await saveActivity({
          ...payload,
          title: `${f.title}（${mmdd}）`,
          start_time: shift(payload.start_time),
          end_time: shift(payload.end_time),
          signup_deadline: shift(payload.signup_deadline),
        })
      }
    }
    showForm.value = false
    await load()
  } catch (e) { alert(e.message) } finally { saving.value = false }
}

// 腾讯地图选点回传（locpicker 组件 postMessage）
function onMapMessage(e) {
  const d = e.data
  if (!d || d.module !== 'locationPicker') return
  form.value.location = d.poiname && d.poiaddress
    ? `${d.poiaddress}（${d.poiname}）`
    : (d.poiaddress || d.poiname || form.value.location)
  if (d.latlng) {
    form.value.latitude = Number(d.latlng.lat.toFixed(6))
    form.value.longitude = Number(d.latlng.lng.toFixed(6))
  }
  showMap.value = false
}
onMounted(() => window.addEventListener('message', onMapMessage))
onUnmounted(() => window.removeEventListener('message', onMapMessage))
async function openSignups(a) {
  signupsActivity.value = a
  signups.value = (await getActivitySignups(a.id)).list
  showSignups.value = true
}

// ── 类型管理 ──
function openTypes() { resetTypeForm(); showTypes.value = true }
function resetTypeForm() { typeForm.value = { channel: 'offline', sort: 0, schedule_hint: '' } }
function editType(t) { typeForm.value = { ...t } }
async function onSaveType() {
  if (!typeForm.value.name || !typeForm.value.name.trim()) { alert('类型名称必填'); return }
  try {
    await saveActivityType({ is_active: 1, ...typeForm.value })
    resetTypeForm()
    await loadTypes()
  } catch (e) { alert(e.message) }
}
async function toggleType(t) {
  try {
    await saveActivityType({ ...t, is_active: t.is_active ? 0 : 1 })
    await loadTypes()
  } catch (e) { alert(e.message) }
}

// ── 现场分享 ──
async function openPosts(a) {
  postsActivity.value = a
  showPosts.value = true
  await loadPosts(1)
}
async function loadPosts(page) {
  const r = await getActivityPosts(postsActivity.value.id, page)
  posts.value = r.list
  postsTotal.value = r.total
  postsPage.value = r.page
  // cloud:// fileID 批量换临时 URL
  const ids = [...new Set(r.list.flatMap(p => p.images))].filter(x => x && !imgUrls.value[x])
  if (ids.length) {
    const map = await resolveFileUrls(ids)
    imgUrls.value = { ...imgUrls.value, ...map }
  }
}
async function onDeletePost(p) {
  if (!confirm(`删除「${p.nickname}」的这条分享？`)) return
  try {
    await deleteActivityPost(p.id)
    await loadPosts(postsPage.value)
  } catch (e) { alert(e.message) }
}
</script>

<style scoped>
.addr-row { display: flex; gap: 8px; align-items: center; }
.addr-row .input-full { flex: 1; }
.addr-map-btn { flex-shrink: 0; white-space: nowrap; }
.addr-coord { font-size: 11px; color: var(--ink-4); margin-top: 4px; }
.repeat-hint { font-size: 12px; color: #B6452F; margin: 8px 0 0; }
.map-modal { width: 720px; max-width: 92vw; }
.map-frame { width: 100%; height: 480px; border: 0; border-radius: 8px; }
</style>
