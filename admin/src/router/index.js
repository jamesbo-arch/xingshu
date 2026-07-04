import { createRouter, createWebHistory } from 'vue-router'
import { isLoggedIn } from '../api'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue'), meta: { public: true } },
  { path: '/', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
  { path: '/orders', name: 'Orders', component: () => import('../views/Orders.vue') },
  { path: '/users', name: 'Users', component: () => import('../views/Users.vue') },
  { path: '/users/:id', name: 'UserDetail', component: () => import('../views/UserDetail.vue') },
  { path: '/diaries', name: 'Diaries', component: () => import('../views/Diaries.vue') },
  { path: '/diaries/:id', name: 'DiaryDetail', component: () => import('../views/DiaryDetail.vue') },
  { path: '/interactions', name: 'Interactions', component: () => import('../views/Interactions.vue') },
  { path: '/activities', name: 'Activities', component: () => import('../views/Activities.vue') },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  if (!to.meta.public && !isLoggedIn()) return { path: '/login' }
  if (to.path === '/login' && isLoggedIn()) return { path: '/' }
})

export default router
