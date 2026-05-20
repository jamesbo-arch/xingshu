# CLAUDE.md

本文件为 Claude Code 提供项目级行为指引。前半部分为通用编码规范（源自 Andrej Karpathy 的最佳实践），后半部分为项目专属信息。

---

## 编码行为规范

> 这些规范旨在减少 LLM 编码中的常见错误。倾向于谨慎而非速度——对琐碎任务可灵活把握。
> 规范生效的标志：diff 中不必要的变更减少、因过度复杂化导致的返工减少、澄清性问题在犯错之前提出。

### 1. 先想后写

**不要假设。不要掩盖困惑。暴露权衡。**

写代码之前：
- 明确陈述你的假设，不确定时主动询问
- 遇到模糊需求时，列出多种解读供选择，而非默默选定一种
- 当存在更简单的方案时，主动指出
- 不清楚时停下来，说出让你困惑的地方

### 2. 简洁优先

**用最少代码解决问题。不写任何推测性代码。**

- 不添加需求之外的任何功能
- 不为单次使用的代码创建抽象
- 不添加未被要求的"灵活性"或"可配置性"
- 不为不发生的场景添加错误处理
- 如果 200 行可以写成 50 行，重写它

**自检问题**：资深工程师看到这段代码会说"过度复杂"吗？如果是，简化。

### 3. 外科手术式修改

**只碰必须改的。只清理你自己的脏代码。**

修改已有代码时：
- 不要顺手"优化"相邻代码、注释、或格式
- 不要重构没有坏的东西
- 匹配已有代码风格，即使你本来会用不同写法
- 看到无关的死代码可以提出来，但不要擅自删除

当你的改动导致某些东西不再使用：
- 只移除**你的改动**导致的不再使用的东西
- 不要删除已有的死代码，除非用户明确要求

**检验标准**：每行被修改的代码，都应该能直接追溯到用户的需求。

### 4. 目标驱动执行

**定义成功的可验证标准。循环迭代直到验证通过。**

将任务转化为可验证的目标：
| 模糊任务 | 转化为 |
|---|---|
| "加个验证" | 先写无效输入的测试 → 确保测试失败 → 实现 → 确认测试通过 |
| "修这个 bug" | 先写可复现的测试 → 确保失败 → 修复 → 确认通过 |
| "重构 X" | 重构前后测试均通过 |

多步骤任务格式：
```
1. [步骤] → 验证: [检查项]
2. [步骤] → 验证: [检查项]  
3. [步骤] → 验证: [检查项]
```

弱的成功标准（"让它能用"）需要不断澄清，强的成功标准（"重构前后测试均绿色"）让你可以独立推进。

---

## 项目概述

"醒书日记"（Xingshu Diary）—— 一款带有社区互动和会员体系的微信小程序日记应用。最初在 `project/` 目录下以 HTML/CSS/JS 原型设计，然后在 `miniprogram/` 目录下实现。设计交接的聊天记录位于 `chats/chat1.md`。

应用有三种用户身份等级（`guest`、`authed`、`member`）和三种日记权限（`public`、`member`、`private`）。目前没有后端——所有状态存储在 `app.globalData` 中，由 `data/mock.js` 提供种子数据。

## 开发方式

在微信开发者工具中打开 `miniprogram/` 作为项目根目录。appid 为 `wx841de0568655b384`，基础库版本 `2.26.0`。

没有构建工具、代码检查工具或测试框架。项目为纯微信小程序原生代码——每个页面/组件包含四种文件：`.js`、`.json`、`.wxml`、`.wxss`。

## Subagent 协作体系

本项目配置了 7 个专业 subagent 用于团队协作式开发，定义文件位于 `.claude/plans/`：

| Agent | 文件 | 角色 |
|-------|------|------|
| **PM** | `pm-agent.md` | 项目经理——用户唯一接口，负责任务拆解与分派 |
| **Product** | `product-agent.md` | 资深小程序产品经理——功能设计、UX 规划 |
| **Architecture** | `architecture-agent.md` | 资深技术架构师——组件设计、数据流、后端集成方案 |
| **Frontend** | `frontend-agent.md` | 资深前端开发——WXML/WXSS/JS 实现、动画、API 调用 |
| **Backend** | `backend-agent.md` | 资深后端开发——CloudBase 云函数、数据库、鉴权 |
| **QA** | `qa-agent.md` | 资深测试——用例设计、边界覆盖、Bug 报告 |
| **CI/CD** | `cicd-agent.md` | 部署工程师——版本管理、审核提交、发布流程 |

### 协作流程

```
用户 → PM（拆解任务）→ 分派给专业 agent → PM（审核输出）→ 汇总报告给用户
```

### 已安装 Skills

- `miniprogram-development` — 微信小程序开发全流程
- `auth-wechat-miniprogram` — 微信登录鉴权
- `cloudbase-document-database-in-wechat-miniprogram` — CloudBase 文档数据库

## 开发日志维护（强制）

每次完成实质性开发工作（写代码、改配置、修 bug、部署、安装依赖等）后，**必须在 `.claude/plans/devlog.md` 末尾追加日志记录**。格式如下：

```markdown
### YYYY-MM-DD HH:MM — [简短标题]

**类型**：[前端 | 后端 | 数据库 | 云函数 | 测试 | 部署 | 配置 | 文档]
**计划关联**：Phase X.Y — [关联的计划步骤]
**修改文件**：
- `path/file.ext` — 变更摘要

**变更说明**：
[详细描述做了什么]

**验证**：
[如何确认变更正确]
```

每完成计划文件（`.claude/plans/fullstack-plan.md`）中的一个步骤时，在 devlog 中记录并将计划对应项的 `[ ]` 改为 `[x]`。

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
