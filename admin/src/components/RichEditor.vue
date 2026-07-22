<!-- 所见即所得富文本编辑器（供 Banner 详情页图文用）

     画布宽 750px、1rpx = 1px，即手机两倍稿：字号、行高、间距与真机等比。
     出参已按小程序 rich-text 口径净化并换回 rpx，可直接入库。 -->
<template>
  <div class="rte">
    <!-- mousedown.prevent：不让焦点离开画布，否则按钮一按选区就没了、命令作用不到选中的字 -->
    <div class="rte-bar" @mousedown.prevent>
      <div class="grp">
        <button type="button" class="tb" :class="{ on: st.block === 'p' || !st.block }"
          title="正文" @click="block('p')">正文</button>
        <button type="button" class="tb" :class="{ on: st.block === 'h2' }"
          title="大标题" @click="block('h2')">大标题</button>
        <button type="button" class="tb" :class="{ on: st.block === 'h3' }"
          title="小标题" @click="block('h3')">小标题</button>
        <button type="button" class="tb" :class="{ on: st.block === 'blockquote' }"
          title="引用块" @click="block('blockquote')">引用</button>
      </div>

      <div class="grp">
        <button type="button" class="tb ico" :class="{ on: st.bold }" title="加粗"
          @click="exec('bold')"><b>B</b></button>
        <button type="button" class="tb ico" :class="{ on: st.italic }" title="斜体"
          @click="exec('italic')"><i>I</i></button>
        <button type="button" class="tb ico" :class="{ on: st.underline }" title="下划线"
          @click="exec('underline', null, true)"><u>U</u></button>
      </div>

      <div class="grp">
        <button v-for="c in COLORS" :key="c.hex" type="button" class="tb sw" :title="c.name"
          :style="{ background: c.hex }" @click="exec('foreColor', c.hex, true)"></button>
      </div>

      <div class="grp">
        <button type="button" class="tb ico" :class="{ on: st.ul }" title="项目符号列表"
          @click="exec('insertUnorderedList')">•—</button>
        <button type="button" class="tb ico" :class="{ on: st.ol }" title="编号列表"
          @click="exec('insertOrderedList')">1.</button>
      </div>

      <div class="grp">
        <button type="button" class="tb ico" :class="{ on: !st.center }" title="左对齐"
          @click="exec('justifyLeft', null, true)">≡</button>
        <button type="button" class="tb ico" :class="{ on: st.center }" title="居中"
          @click="exec('justifyCenter', null, true)">⋮≡</button>
      </div>

      <div class="grp">
        <button type="button" class="tb" title="插入分割线" @click="hr()">分割线</button>
        <button type="button" class="tb" title="清除文字格式" @click="clearFormat()">清格式</button>
      </div>

      <div class="grp">
        <button type="button" class="tb ico" title="撤销" @click="exec('undo')">↶</button>
        <button type="button" class="tb ico" title="重做" @click="exec('redo')">↷</button>
      </div>

      <div class="grp grp-end">
        <button type="button" class="tb" :class="{ on: source }"
          title="查看 / 直接编辑 HTML 源码" @click="toggleSource()">&lt;/&gt;</button>
      </div>
    </div>

    <div class="rte-stage" :class="{ hide: source }">
      <div ref="ed" class="rte-canvas" contenteditable="true"
        @input="onInput" @paste="onPaste" @keyup="syncState" @mouseup="syncState" @focus="onFocus"></div>
    </div>

    <textarea v-show="source" v-model="raw" class="rte-code" spellcheck="false" rows="14"
      @input="onRawInput"></textarea>

    <div class="rte-foot">
      画布按手机两倍尺寸呈现（750px = 750rpx），排版比例与真机一致。
      仅保留小程序 rich-text 支持的标签与内联样式，粘贴内容会自动净化。
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, nextTick } from 'vue'
import { toEditorHtml, toStoredHtml, sanitizeFragment, escapeHtml } from '../utils/rich-text.js'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const COLORS = [
  { name: '墨黑（正文）', hex: '#2A2723' },
  { name: '印章红（强调）', hex: '#B6452F' },
  { name: '描金（点缀）', hex: '#B89968' },
  { name: '辅助灰（注释）', hex: '#7A746A' },
]

const ed = ref(null)
const source = ref(false)
const raw = ref('')
const st = reactive({ block: 'p', bold: false, italic: false, underline: false, ul: false, ol: false, center: false })

// 自己刚 emit 出去的值——用它挡住回流，否则每敲一个字都会重写 innerHTML、光标被打回开头
let lastEmitted = null

onMounted(() => {
  syncFromProp()
  try { document.execCommand('defaultParagraphSeparator', false, 'p') } catch { /* 老浏览器忽略 */ }
})

watch(() => props.modelValue, syncFromProp)

function syncFromProp() {
  if (props.modelValue === lastEmitted) return
  raw.value = props.modelValue || ''
  if (ed.value) ed.value.innerHTML = toEditorHtml(props.modelValue)
}

function push() {
  const out = toStoredHtml(ed.value.innerHTML)
  lastEmitted = out
  raw.value = out
  emit('update:modelValue', out)
}

function onInput() { push() }

function onFocus() { syncState() }

function exec(cmd, val = null, css = false) {
  ed.value.focus()
  // styleWithCSS：颜色/对齐/下划线走内联样式（rich-text 不支持 <u>、<font> 语义也不稳），
  // 加粗斜体则留 <b>/<i>，出参更干净
  try { document.execCommand('styleWithCSS', false, css) } catch { /* 忽略 */ }
  document.execCommand(cmd, false, val)
  push()
  syncState()
}

function block(tag) { exec('formatBlock', `<${tag}>`) }

function hr() { exec('insertHTML', '<hr>') }

function clearFormat() {
  ed.value.focus()
  document.execCommand('removeFormat')
  document.execCommand('formatBlock', false, '<p>')
  push()
  syncState()
}

function syncState() {
  try {
    st.bold = document.queryCommandState('bold')
    st.italic = document.queryCommandState('italic')
    st.underline = document.queryCommandState('underline')
    st.ul = document.queryCommandState('insertUnorderedList')
    st.ol = document.queryCommandState('insertOrderedList')
    st.center = document.queryCommandState('justifyCenter')
    st.block = String(document.queryCommandValue('formatBlock') || 'p').toLowerCase()
  } catch { /* 选区不在画布内时会抛，忽略 */ }
}

function onPaste(e) {
  e.preventDefault()
  const dt = e.clipboardData
  const html = dt.getData('text/html')
  if (html) {
    document.execCommand('insertHTML', false, sanitizeFragment(html))
  } else {
    const text = dt.getData('text/plain') || ''
    const frag = text.split(/\n{2,}/)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
      .join('')
    document.execCommand('insertHTML', false, frag)
  }
  push()
}

function onRawInput() {
  // 源码模式下原样回传：画布此刻不可见，切回去时再统一净化重建
  lastEmitted = raw.value
  emit('update:modelValue', raw.value)
}

function toggleSource() {
  if (!source.value) {
    raw.value = props.modelValue || ''
    source.value = true
    return
  }
  const out = toStoredHtml(toEditorHtml(raw.value))
  lastEmitted = out
  raw.value = out
  emit('update:modelValue', out)
  source.value = false
  nextTick(() => { if (ed.value) ed.value.innerHTML = toEditorHtml(out) })
}
</script>

<style scoped>
/* 注意：这里不能加 overflow:hidden ——那会让 .rte 自己变成滚动容器，
   工具条的 sticky 就只相对 .rte 生效（而它从不滚动），等于失效。
   圆角改由工具条与页脚各自切两角。 */
.rte {
  border: 0.5px solid var(--tbl-border);
  border-radius: 10px;
  background: var(--bg-content);
  margin-top: 6px;
}

/* 工具条：粘在编辑区上沿。弹窗（.modal）是滚动容器，sticky 让它在弹窗滚动时也不跑掉 */
.rte-bar {
  position: sticky;
  top: 0;
  z-index: 5;
  border-radius: 9px 9px 0 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 7px 8px;
  background: var(--paper-2);
  border-bottom: 0.5px solid var(--tbl-border);
}

.grp { display: flex; gap: 3px; padding-right: 7px; border-right: 0.5px solid var(--tbl-border); }
.grp:last-child, .grp-end { border-right: none; padding-right: 0; }
.grp-end { margin-left: auto; }

.tb {
  min-width: 26px;
  height: 26px;
  padding: 0 8px;
  border: 0.5px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--ink-2);
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: background .12s, color .12s;
}
.tb:hover { background: var(--paper-card); border-color: var(--tbl-border); }
.tb.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.ico { padding: 0; font-size: 13px; }

/* 色板按钮：本身就是色块，不能被 .on 反色 */
.sw {
  width: 22px;
  min-width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, .8);
  box-shadow: 0 0 0 0.5px var(--tbl-border);
}
.sw:hover { transform: scale(1.12); border-color: #fff; }

/* 画布舞台：内部滚动，保证工具条与下方表单永远同屏 */
.rte-stage {
  max-height: 52vh;
  overflow: auto;
  padding: 16px;
  background: var(--bg-canvas);
  display: flex;
  justify-content: center;
}
.rte-stage.hide { display: none; }

/* 与小程序 pages/banner-detail 的 .banner-rich 一致（那边是 rpx，这里 1:1 换成 px） */
.rte-canvas {
  width: 750px;
  flex: none;
  min-height: 260px;
  box-sizing: border-box;
  padding: 32px;
  background: #FFFCF5;
  border: 1px solid rgba(126, 102, 64, .14);
  border-radius: 14px;
  outline: none;
  font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 30px;
  line-height: 54px;
  color: #2A2723;
  text-align: left;
}

/* execCommand 生成的节点没有 scoped 标记，必须 :deep 才命中。
   数值须与 utils/rich-text.js 的 BLOCK_STYLE 一一对应（那边 rpx、这边 px） */
.rte-canvas :deep(p) { margin: 0 0 24px; font-size: 30px; line-height: 54px; }
.rte-canvas :deep(h2) { margin: 0 0 20px; font-size: 38px; line-height: 62px; font-weight: 700; }
.rte-canvas :deep(h3) { margin: 0 0 16px; font-size: 32px; line-height: 56px; font-weight: 600; }
.rte-canvas :deep(ul), .rte-canvas :deep(ol) { margin: 0 0 24px; padding-left: 44px; }
.rte-canvas :deep(li) { margin: 0 0 8px; font-size: 30px; line-height: 54px; }
.rte-canvas :deep(blockquote) {
  margin: 0 0 24px; padding: 16px 24px;
  border-left: 6px solid #B89968; background: #F5EFE2; color: #4A453E;
}
.rte-canvas :deep(hr) { margin: 28px 0; border: none; border-top: 1px solid rgba(126, 102, 64, .24); }
.rte-canvas :deep(img) { width: 100%; display: block; margin: 0 0 24px; border-radius: 14px; }

.rte-code {
  display: block;
  width: 100%;
  box-sizing: border-box;
  border: none;
  border-radius: 0;
  padding: 14px 16px;
  background: var(--bg-canvas);
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-2);
  outline: none;
  resize: vertical;
}

.rte-foot {
  padding: 7px 12px;
  border-top: 0.5px solid var(--tbl-border);
  border-radius: 0 0 9px 9px;
  background: var(--paper-2);
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 0;
  color: var(--ink-4);
}
</style>
