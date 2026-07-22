<template>
  <div>
    <h1 class="page-title">账号管理</h1>
    <div class="filter-bar">
      <input v-model="keyword" placeholder="搜索姓名/手机号" class="input" @input="onFilter" />
      <button class="btn btn-primary" @click="openCreate">新建账号</button>
    </div>
    <table class="data-table">
      <thead><tr>
        <th>ID</th><th>姓名</th><th>手机号</th><th>角色</th><th>绑定会员</th>
        <th>状态</th><th>最近登录</th><th>创建时间</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr v-for="a in list" :key="a.id">
          <td>{{ a.id }}</td>
          <td>{{ a.name }}</td>
          <td>{{ a.phone }}</td>
          <td>
            <span v-for="r in a.roles" :key="r" class="role-badge" :class="'role-' + r">{{ roleLabel(r) }}</span>
          </td>
          <td>{{ a.userId ? `${a.userNickname || '?'}（ID ${a.userId}）` : '—' }}</td>
          <td>
            <span class="state" :class="a.isActive ? 'state-on' : 'state-off'">{{ a.isActive ? '启用' : '停用' }}</span>
          </td>
          <td class="dim">{{ a.lastLoginAt || '从未登录' }}</td>
          <td class="dim">{{ a.createdAt }}</td>
          <td>
            <a class="link" @click="openEdit(a)">编辑</a>
            <a class="link" @click="openResetPwd(a)">重置密码</a>
            <a class="link" :class="a.isActive ? 'link-danger' : ''" @click="onToggle(a)">{{ a.isActive ? '停用' : '启用' }}</a>
          </td>
        </tr>
        <tr v-if="!list.length"><td colspan="9" class="empty">暂无运营账号，点右上「新建账号」创建</td></tr>
      </tbody>
    </table>

    <!-- 新建/编辑弹窗 -->
    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="modal">
        <h3>{{ form.id ? '编辑账号' : '新建账号' }}</h3>
        <div class="form-row"><label>姓名</label><input v-model="form.name" class="input" placeholder="姓名/备注名" /></div>
        <div class="form-row"><label>手机号</label><input v-model="form.phone" class="input" placeholder="登录手机号（11 位）" /></div>
        <div class="form-row">
          <label>角色（可多选）</label>
          <label v-for="r in ROLE_OPTIONS" :key="r.value" class="role-check">
            <input type="checkbox" :value="r.value" v-model="form.roles" /> {{ r.label }}
          </label>
        </div>
        <div class="form-row">
          <label>绑定会员<template v-if="form.roles.includes('activity')">（必填）</template></label>
          <div class="bind-box">
            <div v-if="form.userId" class="bind-current">
              {{ form.userNickname || '?' }}（ID {{ form.userId }}）
              <a class="link link-danger" @click="form.userId = null; form.userNickname = ''">解绑</a>
            </div>
            <template v-else>
              <input v-model="searchKw" class="input" placeholder="搜昵称/手机号/姓名/ID 绑定小程序用户" @input="onSearch" />
              <div v-if="searchList.length" class="search-drop">
                <div v-for="u in searchList" :key="u.id" class="search-item" @click="pickUser(u)">
                  {{ u.nickname }}<span class="dim">（ID {{ u.id }}{{ u.phone ? ' · ' + u.phone : '' }}{{ u.isMember ? ' · 会员' : '' }}）</span>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div class="form-row" v-if="!form.id">
          <label>初始密码</label><input v-model="form.password" type="password" class="input" placeholder="至少 6 位" />
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showForm = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="onSave">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 重置密码弹窗 -->
    <div v-if="showPwd" class="modal-mask" @click.self="showPwd = false">
      <div class="modal modal-sm">
        <h3>重置密码 · {{ pwdTarget.name }}</h3>
        <div class="form-row"><label>新密码</label><input v-model="newPwd" type="password" class="input" placeholder="至少 6 位" /></div>
        <div class="modal-actions">
          <button class="btn" @click="showPwd = false">取消</button>
          <button class="btn btn-primary" :disabled="saving || newPwd.length < 6" @click="onResetPwd">确认重置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAccounts, saveAccount, disableAccount, resetAccountPwd, searchMembers, getUid, logout } from '../api/index.js'

const router = useRouter()

const list = ref([]), keyword = ref(''), total = ref(0)
const showForm = ref(false), showPwd = ref(false), saving = ref(false)
const form = ref({})
const pwdTarget = ref({}), newPwd = ref('')
const searchKw = ref(''), searchList = ref([])
let timer = null, searchTimer = null

onMounted(reload)
async function reload() {
  const r = await getAccounts({ keyword: keyword.value.trim() || undefined, page: 1, pageSize: 100 })
  list.value = r.list; total.value = r.total
}
function onFilter() { clearTimeout(timer); timer = setTimeout(reload, 250) }

function roleLabel(r) { return { super: '超级管理员', content: '内容运营', activity: '活动运营', member: '会员运营' }[r] || r }
const ROLE_OPTIONS = [
  { value: 'content', label: '内容运营（故事/精选/互动）' },
  { value: 'activity', label: '活动运营（仅自己主理的活动）' },
  { value: 'member', label: '会员运营（用户/订单，不含退费）' },
  { value: 'super', label: '超级管理员（全部功能）' },
]

function openCreate() {
  form.value = { name: '', phone: '', roles: ['content'], userId: null, userNickname: '', password: '' }
  searchKw.value = ''; searchList.value = []
  showForm.value = true
}
function openEdit(a) {
  const roles = (a.roles && a.roles.length) ? [...a.roles] : String(a.role || '').split(',').filter(Boolean)
  form.value = { id: a.id, name: a.name, phone: a.phone, roles, userId: a.userId, userNickname: a.userNickname,
    _origRoles: [...roles].sort().join(',') }
  searchKw.value = ''; searchList.value = []
  showForm.value = true
}

function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    const kw = searchKw.value.trim()
    if (!kw) { searchList.value = []; return }
    const r = await searchMembers(kw, { pageSize: 8 })
    searchList.value = r.list
  }, 300)
}
function pickUser(u) {
  form.value.userId = u.id
  form.value.userNickname = u.nickname
  searchKw.value = ''; searchList.value = []
}

async function onSave() {
  if (saving.value) return
  saving.value = true
  const roleChanged = form.value.id && form.value._origRoles !== undefined &&
    [...form.value.roles].sort().join(',') !== form.value._origRoles
  const isSelf = form.value.id && form.value.id === getUid()
  if (!form.value.roles.length) { alert('至少选择一个角色'); saving.value = false; return }
  try {
    await saveAccount({
      id: form.value.id, name: form.value.name, phone: form.value.phone.trim(),
      roles: form.value.roles, userId: form.value.userId || null, password: form.value.password || undefined,
    })
    showForm.value = false
  } catch (e) {
    alert(e.message || '保存失败')
    saving.value = false
    return
  }
  saving.value = false
  // 角色变更即时生效于服务端权限；但左侧菜单来自登录 token，须重新登录后刷新
  if (isSelf && roleChanged) {
    alert('已修改你自己的角色，请重新登录以按新角色使用后台。')
    logout()
    router.replace('/login')
    return
  }
  if (roleChanged) alert('已保存。角色权限即时生效；该账号重新登录后左侧菜单才会按新角色显示。')
  // 列表刷新失败不影响保存结果的判定（隧道偶发慢时避免误报「保存失败」）
  try { await reload() } catch (e) { console.warn('列表刷新失败：', e) }
}

async function onToggle(a) {
  if (a.isActive && !confirm(`确认停用账号「${a.name}」？停用后立即无法登录/操作。`)) return
  try {
    await disableAccount(a.id, !a.isActive)
    await reload()
  } catch (e) { alert(e.message || '操作失败') }
}

function openResetPwd(a) { pwdTarget.value = a; newPwd.value = ''; showPwd.value = true }
async function onResetPwd() {
  if (saving.value) return
  saving.value = true
  try {
    await resetAccountPwd(pwdTarget.value.id, newPwd.value)
    showPwd.value = false
    alert('密码已重置')
  } catch (e) {
    alert(e.message || '重置失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.role-badge { padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; margin-right: 6px; display: inline-block; }
.role-check { display: block; font-size: 13px; color: #374151; padding: 4px 0; cursor: pointer; }
.role-check input { margin-right: 6px; }
.role-super { background: #FBE3DE; color: #B6452F; }
.role-content { background: #E6EEF6; color: #3578F6; }
.role-activity { background: #E8F3E8; color: #3D7A3D; }
.role-member { background: #F6EEDA; color: #8A6E4B; }
.state { font-size: 12px; }
.state-on { color: #3D7A3D; }
.state-off { color: #A8A39B; }
.link { cursor: pointer; margin-right: 10px; }
.link-danger { color: #B6452F; }
.dim { color: #A8A39B; font-size: 12px; }
.empty { text-align: center; color: #A8A39B; padding: 24px; }
.modal-mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35);
  display: grid; place-items: center; z-index: 100;
}
.modal { background: #fff; border-radius: 12px; padding: 24px; width: 460px; max-width: 92vw; }
.modal-sm { width: 360px; }
.modal h3 { margin: 0 0 18px; }
.form-row { margin-bottom: 14px; }
.form-row label { display: block; font-size: 13px; color: #6B7280; margin-bottom: 6px; }
.form-row .input, .form-row .select { width: 100%; box-sizing: border-box; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.bind-box { position: relative; }
.bind-current { padding: 8px 0; font-size: 14px; display: flex; align-items: center; gap: 10px; }
.search-drop {
  position: absolute; left: 0; right: 0; top: 100%; z-index: 10;
  background: #fff; border: 1px solid #E5E7EB; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); max-height: 220px; overflow-y: auto;
}
.search-item { padding: 8px 12px; cursor: pointer; font-size: 14px; }
.search-item:hover { background: #F3F6FA; }
</style>
