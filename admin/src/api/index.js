// 管理后台 API — 通过 @cloudbase/js-sdk 调用 admin 云函数（action 路由）
// 鉴权：密码登录换取 HMAC token（12h 有效），存 localStorage，随每次请求携带
import cloudbase from '@cloudbase/js-sdk'

// 云环境按 Vite mode 注入（.env.dev / .env.prd）；缺省回退 dev 环境
export const ENV_ID = import.meta.env.VITE_TCB_ENV || 'cloud1-xingshu-prd-d1cev0fcca864'
export const ENV_LABEL = import.meta.env.VITE_ENV_LABEL || '开发'
// 环境徽章按标签判定（环境 ID 含 prd 字样但已与槽位对调，不能再按 ID 判）
export const IS_PROD = ENV_LABEL === '正式'
const TOKEN_KEY = 'xs_admin_token'

// timeout 提到 30s：cpolar 隧道冷透时云函数写入已成功但默认 15s 内未及返回，
// 会被误报「请求失败」（实际已生效）
const app = cloudbase.init({ env: ENV_ID, timeout: 30000 })
let signInPromise = null

// TCB 匿名登录（需在控制台开启），兼容 js-sdk v1/v2 API
function ensureSignIn() {
  if (!signInPromise) {
    signInPromise = (async () => {
      const auth = app.auth({ persistence: 'local' })
      const state = await auth.getLoginState()
      if (state) return
      if (auth.signInAnonymously) await auth.signInAnonymously()
      else await auth.anonymousAuthProvider().signIn()
    })()
  }
  return signInPromise
}

const EXPIRED_KEY = 'xs_admin_expired'
let handlingExpiry = false

const PROFILE_KEY = 'xs_admin_profile'

export function getToken() { return localStorage.getItem(TOKEN_KEY) || '' }
export function isLoggedIn() { return !!getToken() }
export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(PROFILE_KEY)
}

// token 第二段 base64url(JSON{uid,role})；旧两段式 token 兜底 super/uid 0（12h 内自然过期）
function tokenPayload() {
  const parts = String(getToken()).split('.')
  if (parts.length < 3) return {}
  try {
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) || {}
  } catch (e) { return {} }
}
// 一个账号可持多角色：token 的 role 为逗号分隔多值
export function getRoles() {
  const r = tokenPayload().role
  return r ? String(r).split(',').filter(Boolean) : ['super']
}
export function hasRole(role) { return getRoles().includes(role) }
// 当前登录的 admin_accounts.id（0 = 全局密码超管）
export function getUid() { return Number(tokenPayload().uid) || 0 }
// 登录时存的展示信息 { name }（侧边栏「当前登录」用）
export function getProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {} } catch (e) { return {} }
}
// 登录页读取并清除"超时"标记（call 在过期/-401 时置位）
export function consumeExpiredNotice() {
  const v = sessionStorage.getItem(EXPIRED_KEY)
  if (v) sessionStorage.removeItem(EXPIRED_KEY)
  return !!v
}

// token 形如 "过期时间戳.签名"；时间戳缺失或已过期即视为失效（本地时钟为准，仅用于提前拦截）
function tokenExpired(token) {
  const exp = Number(String(token || '').split('.')[0])
  return !exp || exp < Date.now()
}
// 触发超时：登出 + 置超时标记 + 跳登录页（去重避免并发请求重复跳转），抛错中断当前调用
function expireSession() {
  logout()
  if (!handlingExpiry) {
    handlingExpiry = true
    sessionStorage.setItem(EXPIRED_KEY, '1')
    // hash 路由：跳 #/login（直跳 /login 在静态托管会 404）
    window.location.href = '#/login'
    window.location.reload()
  }
  throw new Error('登录已超时')
}

async function call(action, payload = {}) {
  // 发请求前先本地判过期：真实超时时立即提示、不发无谓请求，也不依赖服务端返回码
  const token = getToken()
  if (!token || tokenExpired(token)) return expireSession()
  await ensureSignIn()
  const res = await app.callFunction({ name: 'admin', data: { action, token, payload } })
  const r = res.result || {}
  if (r.code === -401) return expireSession()  // 服务端判失效（如签名不符、账号被停用）兜底
  if (r.code === -403) throw new Error(r.msg || '无权限操作')  // 越权仅提示，不踢登录
  if (r.code !== 0) throw new Error(r.msg || '请求失败')
  return r.data
}

// 双模式登录：带 phone = 运营账号（手机号+密码）；不带 = 超管全局密码
export async function login(password, phone) {
  await ensureSignIn()
  const payload = phone ? { phone, password } : { password }
  const res = await app.callFunction({ name: 'admin', data: { action: 'login', payload } })
  const r = res.result || {}
  if (r.code !== 0) throw new Error(r.msg || '登录失败')
  localStorage.setItem(TOKEN_KEY, r.data.token)
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: r.data.name || '管理员' }))
  return r.data.role || 'super'
}

export async function getKpi() { return call('kpi') }
export async function getActivity() { return call('activity') }
export async function getTrend() { return call('trend') }
export async function getUsers(params = {}) { return call('users', params) }
export async function getUserDetail(id) { return call('userDetail', { id }) }
export async function getStories(params = {}) { return call('stories', params) }
export async function getStoryDetail(id) { return call('storyDetail', { id }) }
export async function deleteStory(id) { return call('deleteStory', { id }) }
export async function deleteStories(ids) { return call('deleteStories', { ids }) }
export async function deleteComment(id) { return call('deleteComment', { id }) }
export async function getComments(params = {}) { return call('comments', params) }
export async function updateReferrer(userId, referrerId) { return call('updateReferrer', { userId, referrerId }) }
// B/C 档：编辑用户资料、编辑故事、后台代发故事、系统标签列表
export async function updateUser(data) { return call('updateUser', data) }
export async function updateStory(data) { return call('updateStory', data) }
export async function createStory(data) { return call('createStory', data) }
export async function getTagList() { return call('tagList') }

// 精选故事：热度榜（可配权重）→ 人工纳入 → 副本修订/上下架（副本独立于原文，互动共享原故事）
export async function getFeaturedRank(params = {}) { return call('featuredRank', params) }
export async function addFeatured(storyId) { return call('featuredAdd', { storyId }) }
export async function updateFeatured(data) { return call('featuredUpdate', data) }
export async function toggleFeatured(id, status) { return call('featuredToggle', { id, status }) }
export async function getFeaturedList(params = {}) { return call('featuredList', params) }
export async function getFeaturedDetail(id) { return call('featuredDetail', { id }) }
export async function getActivities() { return call('activityList') }
export async function saveActivity(data) { return call('activitySave', data) }
export async function getActivitySignups(id) { return call('activitySignups', { id }) }

// 活动分类与现场分享
export async function getActivityTypes() { return call('typeList') }
export async function saveActivityType(data) { return call('typeSave', data) }
export async function getActivityPosts(activityId, page = 1) { return call('postListAdmin', { activityId, page, pageSize: 20 }) }
export async function deleteActivityPost(id) { return call('postDeleteAdmin', { id }) }
// 实际参与 + 已收费名单：整场覆盖式保存两组勾选的报名 ID
export async function saveAttendance(activityId, attendedIds, paidIds = []) { return call('attendanceSave', { activityId, attendedIds, paidIds }) }
// 活动介绍配图上传：base64 → 服务端存云存储，返回 fileID
export async function uploadActivityImage(base64, ext) { return call('activityUpload', { base64, ext }) }
// 邀请函：该活动的带参小程序码（dataURL，直供 canvas 出图）
export async function getInviteQr(activityId) { return call('inviteQr', { activityId }) }

// cloud:// fileID 批量换临时 URL（展示小程序上传的现场分享图片）。
// 走 admin 云函数服务端换链——Web 端匿名登录对云存储常无读权限，客户端 getTempFileURL 会拿到空链接
export async function resolveFileUrls(fileIDs) {
  if (!fileIDs || !fileIDs.length) return {}
  return call('fileUrls', { fileIDs })
}

// v2.4 会员订单管理
export async function getOrders(params = {}) { return call('orderList', params) }
export async function getOrderDetail(id) { return call('orderDetail', { id }) }
export async function getUserOrders(userId) { return call('userOrders', { userId }) }
export async function createOrder(data) { return call('createOrder', data) }

// 会员退费：preview 试算（最近缴费单 + 规则 + 应退金额），refund 执行（服务端重算，退费后会员即时失效）
export async function getRefundPreview(userId) { return call('refundPreview', { userId }) }
export async function refundOrder(userId) { return call('refundOrder', { userId }) }

// 运营账号管理（仅超管）
export async function getAccounts(params = {}) { return call('accountList', params) }
export async function saveAccount(data) { return call('accountSave', data) }
export async function disableAccount(id, isActive) { return call('accountDisable', { id, isActive }) }
export async function resetAccountPwd(id, password) { return call('accountResetPwd', { id, password }) }
// 搜用户（选主理人/加工作人员）
export async function searchMembers(keyword, params = {}) { return call('memberSearch', { keyword, ...params }) }
// 活动工作人员白名单（super 或该活动主理人可管）
export async function getStaffList(activityId) { return call('staffList', { activityId }) }
export async function addStaff(activityId, userId) { return call('staffAdd', { activityId, userId }) }
export async function removeStaff(activityId, userId) { return call('staffRemove', { activityId, userId }) }

// v2.0 活动页 Banner 管理（图片复用活动的 activityUpload 通道）
export async function getBanners() { return call('bannerListAdmin') }
export async function getBannerDetail(id) { return call('bannerDetailAdmin', { id }) }
export async function saveBanner(data) { return call('bannerSave', data) }
export async function deleteBanner(id) { return call('bannerDelete', { id }) }

// v2.0 醒书问答管理（后台始终显示真实作者，匿名仅对小程序端其他用户生效）
export async function getQuestions(params = {}) { return call('questionList', params) }
export async function getQuestionDetail(id) { return call('questionDetail', { id }) }
export async function deleteQuestion(id) { return call('questionDelete', { id }) }
export async function deleteQuestionComment(id) { return call('questionCommentDelete', { id }) }
// 精选问答：纳入生成可修订副本 → 修订 → 上/下架（联动 questions.is_featured）
export async function addQaFeatured(questionId) { return call('qaFeaturedAdd', { questionId }) }
export async function updateQaFeatured(questionId, content) { return call('qaFeaturedUpdate', { questionId, content }) }
export async function toggleQaFeatured(questionId, status) { return call('qaFeaturedToggle', { questionId, status }) }

// 支付凭证：客户端等比缩放到 ≤1280px 并转 JPEG dataURL，随建单经鉴权云函数写入 DB。
// 不走云存储（匿名登录无写权限，且会绕过密码鉴权），dataURL 直接可 <img src> 展示。
export function fileToProofDataUrl(file, maxSide = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('解析图片失败'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxSide || height > maxSide) {
          const r = Math.min(maxSide / width, maxSide / height)
          width = Math.round(width * r); height = Math.round(height * r)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
