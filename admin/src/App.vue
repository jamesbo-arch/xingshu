<template>
  <div class="env-badge" :class="IS_PROD ? 'env-prod' : 'env-dev'">{{ ENV_LABEL }}环境</div>
  <router-view v-if="$route.path === '/login'" />
  <div v-else class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="seal"><span>醒書</span></div>
        <div>
          <div class="name">醒书日记</div>
          <div class="role">管理后台 · OPERATIONS</div>
        </div>
      </div>
      <nav>
        <router-link v-for="item in navItems" :key="item.to" :to="item.to"
          class="nav-item" active-class="active" :exact="item.to === '/'">{{ item.label }}</router-link>
      </nav>
      <div class="sidebar-footer">
        <div class="whoami">{{ profileName }} · <span class="whoami-role">{{ roleLabel }}</span></div>
        <a class="logout-link" @click="onLogout">退出登录</a>
        <div>v{{ appVersion }} · 运营后台</div>
      </div>
    </aside>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { logout, getRoles, getProfile, ENV_LABEL, IS_PROD } from './api'
// 版本号单一来源：仓库根 package.json 的 version，发版打 tag 时同步（见 CLAUDE.md 发版流程）
import rootPkg from '../../package.json'

const appVersion = rootPkg.version

// 侧边栏按角色过滤（与 router meta.roles 保持一致）；依赖 route.path 使登录/退出后重新求值
const NAV = [
  { to: '/', label: '数据概览', roles: ['super'] },
  { to: '/orders', label: '会员订单', roles: ['super', 'member'] },
  { to: '/users', label: '用户管理', roles: ['super', 'member'] },
  { to: '/stories', label: '故事管理', roles: ['super', 'content'] },
  { to: '/questions', label: '问答管理', roles: ['super', 'content'] },
  { to: '/featured', label: '精选管理', roles: ['super', 'content'] },
  { to: '/interactions', label: '互动数据', roles: ['super', 'content'] },
  { to: '/activities', label: '活动管理', roles: ['super', 'activity'] },
  { to: '/banners', label: '活动Banner', roles: ['super', 'activity'] },
  { to: '/accounts', label: '账号管理', roles: ['super'] },
]
const route = useRoute()
// 多角色：账号任一角色命中即显示该菜单
const navItems = computed(() => {
  route.path
  const mine = getRoles()
  return NAV.filter(i => i.roles.some(r => mine.includes(r)))
})

// 当前登录者展示（依赖 route.path 使登录/退出后重新求值）；多角色以「/」相连
const ROLE_LABELS = { super: '超级管理员', content: '内容运营', activity: '活动运营', member: '会员运营' }
const profileName = computed(() => { route.path; return getProfile().name || '管理员' })
const roleLabel = computed(() => { route.path; return getRoles().map(r => ROLE_LABELS[r] || r).join(' / ') })

const router = useRouter()
function onLogout() {
  logout()
  router.replace('/login')
}
</script>

<style scoped>
.env-badge {
  position: fixed;
  top: 10px;
  right: 12px;
  z-index: 9999;
  padding: 3px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  pointer-events: none;
}
.env-dev { background: #E6EEF6; color: #3578F6; }
.env-prod { background: #FBE3DE; color: #B6452F; box-shadow: 0 0 0 2px rgba(182, 69, 47, 0.25); }
.whoami { font-size: 12px; margin-bottom: 6px; opacity: 0.9; }
.whoami-role { color: #3578F6; }
</style>
