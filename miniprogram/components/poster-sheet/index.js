const toast = require('../../utils/toast')
const { call } = require('../../api/request')
const { throttle } = require('../../utils/guard')

// v3.2 分享海报（仅善选故事可分享）：善选副本全文 + 配图，不展示作者名；
// 视觉与活动邀请函统一——标签框 + 衬线标题 + 分段正文 + 虚线 CTA 框 + 手绘醒书咨询页尾

Component({
  // 允许 app.wxss 全局类（seal-tag/btn-primary/btn-ghost）穿透组件样式隔离
  options: { addGlobalClass: true },
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    story: {
      type: Object,
      value: null,
    },
  },

  data: {
    _mounted: false,
    _show: false,
    shareTitle: '',
    shareContent: '',
    shareImages: [],
    qrFileID: '',
  },

  observers: {
    'visible': function(val) {
      if (val) {
        this.setData({ _mounted: true })
        setTimeout(() => this.setData({ _show: true }), 20)
      } else {
        this.setData({ _show: false })
        setTimeout(() => this.setData({ _mounted: false }), 320)
      }
    },
    'story': function(d) {
      if (d) {
        // 先用传入内容占位，随后拉善选副本全文覆盖（会员/作者视角传入的是原文，海报须用公众可见的副本）
        this.setData({ shareTitle: d.title || '', shareContent: d.content || '', shareImages: d.images || [], qrFileID: '' })
        this._qrTempPath = ''
        this._loadShareContent(d.id)
        this._loadQr(d.id)
      }
    },
  },

  methods: {
    // 分享内容 = 善选副本全文 + 副本配图（preferFeatured：任何身份都取副本，不计阅读记录）
    async _loadShareContent(storyId) {
      const res = await call('getStoryDetail', { storyId, preferFeatured: true }, { raw: true })
      if (res && res.code === 0 && res.data) {
        this.setData({
          shareTitle: res.data.title || '',
          shareContent: res.data.content || '',
          shareImages: res.data.images || [],
        })
      }
    },

    // v2.2 带参小程序码：scene 携带故事 ID + 当前用户（分享人）ID，失败静默回退占位
    async _loadQr(storyId) {
      try {
        const app = getApp()
        const sharerId = (app.globalData.user || {}).id
        // raw 取完整信封，失败时把服务端 msg 打出来便于定位
        const res = await call('generateMiniCode', { storyId, sharerId }, { raw: true })
        if (res && res.code === 0 && res.data && res.data.fileID) {
          this.setData({ qrFileID: res.data.fileID })
          const dl = await wx.cloud.downloadFile({ fileID: res.data.fileID })
          this._qrTempPath = dl.tempFilePath
        } else {
          console.warn('[poster] 小程序码生成失败，回退占位码。原因：', res && res.msg)
        }
      } catch (e) { console.error('[poster] _loadQr error:', e) }
    },
    onMaskTap() {
      this.triggerEvent('close')
    },

    // wxml 用 catchtap 绑定即已阻止冒泡到遮罩，无需（小程序也没有）e.stopPropagation
    onSheetTap() {},

    onSaveImage() {
      // 生成+保存海报耗时较长，2s 内防连点，避免重复保存到相册
      throttle(this, 'save', () => this._doSaveImage(), 2000)
    },

    _doSaveImage() {
      const save = () => this._render(path => { if (path) this._saveToAlbum(path) })
      wx.getSetting({
        success: (res) => {
          const scope = res.authSetting['scope.writePhotosAlbum']
          if (scope === true) { save(); return }
          if (scope === false) { this._openAlbumSetting(); return }
          // 从未申请过 → 主动拉起授权，避免首次保存时隐式弹窗被误判为失败
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: save,
            fail: () => this._openAlbumSetting(),
          })
        },
        fail: save,
      })
    },

    // 分享给朋友：生成海报图片后拉起系统分享面板（分享无需相册权限）
    onShareImage() {
      throttle(this, 'share', () => this._render(path => {
        if (!path) return
        wx.showShareImageMenu({ path, fail: () => toast.info('可先保存到相册再分享', 2000) })
      }), 2000)
    },

    _saveToAlbum(path) {
      wx.saveImageToPhotosAlbum({
        filePath: path,
        success: () => { toast.success('已保存到相册'); this._recordShare() },
        fail: (err) => {
          const msg = (err && err.errMsg) || ''
          console.error('[poster] saveImageToPhotosAlbum fail:', msg)
          if (/deny|denied|authorize|cancel|auth/i.test(msg)) {
            this._openAlbumSetting()
          } else {
            toast.error('保存失败：' + (msg.replace('saveImageToPhotosAlbum:fail ', '') || '请重试'))
          }
        },
      })
    },

    _openAlbumSetting() {
      wx.showModal({
        title: '需要相册权限',
        content: '请在设置中允许"醒书日记"访问你的相册',
        confirmText: '去设置',
        cancelText: '取消',
        success: (r) => { if (r.confirm) wx.openSetting() },
      })
    },

    // 渲染海报到临时文件，done(tempFilePath|null)；保存与分享共用
    _render(done) {
      const d = this.data.story
      if (!d) { done && done(null); return }

      const query = wx.createSelectorQuery().in(this)
      query.select('#poster-canvas').fields({ node: true, size: true }).exec(async (res) => {
        if (!res || !res[0] || !res[0].node) {
          toast.error('图片生成失败')
          done && done(null)
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const W = 640, PADX = 60, CW = W - PADX * 2   // 沿用原故事海报尺寸
        const MAX_H = 8000            // 画布高度软上限（超限时截断正文，防旧机型导出失败）
        const FRAME_L = 24                            // 花边矩形（在英文下方，框住标题+正文）
        const CTA_H = 150, FOOT_H = 100
        const ACCENT = '#B6452F', FOOT_BG = '#A08A63', TAG_COLOR = '#8A6E4B'  // 标签色同活动海报

        // 配图与品牌栏图先行加载（cloud:// 下载临时路径 → createImage 取宽高），失败的静默跳过
        wx.showLoading({ title: '生成海报中…', mask: true })
        const loadImage = async (src) => {
          try {
            let path = src
            if (/^cloud:\/\//.test(src)) {
              const dl = await wx.cloud.downloadFile({ fileID: src })
              path = dl.tempFilePath
            }
            const img = canvas.createImage()
            await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = path })
            return img
          } catch (e) {
            console.warn('[poster] 图片加载失败，跳过：', src)
            return null
          }
        }
        const posterImgs = (await Promise.all((this.data.shareImages || []).map(loadImage))).filter(Boolean)
        const qrImg = this._qrTempPath ? await loadImage(this._qrTempPath) : null
        wx.hideLoading()

        // ── 第一遍：测量排版，算出动态高度（花边框住文字，花边下为图片/二维码/页尾）──
        canvas.width = W
        canvas.height = 100
        ctx.font = 'bold 38px serif'
        const titleLines = this._splitText(ctx, this.data.shareTitle || '', CW)
        ctx.font = '27px sans-serif'
        // 正文按原文段落（\n）分段，每段独立折行、段间留间距
        let contentBlocks = String(this.data.shareContent || '').split('\n')
          .map(p => (p.trim() ? this._splitText(ctx, p.trim(), CW) : []))
        const imgHeights = posterImgs.map(img => Math.round(CW * img.height / Math.max(img.width, 1)))
        const imgsH = imgHeights.reduce((s, h) => s + h + 16, 0)
        const contentHof = (blocks) => {
          let ch = 0
          blocks.forEach((lines, i) => { ch += lines.length * 40; if (i < blocks.length - 1) ch += 12 })
          return ch
        }
        const measure = (blocks) => {
          let yy = 40
          const tagTop = yy                    // 「醒書故事」标签框（花边外上方）
          yy += 48 + 12
          const kickerTop = yy                 // 英文小字 XINGSHU STORY（花边外）
          yy += 30 + 16
          const frameTop = yy                  // 花边上边（英文下方）
          yy += 28
          const titleTop = yy                  // 花边内：标题（居中）
          yy += titleLines.length * 54
          yy += 16
          const contentTop = yy                // 花边内：正文（左对齐）
          yy += contentHof(blocks)
          yy += 24
          const frameBottom = yy               // 花边下边（框住标题+正文）
          yy += 32
          const imgTop = yy                    // 花边下：配图
          yy += imgsH
          const ctaTop = yy                    // 二维码 CTA
          yy += CTA_H + 28
          return { tagTop, kickerTop, frameTop, titleTop, contentTop, frameBottom, imgTop, ctaTop, H: yy + FOOT_H }
        }
        let lay = measure(contentBlocks)
        if (lay.H > MAX_H) {
          // 正文超长：展平后按可用高度截断，末尾提示扫码阅读
          const allow = MAX_H - (lay.H - contentHof(contentBlocks))
          const flat = []
          contentBlocks.forEach(lines => lines.forEach(l => flat.push(l)))
          const keep = Math.max(1, Math.floor(allow / 40) - 1)
          contentBlocks = [flat.slice(0, keep).concat(['……（全文请扫码进入小程序阅读）'])]
          lay = measure(contentBlocks)
        }

        // ── 第二遍：按最终高度绘制（重设尺寸会清空画布与状态）──
        const H = lay.H
        canvas.height = H

        // 底色（原米纸）+ 点阵（至页尾前）
        ctx.fillStyle = '#FFFCF5'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = 'rgba(126,102,64,0.05)'
        for (let x = 18; x < W; x += 18) {
          for (let yy = 18; yy < H - FOOT_H; yy += 18) {
            ctx.beginPath(); ctx.arc(x, yy, 1.5, 0, Math.PI * 2); ctx.fill()
          }
        }

        // 花边：矩形边框 + 四角 L 形（在英文下方，框住标题+正文）
        ctx.strokeStyle = 'rgba(126,102,64,0.2)'; ctx.lineWidth = 1
        ctx.strokeRect(FRAME_L, lay.frameTop, W - FRAME_L * 2, lay.frameBottom - lay.frameTop)
        const cm = 16
        ctx.strokeStyle = 'rgba(126,102,64,0.4)'; ctx.lineWidth = 1.5
        const fL = FRAME_L + 12, fT = lay.frameTop + 12, fR = W - FRAME_L - 12, fB = lay.frameBottom - 12
        ;[
          [[fL + cm, fT], [fL, fT], [fL, fT + cm]],
          [[fR - cm, fT], [fR, fT], [fR, fT + cm]],
          [[fL, fB - cm], [fL, fB], [fL + cm, fB]],
          [[fR - cm, fB], [fR, fB], [fR, fB - cm]],
        ].forEach(([s, c, e]) => { ctx.beginPath(); ctx.moveTo(...s); ctx.lineTo(...c); ctx.lineTo(...e); ctx.stroke() })

        // 「醒書故事」标签框（左对齐，花边内顶部，边框色同活动标签）
        ctx.textAlign = 'left'; ctx.font = '24px sans-serif'
        const brandText = '醒書故事'
        const brandTagW = ctx.measureText(brandText).width + 36
        ctx.strokeStyle = TAG_COLOR; ctx.lineWidth = 2
        this._roundRect(ctx, PADX, lay.tagTop, brandTagW, 48, 7); ctx.stroke()
        ctx.fillStyle = TAG_COLOR; ctx.fillText(brandText, PADX + 18, lay.tagTop + 32)

        // 英文小字 kicker（同活动海报 SATURDAY MORNING COFFEE 位置）
        ctx.globalAlpha = 0.6; ctx.fillStyle = TAG_COLOR; ctx.font = '18px sans-serif'
        ctx.fillText('X I N G S H U   S T O R Y', PADX, lay.kickerTop + 18); ctx.globalAlpha = 1

        // 故事标题（居中衬线，活动字体色）
        ctx.fillStyle = '#43341F'; ctx.font = 'bold 38px serif'; ctx.textAlign = 'center'
        let ty = lay.titleTop + 40
        titleLines.forEach(line => { ctx.fillText(line, W / 2, ty); ty += 54 })

        // 正文全文（左对齐，活动字体色，分段）
        ctx.fillStyle = 'rgba(67,52,31,0.9)'; ctx.font = '27px sans-serif'; ctx.textAlign = 'left'
        let cy = lay.contentTop + 30
        contentBlocks.forEach(lines => {
          lines.forEach(line => { ctx.fillText(line, PADX, cy); cy += 40 })
          cy += 12
        })

        // ── 花边下：配图（逐张等比） ──
        let imy = lay.imgTop
        posterImgs.forEach((img, i) => { ctx.drawImage(img, PADX, imy, CW, imgHeights[i]); imy += imgHeights[i] + 16 })

        // ── 二维码 CTA：虚线框 + 文案 + 带参小程序码 ──
        const ctaX = 40, ctaW = W - 80, ctaY = lay.ctaTop
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.setLineDash([9, 7])
        this._roundRect(ctx, ctaX, ctaY, ctaW, CTA_H, 14); ctx.stroke(); ctx.setLineDash([])
        ctx.fillStyle = ACCENT; ctx.textAlign = 'left'
        ctx.font = '25px sans-serif'
        ctx.fillText('长按识别小程序码', ctaX + 28, ctaY + 62)
        ctx.font = '22px sans-serif'
        ctx.fillText('探索把经典走进你的生活', ctaX + 28, ctaY + 100)
        const qsize = 110
        const qx = ctaX + ctaW - 28 - qsize, qy = ctaY + (CTA_H - qsize) / 2
        ctx.fillStyle = '#FFFFFF'
        this._roundRect(ctx, qx - 7, qy - 7, qsize + 14, qsize + 14, 8); ctx.fill()
        if (qrImg) {
          ctx.drawImage(qrImg, qx, qy, qsize, qsize)
        } else {
          ctx.fillStyle = '#1E1A14'
          const c = qsize / 3
          ;[[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]].forEach(([r, col]) => {
            ctx.fillRect(qx + col * c, qy + r * c, c - 3, c - 3)
          })
        }

        // ── 页尾品牌栏（手绘醒书咨询）──
        const fy = H - FOOT_H
        ctx.fillStyle = FOOT_BG; ctx.fillRect(0, fy, W, FOOT_H)
        ctx.fillStyle = '#FDF9F0'; ctx.font = 'bold 26px serif'; ctx.textAlign = 'left'
        ctx.fillText('醒书咨询', 40, fy + 46)
        ctx.font = '11px sans-serif'; ctx.globalAlpha = 0.85; ctx.fillText('XINGSHU CONSULTING', 40, fy + 70)
        ctx.globalAlpha = 0.35; ctx.fillRect(186, fy + 22, 2, 56)
        ctx.globalAlpha = 0.92; ctx.font = '16px sans-serif'
        const desc = '醒书咨询，一家专注经典文化与现代生活深度对话的机构，为中小企业和个人提供发展咨询服务。'
        this._splitText(ctx, desc, W - 206 - 40).slice(0, 3).forEach((line, i) => {
          ctx.fillText(line, 206, fy + 38 + i * 24)
        })
        ctx.globalAlpha = 1

        // 导出临时文件，交回调（保存 / 分享分别处理）
        wx.canvasToTempFilePath({
          canvas,
          success: (r) => done && done(r.tempFilePath),
          fail: (err) => {
            console.error('[poster] canvasToTempFilePath fail:', (err && err.errMsg) || err)
            toast.error('图片生成失败')
            done && done(null)
          },
        }, this)
      })
    },

    _splitText(ctx, text, maxWidth) {
      if (!text) return ['']
      const lines = []
      let line = ''
      for (const char of text) {
        const test = line + char
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line)
          line = char
        } else {
          line = test
        }
      }
      if (line) lines.push(line)
      return lines.length ? lines : ['']
    },

    _roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.arcTo(x + w, y, x + w, y + r, r)
      ctx.lineTo(x + w, y + h - r)
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
      ctx.lineTo(x + r, y + h)
      ctx.arcTo(x, y + h, x, y + h - r, r)
      ctx.lineTo(x, y + r)
      ctx.arcTo(x, y, x + r, y, r)
      ctx.closePath()
    },

    // 海报成功保存到相册 = 完成一次分享：后端累加 share_count，并把最新数字回抛给列表页更新
    async _recordShare() {
      const d = this.data.story
      if (!d) return
      const res = await call('recordShare', { storyId: d.id }, { showError: false })
      if (res) this.triggerEvent('shared', { id: d.id, shares: res.shares })
    },
  },
})
