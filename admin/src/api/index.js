// 管理后台 API — 通过 @cloudbase/js-sdk 调用 admin 云函数（action 路由）
// 鉴权：密码登录换取 HMAC token（12h 有效），存 localStorage，随每次请求携带
import cloudbase from '@cloudbase/js-sdk'

const ENV_ID = 'cloud1-1gpabyik2db3478f'
const TOKEN_KEY = 'xs_admin_token'

const app = cloudbase.init({ env: ENV_ID })
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

export function getToken() { return localStorage.getItem(TOKEN_KEY) || '' }
export function isLoggedIn() { return !!getToken() }
export function logout() { localStorage.removeItem(TOKEN_KEY) }

async function call(action, payload = {}) {
  await ensureSignIn()
  const res = await app.callFunction({ name: 'admin', data: { action, token: getToken(), payload } })
  const r = res.result || {}
  if (r.code === -401) {
    logout()
    window.location.href = '/login'
    throw new Error(r.msg || '登录已过期')
  }
  if (r.code !== 0) throw new Error(r.msg || '请求失败')
  return r.data
}

export async function login(password) {
  await ensureSignIn()
  const res = await app.callFunction({ name: 'admin', data: { action: 'login', payload: { password } } })
  const r = res.result || {}
  if (r.code !== 0) throw new Error(r.msg || '登录失败')
  localStorage.setItem(TOKEN_KEY, r.data.token)
  return true
}

export async function getKpi() { return call('kpi') }
export async function getActivity() { return call('activity') }
export async function getTrend() { return call('trend') }
export async function getUsers(params = {}) { return call('users', params) }
export async function getUserDetail(id) { return call('userDetail', { id }) }
export async function getDiaries(params = {}) { return call('diaries', params) }
export async function getDiaryDetail(id) { return call('diaryDetail', { id }) }
export async function deleteDiary(id) { return call('deleteDiary', { id }) }
export async function deleteDiaries(ids) { return call('deleteDiaries', { ids }) }
export async function deleteComment(id) { return call('deleteComment', { id }) }
export async function getComments(params = {}) { return call('comments', params) }
export async function updateReferrer(userId, referrerId) { return call('updateReferrer', { userId, referrerId }) }
export async function getActivities() { return call('activityList') }
export async function saveActivity(data) { return call('activitySave', data) }
export async function getActivitySignups(id) { return call('activitySignups', { id }) }

// v2.4 会员订单管理
export async function getOrders(params = {}) { return call('orderList', params) }
export async function getOrderDetail(id) { return call('orderDetail', { id }) }
export async function getUserOrders(userId) { return call('userOrders', { userId }) }
export async function createOrder(data) { return call('createOrder', data) }

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
