<template>
  <div>
    <h1 class="page-title">活动管理</h1>
    <div class="filter-bar">
      <button class="btn btn-primary" @click="openForm()">+ 发布活动</button>
      <!-- 分类是全局配置，仅超管可管（typeSave 服务端亦仅 super） -->
      <button v-if="isSuper" class="btn btn-ghost" @click="openTypes">类型管理</button>
    </div>
    <table class="data-table">
      <thead><tr>
        <th>ID</th><th>标题</th><th>类型</th><th>时间</th><th>形式</th><th>主理人</th><th>报名</th><th>状态</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr v-for="a in list" :key="a.id">
          <td>{{ a.id }}</td>
          <td>{{ a.title }}</td>
          <td>{{ a.typeName || '-' }}</td>
          <td>{{ a.startTime }}</td>
          <td>{{ a.type === 'online' ? '线上' : '线下·' + a.city }}</td>
          <td>{{ a.ownerNickname || '—' }}</td>
          <td><a class="link" @click="openSignups(a)">{{ a.signedUp }}/{{ a.capacity }}</a></td>
          <td><span class="act-st" :class="'st-' + actState(a).cls">{{ actState(a).label }}</span></td>
          <td>
            <div class="act-ops">
              <button class="btn btn-ghost" @click="openForm(a)">编辑</button>
              <a class="link" @click="openStaff(a)">工作人员</a>
              <a class="link" @click="openPosts(a)">现场分享</a>
              <a class="link" @click="openInvite(a)">邀请函</a>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 活动编辑弹窗（不做点击遮罩关闭：表单内容多，防误点丢失编辑） -->
    <div v-if="showForm" class="modal-mask">
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
          <label>时长（小时）
            <input v-model.number="form.duration_hours" type="number" min="0" step="0.5" class="input-full" placeholder="如 1.5，自动算结束时间" />
            <span v-if="computedEndText" class="addr-coord">结束：{{ computedEndText }}</span>
          </label>
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
                <button v-if="mapEnabled" class="btn btn-ghost addr-map-btn" @click="openMapPicker">地图选点</button>
              </span>
              <span v-if="form.latitude" class="addr-coord">已定位：{{ form.latitude }}, {{ form.longitude }}</span>
            </label>
          </template>
          <label>名额上限<input v-model.number="form.capacity" type="number" class="input-full" /></label>
          <label>活动价格（元）<input v-model.number="form.price" type="number" min="0" step="0.01" class="input-full" placeholder="0 = 免费" /></label>
          <label>主理人{{ isSuper ? '' : '（仅超管可改）' }}
            <template v-if="isSuper">
              <span v-if="form.ownerUserId" class="owner-current">
                {{ form.ownerNickname || '?' }}（ID {{ form.ownerUserId }}）
                <a class="link" @click="form.ownerUserId = null; form.ownerNickname = ''">清除</a>
              </span>
              <span v-else class="owner-box">
                <input v-model="ownerKw" class="input-full" placeholder="搜昵称/手机号/ID 指定主理人" @input="onOwnerSearch" />
                <span v-if="ownerList.length" class="owner-drop">
                  <span v-for="u in ownerList" :key="u.id" class="owner-item" @click="pickOwner(u)">
                    {{ u.nickname }}（ID {{ u.id }}{{ u.phone ? ' · ' + u.phone : '' }}）
                  </span>
                </span>
              </span>
            </template>
            <span v-else class="addr-coord">
              {{ form.ownerUserId ? (form.ownerNickname || '?') + '（ID ' + form.ownerUserId + '）' : '新建时自动设为本账号绑定会员' }}
            </span>
          </label>
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
        <div class="block-label">
          活动配图（海报会依次贴在介绍下方）
          <div class="img-grid">
            <div v-for="(fid, i) in (form.images || [])" :key="fid" class="img-thumb">
              <img :src="imgUrls[fid] || ''" />
              <span class="img-del" @click="removeImage(i)">×</span>
            </div>
            <label class="img-add" :class="{ 'img-uploading': imgUploading }">
              <span>{{ imgUploading ? '上传中…' : '+ 添加' }}</span>
              <input type="file" accept="image/*" multiple :disabled="imgUploading" @change="onPickImages" hidden />
            </label>
          </div>
        </div>
        <label v-if="form.status === 'finished'" class="block-label">回顾图文<textarea v-model="form.review_content" class="textarea" rows="4" placeholder="活动结束后的图文回顾" /></label>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showForm = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="onSave">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 腾讯地图选点（JS API 自建：拖动地图取中心点 / 搜索定位，逆地址解析回填；需 VITE_TMAP_KEY） -->
    <div v-if="showMap" class="modal-mask" @click.self="closeMap">
      <div class="modal map-modal">
        <h2 class="modal-title">地图选点 · 拖动地图对准图钉，或搜索地点</h2>
        <div class="map-search">
          <input v-model="mapKeyword" class="input-full" placeholder="搜索地点，回车检索" @keyup.enter="onMapSearch" />
          <button class="btn btn-ghost" @click="onMapSearch">搜索</button>
        </div>
        <div v-if="mapSuggests.length" class="map-suggests">
          <div v-for="s in mapSuggests" :key="s.id" class="map-suggest" @click="onPickSuggest(s)">
            {{ s.title }}<span class="map-suggest-addr">{{ s.address }}</span>
          </div>
        </div>
        <div class="map-wrap">
          <div id="tmapPicker" class="map-canvas"></div>
          <div class="map-pin"></div>
        </div>
        <div class="map-addr">{{ mapAddr || '定位中…拖动地图后自动解析地址' }}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="closeMap">取消</button>
          <button class="btn btn-primary" :disabled="!mapAddr" @click="onConfirmMap">使用该位置</button>
        </div>
      </div>
    </div>

    <!-- 邀请函弹窗：按活动类型主题渲染，html2canvas 下载成图 -->
    <div v-if="showInvite" class="modal-mask" @click.self="showInvite = false">
      <div class="modal invite-modal">
        <h2 class="modal-title">邀请函 · {{ inviteAct.title }}</h2>
        <div class="invite-scroll">
          <div class="inv-card" :class="'inv-' + invite.theme" ref="inviteRef">
            <div class="inv-body">
              <span class="inv-tag">{{ invite.tagText }}</span>
              <div class="inv-kicker">{{ invite.kicker }}</div>
              <div class="inv-title">{{ inviteAct.title }}</div>
              <p class="inv-intro">{{ invite.intro }}</p>
              <div class="inv-info">
                <div class="inv-row"><b>活动时间</b><span>{{ invite.timeText }}</span></div>
                <div class="inv-row"><b>参与方式</b><span>{{ invite.joinText }}</span></div>
                <div class="inv-row"><b>报名限额</b><span>{{ invite.quotaText }}</span></div>
              </div>
              <div class="inv-cta">
                <span>长按识别小程序码 · 报名参加</span>
                <img v-if="inviteQr" :src="inviteQr" class="inv-qr" />
                <span v-else class="inv-qr inv-qr-loading">码生成中</span>
              </div>
            </div>
            <div class="inv-foot">
              <div class="invf-logo">
                <div class="invf-name">醒书咨询</div>
                <div class="invf-en">XINGSHU CONSULTING</div>
              </div>
              <div class="invf-desc">醒书咨询，一家专注经典文化与现代生活深度对话的机构，为中小企业和个人提供发展咨询服务。</div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showInvite = false">关闭</button>
          <button class="btn btn-primary" :disabled="inviteSaving || !inviteQr" @click="onDownloadInvite">
            {{ inviteSaving ? '生成中…' : '下载图片' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 报名名单弹窗 -->
    <div v-if="showSignups" class="modal-mask" @click.self="showSignups = false">
      <div class="modal">
        <h2 class="modal-title">报名名单 · {{ signupsActivity.title }}（{{ signups.length }} 人 · 实际参与 {{ attendCount }} 人<template v-if="signupPrice > 0"> · 价格 {{ signupPrice }} 元 · 已收费 {{ paidCount }} 人</template>）</h2>
        <table class="data-table">
          <thead><tr><th>实际参与</th><th v-if="signupPrice > 0">已收费</th><th>称呼</th><th>联系方式</th><th>昵称</th><th>手机号</th><th>报名时间</th></tr></thead>
          <tbody>
            <tr v-for="s in signups" :key="s.id">
              <td><input type="checkbox" class="attend-check" v-model="attendSet[s.id]" /></td>
              <td v-if="signupPrice > 0"><input type="checkbox" class="attend-check" v-model="paidSet[s.id]" /></td>
              <td>{{ s.name }}</td><td>{{ s.contact || '-' }}</td>
              <td>{{ s.nickname }}</td><td>{{ s.phone || '-' }}</td><td>{{ s.signedAt }}</td>
            </tr>
          </tbody>
        </table>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showSignups = false">关闭</button>
          <button class="btn btn-primary" :disabled="attendSaving" @click="onSaveAttendance">
            {{ attendSaving ? '保存中…' : '保存参与名单' }}
          </button>
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

    <!-- 工作人员弹窗：白名单成员可在小程序端查看该活动报名数据 -->
    <div v-if="showStaff" class="modal-mask" @click.self="showStaff = false">
      <div class="modal">
        <h2 class="modal-title">工作人员 · {{ staffActivity.title }}（{{ staff.length }} 人）</h2>
        <p class="staff-hint">名单内成员登录小程序后，可在该活动详情页打开「报名数据」查看报名/到场/收费情况（只读）。主理人无需添加，天然可见。</p>
        <div class="owner-box staff-add">
          <input v-model="staffKw" class="input-full" placeholder="搜昵称/手机号/姓名/ID 添加工作人员" @input="onStaffSearch" />
          <span v-if="staffSearchList.length" class="owner-drop">
            <span v-for="u in staffSearchList" :key="u.id" class="owner-item" @click="onAddStaff(u)">
              {{ u.nickname }}（ID {{ u.id }}{{ u.phone ? ' · ' + u.phone : '' }}{{ u.isMember ? ' · 会员' : '' }}）
            </span>
          </span>
        </div>
        <table class="data-table">
          <thead><tr><th>昵称</th><th>手机号</th><th>添加时间</th><th>添加人</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="s in staff" :key="s.userId">
              <td>{{ s.nickname }}</td>
              <td>{{ s.phone || '-' }}</td>
              <td>{{ s.createdAt }}</td>
              <td class="dim-cell">{{ s.addedBy || '-' }}</td>
              <td><a class="link" @click="onRemoveStaff(s)">移除</a></td>
            </tr>
            <tr v-if="!staff.length"><td colspan="5" style="text-align:center;color:#999;">暂无工作人员，上方搜索添加</td></tr>
          </tbody>
        </table>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showStaff = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 现场分享弹窗 -->
    <div v-if="showPosts" class="modal-mask" @click.self="showPosts = false">
      <div class="modal">
        <h2 class="modal-title">现场分享 · {{ postsActivity.title }}（{{ postsTotal }} 条）</h2>
        <table class="data-table">
          <thead><tr><th>昵称</th><th>内容</th><th>媒体</th><th>时间</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="p in posts" :key="p.id" :style="p.status === 'deleted' ? 'opacity:.45' : ''">
              <td>{{ p.nickname }}</td>
              <td style="max-width:260px;white-space:pre-wrap;">{{ p.content || '-' }}</td>
              <td>
                <a v-for="(img, i) in p.images" :key="i" :href="imgUrls[img] || '#'" target="_blank">
                  <img :src="imgUrls[img]" style="width:44px;height:44px;object-fit:cover;border-radius:4px;margin-right:4px;" />
                </a>
                <a v-if="p.video" :href="imgUrls[p.video] || '#'" target="_blank" class="link">▶ 视频</a>
                <span v-if="!p.images.length && !p.video">-</span>
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
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import {
  getActivities, saveActivity, getActivitySignups, saveAttendance, getInviteQr,
  getActivityTypes, saveActivityType, getActivityPosts, deleteActivityPost, resolveFileUrls,
  uploadActivityImage, hasRole, searchMembers, getStaffList, addStaff, removeStaff,
} from '../api/index.js'

const isSuper = hasRole('super')

const list = ref([])
const types = ref([])
const showForm = ref(false), form = ref({}), saving = ref(false)
// 腾讯地图选点：需在 admin/.env.local 配置 VITE_TMAP_KEY（腾讯位置服务 key，WebServiceAPI 无需白名单）
const TMAP_KEY = import.meta.env.VITE_TMAP_KEY || ''
const mapEnabled = !!TMAP_KEY
const showMap = ref(false)
// ── JS API 自建选点：官方 locpicker 组件的内置定位 iframe 被 Permissions Policy 拦、coord 参数校验又拒收，
// 弃用之。改为：GL 地图 + 中心图钉，拖动后逆地址解析回填；搜索走地点建议接口（两接口均已验证本 key 可用）
const mapKeyword = ref(''), mapSuggests = ref([]), mapAddr = ref(''), mapCenter = ref(null)
let tmap = null

function loadTMapScript() {
  return new Promise((resolve, reject) => {
    if (window.TMap) return resolve()
    const s = document.createElement('script')
    s.src = `https://map.qq.com/api/gljs?v=1.exp&key=${TMAP_KEY}`
    s.onload = resolve
    s.onerror = () => reject(new Error('地图脚本加载失败，请检查网络'))
    document.head.appendChild(s)
  })
}

// WebService JSONP（浏览器端需 JSONP，域名白名单已放开）
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = '_tmap_cb_' + Date.now() + '_' + Math.floor(Math.random() * 1e4)
    const s = document.createElement('script')
    window[cb] = (data) => { delete window[cb]; s.remove(); resolve(data) }
    s.src = `${url}&output=jsonp&callback=${cb}`
    s.onerror = () => { delete window[cb]; s.remove(); reject(new Error('请求失败')) }
    document.head.appendChild(s)
  })
}

async function openMapPicker() {
  showMap.value = true
  mapAddr.value = ''; mapSuggests.value = []; mapKeyword.value = ''; mapCenter.value = null
  try { await loadTMapScript() } catch (e) { alert(e.message); showMap.value = false; return }
  await nextTick()
  // 编辑已有坐标则回显该点，否则广州中心
  const center = new window.TMap.LatLng(form.value.latitude || 23.129163, form.value.longitude || 113.264435)
  tmap = new window.TMap.Map(document.getElementById('tmapPicker'), { center, zoom: 15 })
  tmap.on('idle', onMapIdle)
  resolveCenter()
}

let idleTimer = null
function onMapIdle() { clearTimeout(idleTimer); idleTimer = setTimeout(resolveCenter, 300) }

// 取地图中心 → 逆地址解析出可读地址
async function resolveCenter() {
  if (!tmap) return
  const c = tmap.getCenter()
  mapCenter.value = { lat: c.getLat(), lng: c.getLng() }
  try {
    const r = await jsonp(`https://apis.map.qq.com/ws/geocoder/v1/?location=${c.getLat()},${c.getLng()}&key=${TMAP_KEY}`)
    if (r.status === 0) {
      const rec = r.result.formatted_addresses && r.result.formatted_addresses.recommend
      mapAddr.value = rec ? `${r.result.address}（${rec}）` : r.result.address
    } else {
      mapAddr.value = ''
      alert('地址解析失败：' + r.message)
    }
  } catch { mapAddr.value = '' }
}

async function onMapSearch() {
  const kw = mapKeyword.value.trim()
  if (!kw) return
  try {
    const region = encodeURIComponent(form.value.city || '')
    const r = await jsonp(`https://apis.map.qq.com/ws/place/v1/suggestion?keyword=${encodeURIComponent(kw)}&region=${region}&key=${TMAP_KEY}`)
    if (r.status === 0) mapSuggests.value = (r.data || []).slice(0, 8)
    else alert('搜索失败：' + r.message)
  } catch { alert('搜索失败，请重试') }
}

function onPickSuggest(s) {
  mapSuggests.value = []
  mapKeyword.value = s.title
  mapCenter.value = { lat: s.location.lat, lng: s.location.lng }
  mapAddr.value = `${s.address}（${s.title}）`
  if (tmap) tmap.setCenter(new window.TMap.LatLng(s.location.lat, s.location.lng))
}

function onConfirmMap() {
  if (!mapCenter.value || !mapAddr.value) return
  form.value.location = mapAddr.value
  form.value.latitude = Number(mapCenter.value.lat.toFixed(6))
  form.value.longitude = Number(mapCenter.value.lng.toFixed(6))
  closeMap()
}

function closeMap() {
  showMap.value = false
  clearTimeout(idleTimer)
  if (tmap) { tmap.destroy(); tmap = null }
}
const showSignups = ref(false), signups = ref([]), signupsActivity = ref({})
const attendSet = ref({}), attendSaving = ref(false)
const paidSet = ref({}), signupPrice = ref(0)
const imgUploading = ref(false)
const attendCount = computed(() => Object.values(attendSet.value).filter(Boolean).length)
const paidCount = computed(() => Object.values(paidSet.value).filter(Boolean).length)
// 邀请函
const showInvite = ref(false), inviteAct = ref({}), inviteQr = ref(''), inviteSaving = ref(false)
const inviteRef = ref(null)
const showTypes = ref(false), typeForm = ref({ channel: 'offline', sort: 0 })
const showPosts = ref(false), posts = ref([]), postsActivity = ref({}), postsTotal = ref(0), postsPage = ref(1)
const imgUrls = ref({})
// 主理人搜索（表单内，仅超管）与工作人员管理
const ownerKw = ref(''), ownerList = ref([])
const showStaff = ref(false), staff = ref([]), staffActivity = ref({})
const staffKw = ref(''), staffSearchList = ref([])
let ownerTimer = null, staffTimer = null

function onOwnerSearch() {
  clearTimeout(ownerTimer)
  ownerTimer = setTimeout(async () => {
    const kw = ownerKw.value.trim()
    if (!kw) { ownerList.value = []; return }
    ownerList.value = (await searchMembers(kw, { pageSize: 8 })).list
  }, 300)
}
function pickOwner(u) {
  form.value.ownerUserId = u.id
  form.value.ownerNickname = u.nickname
  ownerKw.value = ''; ownerList.value = []
}

async function openStaff(a) {
  staffActivity.value = a
  staffKw.value = ''; staffSearchList.value = []
  staff.value = (await getStaffList(a.id)).list
  showStaff.value = true
}
function onStaffSearch() {
  clearTimeout(staffTimer)
  staffTimer = setTimeout(async () => {
    const kw = staffKw.value.trim()
    if (!kw) { staffSearchList.value = []; return }
    staffSearchList.value = (await searchMembers(kw, { pageSize: 8 })).list
  }, 300)
}
async function onAddStaff(u) {
  staffKw.value = ''; staffSearchList.value = []
  try {
    await addStaff(staffActivity.value.id, u.id)
    staff.value = (await getStaffList(staffActivity.value.id)).list
  } catch (e) { alert(e.message || '添加失败') }
}
async function onRemoveStaff(s) {
  if (!confirm(`确认移除工作人员「${s.nickname}」？移除后其小程序端立即不可再查看报名数据。`)) return
  try {
    await removeStaff(staffActivity.value.id, s.userId)
    staff.value = (await getStaffList(staffActivity.value.id)).list
  } catch (e) { alert(e.message || '移除失败') }
}

onMounted(async () => { await Promise.all([load(), loadTypes()]) })
async function load() { list.value = (await getActivities()).list }
async function loadTypes() { types.value = await getActivityTypes() }
// 列表状态派生（与小程序端口径一致）：规划中(draft) / 报名中(未开始) / 进行中(已开始未结束，
// 无结束时间按开始后 24h 内) / 已结束(finished 或已过结束判定线)
function actState(a) {
  if (a.status === 'draft') return { cls: 'plan', label: '规划中' }
  const now = Date.now()
  const start = new Date(String(a.startTime).replace(/-/g, '/')).getTime()
  const end = a.endTime
    ? new Date(String(a.endTime).replace(/-/g, '/')).getTime()
    : start + 24 * 3600 * 1000
  if (a.status !== 'finished') {
    if (now < start) return { cls: 'open', label: '报名中' }
    if (now <= end) return { cls: 'live', label: '进行中' }
  }
  return { cls: 'done', label: '已结束' }
}

// 表单类型选项：启用项 +（编辑回显时）当前活动已关联但被停用的类型
const formTypeOptions = computed(() => {
  const active = types.value.filter(t => t.is_active)
  const cur = form.value.type_id && types.value.find(t => t.id === form.value.type_id && !t.is_active)
  return cur ? [...active, cur] : active
})

// datetime-local（"YYYY-MM-DDTHH:mm"）↔ 后端（"YYYY-MM-DD HH:mm:ss"）
function toLocal(s) { return s ? String(s).replace(' ', 'T').slice(0, 16) : '' }
function fromLocal(v) { return v ? v.replace('T', ' ') + ':00' : null }

// 时长（小时）↔ 结束时间：开始时间 + 时长 → 结束；编辑回填时由起止反算时长（归整到 0.5）
function endFromDuration(startLocal, hours, withSec) {
  if (!startLocal || !(hours > 0)) return null
  const d = new Date(startLocal)
  if (isNaN(d.getTime())) return null
  d.setTime(d.getTime() + hours * 3600 * 1000)
  const p = n => String(n).padStart(2, '0')
  const base = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  return withSec ? base + ':00' : base
}
function durationBetween(startLocal, endLocal) {
  if (!startLocal || !endLocal) return null
  const s = new Date(startLocal), e = new Date(endLocal)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null
  const h = (e.getTime() - s.getTime()) / 3600000
  return h > 0 ? Math.round(h * 2) / 2 : null
}
const computedEndText = computed(() => endFromDuration(form.value.start_time, form.value.duration_hours, false) || '')

// images 列可能是数组或 JSON 字符串（mysql2 视驱动而定），统一成数组
function normImgs(v) {
  if (Array.isArray(v)) return v
  if (!v) return []
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
}
// 活动配图缩略图换链（编辑回填 form.images 时触发）
async function loadFormImages() {
  const ids = (form.value.images || []).filter(x => x && !imgUrls.value[x])
  if (ids.length) {
    const map = await resolveFileUrls(ids)
    imgUrls.value = { ...imgUrls.value, ...map }
  }
}
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}
async function onPickImages(e) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  if (!files.length) return
  imgUploading.value = true
  try {
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { alert(`${file.name} 超过 5MB，请压缩后再传`); continue }
      const base64 = await fileToBase64(file)
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const { fileID } = await uploadActivityImage(base64, ext)
      if (!form.value.images) form.value.images = []
      form.value.images.push(fileID)
      const map = await resolveFileUrls([fileID])
      imgUrls.value = { ...imgUrls.value, ...map }
    }
  } catch (err) { alert('图片上传失败：' + err.message) } finally { imgUploading.value = false }
}
function removeImage(i) { form.value.images.splice(i, 1) }

// 生效形式：关联类型时随类型渠道，否则取表单所选（控制会议号/地址字段切换）
const effectiveType = computed(() => {
  if (form.value.type_id) {
    const t = types.value.find(x => x.id === form.value.type_id)
    if (t) return t.channel
  }
  return form.value.type
})

// 选定活动类型时，「活动形式」下拉同步跳到该类型的渠道（disabled 态下展示与实际一致）
watch(() => form.value.type_id, (id) => {
  if (!id) return
  const t = types.value.find(x => x.id === id)
  if (t) form.value.type = t.channel
})

function openForm(a) {
  const startLocal = a ? toLocal(a.startTime) : ''
  form.value = a
    ? { id: a.id, title: a.title, start_time: startLocal,
        duration_hours: durationBetween(startLocal, toLocal(a.endTime)) ?? 2,
        signup_deadline: toLocal(a.deadline),
        type: a.type, type_id: a.type_id || null, city: a.city, capacity: a.capacity,
        price: Number(a.price) || 0, status: a.status,
        location: a.location || '', latitude: a.latitude || null, longitude: a.longitude || null,
        organizer: a.organizer || '醒书运营组', images: normImgs(a.images),
        ownerUserId: a.ownerUserId || null, ownerNickname: a.ownerNickname || '',
        content: a.content || '', review_content: a.review_content || '', cover_url: a.cover_url || '' }
    : { type: 'offline', type_id: null, status: 'draft', capacity: 12, price: 0, duration_hours: 2,
        organizer: '醒书运营组', images: [], ownerUserId: null, ownerNickname: '',
        latitude: null, longitude: null, repeat: '', repeat_until: '' }
  ownerKw.value = ''; ownerList.value = []
  showForm.value = true
  loadFormImages()
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
    delete payload.repeat; delete payload.repeat_until; delete payload.duration_hours
    delete payload.ownerNickname
    // 主理人字段仅超管提交（服务端亦仅 super 生效；activity 角色新建时服务端自动落自己）
    if (!isSuper) delete payload.ownerUserId
    payload.start_time = fromLocal(f.start_time)
    payload.end_time = endFromDuration(f.start_time, f.duration_hours, true)
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

async function openSignups(a) {
  signupsActivity.value = a
  const res = await getActivitySignups(a.id)
  signups.value = res.list
  signupPrice.value = Number(res.price) || 0
  // 勾选态从库内 attended / paid 回显
  const set = {}, pset = {}
  for (const s of signups.value) { set[s.id] = !!s.attended; pset[s.id] = !!s.paid }
  attendSet.value = set
  paidSet.value = pset
  showSignups.value = true
}

// 实际参与名单：勾选后整场覆盖式保存
async function onSaveAttendance() {
  if (attendSaving.value) return
  attendSaving.value = true
  try {
    const ids = signups.value.filter(s => attendSet.value[s.id]).map(s => s.id)
    const paidIds = signups.value.filter(s => paidSet.value[s.id]).map(s => s.id)
    const r = await saveAttendance(signupsActivity.value.id, ids, paidIds)
    alert(`已保存：实际参与 ${r.attended} 人` + (signupPrice.value > 0 ? ` · 已收费 ${r.paid} 人` : ''))
  } catch (e) {
    alert('保存失败：' + e.message)
  } finally {
    attendSaving.value = false
  }
}

// ── 邀请函 ──
// 主题映射：按类型名关键词，渠道兜底（与小程序端类型图标口径一致）
function inviteTheme(a) {
  const n = a.typeName || ''
  if (n.includes('咖啡')) return { theme: 'coffee', tagText: `${n || '醒书咖啡'} · 线上`, kicker: 'SATURDAY MORNING COFFEE' }
  if (n.includes('观影') || n.includes('电影')) return { theme: 'film', tagText: `${n} · 线下`, kicker: 'XINGSHU CINEMA CLUB' }
  if (n.includes('巧克力')) return { theme: 'choco', tagText: `${n} · 线下`, kicker: 'BEAN TO BAR WORKSHOP' }
  if (n.includes('厨房') || n.includes('餐')) return { theme: 'pot', tagText: `${n} · 线下`, kicker: 'XINGSHU KITCHEN TABLE' }
  if (a.type === 'online') return { theme: 'story', tagText: `${n || '醒书活动'} · 线上`, kicker: 'XINGSHU MONTHLY STORY' }
  return { theme: 'fire', tagText: `${n || '醒书活动'} · 线下`, kicker: 'XINGSHU CAMPFIRE STORIES' }
}

const invite = computed(() => {
  const a = inviteAct.value
  if (!a.id) return { theme: 'story' }
  const t = inviteTheme(a)
  const wd = (s) => {
    const d = new Date(String(s).replace(/-/g, '/'))
    return isNaN(d.getTime()) ? '' : '（周' + '日一二三四五六'[d.getDay()] + '）'
  }
  const endPart = a.endTime ? ' – ' + (String(a.endTime).slice(0, 10) === String(a.startTime).slice(0, 10)
    ? String(a.endTime).slice(11, 16) : a.endTime) : ''
  return {
    ...t,
    intro: (a.content || '').replace(/\s+/g, ' ').slice(0, 110) + ((a.content || '').length > 110 ? '…' : ''),
    timeText: `${a.startTime}${wd(a.startTime)}${endPart}`,
    joinText: a.type === 'online' ? '线上 · 腾讯会议（会议号报名后可见）' : `线下 · ${a.city || ''} · ${a.location || ''}`,
    quotaText: a.capacity > 0 ? `${a.capacity} 人 · 先到先得` : '不限名额',
  }
})

async function openInvite(a) {
  inviteAct.value = a
  inviteQr.value = ''
  showInvite.value = true
  try {
    const r = await getInviteQr(a.id)
    inviteQr.value = r.dataUrl
  } catch (e) {
    alert('小程序码生成失败：' + e.message)
  }
}

async function onDownloadInvite() {
  if (inviteSaving.value || !inviteRef.value) return
  inviteSaving.value = true
  try {
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(inviteRef.value, { scale: 3, backgroundColor: null, useCORS: true })
    const link = document.createElement('a')
    link.download = `邀请函-${inviteAct.value.title}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } catch (e) {
    alert('生成图片失败：' + e.message)
  } finally {
    inviteSaving.value = false
  }
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
  // cloud:// fileID 批量换临时 URL（照片 + 视频）
  const ids = [...new Set(r.list.flatMap(p => [...(p.images || []), p.video]))].filter(x => x && !imgUrls.value[x])
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
/* 操作列：按钮与链接横排留距 */
.act-ops { display: flex; align-items: center; gap: 12px; white-space: nowrap; }

/* ── 邀请函 ── */
.invite-modal { width: 440px; max-width: 94vw; }
.invite-scroll { max-height: 66vh; overflow-y: auto; display: flex; justify-content: center; padding: 4px 0 8px; }
.inv-card { width: 360px; flex-shrink: 0; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 12px 32px rgba(30,25,18,.25); }
.inv-body { padding: 30px 28px 24px; position: relative; display: flex; flex-direction: column; }
.inv-tag { align-self: flex-start; font-size: 12px; letter-spacing: 3px; padding: 4px 12px; border-radius: 4px; border: 1.5px solid currentColor; }
.inv-kicker { font-size: 10px; letter-spacing: 4px; margin-top: 22px; opacity: .7; }
.inv-title { font-family: 'Songti SC', 'Noto Serif SC', SimSun, serif; font-size: 28px; line-height: 1.45; letter-spacing: 2px; font-weight: 700; margin: 6px 0 12px; }
.inv-intro { font-size: 13px; line-height: 1.9; opacity: .9; margin: 0 0 20px; }
.inv-info { border-top: 1px solid; border-color: currentColor; opacity: .96; padding-top: 14px; display: flex; flex-direction: column; gap: 10px; }
.inv-row { display: flex; gap: 12px; font-size: 13px; align-items: baseline; }
.inv-row b { flex-shrink: 0; width: 60px; font-weight: 500; font-size: 11px; letter-spacing: 2px; opacity: .72; }
.inv-row span { flex: 1; }
.inv-cta { margin-top: 20px; display: flex; align-items: center; gap: 14px; justify-content: space-between; border: 1.5px dashed currentColor; border-radius: 12px; padding: 12px 16px; font-size: 12px; letter-spacing: 2px; }
.inv-qr { width: 74px; height: 74px; border-radius: 6px; background: #fff; flex-shrink: 0; }
.inv-qr-loading { display: flex; align-items: center; justify-content: center; font-size: 10px; letter-spacing: 1px; opacity: .7; background: rgba(255,255,255,.15); }
/* 品牌页脚（复刻醒书咨询品牌条） */
.inv-foot { background: #A08A63; color: #FDF9F0; padding: 12px 18px; display: flex; align-items: center; gap: 12px; }
.invf-logo { flex-shrink: 0; text-align: center; }
.invf-name { font-family: 'Songti SC', SimSun, serif; font-size: 13px; letter-spacing: 2px; font-weight: 700; }
.invf-en { font-size: 6.5px; letter-spacing: 1.5px; opacity: .85; }
.invf-desc { flex: 1; font-size: 9px; line-height: 1.75; opacity: .92; border-left: 1px solid rgba(253,249,240,.35); padding-left: 12px; }
/* 六类主题 */
.inv-story { background: linear-gradient(168deg, #1F3450, #2C4A6E 55%, #3A6B9E); color: #F2EFE6; }
.inv-story .inv-tag, .inv-story .inv-cta { color: #F8E9BE; }
.inv-coffee { background: linear-gradient(165deg, #F6EDDC, #EAD9B8 60%, #DEC79A); color: #4A3A28; }
.inv-coffee .inv-tag, .inv-coffee .inv-cta { color: #8A6E4B; }
.inv-film { background: linear-gradient(170deg, #26232B, #3A3442 60%, #4A4256); color: #EDE8F2; }
.inv-film .inv-tag, .inv-film .inv-cta { color: #C9B8E8; }
.inv-fire { background: linear-gradient(168deg, #8C2F1E, #A73D28 55%, #C2563F); color: #FBEFE3; }
.inv-fire .inv-tag, .inv-fire .inv-cta { color: #FFD9A0; }
.inv-choco { background: linear-gradient(166deg, #3E2A20, #5A3D2C 55%, #6B4A3A); color: #F2E4D4; }
.inv-choco .inv-tag, .inv-choco .inv-cta { color: #E8C39A; }
.inv-pot { background: linear-gradient(167deg, #B8860B, #C29013 50%, #D8A93C); color: #FFF9EA; }
.inv-pot .inv-tag, .inv-pot .inv-cta { color: #FFF3D0; }

/* 活动状态胶囊：规划中/报名中/进行中/已结束 */
.act-st { display: inline-block; font-size: 12px; padding: 2px 10px; border-radius: 10px; white-space: nowrap; }
.st-plan { color: var(--ink-3); background: rgba(126, 102, 64, 0.08); }
.st-open { color: #fff; background: #B6452F; }
.st-live { color: #fff; background: #5B8F6C; }
.st-done { color: var(--ink-4); border: 0.5px solid var(--tbl-border); }

.addr-row { display: flex; gap: 8px; align-items: center; }
.addr-row .input-full { flex: 1; }
.addr-map-btn { flex-shrink: 0; white-space: nowrap; }
.addr-coord { font-size: 11px; color: var(--ink-4); margin-top: 4px; }
.repeat-hint { font-size: 12px; color: #B6452F; margin: 8px 0 0; }
.map-modal { width: 720px; max-width: 92vw; }
.map-search { display: flex; gap: 8px; margin-bottom: 8px; }
.map-search .input-full { flex: 1; }
.map-suggests { border: 0.5px solid var(--tbl-border); border-radius: 8px; margin-bottom: 8px; max-height: 200px; overflow-y: auto; background: var(--bg-content); }
.map-suggest { padding: 8px 12px; font-size: 13px; cursor: pointer; border-bottom: 0.5px solid var(--tbl-border); }
.map-suggest:last-child { border-bottom: none; }
.map-suggest:hover { background: rgba(53, 120, 246, 0.06); }
.map-suggest-addr { margin-left: 8px; font-size: 11px; color: var(--ink-4); }
.map-wrap { position: relative; }
.map-canvas { width: 100%; height: 400px; border-radius: 8px; overflow: hidden; }
/* 中心固定图钉：取图钉尖端所指即所选坐标 */
.map-pin { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; transform: translate(-50%, -100%); pointer-events: none; z-index: 5; }
.map-pin::before { content: ''; position: absolute; left: 50%; top: 0; transform: translateX(-50%); width: 16px; height: 16px; background: #E5574A; border: 2px solid #fff; border-radius: 50% 50% 50% 0; rotate: -45deg; box-shadow: 0 2px 6px rgba(0,0,0,.3); }
.map-addr { font-size: 13px; color: var(--ink-2); padding: 10px 2px 0; min-height: 20px; }

/* 主理人/工作人员：搜索下拉与当前项 */
.owner-box { position: relative; display: block; }
.owner-current { display: inline-flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 13px; }
.owner-drop {
  position: absolute; left: 0; right: 0; top: 100%; z-index: 20; display: block;
  background: var(--bg-content, #fff); border: 0.5px solid var(--tbl-border);
  border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); max-height: 220px; overflow-y: auto;
}
.owner-item { display: block; padding: 8px 12px; font-size: 13px; cursor: pointer; }
.owner-item:hover { background: rgba(53, 120, 246, 0.06); }
.staff-hint { font-size: 12px; color: var(--ink-3); margin: 0 0 12px; }
.staff-add { margin-bottom: 12px; }
.dim-cell { color: var(--ink-4); font-size: 12px; }

/* 活动配图上传 */
.img-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
.img-thumb { position: relative; width: 84px; height: 84px; border-radius: 8px; overflow: hidden; border: 0.5px solid var(--tbl-border); }
.img-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.img-del { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; line-height: 18px; text-align: center; background: rgba(0,0,0,.55); color: #fff; border-radius: 50%; cursor: pointer; font-size: 14px; }
.img-add { display: flex; align-items: center; justify-content: center; width: 84px; height: 84px; border: 1px dashed var(--tbl-border); border-radius: 8px; cursor: pointer; color: var(--ink-4); font-size: 13px; text-align: center; }
.img-add.img-uploading { opacity: .6; cursor: default; }
</style>
