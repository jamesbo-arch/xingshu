# 醒书日记小程序 — 后续工作计划

## 背景
原型设计（HTML）位于 `project/`，小程序实现位于 `miniprogram/`。设计交接记录位于 `chats/chat1.md`。

**已完成（截至 2026-05-18）：**
- 权限徽章图标（⊕/★/⊗）
- filter-sheet 关闭按钮/标签/时间 Tab 优化
- 浮层定位修复（fixed 定位在组件内失效）
- Tab Bar 毛玻璃效果、FAB 尺寸统一、头部多余会员芯片移除
- **1A** 详情页补全：分享按钮（↑）、poster-sheet 接入、评论输入框、评论/回复展示
- **1B** member-guard 接入：广场页、收藏页均已完整绑定
- **1C** 卡片分享流程：广场页、收藏页 diary-card → poster-sheet 链路全部打通
- **2A** 点赞浮动动画：+1 从图标处向上浮出淡出（CSS @keyframes）
- **2B** Sheet 弹出动画：filter-sheet / poster-sheet / member-guard 均有 slide-up 入场 + 遮罩淡入淡出
- **2C** Toast 工具封装：`utils/toast.js`（`success` / `info` / `error`）
- **3A** 海报图片导出：Canvas 2D 绘制 poster → `wx.saveImageToPhotosAlbum`，含相册权限申请/引导流程
- **3B** 撰写页 textarea：已确认 `auto-height` 属性已设置（compose/index.wxml:43）

当前整体完成度约 **98%**。

---

## 剩余（可选）

### 详情页头部滚动 blur
**文件：** `miniprogram/pages/detail/index.wxml|wxss|js`

- 滚动时 header 渐显 backdrop-blur 效果
- 需要自定义导航栏 + `onPageScroll` 监听，改动较大，视需求决定是否实现

---

## 关键文件速查

| 文件 | 说明 |
|---|---|
| `miniprogram/pages/detail/index.*` | 详情页 |
| `miniprogram/pages/square/index.*` | 广场页 |
| `miniprogram/pages/collections/index.*` | 收藏页 |
| `miniprogram/components/diary-card/index.*` | 卡片（点赞动效、分享触发） |
| `miniprogram/components/poster-sheet/index.*` | 海报弹层（含 canvas 导出） |
| `miniprogram/components/member-guard/index.*` | 会员拦截弹层 |
| `miniprogram/components/filter-sheet/index.*` | 筛选弹层 |
| `miniprogram/utils/toast.js` | Toast 工具（success/info/error） |
| `project/index.html` | 原型参考（主设计文件） |
