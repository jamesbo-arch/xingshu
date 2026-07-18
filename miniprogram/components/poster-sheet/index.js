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
      wx.getSetting({
        success: (res) => {
          const scope = res.authSetting['scope.writePhotosAlbum']
          if (scope === true) { this._renderAndSave(); return }
          if (scope === false) { this._openAlbumSetting(); return }
          // 从未申请过 → 主动拉起授权，避免首次保存时隐式弹窗被误判为失败
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => this._renderAndSave(),
            fail: () => this._openAlbumSetting(),
          })
        },
        fail: () => this._renderAndSave(),
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

    _renderAndSave() {
      const d = this.data.story
      if (!d) return

      const query = wx.createSelectorQuery().in(this)
      query.select('#poster-canvas').fields({ node: true, size: true }).exec(async (res) => {
        if (!res || !res[0] || !res[0].node) {
          toast.error('图片生成失败')
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const W = 750, PX = 56, CW = W - PX * 2
        const MAX_H = 9000            // 画布高度软上限（超限时截断正文，防旧机型导出失败）
        const T = { bg: ['#F7EFE0', '#EAD9B8'], fg: '#43341F', accent: '#B6452F', footBg: '#A08A63' }

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

        const FOOT_H = 118   // 手绘页尾固定高

        // ── 第一遍：测量排版，算出动态高度 ──
        canvas.width = W
        canvas.height = 100
        ctx.font = 'bold 46px serif'
        const titleLines = this._splitText(ctx, this.data.shareTitle || '', CW)
        ctx.font = '27px sans-serif'
        // 正文按原文段落（\n）分段，每段独立折行、段间留间距
        let contentBlocks = String(this.data.shareContent || '').split('\n')
          .map(p => (p.trim() ? this._splitText(ctx, p.trim(), CW) : []))
        const imgHeights = posterImgs.map(img => Math.round(CW * img.height / Math.max(img.width, 1)))
        const imgsH = imgHeights.reduce((s, h) => s + h + 16, 0)
        const tags = (d.tags || []).slice(0, 4)
        const tagsH = tags.length ? 56 : 0
        const CTA_H = 168
        const contentHof = (blocks) => {
          let ch = 0
          blocks.forEach((lines, i) => { ch += lines.length * 44; if (i < blocks.length - 1) ch += 14 })
          return ch
        }
        const measure = (blocks) => {
          let yy = 60 + 52 + 30 + 34            // tag 框 + kicker
          const titleTop = yy
          yy = titleTop + titleLines.length * 64 + 28
          const contentTop = yy
          yy = contentTop + contentHof(blocks) + 24
          const imgTop = yy
          yy += imgsH + 8
          const dividerY = yy
          yy += 40
          const tagsTop = yy
          yy += tagsH
          const ctaTop = yy
          yy = ctaTop + CTA_H + 40
          return { titleTop, contentTop, imgTop, dividerY, tagsTop, ctaTop, H: yy + FOOT_H }
        }
        let lay = measure(contentBlocks)
        if (lay.H > MAX_H) {
          // 正文超长：展平后按可用高度截断，末尾提示扫码阅读
          const allow = MAX_H - (lay.H - contentHof(contentBlocks))
          const flat = []
          contentBlocks.forEach(lines => lines.forEach(l => flat.push(l)))
          const keep = Math.max(1, Math.floor(allow / 44) - 1)
          contentBlocks = [flat.slice(0, keep).concat(['……（全文请扫码进入小程序阅读）'])]
          lay = measure(contentBlocks)
        }

        // ── 第二遍：按最终高度绘制（重设尺寸会清空画布与状态）──
        const H = lay.H
        canvas.height = H
        ctx.textAlign = 'left'

        // 背景暖色渐变
        const g = ctx.createLinearGradient(0, 0, W * 0.3, H)
        g.addColorStop(0, T.bg[0]); g.addColorStop(1, T.bg[1])
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)

        // 品牌标签框「醒書故事」
        ctx.font = '26px sans-serif'
        const tagText = '醒書故事'
        const tagW = ctx.measureText(tagText).width + 44
        ctx.strokeStyle = T.accent; ctx.lineWidth = 2.5
        this._roundRect(ctx, PX, 60, tagW, 52, 8); ctx.stroke()
        ctx.fillStyle = T.accent; ctx.fillText(tagText, PX + 22, 94)

        // 英文小字
        ctx.globalAlpha = 0.55; ctx.fillStyle = T.fg; ctx.font = '20px sans-serif'
        ctx.fillText('X I N G S H U   S T O R Y', PX, 150); ctx.globalAlpha = 1

        // 标题（左对齐衬线）
        ctx.fillStyle = T.fg; ctx.font = 'bold 46px serif'
        let ty = lay.titleTop + 46
        titleLines.forEach(line => { ctx.fillText(line, PX, ty); ty += 64 })

        // 正文全文（分段绘制，段间留间距）
        ctx.globalAlpha = 0.9; ctx.font = '27px sans-serif'; ctx.fillStyle = T.fg
        let cy = lay.contentTop + 27
        contentBlocks.forEach(lines => {
          lines.forEach(line => { ctx.fillText(line, PX, cy); cy += 44 })
          cy += 14
        })
        ctx.globalAlpha = 1

        // 配图（正文之下逐张等比绘制）
        let imy = lay.imgTop
        posterImgs.forEach((img, i) => { ctx.drawImage(img, PX, imy, CW, imgHeights[i]); imy += imgHeights[i] + 16 })

        // 分隔线
        ctx.globalAlpha = 0.28; ctx.strokeStyle = T.fg; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(PX, lay.dividerY); ctx.lineTo(W - PX, lay.dividerY); ctx.stroke(); ctx.globalAlpha = 1

        // 标签（印章样式）
        if (tags.length) {
          ctx.font = '22px sans-serif'
          let tx = PX
          const tgy = lay.tagsTop + 8
          tags.forEach(tag => {
            const tw = ctx.measureText(tag).width + 28
            ctx.fillStyle = 'rgba(126,102,64,0.10)'; this._roundRect(ctx, tx, tgy, tw, 40, 6); ctx.fill()
            ctx.strokeStyle = 'rgba(126,102,64,0.30)'; ctx.lineWidth = 1; ctx.stroke()
            ctx.fillStyle = '#7E6640'; ctx.fillText(tag, tx + 14, tgy + 27)
            tx += tw + 12
          })
        }

        // CTA 虚线框 + 文案 + 小程序码
        const ctaY = lay.ctaTop
        ctx.strokeStyle = T.accent; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8])
        this._roundRect(ctx, PX, ctaY, CW, CTA_H, 16); ctx.stroke(); ctx.setLineDash([])
        ctx.fillStyle = T.accent
        ctx.font = '26px sans-serif'
        ctx.fillText('长按识别小程序码', PX + 32, ctaY + 72)
        ctx.font = '24px sans-serif'
        ctx.fillText('探索把经典走进你的生活', PX + 32, ctaY + 114)
        const qsize = 128
        const qx = W - PX - 32 - qsize, qy = ctaY + (CTA_H - qsize) / 2
        ctx.fillStyle = '#FFFFFF'
        this._roundRect(ctx, qx - 8, qy - 8, qsize + 16, qsize + 16, 10); ctx.fill()
        if (qrImg) {
          ctx.drawImage(qrImg, qx, qy, qsize, qsize)
        } else {
          ctx.fillStyle = '#1E1A14'
          const c = qsize / 3
          ;[[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]].forEach(([r, col]) => {
            ctx.fillRect(qx + col * c, qy + r * c, c - 3, c - 3)
          })
        }

        // 页尾品牌栏（手绘醒书咨询，与活动邀请函一致）
        const fy = H - FOOT_H
        ctx.fillStyle = T.footBg; ctx.fillRect(0, fy, W, FOOT_H)
        ctx.fillStyle = '#FDF9F0'; ctx.font = 'bold 30px serif'; ctx.fillText('醒书咨询', PX, fy + 56)
        ctx.font = '12px sans-serif'; ctx.globalAlpha = 0.85; ctx.fillText('XINGSHU CONSULTING', PX, fy + 84)
        ctx.globalAlpha = 0.35; ctx.fillRect(228, fy + 26, 2, 66)
        ctx.globalAlpha = 0.92; ctx.font = '19px sans-serif'
        const desc = '醒书咨询，一家专注经典文化与现代生活深度对话的机构，为中小企业和个人提供发展咨询服务。'
        this._splitText(ctx, desc, W - 254 - PX).slice(0, 3).forEach((line, i) => {
          ctx.fillText(line, 254, fy + 44 + i * 30)
        })
        ctx.globalAlpha = 1

        // 导出并保存
        wx.canvasToTempFilePath({
          canvas,
          success: (r) => {
            wx.saveImageToPhotosAlbum({
              filePath: r.tempFilePath,
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
          fail: (err) => {
            console.error('[poster] canvasToTempFilePath fail:', (err && err.errMsg) || err)
            toast.error('图片生成失败')
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
