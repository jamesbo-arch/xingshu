<template>
  <div>
    <h1 class="page-title">会员订单</h1>

    <div class="sync-banner">
      <strong>线下转账开通</strong>：用户完成线下转账后，在此为其创建订单即视为记录一笔已完成转账并
      <strong>即时开通 / 续期会员</strong>，小程序端会员身份实时生效。
    </div>

    <div class="filter-bar">
      <input v-model="keyword" placeholder="搜索订单号 / 用户 / 手机号" class="input" @input="search" />
      <select v-model="status" class="select" @change="search">
        <option value="">全部状态</option>
        <option value="active">生效中</option>
        <option value="expiring">即将到期</option>
        <option value="expired">已过期</option>
      </select>
      <button class="btn btn-primary" @click="openCreate()">+ 创建订单</button>
    </div>

    <table class="data-table">
      <thead><tr>
        <th>订单号</th><th>用户</th><th>套餐</th><th>金额</th><th>支付方式</th>
        <th>支付时间</th><th>会员有效期</th><th>状态</th><th>录入人</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr v-for="o in orders" :key="o.id">
          <td class="mono">{{ o.id }}</td>
          <td>{{ o.userName }}<span v-if="o.userPhone" class="dim"> · {{ o.userPhone }}</span></td>
          <td>{{ o.plan }}</td>
          <td>¥{{ o.amount }}</td>
          <td>{{ o.method }}</td>
          <td>{{ o.paymentTime || '-' }}</td>
          <td>{{ o.validFrom || '?' }} → {{ o.validUntil || '?' }}</td>
          <td><span class="badge" :class="'badge-'+o.state">{{ stateLabel(o.state) }}</span></td>
          <td class="dim">{{ o.createdBy }}</td>
          <td><button class="btn btn-ghost" @click="openDetail(o.id)">详情</button></td>
        </tr>
        <tr v-if="!orders.length"><td colspan="10" class="empty">暂无订单</td></tr>
      </tbody>
    </table>
    <Paginate :page="page" :pageSize="pageSize" :total="total" @change="onPage" />

    <!-- ===== 创建订单向导 ===== -->
    <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
      <div class="modal">
        <h2 class="modal-title">创建订单 · 开通会员</h2>
        <div class="stepper">
          <div class="step" :class="{ active: step===1, done: step>1 }"><span class="n">1</span>选择用户</div>
          <div class="bar"></div>
          <div class="step" :class="{ active: step===2, done: step>2 }"><span class="n">2</span>填写订单</div>
          <div class="bar"></div>
          <div class="step" :class="{ active: step===3 }"><span class="n">3</span>确认开通</div>
        </div>

        <!-- 步骤1 选用户 -->
        <div v-if="step===1">
          <input v-model="userKeyword" class="input-full" placeholder="搜索昵称 / 真实姓名 / 手机号 / 用户ID" @input="filterUsers" />
          <div class="candidate-list">
            <div v-for="u in candidates" :key="u.id" class="candidate"
                 :class="{ selected: picked && picked.id===u.id }" @click="picked = u">
              {{ u.nickname }}（ID {{ u.id }}{{ u.phone ? ' · '+u.phone : '' }}） ·
              <span :class="'badge badge-'+u.identity">{{ idLabel(u.identity) }}</span>
            </div>
            <div v-if="!candidates.length" class="candidate dim">无可开通用户（仅已授权 / 现会员可建单）</div>
          </div>
          <div v-if="picked" class="preview-user">
            <div class="info">
              <div class="nm">{{ picked.nickname }}</div>
              <div class="mt">ID {{ picked.id }} · {{ picked.phone || '无手机号' }} · {{ idLabel(picked.identity) }}</div>
            </div>
            <div v-if="picked.identity==='member'" class="warn-ext">续期后有效期将顺延</div>
          </div>
        </div>

        <!-- 步骤2 填单 -->
        <div v-else-if="step===2">
          <div class="form-grid">
            <label>套餐
              <select v-model="form.plan" class="input-full"><option value="年度会员">年度会员（¥365/年）</option></select>
            </label>
            <label>支付方式
              <select v-model="form.method" class="input-full">
                <option v-for="m in methods" :key="m" :value="m">{{ m }}</option>
              </select>
            </label>
            <label>实付金额（元）<input v-model.number="form.amount" type="number" class="input-full" /></label>
            <label>支付日期<input v-model="form.paymentDate" type="date" class="input-full" /></label>
          </div>
          <label class="block-label">备注（转账流水号 / 优惠原因）
            <input v-model="form.note" class="input-full" placeholder="选填" />
          </label>
          <label class="block-label">支付凭证（转账截图，自动压缩，选填）</label>
          <div v-if="!proofPreview" class="proof-upload" @click="$refs.proofInput.click()">
            {{ uploading ? '处理中…' : '点击上传转账截图' }}
            <input ref="proofInput" type="file" accept="image/*" hidden @change="onProof" />
          </div>
          <div v-else class="proof-thumb">
            <img :src="proofPreview" />
            <button class="rm" @click="clearProof">×</button>
          </div>
        </div>

        <!-- 步骤3 确认 -->
        <div v-else-if="step===3">
          <dl class="confirm-kv">
            <dt>用户</dt><dd>{{ picked.nickname }}（ID {{ picked.id }}）</dd>
            <dt>套餐</dt><dd>{{ form.plan }}</dd>
            <dt>实付</dt><dd class="big">¥{{ form.amount }}</dd>
            <dt>支付方式</dt><dd>{{ form.method }}</dd>
            <dt>支付日期</dt><dd>{{ form.paymentDate }}</dd>
            <dt>备注</dt><dd>{{ form.note || '无' }}</dd>
            <dt>凭证</dt><dd>{{ form.proofUrl ? '已上传' : '未上传' }}</dd>
          </dl>
          <div class="sync-banner" style="margin-top:14px">
            确认后将执行：<strong>①</strong> 用户身份改为会员并写入有效期（现会员则顺延）
            <strong>②</strong> 小程序端会员身份实时生效 <strong>③</strong> 落库订单并写审计。
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showCreate = false">取消</button>
          <button v-if="step>1" class="btn btn-ghost" @click="step--">上一步</button>
          <button v-if="step===1" class="btn btn-primary" :disabled="!picked" @click="step=2">下一步</button>
          <button v-else-if="step===2" class="btn btn-primary" :disabled="!form.amount || uploading" @click="step=3">下一步</button>
          <button v-else class="btn btn-primary" :disabled="submitting" @click="submit">
            {{ submitting ? '开通中…' : '确认开通' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== 订单详情 ===== -->
    <div v-if="detail" class="modal-mask" @click.self="detail = null">
      <div class="modal">
        <h2 class="modal-title">订单详情</h2>
        <div class="order-head">
          <div class="stamp" :class="{ expired: detail.state==='expired' }">{{ stateLabel(detail.state) }}</div>
          <div class="amount"><span class="cur">¥</span>{{ detail.amount }}</div>
          <div class="oid">{{ detail.id }}</div>
          <div class="valid-row">会员有效期：{{ detail.validFrom || '?' }} → {{ detail.validUntil || '?' }}</div>
        </div>

        <div class="section">
          <h2>会员用户</h2>
          <dl class="confirm-kv">
            <dt>用户</dt><dd>{{ detail.userName }}</dd>
            <dt>手机号</dt><dd>{{ detail.userPhone || '-' }}</dd>
            <dt></dt><dd><router-link :to="'/users/'+detail.userId" class="link">查看用户 →</router-link></dd>
          </dl>
        </div>

        <div class="section">
          <h2>支付信息</h2>
          <dl class="confirm-kv">
            <dt>套餐</dt><dd>{{ detail.plan }}</dd>
            <dt>支付方式</dt><dd>{{ detail.method }}</dd>
            <dt>支付时间</dt><dd>{{ detail.paymentTime || '-' }}</dd>
            <dt>备注</dt><dd>{{ detail.note || '无' }}</dd>
          </dl>
          <img v-if="proofResolved" :src="proofResolved" class="proof-img" @click="openImg(proofResolved)" />
        </div>

        <div class="section">
          <h2>订单时间线</h2>
          <div class="timeline">
            <div class="step-row done">
              <div class="lbl">订单创建并开通</div>
              <div class="meta">{{ detail.createdAt }} · 录入 {{ detail.createdBy }}</div>
            </div>
            <div class="step-row done">
              <div class="lbl">会员权益生效</div>
              <div class="meta">{{ detail.validFrom }} 起</div>
            </div>
            <div class="step-row" :class="{ done: detail.state==='expired' }">
              <div class="lbl">{{ detail.state==='expired' ? '已到期' : (detail.state==='expiring' ? '即将到期' : '预期到期') }}</div>
              <div class="meta">{{ detail.validUntil }}</div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="detail = null">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getOrders, getOrderDetail, createOrder, getUsers, fileToProofDataUrl } from '../api/index.js'
import Paginate from '../components/Paginate.vue'

const route = useRoute()

const methods = ['微信转账', '支付宝转账', '银行转账', '现金', '其他']

const orders = ref([]), keyword = ref(''), status = ref('')
const page = ref(1), pageSize = ref(20), total = ref(0)  // 服务端分页

const showCreate = ref(false), step = ref(1)
const allUsers = ref([]), candidates = ref([]), userKeyword = ref(''), picked = ref(null)
const form = ref({}), proofPreview = ref(''), uploading = ref(false), submitting = ref(false)

const detail = ref(null), proofResolved = ref('')

onMounted(async () => {
  await load()
  // 从用户详情页「开通/续费会员」跳转而来：?create=<userId> 自动打开建单向导并预置该用户
  const uid = Number(route.query.create)
  if (uid) {
    if (!allUsers.value.length) allUsers.value = (await getUsers({ page: 1, pageSize: 100000 })).list
    const u = allUsers.value.find(x => x.id === uid)
    if (u) openCreate(u)
  }
})
async function load() {
  const r = await getOrders({ keyword: keyword.value || undefined, status: status.value || undefined, page: page.value, pageSize: pageSize.value })
  orders.value = r.list; total.value = r.total
}
let t
function search() { clearTimeout(t); t = setTimeout(() => { page.value = 1; load() }, 250) }
function onPage({ page: p, pageSize: ps }) { page.value = p; pageSize.value = ps; load() }

function stateLabel(s) { return { active:'生效中', expiring:'即将到期', expired:'已过期', pending:'待生效', refunded:'已退款', cancelled:'已取消' }[s] || s }
function idLabel(i) { return { guest:'游客', authed:'已授权', member:'会员' }[i] || i }

async function openCreate(presetUser) {
  step.value = 1; picked.value = presetUser || null; userKeyword.value = ''
  form.value = { plan: '年度会员', method: '微信转账', amount: 365, paymentDate: new Date().toISOString().slice(0, 10), note: '', proofUrl: null }
  proofPreview.value = ''
  if (!allUsers.value.length) allUsers.value = (await getUsers({ page: 1, pageSize: 100000 })).list
  filterUsers()
  showCreate.value = true
}
function filterUsers() {
  const k = userKeyword.value.trim()
  candidates.value = allUsers.value
    .filter(u => u.identity !== 'guest')  // 仅已授权 / 现会员可建单
    .filter(u => !k || u.nickname.includes(k) || (u.realName || '').includes(k) || (u.phone || '').includes(k) || String(u.id) === k)
    .slice(0, 20)
}

async function onProof(e) {
  const file = e.target.files[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024) { alert('图片过大，请选择 10MB 以内'); return }
  uploading.value = true
  try {
    const dataUrl = await fileToProofDataUrl(file)  // 客户端缩放为 JPEG dataURL
    form.value.proofUrl = dataUrl
    proofPreview.value = dataUrl
  } catch (err) { alert('凭证处理失败：' + err.message) }
  finally { uploading.value = false }
}
function clearProof() { proofPreview.value = ''; form.value.proofUrl = null }

async function submit() {
  submitting.value = true
  try {
    await createOrder({
      userId: picked.value.id, amount: form.value.amount, plan: form.value.plan,
      method: form.value.method, paymentTime: form.value.paymentDate + ' 00:00:00',
      note: form.value.note, proofUrl: form.value.proofUrl,
    })
    showCreate.value = false
    allUsers.value = []  // 用户身份已变，下次重新拉取
    await load()
  } catch (err) { alert('开通失败：' + err.message) }
  finally { submitting.value = false }
}

async function openDetail(id) {
  const d = (await getOrderDetail(id)).order
  detail.value = d
  proofResolved.value = d.proofUrl || ''  // dataURL 直接展示
}
function openImg(url) { window.open(url, '_blank') }
</script>

<style scoped>
.dim { color: #A8A39B; font-size: 12px; }
.empty { text-align: center; color: #A8A39B; padding: 24px; }
.section h2 { margin-top: 18px; }
</style>
