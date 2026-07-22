/* ===========================================================
   富文本 ↔ 小程序 rich-text 的净化与单位换算

   小程序 <rich-text> 只认白名单标签 + 内联样式（class 不生效、节点事件被屏蔽），
   所以编辑器的出参必须先过这里：去掉不支持的标签、属性与样式声明。

   单位：库里存 rpx（与小程序其余样式同一口径，现有种子 Banner 也是 rpx），
   浏览器不认 rpx，故编辑画布按 **1rpx = 0.5px** 换算——画布宽 375px 即真机
   逻辑宽度（750rpx），字号间距与手机上看到的一模一样。
   =========================================================== */

// 画布 : 真机 = 375px : 750rpx
export const RPX_TO_PX = 0.5

// rich-text 支持的标签（照微信文档），刻意不含 a：rich-text 屏蔽所有节点事件，
// 链接点不动，留着只会让运营以为能跳转
const ALLOW_TAGS = new Set([
  'p', 'div', 'span', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'ins', 'del', 'sub', 'sup', 'code', 'q', 'blockquote',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'col', 'colgroup',
  'img', 'font', 'abbr', 'label', 'legend', 'fieldset',
])

// 整棵子树丢弃（这些标签若只脱壳，内部代码文本会变成正文）
const DROP_TAGS = new Set([
  'script', 'style', 'head', 'meta', 'link', 'title', 'iframe', 'object', 'embed', 'svg',
])

const ALLOW_STYLE = new Set([
  'color', 'background', 'background-color',
  'font-size', 'font-weight', 'font-style', 'font-family',
  'text-align', 'text-decoration', 'text-indent', 'line-height', 'letter-spacing',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius',
  'width', 'max-width', 'height', 'display', 'vertical-align', 'white-space',
])

// data-fid：正文配图在库里存 cloud:// fileID（临时链接会过期，不能入库），
// 编辑时 src 换成临时链接展示、fileID 暂存在这个属性上，保存时再换回来。
// 它只活在编辑器内存里，toStoredHtml 会删掉，不会进库。
const ALLOW_ATTRS = {
  img: ['src', 'alt', 'data-fid'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
}

// 块级排版基线（rpx）。保存时按「缺什么补什么」合并，已有声明优先，故幂等、不会越存越长。
// 这套值与 RichEditor 画布 CSS 的 px 值一一对应——两边一致才谈得上所见即所得。
export const BLOCK_STYLE = {
  h2: { margin: '0 0 20rpx', 'font-size': '38rpx', 'line-height': '62rpx', 'font-weight': '700', color: '#2A2723' },
  h3: { margin: '0 0 16rpx', 'font-size': '32rpx', 'line-height': '56rpx', 'font-weight': '600', color: '#2A2723' },
  p: { margin: '0 0 24rpx', 'font-size': '30rpx', 'line-height': '54rpx', color: '#2A2723' },
  li: { margin: '0 0 8rpx', 'font-size': '30rpx', 'line-height': '54rpx', color: '#2A2723' },
  ul: { margin: '0 0 24rpx', 'padding-left': '44rpx' },
  ol: { margin: '0 0 24rpx', 'padding-left': '44rpx' },
  blockquote: {
    margin: '0 0 24rpx', padding: '16rpx 24rpx',
    'border-left': '6rpx solid #B89968', background: '#F5EFE2', color: '#4A453E',
  },
  hr: { margin: '28rpx 0', border: 'none', 'border-top': '1rpx solid rgba(126,102,64,0.24)' },
  img: { width: '100%', display: 'block', margin: '0 0 24rpx', 'border-radius': '14rpx' },
}

export function parseStyle(str) {
  const out = {}
  String(str || '').split(';').forEach((decl) => {
    const i = decl.indexOf(':')
    if (i < 0) return
    const k = decl.slice(0, i).trim().toLowerCase()
    const v = decl.slice(i + 1).trim()
    if (k && v) out[k] = v
  })
  return out
}

export function serializeStyle(obj) {
  return Object.entries(obj).map(([k, v]) => `${k}:${v}`).join(';')
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

// 深度优先净化：先处理子节点，再决定当前节点是保留、脱壳还是整棵丢弃
function sanitizeNode(parent) {
  for (const el of Array.from(parent.childNodes)) {
    if (el.nodeType === Node.TEXT_NODE) continue
    if (el.nodeType !== Node.ELEMENT_NODE) { el.remove(); continue }

    const tag = el.tagName.toLowerCase()
    if (DROP_TAGS.has(tag)) { el.remove(); continue }

    sanitizeNode(el)

    if (!ALLOW_TAGS.has(tag)) {
      // 不支持的标签（含粘贴带进来的 a / section / article）：留文字、去壳
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      el.remove()
      continue
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      if (name === 'style' || (ALLOW_ATTRS[tag] || []).includes(name)) continue
      el.removeAttribute(attr.name)
    }

    if (el.hasAttribute('style')) {
      const clean = {}
      for (const [k, v] of Object.entries(parseStyle(el.getAttribute('style')))) {
        if (ALLOW_STYLE.has(k) && !/expression|javascript:|url\s*\(/i.test(v)) clean[k] = v
      }
      const s = serializeStyle(clean)
      if (s) el.setAttribute('style', s)
      else el.removeAttribute('style')
    }

    // 图片放行 http(s)/协议相对/data 图/云存储 fileID。
    // **data-fid 也算数**——临时链接换取失败时 src 会是空串，只看 src 就会把图删掉、
    // 下次保存直接丢数据；有 fileID 兜底就还能救回来。
    if (tag === 'img') {
      const src = el.getAttribute('src') || ''
      const fid = el.getAttribute('data-fid') || ''
      const ok = /^(https?:)?\/\/|^data:image\/|^cloud:\/\//i.test(src) || /^cloud:\/\//i.test(fid)
      if (!ok) el.remove()
    }
  }
}

// 只改 style 属性里的单位，正文文字不动。
// `(\d*\.?\d+)px` 匹配不到 `1rpx`（px 前面隔着 r，不是数字），故两个方向都安全。
function convertUnit(root, from, to, scale) {
  const re = new RegExp(`(\\d*\\.?\\d+)${from}\\b`, 'g')
  root.querySelectorAll('[style]').forEach((el) => {
    el.setAttribute('style', el.getAttribute('style').replace(re, (_, n) => {
      const v = Math.round(Number(n) * scale * 100) / 100   // 收掉浮点尾巴，如 12.500000000000002
      return `${v}${to}`
    }))
  })
}

function stampBlockStyle(root) {
  Object.entries(BLOCK_STYLE).forEach(([tag, base]) => {
    root.querySelectorAll(tag).forEach((el) => {
      // 已有声明放在后面 → 覆盖基线，运营手动调过的字号/颜色不会被吃掉
      el.setAttribute('style', serializeStyle({ ...base, ...parseStyle(el.getAttribute('style')) }))
    })
  })
}

function parse(html) {
  // DOMParser 产出的是惰性文档，不执行脚本、不发图片请求
  return new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html').body
}

/** 从 HTML 里抠出所有云存储 fileID（供调 fileUrls 换临时链接） */
export function extractFileIds(html) {
  return [...new Set(String(html || '').match(/cloud:\/\/[^"'\s>]+/g) || [])]
}

/** 库存 HTML（rpx）→ 编辑画布 HTML（px）。urlMap: fileID → 临时链接 */
export function toEditorHtml(stored, urlMap = {}) {
  const body = parse(stored)
  sanitizeNode(body)
  convertUnit(body, 'rpx', 'px', RPX_TO_PX)
  body.querySelectorAll('img').forEach((el) => {
    const src = el.getAttribute('src') || ''
    if (!/^cloud:\/\//i.test(src)) return
    el.setAttribute('data-fid', src)
    el.setAttribute('src', urlMap[src] || '')
  })
  return body.innerHTML.trim() || '<p><br></p>'
}

/** 编辑画布 HTML（px）→ 库存 HTML（rpx），顺带补齐排版基线 */
export function toStoredHtml(editorHtml) {
  const body = parse(editorHtml)
  sanitizeNode(body)
  // 空判定必须在 stamp 之前——补完样式后 `<p><br></p>` 就不是空串了，必填校验会失灵
  if (!body.textContent.trim() && !body.querySelector('img, hr')) return ''
  // 临时链接换回 fileID：临时链接几小时后失效，入库的必须是 cloud://
  body.querySelectorAll('img[data-fid]').forEach((el) => {
    el.setAttribute('src', el.getAttribute('data-fid'))
    el.removeAttribute('data-fid')
  })
  stampBlockStyle(body)
  convertUnit(body, 'px', 'rpx', 1 / RPX_TO_PX)
  return body.innerHTML.trim()
}

/** 粘贴片段净化（外部 HTML → 可插入画布的 px 版） */
export function sanitizeFragment(html) {
  const body = parse(html)
  sanitizeNode(body)
  convertUnit(body, 'rpx', 'px', RPX_TO_PX)
  return body.innerHTML
}
