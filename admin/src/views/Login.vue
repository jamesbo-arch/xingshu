<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-brand">醒书日记 · 管理后台</div>
      <input
        v-model="password"
        type="password"
        class="login-input"
        placeholder="请输入管理员密码"
        @keyup.enter="onLogin"
      />
      <button class="login-btn" :disabled="loading || !password" @click="onLogin">
        {{ loading ? '登录中…' : '登 录' }}
      </button>
      <div v-if="error" class="login-error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../api'

const router = useRouter()
const password = ref('')
const loading = ref(false)
const error = ref('')

async function onLogin() {
  if (!password.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    await login(password.value)
    router.replace('/')
  } catch (e) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#F3F4F6; }
.login-card { width:360px; background:#fff; border-radius:12px; padding:40px 36px; box-shadow:0 4px 24px rgba(31,41,55,.08); }
.login-brand { font-size:18px; font-weight:700; color:#3578F6; text-align:center; margin-bottom:28px; letter-spacing:1px; }
.login-input { width:100%; padding:12px 14px; border:1px solid #E5E7EB; border-radius:8px; font-size:14px; outline:none; transition:border-color .15s; }
.login-input:focus { border-color:#3578F6; }
.login-btn { width:100%; margin-top:16px; padding:12px; background:#3578F6; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; letter-spacing:4px; }
.login-btn:disabled { opacity:.6; cursor:not-allowed; }
.login-error { margin-top:12px; color:#DC2626; font-size:13px; text-align:center; }
</style>
