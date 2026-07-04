<template>
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
        <router-link to="/users" class="nav-item" active-class="active">用户管理</router-link>
        <router-link to="/diaries" class="nav-item" active-class="active">日记管理</router-link>
        <router-link to="/interactions" class="nav-item" active-class="active">互动数据</router-link>
        <router-link to="/activities" class="nav-item" active-class="active">活动管理</router-link>
      </nav>
      <div class="sidebar-footer">
        <a class="logout-link" @click="onLogout">退出登录</a>
        <div>v0.2 · 运营后台</div>
      </div>
    </aside>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { logout } from './api'

const router = useRouter()
function onLogout() {
  logout()
  router.replace('/login')
}
</script>
