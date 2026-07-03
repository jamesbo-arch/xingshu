<template>
  <div>
    <h1 class="page-title">活动管理</h1>
    <div class="filter-bar">
      <button class="btn btn-primary" @click="openForm()">+ 发布活动</button>
    </div>
    <table class="data-table">
      <thead><tr>
        <th>ID</th><th>标题</th><th>时间</th><th>形式</th><th>报名</th><th>状态</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr v-for="a in list" :key="a.id">
          <td>{{ a.id }}</td>
          <td>{{ a.title }}</td>
          <td>{{ a.startTime }}</td>
          <td>{{ a.type === 'online' ? '线上' : '线下·' + a.city }}</td>
          <td><a class="link" @click="openSignups(a)">{{ a.signedUp }}/{{ a.capacity }}</a></td>
          <td><span class="badge" :class="'badge-'+a.status">{{ statusLabel(a.status) }}</span></td>
          <td>
            <button class="btn btn-ghost" @click="openForm(a)">编辑</button>
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
          <label>开始时间 *<input v-model="form.start_time" class="input-full" placeholder="2026-07-20 14:00:00" /></label>
          <label>结束时间<input v-model="form.end_time" class="input-full" placeholder="可留空" /></label>
          <label>报名截止<input v-model="form.signup_deadline" class="input-full" placeholder="可留空" /></label>
          <label>形式
            <select v-model="form.type" class="input-full">
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getActivities, saveActivity, getActivitySignups } from '../api/index.js'

const list = ref([])
const showForm = ref(false), form = ref({})
const showSignups = ref(false), signups = ref([]), signupsActivity = ref({})

onMounted(load)
async function load() { list.value = (await getActivities()).list }
function statusLabel(s) { return { draft: '草稿', online: '上线', finished: '已结束' }[s] || s }

function openForm(a) {
  form.value = a
    ? { id: a.id, title: a.title, start_time: a.startTime, signup_deadline: a.deadline,
        type: a.type, city: a.city, capacity: a.capacity, status: a.status,
        location: '', organizer: '醒书运营组', content: '', review_content: '' }
    : { type: 'offline', status: 'draft', capacity: 30, organizer: '醒书运营组' }
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
</script>

<style scoped>
.page-title { font-size:22px; font-weight:700; margin-bottom:24px; }
.filter-bar { display:flex; gap:12px; margin-bottom:16px; }
.data-table { width:100%; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06); border-collapse:collapse; }
.data-table th { background:#F9FAFB; padding:10px 14px; text-align:left; font-size:13px; font-weight:600; color:#6B7280; border-bottom:1px solid #E5E7EB; }
.data-table td { padding:10px 14px; font-size:14px; border-bottom:1px solid #F3F4F6; }
.badge { padding:2px 8px; border-radius:4px; font-size:12px; }
.badge-online { background:#D1FAE5; color:#065F46; } .badge-draft { background:#F3F4F6; color:#6B7280; } .badge-finished { background:#DBEAFE; color:#1E40AF; }
.link { color:#3578F6; cursor:pointer; }
.btn { padding:6px 12px; border:none; border-radius:6px; font-size:13px; cursor:pointer; }
.btn-primary { background:#3578F6; color:#fff; }
.btn-ghost { background:#F3F4F6; color:#4B5563; border:1px solid #E5E7EB; }
.modal-mask { position:fixed; inset:0; background:rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; z-index:50; }
.modal { background:#fff; border-radius:12px; padding:24px 28px; width:640px; max-height:84vh; overflow-y:auto; }
.modal-title { font-size:17px; font-weight:700; margin-bottom:18px; }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px 16px; }
.form-grid label, .block-label { font-size:13px; color:#6B7280; display:flex; flex-direction:column; gap:5px; }
.block-label { margin-top:12px; }
.input-full, .textarea { padding:8px 10px; border:1px solid #E5E7EB; border-radius:6px; font-size:14px; width:100%; box-sizing:border-box; }
.textarea { resize:vertical; font-family:inherit; }
.modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:20px; }
</style>
