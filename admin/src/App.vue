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
        <router-link to="/" class="nav-item" active-class="active" exact>数据概览</router-link>
        <router-link to="/orders" class="nav-item" active-class="active">会员订单</router-link>
        <router-link to="/users" class="nav-item" active-class="active">用户管理</router-link>
        <router-link to="/diaries" class="nav-item" active-class="active">日记管理</router-link>
        <router-link to="/interactions" class="nav-item" active-class="active">互动数据</router-link>
        <router-link to="/activities" class="nav-item" active-class="active">活动管理</router-link>
      </nav>
      <div class="sidebar-footer">
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
import { useRouter } from 'vue-router'
import { logout, ENV_LABEL, IS_PROD } from './api'
// 版本号单一来源：仓库根 package.json 的 version，发版打 tag 时同步（见 CLAUDE.md 发版流程）
import rootPkg from '../../package.json'

const appVersion = rootPkg.version

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
</style>
