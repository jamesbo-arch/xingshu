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
          <label>标题 *<input v-model="form.title" class="input-full" /></label>
          <label>活动类型
            <select v-model="form.type_id" class="input-full">
              <option :value="null">不关联（自选形式）</option>
              <option v-for="t in formTypeOptions" :key="t.id" :value="t.id">
                {{ t.name }}（{{ t.channel === 'online' ? '线上' : '线下' }}）{{ t.is_active ? '' : '·已停用' }}
              </option>
            </select>
          </label>
          <label>开始时间 *<input v-model="form.start_time" class="input-full" placeholder="2026-07-20 14:00:00" /></label>
          <label>结束时间<input v-model="form.end_time" class="input-full" placeholder="可留空" /></label>
          <label>报名截止<input v-model="form.signup_deadline" class="input-full" placeholder="可留空" /></label>
          <label>形式{{ form.type_id ? '（随类型自动）' : '' }}
            <select v-model="form.type" class="input-full" :disabled="!!form.type_id">
              <option value="offline">线下</option><option value="online">线上</option>
            </select>
          </label>
          <label>城市<input v-model="form.city" class="input-full" placeholder="线下活动填写" /></label>
          <label>地点/入会方式<input v-model="form.location" class="input-full" /></label>
          <label>名额上限<input v-model.number="form.capacity" type="number" class="input-full" /></label>
          <label>组织方<input v-model="form.organizer" class="input-full" /></label>
          <label>状态
            <select v-model="form.status" class="input-full">
              <option value="draft">草稿（不可见）</option>
              <option value="online">上线（可报名）</option>
              <option value="finished">已结束（往期回顾）</option>
            </select>
          </label>
        </div>
        <label class="block-label">活动介绍<textarea v-model="form.content" class="textarea" rows="5" /></label>
        <label v-if="form.status === 'finished'" class="block-label">回顾图文<textarea v-model="form.review_content" class="textarea" rows="4" placeholder="活动结束后的图文回顾" /></label>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showForm = false">取消</button>
          <button class="btn btn-primary" @click="onSave">保存</button>
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
import { ref, computed, onMounted } from 'vue'
import {
  getActivities, saveActivity, getActivitySignups,
  getActivityTypes, saveActivityType, getActivityPosts, deleteActivityPost, resolveFileUrls,
} from '../api/index.js'

const list = ref([])
const types = ref([])
const showForm = ref(false), form = ref({})
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

function openForm(a) {
  form.value = a
    ? { id: a.id, title: a.title, start_time: a.startTime, end_time: a.endTime, signup_deadline: a.deadline,
        type: a.type, type_id: a.type_id || null, city: a.city, capacity: a.capacity, status: a.status,
        location: a.location || '', organizer: a.organizer || '醒书运营组',
        content: a.content || '', review_content: a.review_content || '', cover_url: a.cover_url || '' }
    : { type: 'offline', type_id: null, status: 'draft', capacity: 30, organizer: '醒书运营组' }
  showForm.value = true
}
async function onSave() {
  if (!form.value.title || !form.value.start_time) { alert('标题与开始时间必填'); return }
  try {
    await saveActivity(form.value)
    showForm.value = false
    await load()
  } catch (e) { alert(e.message) }
}
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
