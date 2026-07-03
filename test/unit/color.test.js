// utils/color.js 单元测试 — 色相映射与头像首字符
const { test } = require('node:test')
const assert = require('node:assert')
const { hueToColor, getInitial } = require('../../miniprogram/utils/color')

test('hueToColor：各区间映射到对应暖土色', () => {
  assert.strictEqual(hueToColor(0), '#8B5A5A')
  assert.strictEqual(hueToColor(45), '#8B7A4A')
  assert.strictEqual(hueToColor(120), '#4A8B5A')
  assert.strictEqual(hueToColor(359), '#8B4A72')
})

test('hueToColor：负值与超 360 的色相取模归一', () => {
  assert.strictEqual(hueToColor(-30), hueToColor(330))
  assert.strictEqual(hueToColor(400), hueToColor(40))
  assert.strictEqual(hueToColor(720), hueToColor(0))
})

test('getInitial：返回名字首字符，空值兜底为 ?', () => {
  assert.strictEqual(getInitial('砚秋'), '砚')
  assert.strictEqual(getInitial('Alice'), 'A')
  assert.strictEqual(getInitial(''), '?')
  assert.strictEqual(getInitial(null), '?')
})
