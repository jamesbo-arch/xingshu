import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
  { path: '/users', name: 'Users', component: () => import('../views/Users.vue') },
  { path: '/users/:id', name: 'UserDetail', component: () => import('../views/UserDetail.vue') },
  { path: '/diaries', name: 'Diaries', component: () => import('../views/Diaries.vue') },
  { path: '/diaries/:id', name: 'DiaryDetail', component: () => import('../views/DiaryDetail.vue') },
  { path: '/interactions', name: 'Interactions', component: () => import('../views/Interactions.vue') },
]

export default createRouter({ history: createWebHistory(), routes })
