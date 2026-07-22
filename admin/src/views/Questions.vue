<template>
  <div>
    <h1 class="page-title">问答管理</h1>

    <div class="section-card">
      <h2 class="section-title">
        醒书问答
        <span class="dim">（后台始终显示真实作者；匿名仅对小程序端其他用户生效）</span>
      </h2>
      <div class="filter-bar">
        <input v-model="keyword" placeholder="搜索问题内容" class="input" @input="onFilter" />
        <select v-model="publishStatus" class="select" @change="onFilter">
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">暂存</option>
        </select>
        <label class="inline-label">
          <input v-model="onlyFeatured" type="checkbox" @change="onFilter" /> 只看精选
        </label>
      </div>

      <table class="data-table">
        <thead><tr>
          <th>ID</th><th>问题</th><th>作者</th><th>状态</th><th>赞</th><th>藏</th><th>回答</th>
          <th>提问时间</th><th>操作</th>
        </tr></thead>
        <tbody>
          <tr v-for="q in list" :key="q.id">
            <td>{{ q.id }}</td>
            <td class="q-cell">
              <a class="link" @click="openDetail(q)">{{ excerpt(q.content) }}</a>
            </td>
            <td>
              {{ q.author }}
              <span v-if="q.isAnonymous" class="badge badge-private anon-tag">匿名</span>
            </td>
            <td>
              <span class="badge" :class="q.publishStatus === 'published' ? 'badge-public' : 'badge-private'">
                {{ q.publishStatus === 'published' ? '已发布' : '暂存' }}
              </span>
              <span v-if="q.isFeatured" class="badge badge-featured">精选</span>
            </td>
            <td>{{ q.likes }}</td><td>{{ q.favorites }}</td><td>{{ q.comments }}</td>
            <td class="dim">{{ q.createdAt }}</td>
            <td class="ops">
              <button class="btn btn-ghost" @click="openDetail(q)">详情</button>
              <button v-if="!q.isFeatured" class="btn btn-primary"
                :disabled="q.publishStatus !== 'published'"
                :title="q.publishStatus !== 'published' ? '仅已发布的问题可纳入精选' : ''"
                @click="onAddFeatured(q)">纳入精选</button>
              <button class="btn btn-danger" @click="onDelete(q)">删除</button>
            </td>
          </tr>
          <tr v-if="!list.length"><td colspan="9" class="empty">暂无问答</td></tr>
        </tbody>
      </table>
      <Paginate :page="page" :pageSize="pageSize" :total="total" @change="onPage" />
    </div>

    <!-- 详情弹窗：问题 + 回答列表 + 精选副本修订 -->
    <div v-if="showDetail" class="modal-mask" @click.self="showDetail = false">
      <div class="modal modal-wide">
        <h2 class="modal-title">
          问答详情
          <span class="dim">（作者 {{ detail.question?.author }}{{ detail.question?.is_anonymous ? '（该问题对外匿名）' : '' }}）</span>
        </h2>

        <label class="block-label">问题原文（只读）
          <textarea class="textarea origin-box" rows="5" :value="detail.question?.content" readonly />
        </label>

        <!-- 精选副本：纳入后可修订，改副本不动作者原文 -->
        <div v-if="detail.featured" class="feat-box">
          <label class="block-label">
            精选副本正文
            <span class="dim">（公众看到的是这份；修订不影响作者原文）</span>
            <textarea v-model="featContent" class="textarea" rows="6" />
          </label>
          <div class="feat-actions">
            <span class="badge" :class="detail.featured.status === 'online' ? 'badge-public' : 'badge-private'">
              {{ detail.featured.status === 'online' ? '上架中' : '已下架' }}
            </span>
            <button class="btn btn-primary" :disabled="savingFeat" @click="onSaveFeatured">
              {{ savingFeat ? '保存中…' : '保存副本' }}
            </button>
            <button v-if="detail.featured.status === 'online'" class="btn btn-danger" @click="onToggleFeatured('offline')">下架</button>
            <button v-else class="btn btn-primary" @click="onToggleFeatured('online')">上架</button>
          </div>
        </div>

        <h3 class="sub-title">回答（{{ activeComments.length }}）</h3>
        <div class="cmt-list">
          <div v-for="c in detail.comments" :key="c.id" class="cmt" :class="{ 'cmt-deleted': c.isDeleted }">
            <div class="cmt-head">
              <b>{{ c.author }}</b>
              <span v-if="c.isAnonymous" class="badge badge-private anon-tag">匿名</span>
              <span v-if="c.parentId" class="dim">· 追评</span>
              <span class="dim cmt-time">{{ c.createdAt }}</span>
              <button v-if="!c.isDeleted" class="btn btn-danger btn-mini" @click="onDeleteComment(c)">删除</button>
              <span v-else class="dim">已删除</span>
            </div>
            <div class="cmt-body">{{ c.content }}</div>
          </div>
          <div v-if="!detail.comments?.length" class="empty">还没有回答</div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showDetail = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getQuestions, getQuestionDetail, deleteQuestion, deleteQuestionComment,
  addQaFeatured, updateQaFeatured, toggleQaFeatured,
} from '../api/index.js'
import Paginate from '../components/Paginate.vue'

const list = ref([]), page = ref(1), pageSize = ref(20), total = ref(0)
const keyword = ref(''), publishStatus = ref(''), onlyFeatured = ref(false)
let timer = null

const showDetail = ref(false), detail = ref({}), featContent = ref(''), savingFeat = ref(false)

const activeComments = computed(() => (detail.value.comments || []).filter(c => !c.isDeleted))

onMounted(reload)

async function reload() {
  const r = await getQuestions({
    keyword: keyword.value.trim() || undefined,
    publishStatus: publishStatus.value || undefined,
    featured: onlyFeatured.value ? 1 : undefined,
    page: page.value, pageSize: pageSize.value,
  })
  list.value = r.list; total.value = r.total
}
function onFilter() { clearTimeout(timer); timer = setTimeout(() => { page.value = 1; reload() }, 250) }
function onPage({ page: p, pageSize: ps }) { page.value = p; pageSize.value = ps; reload() }

function excerpt(s) {
  const t = String(s || '').replace(/\s+/g, ' ')
  return t.length > 60 ? t.slice(0, 60) + '…' : t
}

async function openDetail(q) {
  try {
    const d = await getQuestionDetail(q.id)
    detail.value = d
    featContent.value = d.featured ? d.featured.content : ''
    showDetail.value = true
  } catch (e) { alert(e.message) }
}

async function onAddFeatured(q) {
  if (!confirm('将该问题纳入精选？\n将拷贝原文生成公众可见副本（可再修订），原文不受影响。')) return
  try {
    await addQaFeatured(q.id)
    await reload()
  } catch (e) { alert('纳入失败：' + e.message) }
}

async function onSaveFeatured() {
  if (!featContent.value.trim()) { alert('副本正文不能为空'); return }
  savingFeat.value = true
  try {
    await updateQaFeatured(detail.value.question.id, featContent.value.trim())
    await openDetail(detail.value.question)
  } catch (e) { alert('保存失败：' + e.message) }
  finally { savingFeat.value = false }
}

async function onToggleFeatured(status) {
  try {
    await toggleQaFeatured(detail.value.question.id, status)
    await openDetail(detail.value.question)
    await reload()
  } catch (e) { alert('操作失败：' + e.message) }
}

async function onDeleteComment(c) {
  if (!confirm('删除这条回答？')) return
  try {
    await deleteQuestionComment(c.id)
    await openDetail(detail.value.question)
  } catch (e) { alert('删除失败：' + e.message) }
}

async function onDelete(q) {
  if (!confirm(`删除问题 #${q.id}？\n删除后精选副本一并下架，不可恢复。`)) return
  try {
    await deleteQuestion(q.id)
    await reload()
  } catch (e) { alert('删除失败：' + e.message) }
}
</script>

<style scoped>
.q-cell { max-width: 420px; }
.anon-tag { margin-left: 6px; }
.badge-featured {
  background: #fdf3dc;
  color: #8a6e2f;
  margin-left: 6px;
}
.sub-title { font-size: 15px; margin: 20px 0 10px; }
.feat-box {
  background: #fbf9f3;
  border: 1px solid #eae3d3;
  border-radius: 6px;
  padding: 12px 14px;
  margin-top: 10px;
}
.feat-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.cmt-list { max-height: 320px; overflow-y: auto; }
.cmt { padding: 10px 0; border-bottom: 1px solid #f0ece3; }
.cmt-deleted { opacity: 0.5; }
.cmt-head { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 4px; }
.cmt-time { flex: 1; }
.cmt-body { font-size: 14px; color: #333; white-space: pre-wrap; }
.btn-mini { padding: 2px 10px; font-size: 12px; }
</style>
