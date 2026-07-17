<template>
  <div>
    <h1 class="page-title">故事管理</h1>
    <div class="filter-bar">
      <input v-model="keyword" placeholder="搜索标题/内容/作者/ID" class="input" @input="onFilter" />
      <select v-model="publishStatus" class="select" @change="onFilter">
        <option value="">全部状态</option><option value="published">已发布</option><option value="draft">暂存</option>
      </select>
      <select v-model="featured" class="select" @change="onFilter">
        <option value="">是否善选</option><option value="1">已善选</option><option value="0">未善选</option>
      </select>
      <select v-model="tag" class="select" @change="onFilter">
        <option value="">全部标签</option>
        <option v-for="t in allTags" :key="t" :value="t">{{ t }}</option>
      </select>
      <button class="btn btn-primary" @click="openCreate">+ 新建故事</button>
      <button class="btn btn-ghost" @click="onExport">导出（{{ total }}）</button>
      <button class="btn btn-danger" :disabled="!selected.length" @click="onBatchDelete">
        批量删除{{ selected.length ? `（${selected.length}）` : '' }}
      </button>
    </div>
    <table class="data-table">
      <thead><tr>
        <th style="width:36px"><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
        <th>ID</th><th>标题</th><th>作者</th><th>标签</th><th>时间</th><th>状态</th><th>善选</th>
        <th>赞</th><th>藏</th><th>评</th><th>转</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr v-for="d in list" :key="d.id">
          <td><input type="checkbox" :value="d.id" v-model="selected" /></td>
          <td>{{ d.id }}</td>
          <td>
            <router-link :to="'/stories/'+d.id" class="link">{{ d.title }}</router-link>
            <span v-if="d.editedAt" class="edited-tag">已编辑</span>
            <div class="excerpt">{{ excerpt(d.content) }}</div>
          </td>
          <td>{{ d.author }}</td>
          <td>
            <span v-for="t in (d.tags||[]).slice(0,2)" :key="t" class="seal-tag">{{ t }}</span>
            <span v-if="(d.tags||[]).length > 2" class="tag-more">+{{ d.tags.length - 2 }}</span>
          </td>
          <td class="dim">{{ d.createdAt }}</td>
          <td><span class="badge" :class="'badge-'+d.publishStatus">{{ statusLabel(d.publishStatus) }}</span></td>
          <td><span v-if="d.isFeatured" class="featured-tag">善选</span><span v-else class="dim">—</span></td>
          <td>{{ d.likes }}</td><td>{{ d.favorites }}</td><td>{{ d.comments }}</td><td>{{ d.shares }}</td>
          <td class="ops">
            <button class="btn btn-ghost" @click="openEdit(d)">编辑</button>
            <button class="btn btn-danger" @click="onDelete(d)">删除</button>
          </td>
        </tr>
        <tr v-if="!list.length"><td colspan="13" class="empty">暂无故事</td></tr>
      </tbody>
    </table>
    <Paginate :page="page" :pageSize="pageSize" :total="total" @change="onPage" />

    <!-- 故事编辑 / 后台代发弹窗 -->
    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="modal">
        <h2 class="modal-title">{{ form.id ? '编辑故事' : '新建故事（后台代发）' }}</h2>

        <label class="block-label">作者
          <template v-if="form.id">
            <input class="input-full" :value="form.authorName + '（原作者不可变更）'" readonly />
          </template>
          <template v-else>
            <input v-model="authorKeyword" class="input-full" placeholder="搜索作者昵称/手机号/ID（仅非游客）" @input="filterAuthors" />
            <div v-if="!pickedAuthor" class="candidate-list">
              <div v-for="u in authorCandidates" :key="u.id" class="candidate" @click="pickAuthor(u)">
                {{ u.nickname }}（ID {{ u.id }}{{ u.phone ? ' · '+u.phone : '' }}） · {{ idLabel(u.identity) }}
              </div>
              <div v-if="!authorCandidates.length" class="candidate dim">无匹配的非游客用户</div>
            </div>
            <div v-else class="picked-author">以 <b>{{ pickedAuthor.nickname }}</b>（ID {{ pickedAuthor.id }}）身份发布
              <a class="link" @click="pickedAuthor = null">重选</a></div>
          </template>
        </label>

        <label class="block-label">标题（{{ (form.title||'').length }}/30）
          <input v-model="form.title" class="input-full" maxlength="30" />
        </label>
        <label class="block-label">正文（{{ (form.content||'').length }} 字）
          <textarea v-model="form.content" class="textarea" rows="6" />
        </label>

        <label class="block-label">标签</label>
        <div class="tag-picker">
          <span v-for="t in sysTags" :key="t" class="tag-opt" :class="{ on: form.tags.includes(t) }" @click="toggleTag(t)">{{ t }}</span>
        </div>

        <label class="block-label">状态</label>
        <div class="seg-pick">
          <span v-for="p in ['published','draft']" :key="p" class="opt" :class="{ active: form.publishStatus===p }" @click="form.publishStatus=p">{{ statusLabel(p) }}</span>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showForm = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="onSave">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getStories, deleteStory, deleteStories, updateStory, createStory, getTagList, getUsers } from '../api/index.js'
import { exportCsv } from '../utils/csv.js'
import Paginate from '../components/Paginate.vue'

const list = ref([]), keyword = ref(''), publishStatus = ref(''), featured = ref(''), tag = ref('')
const page = ref(1), pageSize = ref(20), total = ref(0)
const selected = ref([]), allTags = ref([])
let timer = null

// 编辑/代发弹窗
const showForm = ref(false), form = ref({ tags: [] }), saving = ref(false)
const sysTags = ref([]), allUsers = ref([])
const authorKeyword = ref(''), authorCandidates = ref([]), pickedAuthor = ref(null)

onMounted(async () => {
  allTags.value = (await getTagList()).list  // 标签筛选下拉：全量系统标签
  await reload()
})
function filters() {
  return {
    keyword: keyword.value.trim() || undefined,
    publishStatus: publishStatus.value || undefined,
    featured: featured.value === '' ? undefined : Number(featured.value),
    tag: tag.value || undefined,
  }
}
async function reload() {
  const r = await getStories({ ...filters(), page: page.value, pageSize: pageSize.value })
  list.value = r.list; total.value = r.total
  selected.value = selected.value.filter(id => list.value.some(d => d.id === id))
}
function onFilter() { clearTimeout(timer); timer = setTimeout(() => { page.value = 1; reload() }, 250) }
function onPage({ page: p, pageSize: ps }) { page.value = p; pageSize.value = ps; reload() }

function statusLabel(p) { return { published: '已发布', draft: '暂存' }[p] || p }
function idLabel(i) { return { guest:'游客', authed:'已授权', member:'会员' }[i] || i }
function excerpt(c) { return c ? (c.length > 50 ? c.slice(0, 50) + '…' : c) : '' }

const allChecked = computed(() => list.value.length > 0 && list.value.every(d => selected.value.includes(d.id)))
function toggleAll(e) {
  const ids = list.value.map(d => d.id)
  selected.value = e.target.checked
    ? [...new Set([...selected.value, ...ids])]
    : selected.value.filter(id => !ids.includes(id))
}
function interTotal(d) { return (d.likes||0) + (d.favorites||0) + (d.comments||0) + (d.shares||0) }
async function onDelete(d) {
  if (!confirm(`确定删除《${d.title}》（作者 ${d.author}）？\n该故事及其 ${interTotal(d)} 条互动数据将同步从小程序移除（善选副本一并下架），无法恢复。`)) return
  await deleteStory(d.id)
  await reload()
}
async function onBatchDelete() {
  const total0 = selected.value.reduce((s, id) => {
    const d = list.value.find(x => x.id === id)
    return s + (d ? interTotal(d) : 0)
  }, 0)
  if (!confirm(`确定删除选中的 ${selected.value.length} 篇故事？\n连同约 ${total0} 条互动数据一并永久删除（善选副本下架），无法恢复。`)) return
  const r = await deleteStories(selected.value)
  if (r.failed.length) alert(`${r.failed.length} 篇删除失败：${r.failed.map(f => f.id).join(', ')}`)
  selected.value = []
  await reload()
}
async function onExport() {
  const r = await getStories({ ...filters(), page: 1, pageSize: 100000 })
  exportCsv(
    `醒书故事列表-${new Date().toISOString().slice(0, 10)}.csv`,
    ['故事ID', '标题', '作者', '发布时间', '状态', '善选', '标签', '点赞', '收藏', '评论', '转发', '已编辑'],
    r.list.map(d => [d.id, d.title, d.author, d.createdAt, statusLabel(d.publishStatus), d.isFeatured ? '是' : '',
      (d.tags || []).join('、'), d.likes, d.favorites, d.comments, d.shares, d.editedAt ? '是' : ''])
  )
}

// ── 编辑 / 代发 ──
async function ensureMeta() {
  if (!sysTags.value.length) sysTags.value = (await getTagList()).list
  if (!allUsers.value.length) allUsers.value = (await getUsers({ page: 1, pageSize: 100000 })).list
}
async function openEdit(d) {
  await ensureMeta()
  form.value = { id: d.id, authorName: d.author, title: d.title, content: d.content, publishStatus: d.publishStatus, tags: [...(d.tags || [])] }
  showForm.value = true
}
async function openCreate() {
  await ensureMeta()
  form.value = { title: '', content: '', publishStatus: 'published', tags: [] }
  pickedAuthor.value = null; authorKeyword.value = ''; filterAuthors()
  showForm.value = true
}
function filterAuthors() {
  const k = authorKeyword.value.trim()
  authorCandidates.value = allUsers.value
    .filter(u => u.identity !== 'guest')
    .filter(u => !k || u.nickname.includes(k) || (u.phone || '').includes(k) || String(u.id) === k)
    .slice(0, 20)
}
function pickAuthor(u) { pickedAuthor.value = u }
function toggleTag(t) {
  const i = form.value.tags.indexOf(t)
  if (i >= 0) form.value.tags.splice(i, 1); else form.value.tags.push(t)
}
async function onSave() {
  if (!form.value.title.trim() || !form.value.content.trim()) { alert('标题和内容不能为空'); return }
  if (!form.value.id && !pickedAuthor.value) { alert('请选择作者'); return }
  saving.value = true
  try {
    if (form.value.id) {
      await updateStory({ id: form.value.id, title: form.value.title.trim(), content: form.value.content.trim(), publishStatus: form.value.publishStatus, tags: form.value.tags })
    } else {
      await createStory({ authorId: pickedAuthor.value.id, title: form.value.title.trim(), content: form.value.content.trim(), publishStatus: form.value.publishStatus, tags: form.value.tags })
    }
    showForm.value = false
    allTags.value = (await getTagList()).list
    await reload()
  } catch (e) { alert('保存失败：' + e.message) }
  finally { saving.value = false }
}
</script>

<style scoped>
.excerpt { font-size: 12px; color: var(--ink-4); margin-top: 3px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.seal-tag {
  display: inline-block; padding: 1px 6px; margin-right: 4px;
  font-family: var(--font-serif); font-size: 11px; color: var(--vermilion);
  border: 0.5px solid var(--vermilion); border-radius: 2px;
  background: rgba(182,69,47,0.04); white-space: nowrap;
}
.tag-more { font-size: 11px; color: var(--ink-4); }
.dim { color: #A8A39B; font-size: 12px; }
.empty { text-align: center; color: #A8A39B; padding: 24px; }
.edited-tag { margin-left: 8px; font-size: 10px; color: var(--warn); background: rgba(192,147,83,0.14); padding: 1px 6px; border-radius: 3px; }
.featured-tag { font-size: 11px; color: #5B8F6C; background: rgba(91,143,108,0.12); padding: 1px 8px; border-radius: 3px; }
.ops { display: flex; gap: 6px; }

.picked-author { margin-top: 8px; font-size: 13px; color: var(--ink-2); }
.tag-picker { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.tag-opt {
  padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer;
  border: 0.5px solid var(--tbl-border); background: var(--bg-canvas); color: var(--ink-2);
  font-family: var(--font-serif);
}
.tag-opt.on { background: var(--vermilion); color: #fff; border-color: var(--vermilion); }
</style>
