import { createRouter, createWebHashHistory } from 'vue-router'
import { isLoggedIn, getRoles } from '../api'

// 各角色的落地首页；多角色按此优先级取第一个命中角色的首页
const ROLE_HOME = { super: '/', content: '/stories', activity: '/activities', member: '/orders' }
const ROLE_PRIORITY = ['super', 'content', 'activity', 'member']

export function homeFor(roles) {
  const list = Array.isArray(roles) ? roles : String(roles || '').split(',').filter(Boolean)
  const hit = ROLE_PRIORITY.find(r => list.includes(r))
  return ROLE_HOME[hit] || '/'
}

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue'), meta: { public: true } },
  { path: '/', name: 'Dashboard', component: () => import('../views/Dashboard.vue'), meta: { roles: ['super'] } },
  { path: '/orders', name: 'Orders', component: () => import('../views/Orders.vue'), meta: { roles: ['super', 'member'] } },
  // content 不给用户管理页（其 users 只读 API 仅供代发故事选作者，无页面入口）
  { path: '/users', name: 'Users', component: () => import('../views/Users.vue'), meta: { roles: ['super', 'member'] } },
  { path: '/users/:id', name: 'UserDetail', component: () => import('../views/UserDetail.vue'), meta: { roles: ['super', 'member'] } },
  { path: '/stories', name: 'Stories', component: () => import('../views/Stories.vue'), meta: { roles: ['super', 'content'] } },
  { path: '/stories/:id', name: 'StoryDetail', component: () => import('../views/StoryDetail.vue'), meta: { roles: ['super', 'content'] } },
  { path: '/featured', name: 'Featured', component: () => import('../views/Featured.vue'), meta: { roles: ['super', 'content'] } },
  // 旧路径兼容（书签/历史链接）
  { path: '/diaries', redirect: '/stories' },
  { path: '/diaries/:id', redirect: to => `/stories/${to.params.id}` },
  { path: '/interactions', name: 'Interactions', component: () => import('../views/Interactions.vue'), meta: { roles: ['super', 'content'] } },
  { path: '/activities', name: 'Activities', component: () => import('../views/Activities.vue'), meta: { roles: ['super', 'activity'] } },
  { path: '/accounts', name: 'Accounts', component: () => import('../views/Accounts.vue'), meta: { roles: ['super'] } },
]

// hash 模式：COS 静态托管刷新子路由不会 404（# 后路径不发往服务器）
const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach((to) => {
  if (!to.meta.public && !isLoggedIn()) return { path: '/login' }
  const roles = getRoles()
  const home = homeFor(roles)
  if (to.path === '/login' && isLoggedIn()) return { path: home }
  // 页面级角色守卫：账号任一角色命中即放行，否则重定向到其首页
  if (to.meta.roles && !to.meta.roles.some(r => roles.includes(r))) return { path: home }
})

export default router
