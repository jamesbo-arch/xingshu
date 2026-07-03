// 云函数本地调用 harness — 拦截 wx-server-sdk，注入可控的 OPENID
// 使云函数 index.js 无需部署即可在本地 Node 中真实执行（db.js 走真实 MySQL）
const Module = require('module')
const path = require('path')

const ctx = { OPENID: '', APPID: 'local-test', UNIONID: '' }

const fakeCloud = {
  DYNAMIC_CURRENT_ENV: 'local-test-env',
  init() {},
  getWXContext: () => ({ ...ctx }),
}

const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return fakeCloud
  return origLoad.apply(this, arguments)
}

/**
 * 以指定 openid 身份调用云函数
 * @param {string} name  云函数目录名（如 'getTags'）
 * @param {object} event 事件参数
 * @param {string} openid 模拟的调用者 OPENID（'' 表示未注册的游客）
 * @param {string} unionid 模拟的 UNIONID（v2.3 登录链路用，默认空）
 */
function callFn(name, event = {}, openid = '', unionid = '') {
  ctx.OPENID = openid
  ctx.UNIONID = unionid
  const fn = require(path.join(__dirname, '..', 'miniprogram', 'cloudfunctions', name, 'index.js'))
  return fn.main(event, {})
}

module.exports = { callFn }
