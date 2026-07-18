<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-seal"><span>醒書</span></div>
      <div class="login-brand">醒书日记</div>
      <div class="login-sub">管理后台 · OPERATIONS</div>
      <div class="login-tabs">
        <span class="login-tab" :class="{ active: mode === 'account' }" @click="switchMode('account')">运营账号</span>
        <span class="login-tab" :class="{ active: mode === 'admin' }" @click="switchMode('admin')">超管密码</span>
      </div>
      <input
        v-if="mode === 'account'"
        v-model="phone"
        type="tel"
        class="login-input"
        placeholder="请输入手机号"
        @keyup.enter="onLogin"
      />
      <input
        v-model="password"
        type="password"
        class="login-input"
        :placeholder="mode === 'account' ? '请输入密码' : '请输入管理员密码'"
        @keyup.enter="onLogin"
      />
      <button class="login-btn" :disabled="loading || !canSubmit" @click="onLogin">
        {{ loading ? '登录中…' : '登 录' }}
      </button>
      <div v-if="error" class="login-error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { login, consumeExpiredNotice } from '../api'
import { homeFor } from '../router'

const router = useRouter()
const mode = ref('account')   // account = 运营账号（手机号+密码）；admin = 超管全局密码
const phone = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const canSubmit = computed(() =>
  mode.value === 'account' ? (phone.value && password.value) : !!password.value)

function switchMode(m) {
  mode.value = m
  error.value = ''
}

// 因 token 超时被踢回登录页时，自动提示需重新登录
onMounted(() => {
  if (consumeExpiredNotice()) error.value = '登录已超时，请重新登录'
})

async function onLogin() {
  if (!canSubmit.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const role = await login(password.value, mode.value === 'account' ? phone.value.trim() : undefined)
    router.replace(homeFor(role))
  } catch (e) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
  background: #EEF1F6;
  border-radius: 8px;
  padding: 3px;
}
.login-tab {
  flex: 1;
  text-align: center;
  padding: 7px 0;
  font-size: 13px;
  color: #6B7280;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
}
.login-tab.active {
  background: #fff;
  color: #3578F6;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
</style>
