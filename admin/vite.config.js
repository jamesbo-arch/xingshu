import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 构建时间戳：注入侧边栏，用来一眼判断手上这份是不是刚部署的那版。
// hosting deploy 不删旧文件，浏览器一旦缓存了旧 index.html 就能整套加载旧分块、
// 页面看起来毫无异常——没有这个戳，「到底刷没刷新」只能靠翻 Network 面板比对分块哈希。
const BUILD_AT = new Date().toLocaleString('zh-CN', {
  timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  define: { __BUILD_AT__: JSON.stringify(BUILD_AT) },
})
