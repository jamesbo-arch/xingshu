# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

"醒书日记"（Xingshu Diary）—— 一款带有社区互动和会员体系的微信小程序日记应用。最初在 `project/` 目录下以 HTML/CSS/JS 原型设计，然后在 `miniprogram/` 目录下实现。设计交接的聊天记录位于 `chats/chat1.md`。

应用有三种用户身份等级（`guest`、`authed`、`member`）和三种日记权限（`public`、`member`、`private`）。目前没有后端——所有状态存储在 `app.globalData` 中，由 `data/mock.js` 提供种子数据。

## 开发方式

在微信开发者工具中打开 `miniprogram/` 作为项目根目录。appid 为 `wx841de0568655b384`，基础库版本 `2.26.0`。

没有构建工具、代码检查工具或测试框架。项目为纯微信小程序原生代码——每个页面/组件包含四种文件：`.js`、`.json`、`.wxml`、`.wxss`。

## 架构

### 页面（共 6 个，4 个 tab 页 + 2 个非 tab 页）

| 页面 | 路由 | Tab | 用途 |
|------|-------|-----|---------|
| square | `pages/square/index` | 是 (0) | 醒书广场——公开+会员日记流，搜索、筛选 |
| collections | `pages/collections/index` | 是 (1) | 我的收藏——用户收藏的日记，支持搜索+筛选 |
| mine | `pages/mine/index` | 是 (2) | 我的日记——用户自己的日记，支持编辑/删除 |
| member | `pages/member/index` | 是 (3) | 会员中心——会员信息、购买流程、个人资料编辑 |
| detail | `pages/detail/index` | 否 | 日记详情——查看单篇日记及评论，点赞/收藏/分享 |
| compose | `pages/compose/index` | 否 | 写日记——新建/编辑日记表单，含标签和权限选择 |

### 共享组件

- **`diary-card`** — 列表中的单条日记卡片（头像、标签、权限标识、操作栏）。触发 `open`、`like`、`fav`、`edit`、`delete`、`share` 事件。在广场/收藏/我的日记列表中复用。点击♡时有 +1 浮动淡出动画（CSS `@keyframes like-float-up`）。
- **`filter-sheet`** — 底部筛选面板，包含标签选择、作者搜索和三种时间模式（快捷范围 / 起止日期 / 年月）。触发 `apply`（携带完整 filters 对象）和 `close` 事件。
- **`member-guard`** — 非会员点击会员专属内容时弹出的权限拦截弹窗。触发 `authorize` 和 `joinMember` 事件。已接入广场页和收藏页。
- **`poster-sheet`** — 分享海报底部弹窗，包含头像、摘要和保存/分享操作。已接入广场页、收藏页（`bind:share` on diary-card）和详情页（底部栏 ↑ 按钮）。

所有底部弹层（filter-sheet / poster-sheet / member-guard）均使用 `_mounted` + `_show` 双状态驱动动画：`visible` 为 true 时先挂载 DOM（`_mounted=true`），20ms 后加 `sheet-show` class 触发 slide-up；为 false 时先移除 class，300ms 后卸载 DOM，保证退场动画完整播放。

### 全局状态（`app.js` / `app.globalData`）

所有数据修改均通过 `App` 方法进行——页面不应直接修改 `globalData`：
- `toggleLike(id)` / `toggleFav(id)` — 切换状态并返回结果
- `addDiary(diary)` / `updateDiary(id, patch)` / `deleteDiary(id)` — 日记增删改
- `updateUser(patch)` — 将 patch 合并到当前用户

### 工具模块

- **`utils/filter.js`** — `applyFilters(diaries, mode, search, filters)`。mode（`square`/`collections`/`mine`）先按收藏/归属/可见性进行预筛选，再应用搜索关键词、标签、作者和时间筛选（快捷范围、日期范围或年月）。
- **`utils/color.js`** — `hueToColor(hue)` 根据色相值映射到暖土色系头像颜色。`getInitial(name)` 返回名字首字符作为头像兜底展示。
- **`utils/toast.js`** — 统一封装 `wx.showToast`：`success(title)`、`info(title, duration?)`、`error(title)`。

### 自定义 TabBar

`custom-tab-bar/` 实现了四 tab 导航栏。每个页面的 `onShow` 中调用 `this.getTabBar().setData({ selected: N })` 来同步当前选中态。

### 设计参考

`project/index.html` 是最终原型（主设计文件）。`chats/chat1.md` 中的聊天记录包含设计决策：温暖文艺的视觉风格，衬线字体标题，纸质感，印章风格标签，会员内容采用金色点缀，背景色为 `#FBF7EE` 暖纸色。
