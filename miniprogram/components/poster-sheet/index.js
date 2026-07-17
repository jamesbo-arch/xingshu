const toast = require('../../utils/toast')
const { call } = require('../../api/request')
const { throttle } = require('../../utils/guard')

// v3.1 分享海报（仅善选故事可分享）：包含善选副本全文（运营修订版，面向公众），
// 不展示作者名；底部为醒书咨询品牌栏（images/consulting-banner.png 原图，仅二维码区替换为带参小程序码）
const BANNER_SRC = '/images/consulting-banner.png'
// 原图二维码区在图内的比例坐标（对 413×141 原图实测），替换小程序码时按此定位
const BANNER_QR = { x: 0.7942, y: 0.3688, w: 0.1598, h: 0.4397 }
const BANNER_BG = '#BA9F88'

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
        const W = 640
        const MAX_H = 8000            // 画布高度软上限（超限时截断正文，防旧机型导出失败）
        const CW = W - 120            // 内容区宽（正文/配图共用）
        const fx = 34, fw = W - 68    // 品牌栏横向位置

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
        const [bannerImg, ...rawImgs] = await Promise.all([
          loadImage(BANNER_SRC),
          ...(this.data.shareImages || []).map(loadImage),
        ])
        const posterImgs = rawImgs.filter(Boolean)
        wx.hideLoading()

        // 品牌栏高度按原图比例随栏宽缩放（图加载失败时用近似值兜底）
        const FOOT_H = bannerImg ? Math.round(fw * bannerImg.height / bannerImg.width) : 195

        // ── 第一遍：仅测量排版，算出动态高度 ──
        canvas.width = W
        canvas.height = 100
        ctx.font = 'bold 38px serif'
        const titleLines = this._splitText(ctx, this.data.shareTitle || '', W - 120)
        ctx.font = '27px sans-serif'
        let contentLines = []
        ;(this.data.shareContent || '').split('\n').filter(l => l.trim()).forEach(line => {
          contentLines.push(...this._splitText(ctx, line, W - 120))
        })
        // 配图按内容区宽等比缩放，纵向排列在正文之下
        const imgHeights = posterImgs.map(img => Math.round(CW * img.height / Math.max(img.width, 1)))
        const imgsH = imgHeights.reduce((s, h) => s + h + 16, 0)
        const tags = (d.tags || []).slice(0, 4)
        const tagsH = tags.length ? 56 : 0
        const contentTop = 130 + titleLines.length * 54 + 20
        const fixedH = 16 + imgsH + tagsH + 30 + FOOT_H + 44
        let H = contentTop + contentLines.length * 42 + fixedH
        if (H > MAX_H) {
          const keep = Math.floor((MAX_H - contentTop - fixedH) / 42) - 1
          contentLines = contentLines.slice(0, Math.max(keep, 1))
          contentLines.push('……（全文请扫码进入小程序阅读）')
          H = contentTop + contentLines.length * 42 + fixedH
        }

        // ── 第二遍：按最终高度绘制（重设尺寸会清空画布与状态）──
        canvas.height = H

        // Background
        ctx.fillStyle = '#FFFCF5'
        ctx.fillRect(0, 0, W, H)

        // Dot grid
        ctx.fillStyle = 'rgba(126,102,64,0.05)'
        for (let x = 18; x < W; x += 18) {
          for (let y = 18; y < H - FOOT_H; y += 18) {
            ctx.beginPath()
            ctx.arc(x, y, 1.5, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        // Outer border
        ctx.strokeStyle = 'rgba(126,102,64,0.2)'
        ctx.lineWidth = 1
        ctx.strokeRect(24, 24, W - 48, H - 48)

        // Corner marks (L-shape at each corner)
        const cm = 16
        ctx.strokeStyle = 'rgba(126,102,64,0.4)'
        ctx.lineWidth = 1.5
        const corners = [
          [[36 + cm, 36], [36, 36], [36, 36 + cm]],                          // TL
          [[W - 36 - cm, 36], [W - 36, 36], [W - 36, 36 + cm]],              // TR
          [[36, H - 36 - cm], [36, H - 36], [36 + cm, H - 36]],              // BL
          [[W - 36 - cm, H - 36], [W - 36, H - 36], [W - 36, H - 36 - cm]], // BR
        ]
        corners.forEach(([start, corner, end]) => {
          ctx.beginPath()
          ctx.moveTo(...start)
          ctx.lineTo(...corner)
          ctx.lineTo(...end)
          ctx.stroke()
        })

        // Brand
        ctx.fillStyle = '#B6452F'
        ctx.font = 'bold 26px serif'
        ctx.textAlign = 'center'
        ctx.fillText('醒書故事', W / 2, 100)

        // Title
        ctx.fillStyle = '#2A2723'
        ctx.font = 'bold 38px serif'
        ctx.textAlign = 'center'
        let ty = 164
        titleLines.forEach(line => {
          ctx.fillText(line, W / 2, ty)
          ty += 54
        })
        ty += 20

        // Content full text（善选副本全文）
        ctx.fillStyle = '#4A453E'
        ctx.font = '27px sans-serif'
        ctx.textAlign = 'left'
        contentLines.forEach(line => {
          ctx.fillText(line, 60, ty)
          ty += 42
        })
        ty += 16

        // 配图（正文之下逐张等比绘制）
        posterImgs.forEach((img, i) => {
          ctx.drawImage(img, 60, ty, CW, imgHeights[i])
          ty += imgHeights[i] + 16
        })

        // Tags
        if (tags.length) {
          ctx.font = '22px sans-serif'
          let tx = 60
          tags.forEach(tag => {
            const tw = ctx.measureText(tag).width + 28
            ctx.fillStyle = 'rgba(126,102,64,0.08)'
            this._roundRect(ctx, tx, ty - 22, tw, 36, 6)
            ctx.fill()
            ctx.strokeStyle = 'rgba(126,102,64,0.3)'
            ctx.lineWidth = 1
            ctx.stroke()
            ctx.fillStyle = '#7E6640'
            ctx.fillText(tag, tx + 14, ty)
            tx += tw + 12
          })
        }

        // ── 底部品牌栏：醒书咨询原图，仅二维码区替换为带参小程序码 ──
        const fy = H - 34 - FOOT_H
        if (bannerImg) {
          ctx.drawImage(bannerImg, fx, fy, fw, FOOT_H)
        } else {
          ctx.fillStyle = BANNER_BG
          ctx.fillRect(fx, fy, fw, FOOT_H)
        }
        // 原图二维码区（比例坐标换算到画布），先用底色补丁盖住原码
        const oq = {
          x: fx + fw * BANNER_QR.x,
          y: fy + FOOT_H * BANNER_QR.y,
          w: fw * BANNER_QR.w,
          h: FOOT_H * BANNER_QR.h,
        }
        ctx.fillStyle = BANNER_BG
        ctx.fillRect(oq.x - 5, oq.y - 5, oq.w + 10, oq.h + 10)
        // 带参小程序码居中盖上（白底圆角衬托保证识别率）
        const qsize = Math.round(Math.max(oq.w, oq.h) * 1.1)
        const qx = Math.round(oq.x + oq.w / 2 - qsize / 2)
        const qy = Math.round(oq.y + oq.h / 2 - qsize / 2)
        ctx.fillStyle = '#FFFFFF'
        this._roundRect(ctx, qx - 4, qy - 4, qsize + 8, qsize + 8, 8)
        ctx.fill()
        const drawQrPlaceholder = () => {
          ctx.fillStyle = '#1E1A14'
          const c = qsize / 3
          ;[[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]].forEach(([r, col]) => {
            ctx.fillRect(qx + col * c, qy + r * c, c - 3, c - 3)
          })
        }
        const exportImage = () => {
          wx.canvasToTempFilePath({
            canvas,
            success: (r) => {
              wx.saveImageToPhotosAlbum({
                filePath: r.tempFilePath,
                success: () => { toast.success('已保存到相册'); this._recordShare() },
                fail: (err) => {
                  const msg = (err && err.errMsg) || ''
                  console.error('[poster] saveImageToPhotosAlbum fail:', msg)
                  // 各版本拒绝授权的文案不一（auth deny / authorize / denied / cancel）统一引导去设置
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
        }

        if (this._qrTempPath) {
          const img = canvas.createImage()
          img.onload = () => { ctx.drawImage(img, qx, qy, qsize, qsize); exportImage() }
          img.onerror = () => { drawQrPlaceholder(); exportImage() }
          img.src = this._qrTempPath
          return
        }
        drawQrPlaceholder()
        exportImage()
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
