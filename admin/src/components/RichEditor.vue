<!-- 所见即所得富文本编辑器（供 Banner 详情页图文用）

     工具条功能与小程序 pages/compose 的富文本工具条**一一对应**（5 色 / BIU /
     有序无序列表 / 居中），刻意不多给：多出来的功能运营在手机端见不到，
     排出来的版式也无从预期。

     画布宽 375px = 真机逻辑宽度 750rpx，1rpx = 0.5px，
     字号、行距、留白与手机上所见完全一致。 -->
<template>
  <div class="rte">
    <!-- mousedown.prevent：不让焦点离开画布，否则按钮一按选区就没了、命令作用不到选中的字 -->
    <div class="rte-bar" @mousedown.prevent>
      <button v-for="c in COLORS" :key="c.value" type="button"
        class="tb sw" :class="{ on: st.color === c.value }" :title="c.name"
        :style="{ background: c.value }" @click="exec('foreColor', c.value, true)"></button>

      <span class="sep"></span>

      <button type="button" class="tb ico" :class="{ on: st.bold }" title="加粗"
        @click="exec('bold')"><b>B</b></button>
      <button type="button" class="tb ico" :class="{ on: st.italic }" title="斜体"
        @click="exec('italic')"><i>I</i></button>
      <button type="button" class="tb ico" :class="{ on: st.underline }" title="下划线"
        @click="exec('underline', null, true)"><u>U</u></button>

      <span class="sep"></span>

      <button type="button" class="tb ico" :class="{ on: st.ol }" title="有序列表"
        @click="exec('insertOrderedList')">
        <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
          <text x="0" y="6.5" font-size="6">1</text><text x="0" y="12.5" font-size="6">2</text>
          <text x="0" y="18.5" font-size="6">3</text>
          <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <path d="M7 4.5h12M7 10.5h12M7 16.5h12" />
          </g>
        </svg>
      </button>
      <button type="button" class="tb ico" :class="{ on: st.ul }" title="无序列表"
        @click="exec('insertUnorderedList')">
        <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
          <g fill="currentColor"><circle cx="2" cy="4.5" r="1.5" /><circle cx="2" cy="10.5" r="1.5" />
            <circle cx="2" cy="16.5" r="1.5" /></g>
          <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <path d="M7 4.5h12M7 10.5h12M7 16.5h12" />
          </g>
        </svg>
      </button>

      <span class="sep"></span>

      <button type="button" class="tb ico" :class="{ on: st.center }" title="居中"
        @click="exec('justifyCenter', null, true)">
        <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
          <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <path d="M1 3.5h18M4 8.5h12M1 13.5h18M4 18.5h12" />
          </g>
        </svg>
      </button>
    </div>

    <!-- 手机纸面：宽度、背景、卡片圆角与 pages/banner-detail 完全一致 -->
    <div class="rte-stage">
      <div class="rte-phone">
        <img v-if="heroSrc" :src="heroSrc" class="rte-hero" alt="" />
        <div ref="ed" class="rte-canvas" contenteditable="true"
          @input="push" @paste="onPaste" @keyup="syncState" @mouseup="syncState" @focus="syncState"></div>
      </div>
    </div>

    <div class="rte-foot">画布即手机实际宽度（750rpx），所见即真机所得</div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { toEditorHtml, toStoredHtml, sanitizeFragment, escapeHtml } from '../utils/rich-text.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  heroSrc: { type: String, default: '' },   // 轮播图，摆在正文上方还原详情页真实观感
})
const emit = defineEmits(['update:modelValue'])

// 与小程序 pages/compose 的 formatColors 逐条对应，改这里要同步改那边
const COLORS = [
  { name: '黑', value: '#2A2723' },
  { name: '深红', value: '#B6452F' },
  { name: '黄', value: '#C29013' },
  { name: '蓝', value: '#3A6B9E' },
  { name: '绿', value: '#5B8F6C' },
]

const ed = ref(null)
const st = reactive({ bold: false, italic: false, underline: false, ul: false, ol: false, center: false, color: '' })

// 自己刚 emit 出去的值——用它挡住回流，否则每敲一个字都会重写 innerHTML、光标被打回开头
let lastEmitted = null

onMounted(() => {
  syncFromProp()
  try { document.execCommand('defaultParagraphSeparator', false, 'p') } catch { /* 老浏览器忽略 */ }
})

watch(() => props.modelValue, syncFromProp)

function syncFromProp() {
  if (props.modelValue === lastEmitted) return
  if (ed.value) ed.value.innerHTML = toEditorHtml(props.modelValue)
}

function push() {
  const out = toStoredHtml(ed.value.innerHTML)
  lastEmitted = out
  emit('update:modelValue', out)
}

function exec(cmd, val = null, css = false) {
  ed.value.focus()
  // styleWithCSS：颜色/居中/下划线走内联样式（rich-text 不支持 <u>，<font> 语义也不稳），
  // 加粗斜体则留 <b>/<i>，出参更干净
  try { document.execCommand('styleWithCSS', false, css) } catch { /* 忽略 */ }
  document.execCommand(cmd, false, val)
  push()
  syncState()
}

// queryCommandValue('foreColor') 回的是 rgb(…)，得转成 hex 才能和色板比对
function toHex(v) {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(v || '')
  if (!m) return String(v || '').toLowerCase()
  return '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('')
}

function syncState() {
  try {
    st.bold = document.queryCommandState('bold')
    st.italic = document.queryCommandState('italic')
    st.underline = document.queryCommandState('underline')
    st.ul = document.queryCommandState('insertUnorderedList')
    st.ol = document.queryCommandState('insertOrderedList')
    st.center = document.queryCommandState('justifyCenter')
    const hex = toHex(document.queryCommandValue('foreColor'))
    const hit = COLORS.find((c) => c.value.toLowerCase() === hex)
    st.color = hit ? hit.value : ''
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
</script>

<style scoped>
/* 注意：这里不能加 overflow:hidden ——那会让 .rte 自己变成滚动容器，
   工具条的 sticky 就只相对 .rte 生效（而它从不滚动），等于失效。
   圆角改由工具条与页脚各切两角。 */
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
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  background: var(--paper-2);
  border-bottom: 0.5px solid var(--tbl-border);
}

.sep { width: 0.5px; height: 18px; background: var(--tbl-border); margin: 0 5px; }

.tb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0.5px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-2);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background .12s, color .12s;
}
.tb:hover { background: var(--paper-card); border-color: var(--tbl-border); }
.tb.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }

/* 色板按钮本身就是色块，选中态只能靠描边表达，不能像其他按钮那样反色 */
.sw {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid transparent;
  box-shadow: 0 0 0 0.5px var(--tbl-border);
}
.sw:hover { border-color: transparent; box-shadow: 0 0 0 0.5px var(--ink-3); transform: scale(1.1); }
.sw.on { border-color: var(--paper-card); box-shadow: 0 0 0 1.5px var(--ink); }

.rte-stage {
  max-height: 54vh;
  overflow: auto;
  padding: 18px 0;
  background: var(--paper-2);
  display: flex;
  justify-content: center;
}

/* 以下尺寸全部来自 pages/banner-detail 的 wxss，rpx 一律折半（375px = 750rpx） */
.rte-phone {
  width: 375px;
  flex: none;
  box-sizing: border-box;
  padding: 0 12px;                    /* 24rpx */
  background: #FBF7EE;                /* paper-bg */
  box-shadow: 0 2px 14px rgba(58, 44, 22, .12);
}
.rte-hero {
  display: block;
  width: 100%;
  border-radius: 14px;
  margin-bottom: 12px;                /* 24rpx */
  background: #EFE7D4;
}
.rte-canvas {
  min-height: 300px;
  box-sizing: border-box;
  padding: 16px;                      /* 32rpx */
  background: #FFFCF5;
  border: 0.5px solid rgba(126, 102, 64, .14);
  border-radius: 14px;
  outline: none;
  font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 15px;                    /* 30rpx */
  line-height: 26px;                  /* 52rpx */
  color: #2A2723;
  text-align: left;
}

/* execCommand 生成的节点没有 Vue scoped 标记，必须 :deep 才命中。
   数值须与 utils/rich-text.js 的 BLOCK_STYLE 对应（那边 rpx、这边折半的 px） */
.rte-canvas :deep(p) { margin: 0 0 12px; font-size: 15px; line-height: 27px; }
.rte-canvas :deep(h2) { margin: 0 0 10px; font-size: 19px; line-height: 31px; font-weight: 700; }
.rte-canvas :deep(h3) { margin: 0 0 8px; font-size: 16px; line-height: 28px; font-weight: 600; }
.rte-canvas :deep(ul), .rte-canvas :deep(ol) { margin: 0 0 12px; padding-left: 22px; }
.rte-canvas :deep(li) { margin: 0 0 4px; font-size: 15px; line-height: 27px; }
.rte-canvas :deep(blockquote) {
  margin: 0 0 12px; padding: 8px 12px;
  border-left: 3px solid #B89968; background: #F5EFE2; color: #4A453E;
}
.rte-canvas :deep(hr) { margin: 14px 0; border: none; border-top: 1px solid rgba(126, 102, 64, .24); }
.rte-canvas :deep(img) { width: 100%; display: block; margin: 0 0 12px; border-radius: 7px; }

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
