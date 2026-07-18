import { createRouter, createWebHashHistory } from 'vue-router'
import { isLoggedIn } from '../api'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue'), meta: { public: true } },
  { path: '/', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
  { path: '/orders', name: 'Orders', component: () => import('../views/Orders.vue') },
  { path: '/users', name: 'Users', component: () => import('../views/Users.vue') },
  { path: '/users/:id', name: 'UserDetail', component: () => import('../views/UserDetail.vue') },
  { path: '/stories', name: 'Stories', component: () => import('../views/Stories.vue') },
  { path: '/stories/:id', name: 'StoryDetail', component: () => import('../views/StoryDetail.vue') },
  { path: '/featured', name: 'Featured', component: () => import('../views/Featured.vue') },
  // 旧路径兼容（书签/历史链接）
  { path: '/diaries', redirect: '/stories' },
  { path: '/diaries/:id', redirect: to => `/stories/${to.params.id}` },
  { path: '/interactions', name: 'Interactions', component: () => import('../views/Interactions.vue') },
  { path: '/activities', name: 'Activities', component: () => import('../views/Activities.vue') },
]

// hash 模式：COS 静态托管刷新子路由不会 404（# 后路径不发往服务器）
const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach((to) => {
  if (!to.meta.public && !isLoggedIn()) return { path: '/login' }
  if (to.path === '/login' && isLoggedIn()) return { path: '/' }
})

export default router
