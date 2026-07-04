<template>
  <div v-if="total > 0" class="paginate">
    <span class="pg-total">共 {{ total }} 条</span>
    <select :value="pageSize" class="pg-size" @change="onSize">
      <option :value="10">每页 10</option>
      <option :value="20">每页 20</option>
      <option :value="50">每页 50</option>
    </select>
    <span class="pg-pages">
      <button class="pg-btn" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
      <button v-for="(p, i) in pageList" :key="i" class="pg-num" :class="{ active: p === page, dis: p === '…' }"
              :disabled="p === '…'" @click="go(p)">{{ p }}</button>
      <button class="pg-btn" :disabled="page >= totalPages" @click="go(page + 1)">下一页</button>
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
// 受控组件：父传 page/pageSize/total，任何翻页/改每页条数只发一次 change（父据此单次 reload）
const props = defineProps({ page: Number, pageSize: Number, total: Number })
const emit = defineEmits(['change'])

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const pageList = computed(() => {
  const n = totalPages.value, cur = props.page, out = []
  if (n <= 7) { for (let i = 1; i <= n; i++) out.push(i); return out }
  out.push(1)
  if (cur > 3) out.push('…')
  for (let i = Math.max(2, cur - 1); i <= Math.min(n - 1, cur + 1); i++) out.push(i)
  if (cur < n - 2) out.push('…')
  out.push(n)
  return out
})
function go(p) {
  if (p === '…' || p < 1 || p > totalPages.value || p === props.page) return
  emit('change', { page: p, pageSize: props.pageSize })
}
function onSize(e) { emit('change', { page: 1, pageSize: Number(e.target.value) }) }
</script>

<style scoped>
.paginate {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 4px; margin-top: 8px;
  font-size: 12px; color: var(--ink-3);
}
.pg-total { margin-right: auto; }
.pg-size {
  background: var(--bg-content); border: 0.5px solid var(--tbl-border);
  border-radius: 6px; padding: 5px 8px; font-size: 12px; color: var(--ink); cursor: pointer;
}
.pg-pages { display: flex; align-items: center; gap: 4px; }
.pg-btn, .pg-num {
  min-width: 28px; height: 28px; padding: 0 8px;
  border: 0.5px solid var(--tbl-border); background: var(--bg-content);
  border-radius: 6px; cursor: pointer; font-size: 12px; color: var(--ink-2);
}
.pg-num.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.pg-num.dis { border: none; background: none; cursor: default; }
.pg-btn:disabled { opacity: .4; cursor: not-allowed; }
</style>
