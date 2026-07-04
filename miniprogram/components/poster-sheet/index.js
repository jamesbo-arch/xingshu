const { hueToColor, getInitial } = require('../../utils/color')
const toast = require('../../utils/toast')
const { call } = require('../../api/request')

Component({
  // 允许 app.wxss 全局类（seal-tag/btn-primary/btn-ghost）穿透组件样式隔离
  options: { addGlobalClass: true },
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    diary: {
      type: Object,
      value: null,
    },
  },

  data: {
    _mounted: false,
    _show: false,
    avatarColor: '#8B7A4A',
    avatarInitial: '?',
    contentExcerpt: '',
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
    'diary': function(d) {
      if (d) {
        const lines = (d.content || '').split('\n').filter(l => l.trim())
        const excerpt = lines.slice(0, 5).join('\n')
        this.setData({
          avatarColor: hueToColor(d.author_avatar_hue || d.avatarHue || 60),
          avatarInitial: getInitial(d.author_name || d.author || '?'),
          contentExcerpt: excerpt,
          qrFileID: '',
        })
        this._qrTempPath = ''
        this._loadQr(d.id)
      }
    },
  },

  methods: {
    // v2.2 带参小程序码：scene 携带日记 ID + 当前用户（分享人）ID，失败静默回退占位
    async _loadQr(diaryId) {
      try {
        const app = getApp()
        const sharerId = (app.globalData.user || {}).id
        const res = await call('generateMiniCode', { diaryId, sharerId }, { showError: false })
        if (res && res.fileID) {
          this.setData({ qrFileID: res.fileID })
          const dl = await wx.cloud.downloadFile({ fileID: res.fileID })
          this._qrTempPath = dl.tempFilePath
        }
      } catch (e) {}
    },
    onMaskTap() {
      this.triggerEvent('close')
    },

    onSheetTap(e) {
      e.stopPropagation()
    },

    onSaveImage() {
      wx.getSetting({
        success: (res) => {
          if (res.authSetting['scope.writePhotosAlbum'] === false) {
            wx.showModal({
              title: '需要相册权限',
              content: '请在设置中允许"醒书日记"访问你的相册',
              confirmText: '去设置',
              cancelText: '取消',
              success: (r) => { if (r.confirm) wx.openSetting() },
            })
            return
          }
          this._renderAndSave()
        },
      })
    },

    _renderAndSave() {
      const d = this.data.diary
      if (!d) return

      const query = wx.createSelectorQuery().in(this)
      query.select('#poster-canvas').fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          toast.error('图片生成失败')
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const W = 640, H = 960
        canvas.width = W
        canvas.height = H

        // Background
        ctx.fillStyle = '#FFFCF5'
        ctx.fillRect(0, 0, W, H)

        // Dot grid
        ctx.fillStyle = 'rgba(126,102,64,0.05)'
        for (let x = 18; x < W; x += 18) {
          for (let y = 18; y < H; y += 18) {
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
        ctx.fillText('醒書日記', W / 2, 100)

        // Title
        ctx.fillStyle = '#2A2723'
        ctx.font = 'bold 38px serif'
        ctx.textAlign = 'center'
        let ty = 164
        this._splitText(ctx, d.title || '', W - 120).forEach(line => {
          ctx.fillText(line, W / 2, ty)
          ty += 54
        })
        ty += 20

        // Content excerpt
        ctx.fillStyle = '#4A453E'
        ctx.font = '27px sans-serif'
        ctx.textAlign = 'left'
        const rawLines = (this.data.contentExcerpt || '').split('\n').filter(l => l.trim())
        const contentLines = []
        rawLines.forEach(line => {
          contentLines.push(...this._splitText(ctx, line, W - 120))
        })
        contentLines.slice(0, 7).forEach(line => {
          ctx.fillText(line, 60, ty)
          ty += 42
        })
        ty += 16

        // Tags
        if (d.tags && d.tags.length) {
          ctx.font = '22px sans-serif'
          let tx = 60
          d.tags.slice(0, 4).forEach(tag => {
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
          ty += 40
        }

        // Divider
        ty += 16
        ctx.strokeStyle = 'rgba(126,102,64,0.15)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(60, ty)
        ctx.lineTo(W - 60, ty)
        ctx.stroke()
        ctx.fillStyle = 'rgba(126,102,64,0.35)'
        ctx.font = '18px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('◆', W / 2, ty + 5)
        ty += 40

        // Avatar
        ctx.fillStyle = this.data.avatarColor || '#8B7A4A'
        ctx.beginPath()
        ctx.arc(86, ty + 2, 26, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 26px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(this.data.avatarInitial || '?', 86, ty + 11)

        // Author name + time
        ctx.fillStyle = '#2A2723'
        ctx.font = 'bold 26px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(d.author_name || d.author || '', 128, ty)
        ctx.fillStyle = '#A8A39B'
        ctx.font = '21px sans-serif'
        ctx.fillText(d.created_at || d.time || '', 128, ty + 30)

        // QR：优先绘制真实带参小程序码（v2.2），失败回退占位块
        const qx = W - 110, qy = ty - 16
        const cell = 18
        const qrLabel = () => {
          ctx.fillStyle = '#A8A39B'
          ctx.font = '17px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('扫码阅读', qx + (cell * 3) / 2, qy + cell * 3 + 20)
        }
        const drawQrPlaceholder = () => {
          ctx.fillStyle = '#2A2723'
          ;[[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]].forEach(([r, c]) => {
            ctx.fillRect(qx + c * cell, qy + r * cell, cell - 2, cell - 2)
          })
          qrLabel()
        }
        const exportImage = () => {
          wx.canvasToTempFilePath({
            canvas,
            success: (r) => {
              wx.saveImageToPhotosAlbum({
                filePath: r.tempFilePath,
                success: () => toast.success('已保存到相册'),
                fail: (err) => {
                  const denied = err.errMsg && err.errMsg.indexOf('auth deny') >= 0
                  if (denied) {
                    wx.showModal({
                      title: '需要相册权限',
                      content: '请在设置中允许访问相册',
                      confirmText: '去设置',
                      success: (r2) => { if (r2.confirm) wx.openSetting() },
                    })
                  } else {
                    toast.error('保存失败，请重试')
                  }
                },
              })
            },
            fail: () => toast.error('图片生成失败'),
          }, this)
        }

        if (this._qrTempPath) {
          const img = canvas.createImage()
          img.onload = () => { ctx.drawImage(img, qx, qy, cell * 3, cell * 3); qrLabel(); exportImage() }
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

    onShareWechat() {
      toast.info('请使用右上角分享', 2000)
    },
  },
})
