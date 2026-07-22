<template>
  <div>
    <h1 class="page-title">活动 Banner 管理</h1>

    <div class="section-card">
      <h2 class="section-title">
        轮播列表
        <span class="dim">（小程序「醒书活动」页顶部；仅启用项对外展示，按排序值升序）</span>
        <button class="btn btn-primary head-btn" @click="openForm()">新增 Banner</button>
      </h2>

      <table class="data-table">
        <thead><tr>
          <th>排序</th><th>预览</th><th>标题</th><th>点击行为</th><th>状态</th><th>创建时间</th><th>操作</th>
        </tr></thead>
        <tbody>
          <tr v-for="b in list" :key="b.id" :class="{ 'row-off': !b.isActive }">
            <td>{{ b.sort }}</td>
            <td>
              <img v-if="urls[b.imageUrl]" :src="urls[b.imageUrl]" class="thumb" @click="openForm(b)" />
              <span v-else class="dim">—</span>
            </td>
            <td>{{ b.title || '（未填标题）' }}</td>
            <td>
              <span class="badge" :class="b.linkType === 'detail' ? 'badge-public' : 'badge-private'">
                {{ b.linkType === 'detail' ? '可点进详情页' : '纯展示' }}
              </span>
            </td>
            <td>
              <span class="badge" :class="b.isActive ? 'badge-public' : 'badge-private'">
                {{ b.isActive ? '启用中' : '已停用' }}
              </span>
            </td>
            <td class="dim">{{ b.createdAt }}</td>
            <td class="ops">
              <button class="btn btn-ghost" @click="openForm(b)">编辑</button>
              <button class="btn btn-ghost" @click="onToggleActive(b)">{{ b.isActive ? '停用' : '启用' }}</button>
              <button class="btn btn-danger" @click="onDelete(b)">删除</button>
            </td>
          </tr>
          <tr v-if="!list.length"><td colspan="7" class="empty">还没有 Banner，点右上角新增</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="modal modal-wide">
        <h2 class="modal-title">{{ form.id ? '编辑 Banner' : '新增 Banner' }}</h2>

        <label class="block-label">轮播图片<span class="req">*</span>
          <div class="img-row">
            <img v-if="previewUrl" :src="previewUrl" class="preview" />
            <div v-else class="preview preview-empty">未选择图片</div>
            <div>
              <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onPickImage" />
              <button class="btn btn-ghost" :disabled="uploading" @click="$refs.fileInput.click()">
                {{ uploading ? '上传中…' : (form.imageUrl ? '更换图片' : '选择图片') }}
              </button>
              <div class="hint">建议尺寸 750×340（约 2.2:1），5MB 以内</div>
            </div>
          </div>
        </label>

        <label class="block-label">标题
          <input v-model="form.title" class="input-full" maxlength="30" placeholder="用于详情页标题与转发标题，纯展示可留空" />
        </label>

        <label class="block-label">点击行为
          <select v-model="form.linkType" class="select">
            <option value="none">纯展示（不可点击）</option>
            <option value="detail">点击进入详情页</option>
          </select>
        </label>

        <!-- 富文本用 div 而非 label 包裹：label 会把点击焦点抢回去，contenteditable 里选不中文字 -->
        <div v-if="form.linkType === 'detail'" class="block-label">
          <span>详情页内容<span class="req">*</span>
            <span class="dim">（所见即所得；小程序用 rich-text 渲染）</span></span>
          <RichEditor v-model="form.contentRich" :hero-src="previewUrl" />
        </div>

        <div class="two-col">
          <label class="block-label">排序值 <span class="dim">（越小越靠前）</span>
            <input v-model.number="form.sort" type="number" class="input-full" />
          </label>
          <label class="block-label">状态
            <select v-model.number="form.isActive" class="select">
              <option :value="1">启用</option><option :value="0">停用</option>
            </select>
          </label>
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
import {
  getBanners, getBannerDetail, saveBanner, deleteBanner,
  uploadActivityImage, resolveFileUrls,
} from '../api/index.js'
import RichEditor from '../components/RichEditor.vue'

const list = ref([])
const urls = ref({})           // cloud:// fileID → 临时可展示 URL
const showForm = ref(false), form = ref({}), saving = ref(false), uploading = ref(false)

const previewUrl = computed(() => urls.value[form.value.imageUrl] || '')

onMounted(reload)

async function reload() {
  list.value = await getBanners()
  const ids = list.value.map(b => b.imageUrl).filter(u => u && u.startsWith('cloud://'))
  if (ids.length) urls.value = { ...urls.value, ...await resolveFileUrls(ids) }
}

async function openForm(b) {
  if (!b) {
    form.value = { imageUrl: '', title: '', linkType: 'none', contentRich: '', sort: 0, isActive: 1 }
    showForm.value = true
    return
  }
  try {
    // 列表不带 contentRich（体积大），编辑时单独取详情
    const d = await getBannerDetail(b.id)
    form.value = { ...d, contentRich: d.contentRich || '' }
    showForm.value = true
  } catch (e) { alert(e.message) }
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

async function onPickImage(e) {
  const file = (e.target.files || [])[0]
  e.target.value = ''
  if (!file) return
  if (file.size > 5 * 1024 * 1024) { alert('图片超过 5MB，请压缩后再传'); return }
  uploading.value = true
  try {
    const base64 = await fileToBase64(file)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const { fileID } = await uploadActivityImage(base64, ext)
    form.value.imageUrl = fileID
    urls.value = { ...urls.value, ...await resolveFileUrls([fileID]) }
  } catch (err) { alert('图片上传失败：' + err.message) }
  finally { uploading.value = false }
}

async function onSave() {
  if (!form.value.imageUrl) { alert('请先上传轮播图片'); return }
  if (form.value.linkType === 'detail' && !String(form.value.contentRich || '').trim()) {
    alert('选择「点击进入详情页」时，详情内容不能为空')
    return
  }
  saving.value = true
  try {
    await saveBanner({
      id: form.value.id,
      imageUrl: form.value.imageUrl,
      title: (form.value.title || '').trim(),
      linkType: form.value.linkType,
      contentRich: form.value.linkType === 'detail' ? form.value.contentRich : null,
      sort: Number(form.value.sort) || 0,
      isActive: form.value.isActive ? 1 : 0,
    })
    showForm.value = false
    await reload()
  } catch (e) { alert('保存失败：' + e.message) }
  finally { saving.value = false }
}

// 停用/启用走同一个 save（须回带 contentRich，否则详情内容会被清空）
async function onToggleActive(b) {
  try {
    const d = await getBannerDetail(b.id)
    await saveBanner({ ...d, isActive: b.isActive ? 0 : 1 })
    await reload()
  } catch (e) { alert('操作失败：' + e.message) }
}

async function onDelete(b) {
  if (!confirm(`删除 Banner「${b.title || b.id}」？删除后不可恢复。`)) return
  try {
    await deleteBanner(b.id)
    await reload()
  } catch (e) { alert('删除失败：' + e.message) }
}
</script>

<style scoped>
.head-btn { float: right; }
.thumb {
  width: 120px;
  height: 55px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
  background: #f0ece3;
}
.img-row { display: flex; gap: 16px; align-items: flex-start; margin-top: 6px; }
.preview {
  width: 240px;
  height: 110px;
  object-fit: cover;
  border-radius: 6px;
  background: #f0ece3;
}
.preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9aa0a6;
  font-size: 13px;
  border: 1px dashed #d5d8dd;
}
.hint { font-size: 12px; color: #9aa0a6; margin-top: 8px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.req { color: #d93025; }
.row-off { opacity: 0.55; }
</style>
