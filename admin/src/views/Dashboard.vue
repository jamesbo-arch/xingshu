<template>
  <div>
    <h1 class="page-title">数据概览</h1>
    <div class="kpi-grid">
      <div class="kpi-card" v-for="k in kpis" :key="k.label">
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-value">{{ k.value.toLocaleString() }}</div>
        <div class="kpi-delta" :class="k.delta > 0 ? 'up' : 'down'">{{ k.delta > 0 ? '↑' : '↓' }} {{ Math.abs(k.delta) }}%</div>
      </div>
    </div>
    <div class="section">
      <h2>最近动态</h2>
      <div class="activity-list">
        <div class="activity-item" v-for="a in activity" :key="a.text">
          <span class="activity-tag" :class="'tag-'+a.type">{{ typeLabel(a.type) }}</span>
          <span class="activity-text">{{ a.text }}</span>
          <span class="activity-time">{{ a.time }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getKpi, getActivity } from '../api/index.js'

const kpis = ref([])
const activity = ref([])

onMounted(async () => {
  const data = await getKpi()
  kpis.value = [
    { label: '总用户数', value: data.users.value, delta: data.users.delta },
    { label: '会员数', value: data.members.value, delta: data.members.delta },
    { label: '日记总数', value: data.diaries.value, delta: data.diaries.delta },
    { label: '总互动数', value: data.interactions.value, delta: data.interactions.delta },
    { label: '累计收入(元)', value: data.revenue.value, delta: data.revenue.delta },
  ]
  activity.value = await getActivity()
})

function typeLabel(t) { return { order:'订单', diary:'日记', warning:'提醒', user:'用户' }[t] || t }
</script>

<style scoped>
.page-title { font-size:22px; font-weight:700; margin-bottom:24px; }
.kpi-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:16px; margin-bottom:32px; }
.kpi-card { background:#fff; border-radius:8px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.kpi-label { font-size:13px; color:#9CA3AF; margin-bottom:8px; }
.kpi-value { font-size:28px; font-weight:700; color:#1F2937; }
.kpi-delta { font-size:13px; margin-top:4px; }
.kpi-delta.up { color:#06D6A0; } .kpi-delta.down { color:#FF6B6B; }

.section h2 { font-size:16px; font-weight:600; margin-bottom:16px; }
.activity-list { background:#fff; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.activity-item { display:flex; align-items:center; gap:12px; padding:12px 20px; border-bottom:1px solid #F3F4F6; font-size:14px; }
.activity-tag { padding:2px 8px; border-radius:4px; font-size:12px; }
.tag-order { background:#DBEAFE; color:#1E40AF; } .tag-diary { background:#D1FAE5; color:#065F46; }
.tag-warning { background:#FEF3C7; color:#92400E; } .tag-user { background:#EDE9FE; color:#5B21B6; }
.activity-time { margin-left:auto; color:#9CA3AF; font-size:12px; }
</style>
