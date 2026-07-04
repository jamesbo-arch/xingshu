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

应用有三种用户身份等级（`guest`、`authed`、`member`）和三种日记权限（`public`、`member`、`private`）。后端采用腾讯 CloudBase 云函数（22 个）+ MySQL 数据库（9 张表，通过 cpolar 隧道 `33.tcp.cpolar.top:11028` 连接）。身份认证（PRD v2.3）：微信登录半屏弹窗（`components/login-sheet`）仅获取 openid/unionid，登录后升级为 `authed`，不涉及手机号；会员通过线下转账 + 管理员手动确认激活；会员中心可退出登录（回退 guest，重新登录恢复会员）。`data/mock.js` 仅保留作为设计参考，不再用于运行时数据。

## 开发方式

在微信开发者工具中打开 `miniprogram/` 作为项目根目录。appid 为 `wx841de0568655b384`，基础库版本 `2.26.0`。

项目为纯微信小程序原生代码——每个页面/组件包含四种文件：`.js`、`.json`、`.wxml`、`.wxss`。

`miniprogram/project.private.config.json` 由微信开发者工具本地生成（含个人 libVersion、compileHotReLoad 等设置），**不得纳入 Git 追踪**，已在 `.gitignore` 中排除。

## Git 提交规则

**`.claude/` 目录（含 agents、skills、settings）必须纳入 Git 追踪并在每次变更后推送。** 这些文件是项目开发环境的重要组成部分，与源代码等同对待。（开发日志 `doc/devlog.md` 与开发计划 `doc/fullstack-plan.md` 已于 2026-07-04 迁出 `.claude/`，见「开发日志维护」。）

**每完成一个 Phase 后**：推送当前分支 → 创建下一 Phase 分支（如 `phase4` → `phase5`）→ 切换到新分支继续开发。

## Subagent 协作体系

本项目配置了 7 个专业 subagent 用于团队协作式开发，定义文件位于 `.claude/agents/`：

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

每次完成实质性开发工作（写代码、改配置、修 bug、部署、安装依赖等）后，**必须在 `doc/devlog.md` 末尾追加日志记录**。格式如下：

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

每完成计划文件（`doc/fullstack-plan.md`）中的一个步骤时，在 devlog 中记录并将计划对应项的 `[ ]` 改为 `[x]`。

> 说明：`devlog.md` 与 `fullstack-plan.md` 于 2026-07-04 从 `.claude/plans/` 迁至 `doc/`（`.claude/` 目录写入受宿主安全门保护会逐次弹确认，迁出后追加日志/更新计划不再打断）。历史 devlog 条目中旧的 `.claude/plans/...` 路径为当时记录，保留不改。

## 架构

### 页面（共 8 个，5 个 tab 页 + 3 个非 tab 页）

| 页面 | 路由 | Tab | 用途 |
|------|-------|-----|---------|
| square | `pages/square/index` | 是 (0) | 醒书广场——公开+会员日记流，搜索、筛选 |
| activities | `pages/activities/index` | 是 (1) | 醒书活动——活动列表（近期预告/往期回顾，M1.5 新增） |
| collections | `pages/collections/index` | 是 (2) | 我的收藏——用户收藏的日记，支持搜索+筛选 |
| mine | `pages/mine/index` | 是 (3) | 我的日记——用户自己的日记，支持编辑/删除 |
| member | `pages/member/index` | 是 (4) | 会员中心——会员信息、购买流程、个人资料编辑、设置（退出登录） |
| detail | `pages/detail/index` | 否 | 日记详情——查看单篇日记及评论，点赞/收藏/分享 |
| compose | `pages/compose/index` | 否 | 写日记——新建/编辑日记表单，含标签和权限选择 |
| activity-detail | `pages/activity-detail/index` | 否 | 活动详情——图文详情、报名/取消、活动海报（M1.5 新增） |

原 `pages/auth`（手机号验证页）已于 PRD v2.3 废除，登录改为 `components/login-sheet` 半屏弹窗（仅取 openid/unionid，不涉及手机号）。

### 共享组件

- **`diary-card`** — 列表中的单条日记卡片（头像、标签、权限标识、操作栏）。触发 `open`、`like`、`fav`、`edit`、`delete`、`share` 事件。在广场/收藏/我的日记列表中复用。点击♡时有 +1 浮动淡出动画（CSS `@keyframes like-float-up`）。
- **`filter-sheet`** — 底部筛选面板，包含标签选择、作者搜索和三种时间模式（快捷范围 / 起止日期 / 年月）。触发 `apply`（携带完整 filters 对象）和 `close` 事件。
- **`member-guard`** — 非会员点击会员专属内容时弹出的权限拦截弹窗。触发 `authorize` 和 `joinMember` 事件。已接入广场页和收藏页。
- **`poster-sheet`** — 分享海报底部弹窗，包含头像、摘要和保存/分享操作。已接入广场页、收藏页（`bind:share` on diary-card）和详情页（底部栏 ↑ 按钮）。
- **`login-sheet`** — v2.3 微信登录半屏弹窗（协议勾选 + 微信图标登录，仅取 openid/unionid）。由 `utils/auth-guard.js` 的 `ensureLogin(page, action)` 拉起，登录成功自动续做原操作。已接入广场/日记详情/活动详情/会员中心。

所有底部弹层（filter-sheet / poster-sheet / member-guard / login-sheet）均使用 `_mounted` + `_show` 双状态驱动动画：`visible` 为 true 时先挂载 DOM（`_mounted=true`），20ms 后加 `sheet-show` class 触发 slide-up；为 false 时先移除 class，300ms 后卸载 DOM，保证退场动画完整播放。

### 全局状态（`app.js` / `app.globalData`）

所有数据修改均通过 `App` 方法进行——页面不应直接修改 `globalData`：
- `toggleLike(id)` / `toggleFav(id)` — 切换状态并返回结果
- `addDiary(diary)` / `updateDiary(id, patch)` / `deleteDiary(id)` — 日记增删改
- `updateUser(patch)` — 将 patch 合并到当前用户

### API 封装层（`miniprogram/api/`）

前端与云函数之间的桥梁，统一通过 `wx.cloud.callFunction` 调用：

| 文件 | 职责 |
|------|------|
| `request.js` | 核心封装——`call(name, data, options?)`，统一处理 `{code, data, msg}` 响应格式，code≠0 时自动 toast 错误 |
| `user.js` | `login` / `getUserInfo` / `updateProfile` / `checkMember` |
| `diary.js` | `getList` / `getDetail` / `create` / `update` / `remove` |
| `social.js` | `toggleLike` / `toggleFav` / `createComment` / `getComments` / `deleteComment` |
| `tag.js` | `getAll` / `add` |

所有 API 文件均通过 `mapper.js` 将 MySQL 行转为前端 camelCase 格式后再返回。

### 工具模块

- **`utils/filter.js`** — `applyFilters(diaries, mode, search, filters)`。mode（`square`/`collections`/`mine`）先按收藏/归属/可见性进行预筛选，再应用搜索关键词、标签、作者和时间筛选（快捷范围、日期范围或年月）。
- **`utils/mapper.js`** — MySQL `snake_case` ↔ 前端 `camelCase` 字段映射。`toDiary(dbRow)`、`toComment(dbRow)`、`toUser(dbRow)` 等函数将数据库行转为前端格式；反向映射 `fromDiary(data)` 用于写入。所有 API 层（`api/`）均先通过 mapper 再做返回。
- **`utils/color.js`** — `hueToColor(hue)` 根据色相值映射到暖土色系头像颜色。`getInitial(name)` 返回名字首字符作为头像兜底展示。
- **`utils/toast.js`** — 统一封装 `wx.showToast`：`success(title)`、`info(title, duration?)`、`error(title)`。

### 测试

统一入口为根目录 `npm test`（Loop Engineering 的验证闭环，任一失败即退出码非 0）：

```bash
npm test          # 全量：连通性检查 → 单测 + API + 冒烟/回环 + admin/活动/权限/推荐人/授权/评论/标签，共 114 条
npm run test:unit # 仅 utils 纯函数单测（node:test，不依赖数据库）
npm run test:e2e  # 20 条端到端流程测试（含写库与清理）
node test/seed.js       # 向 MySQL 插入种子数据
node test/reset-user.js # 列出所有用户；带 <openid> 参数重置指定用户为 guest（开发调试用）
```

关键测试文件：
- `test/ping-db.js` — 数据库连通性检查，隧道不可达时 5 秒内失败并给出指引。**自动化循环遇到此失败应停止并报告，而非重试。**
- `test/unit/*.test.js` — `utils/`（filter/mapper/color）纯函数单测，使用 Node 内置 `node:test`
- `test/fn-harness.js` — 云函数本地调用 harness：拦截 `wx-server-sdk` 注入可控 OPENID，云函数代码无需部署即可本地真实执行
- `test/fn-smoke-test.js` — 基于 harness 的只读冒烟测试（getTags / getDiaryList / getUserInfo）
- `test/fn-roundtrip-test.js` — 日记 CRUD 写入回环（含 images），测试数据自动清理
- `test/fn-admin-test.js` — admin 云函数测试（鉴权、数据形状、删除联动清理）

测试依赖根目录的 `mysql2`（根 `package.json` 唯一依赖），首次运行前需在仓库根目录 `npm install`。

测试文档：
- `test/checklist.md` — 回归测试清单（3×3 权限矩阵 + 6 页面 + 组件动画）
- `test/frontend-test-cases.md` — 前端测试用例（40+ 条，含 P0/P1/P2 优先级）
- `test/m15-test-cases.md` — M1.5 首发功能包验收用例（活动/权限矩阵/推荐人，自动化用例与 fn-*-test 文件一一对应，是 Loop 开发的验收规格）
- `test/常用测试指令.md` — 常用测试命令速查

### CloudBase 云函数

**环境 ID**：`cloud1-1gpabyik2db3478f`（在 `app.js` 中通过 `wx.cloud.init` 初始化，根目录 `cloudbaserc.json` 也指向同一环境）。早期 Phase 1 曾使用 `awakebook-env-1g0oford0bea44cc`（已于 Phase 6 弃用，勿再使用）。

**云函数目录**：`miniprogram/cloudfunctions/` 下共 23 个云函数——22 个小程序端（按类别分组见完整计划 `doc/fullstack-plan.md` Phase 2）+ 1 个管理端 `admin`（action 路由统一入口，供 Web 后台调用，不依赖 wx-server-sdk）。

**数据库连接配置（唯一来源：根目录 `.env`）**：每个云函数目录下的 `db.js`（及 admin 的 `secret.js`）由 `npm run sync-db`（`scripts/sync-db-config.js`）从 `.env` 生成，**已从 Git 追踪中排除，勿手改、勿提交**。修改连接信息（如 cpolar 隧道地址变更）或管理员密码的流程：改 `.env` → `npm run sync-db` → 重新部署云函数。测试脚本统一通过 `config/db.js` 读取同一份 `.env`。当前连接目标为 `33.tcp.cpolar.top:11028/xingshu_dev`。新 clone 仓库后需先复制 `.env.example` 为 `.env` 并运行 `npm run sync-db`。

### 管理后台

`admin/` 是 Vue 3 + Vite 独立 Web 应用（7 个页面：Login / Dashboard / Users / UserDetail / Diaries / DiaryDetail / Interactions），UI 配色为深蓝主色 `#3578F6`。

**已对接真实数据**：`src/api/index.js` 通过 `@cloudbase/js-sdk`（匿名登录，**需在 TCB 控制台开启**）调用 `admin` 云函数（action 路由）。鉴权为密码登录：密码存根目录 `.env` 的 `ADMIN_PASSWORD`，经 `npm run sync-db` 生成到云函数的 `secret.js`（不入 Git）；登录换取 12h 有效的 HMAC token 存 localStorage。删除操作会写 `admin_logs` 审计并联动清理互动数据。

```bash
cd admin
npm install       # 首次
npm run dev       # 本地开发服务器
npm run build     # 构建产物
```

### 设计参考

`project/index.html` 是最终原型（主设计文件）。`chats/chat1.md` 中的聊天记录包含设计决策：温暖文艺的视觉风格，衬线字体标题，纸质感，印章风格标签，会员内容采用金色点缀，背景色为 `#FBF7EE` 暖纸色。

产品需求文档位于 `doc/醒书日记小程序及管理后台PRD文档.md`，原型设计资料位于 `doc/醒书日记-原型设计/`。
