<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-seal"><span>醒書</span></div>
      <div class="login-brand">醒书日记</div>
      <div class="login-sub">管理后台 · OPERATIONS</div>
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { login, consumeExpiredNotice } from '../api'

const router = useRouter()
const password = ref('')
const loading = ref(false)
const error = ref('')

// 因 token 超时被踢回登录页时，自动提示需重新登录
onMounted(() => {
  if (consumeExpiredNotice()) error.value = '登录已超时，请重新登录'
})

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
