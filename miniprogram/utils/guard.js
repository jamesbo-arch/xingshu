// 防连点工具（避免连续点击造成重复提交 / 重复打开页面）
//
// lock(ctx, key, task)：异步提交防重——同一 ctx（页面或组件）上 key 对应的
//   操作在完成前，重复触发直接忽略。task 为返回 Promise 的函数。
// throttle(ctx, key, fn, cooldown)：同步动作（导航、打开相册等）防连点——
//   cooldown 毫秒内的重复触发忽略，默认 600ms。
//
// ctx 只需是一个可挂属性的对象（Page/Component 的 this 均可）。

async function lock(ctx, key, task) {
  ctx._locks = ctx._locks || {}
  if (ctx._locks[key]) return
  ctx._locks[key] = true
  try {
    return await task()
  } finally {
    ctx._locks[key] = false
  }
}

function throttle(ctx, key, fn, cooldown = 600) {
  ctx._throttle = ctx._throttle || {}
  const now = Date.now()
  if (now - (ctx._throttle[key] || 0) < cooldown) return
  ctx._throttle[key] = now
  return fn()
}

module.exports = { lock, throttle }
