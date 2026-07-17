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
    { label: '故事总数', value: data.stories.value, delta: data.stories.delta },
    { label: '总互动数', value: data.interactions.value, delta: data.interactions.delta },
    { label: '累计收入(元)', value: data.revenue.value, delta: data.revenue.delta },
  ]
  activity.value = await getActivity()
})

function typeLabel(t) { return { order:'订单', story:'故事', warning:'提醒', user:'用户' }[t] || t }
</script>
