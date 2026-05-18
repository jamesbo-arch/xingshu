module.exports = {
  success(title) {
    wx.showToast({ title, icon: 'success', duration: 1500 })
  },
  info(title, duration = 1500) {
    wx.showToast({ title, icon: 'none', duration })
  },
  error(title) {
    wx.showToast({ title, icon: 'none', duration: 2000 })
  },
}
