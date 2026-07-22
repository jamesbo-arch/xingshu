// 备份文件加解密 — AES-256-GCM，密钥由 ADMIN_PASSWORD 经 scrypt 派生
//
// 云存储桶是「所有用户可读」（小程序显示头像/配图/视频所必需），备份含用户手机号、
// openid 等隐私数据，故落盘前必须加密。本模块同时被云函数与 scripts/ 下的本地脚本
// 使用（本地脚本 require 进本目录），确保加解密实现只有一份、不会漂移。
//
// 文件格式：magic(8) | salt(16) | iv(12) | authTag(16) | ciphertext
const crypto = require('crypto')

const MAGIC = Buffer.from('XSBAK\0\0\1')   // 末字节为格式版本号
const SALT_LEN = 16
const IV_LEN = 12
const TAG_LEN = 16
const KEY_LEN = 32

function deriveKey(password, salt) {
  if (!password) throw new Error('缺少 ADMIN_PASSWORD，无法派生备份密钥')
  return crypto.scryptSync(password, salt, KEY_LEN)
}

function encrypt(plain, password) {
  const salt = crypto.randomBytes(SALT_LEN)
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(password, salt), iv)
  const body = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body])
}

function decrypt(buf, password) {
  if (buf.length < MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN) throw new Error('备份文件已损坏（长度不足）')
  if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('不是本项目的备份文件（magic 不匹配）')
  let at = MAGIC.length
  const salt = buf.subarray(at, at += SALT_LEN)
  const iv = buf.subarray(at, at += IV_LEN)
  const tag = buf.subarray(at, at += TAG_LEN)
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(password, salt), iv)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(buf.subarray(at)), decipher.final()])
  } catch (e) {
    // GCM 校验失败：密码错，或密文被篡改/截断
    throw new Error('解密失败：ADMIN_PASSWORD 不匹配，或文件已损坏')
  }
}

module.exports = { encrypt, decrypt }
