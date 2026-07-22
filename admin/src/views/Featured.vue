<template>
  <div>
    <h1 class="page-title">精选管理</h1>

    <!-- ── 热度排行榜：未精选的已发布故事，按加权计数排序，人工纳入 ── -->
    <div class="section-card">
      <h2 class="section-title">热度排行榜 <span class="dim">（未精选的已发布故事）</span></h2>
      <div class="filter-bar">
        <label class="inline-label">发布起<input v-model="dateFrom" type="date" class="input" /></label>
        <label class="inline-label">止<input v-model="dateTo" type="date" class="input" /></label>
        <label class="inline-label">点赞权重<input v-model.number="wLike" type="number" min="0" max="100" class="input w-num" /></label>
        <label class="inline-label">收藏权重<input v-model.number="wFav" type="number" min="0" max="100" class="input w-num" /></label>
        <label class="inline-label">评论权重<input v-model.number="wComment" type="number" min="0" max="100" class="input w-num" /></label>
        <button class="btn btn-primary" @click="reloadRank(1)">查询</button>
      </div>
      <table class="data-table">
        <thead><tr>
          <th>排名</th><th>ID</th><th>标题</th><th>作者</th><th>发布日期</th>
          <th>赞</th><th>藏</th><th>评</th><th>热度分</th><th>操作</th>
        </tr></thead>
        <tbody>
          <tr v-for="(d, i) in rank" :key="d.id">
            <td>{{ (rankPage - 1) * rankPageSize + i + 1 }}</td>
            <td>{{ d.id }}</td>
            <td>
              <router-link :to="'/stories/'+d.id" class="link">{{ d.title }}</router-link>
              <div class="excerpt">{{ d.excerpt }}</div>
            </td>
            <td>{{ d.author }}</td>
            <td class="dim">{{ d.createdAt }}</td>
            <td>{{ d.likes }}</td><td>{{ d.favorites }}</td><td>{{ d.comments }}</td>
            <td><b>{{ d.score }}</b></td>
            <td><button class="btn btn-primary" :disabled="adding === d.id" @click="onAdd(d)">{{ adding === d.id ? '纳入中…' : '纳入精选' }}</button></td>
          </tr>
          <tr v-if="!rank.length"><td colspan="10" class="empty">暂无候选故事</td></tr>
        </tbody>
      </table>
      <Paginate :page="rankPage" :pageSize="rankPageSize" :total="rankTotal" @change="onRankPage" />
    </div>

    <!-- ── 已精选列表：副本修订 / 上下架 ── -->
    <div class="section-card">
      <h2 class="section-title">已精选故事 <span class="dim">（公众可见的修订副本，互动共享原故事）</span></h2>
      <div class="filter-bar">
        <input v-model="fKeyword" placeholder="搜索副本标题/内容/作者" class="input" @input="onListFilter" />
        <select v-model="fStatus" class="select" @change="onListFilter">
          <option value="">全部状态</option><option value="online">上架中</option><option value="offline">已下架</option>
        </select>
      </div>
      <table class="data-table">
        <thead><tr>
          <th>ID</th><th>副本标题</th><th>作者</th><th>赞</th><th>藏</th><th>评</th>
          <th>纳入时间</th><th>状态</th><th>操作</th>
        </tr></thead>
        <tbody>
          <tr v-for="f in featured" :key="f.id" :class="{ 'row-off': f.status === 'offline' }">
            <td>{{ f.id }}</td>
            <td>
              <a class="link" @click="openEdit(f)">{{ f.title }}</a>
              <div class="excerpt">{{ f.excerpt }}</div>
            </td>
            <td>{{ f.author }}</td>
            <td>{{ f.likes }}</td><td>{{ f.favorites }}</td><td>{{ f.comments }}</td>
            <td class="dim">{{ f.featuredAt }}</td>
            <td><span class="badge" :class="f.status === 'online' ? 'badge-public' : 'badge-private'">{{ f.status === 'online' ? '上架中' : '已下架' }}</span></td>
            <td class="ops">
              <button class="btn btn-ghost" @click="openEdit(f)">修订</button>
              <button v-if="f.status === 'online'" class="btn btn-danger" @click="onToggle(f, 'offline')">下架</button>
              <button v-else class="btn btn-primary" :disabled="f.storyStatus !== 'active'" :title="f.storyStatus !== 'active' ? '原故事已删除，不可重新上架' : ''" @click="onToggle(f, 'online')">上架</button>
            </td>
          </tr>
          <tr v-if="!featured.length"><td colspan="9" class="empty">暂无精选故事</td></tr>
        </tbody>
      </table>
      <Paginate :page="fPage" :pageSize="fPageSize" :total="fTotal" @change="onFeaturedPage" />
    </div>

    <!-- 副本修订弹窗（含原文对照；只改副本，不影响作者原文） -->
    <div v-if="showEdit" class="modal-mask" @click.self="showEdit = false">
      <div class="modal modal-wide">
        <h2 class="modal-title">修订精选副本 <span class="dim">（作者 {{ editForm.author }} · 原文不受影响）</span></h2>
        <div class="edit-grid">
          <div>
            <label class="block-label">副本标题（{{ (editForm.title||'').length }}/30）
              <input v-model="editForm.title" class="input-full" maxlength="30" />
            </label>
            <label class="block-label">副本正文（{{ (editForm.content||'').length }} 字）
              <textarea v-model="editForm.content" class="textarea" rows="14" />
            </label>
          </div>
          <div>
            <label class="block-label">原文对照（只读）
              <input class="input-full" :value="editForm.originTitle" readonly />
            </label>
            <label class="block-label">&nbsp;
              <textarea class="textarea origin-box" rows="14" :value="editForm.originContent" readonly />
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showEdit = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="onSaveEdit">{{ saving ? '保存中…' : '保存副本' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getFeaturedRank, addFeatured, getFeaturedList, getFeaturedDetail, updateFeatured, toggleFeatured } from '../api/index.js'
import Paginate from '../components/Paginate.vue'

// 热度榜
const rank = ref([]), rankPage = ref(1), rankPageSize = ref(20), rankTotal = ref(0)
const dateFrom = ref(''), dateTo = ref('')
const wLike = ref(1), wFav = ref(1), wComment = ref(1)
const adding = ref(null)

// 已精选列表
const featured = ref([]), fPage = ref(1), fPageSize = ref(20), fTotal = ref(0)
const fKeyword = ref(''), fStatus = ref('')
let fTimer = null

// 修订弹窗
const showEdit = ref(false), editForm = ref({}), saving = ref(false)

onMounted(async () => { await Promise.all([reloadRank(1), reloadFeatured()]) })

async function reloadRank(p) {
  if (p) rankPage.value = p
  const r = await getFeaturedRank({
    dateFrom: dateFrom.value || undefined, dateTo: dateTo.value || undefined,
    wLike: wLike.value, wFav: wFav.value, wComment: wComment.value,
    page: rankPage.value, pageSize: rankPageSize.value,
  })
  rank.value = r.list; rankTotal.value = r.total
}
function onRankPage({ page: p, pageSize: ps }) { rankPage.value = p; rankPageSize.value = ps; reloadRank() }

async function reloadFeatured() {
  const r = await getFeaturedList({
    keyword: fKeyword.value.trim() || undefined, status: fStatus.value || undefined,
    page: fPage.value, pageSize: fPageSize.value,
  })
  featured.value = r.list; fTotal.value = r.total
}
function onListFilter() { clearTimeout(fTimer); fTimer = setTimeout(() => { fPage.value = 1; reloadFeatured() }, 250) }
function onFeaturedPage({ page: p, pageSize: ps }) { fPage.value = p; fPageSize.value = ps; reloadFeatured() }

async function onAdd(d) {
  if (!confirm(`将《${d.title}》纳入精选？\n将拷贝原文生成公众可见副本（可再修订），原文不受影响。`)) return
  adding.value = d.id
  try {
    await addFeatured(d.id)
    await Promise.all([reloadRank(), reloadFeatured()])
  } catch (e) { alert('纳入失败：' + e.message) }
  finally { adding.value = null }
}

async function openEdit(f) {
  try {
    const d = await getFeaturedDetail(f.id)
    editForm.value = { id: d.id, title: d.title, content: d.content, author: d.author, originTitle: d.originTitle, originContent: d.originContent }
    showEdit.value = true
  } catch (e) { alert(e.message) }
}
async function onSaveEdit() {
  if (!editForm.value.title.trim() || !editForm.value.content.trim()) { alert('标题和内容不能为空'); return }
  saving.value = true
  try {
    await updateFeatured({ id: editForm.value.id, title: editForm.value.title.trim(), content: editForm.value.content.trim() })
    showEdit.value = false
    await reloadFeatured()
  } catch (e) { alert('保存失败：' + e.message) }
  finally { saving.value = false }
}

async function onToggle(f, status) {
  const tip = status === 'offline' ? `下架《${f.title}》？公众端将不再展示。` : `重新上架《${f.title}》？`
  if (!confirm(tip)) return
  try {
    await toggleFeatured(f.id, status)
    await Promise.all([reloadFeatured(), reloadRank()])
  } catch (e) { alert(e.message) }
}
</script>

<style scoped>
.section-card { background: var(--bg-card, #fff); border-radius: 10px; padding: 16px 18px; margin-bottom: 22px; border: 0.5px solid var(--tbl-border, #E5E0D5); }
.section-title { font-size: 15px; margin: 0 0 12px; }
.inline-label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-2); }
.w-num { width: 64px; }
.excerpt { font-size: 12px; color: var(--ink-4); margin-top: 3px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dim { color: #A8A39B; font-size: 12px; font-weight: normal; }
.empty { text-align: center; color: #A8A39B; padding: 24px; }
.ops { display: flex; gap: 6px; }
.row-off { opacity: 0.55; }
.modal-wide { width: 860px; max-width: 94vw; }
.edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.origin-box { background: var(--bg-canvas, #FAF8F2); color: var(--ink-3); }
</style>
