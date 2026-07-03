# 开发日志 (Development Log)

> 记录醒书日记项目所有实质性开发操作。每完成一个步骤或修复一个问题后更新。

---

## 日志格式规范

每次记录遵循以下格式：

```markdown
### YYYY-MM-DD HH:MM — [标题]

**类型**：[前端 | 后端 | 数据库 | 云函数 | 测试 | 部署 | 配置 | 文档]
**模型**：[模型名称]
**Agent**：[PM → Architecture / Backend / Frontend / QA / CI/CD]
**计划关联**：Phase X.Y — [计划步骤描述]
**修改文件**：
- `path/file.ext` — 变更摘要

**变更说明**：
[详细描述做了什么]

**验证**：
[如何确认变更正确]
```

---

## 日志

### 2026-05-18 — 项目初始分析

**类型**：文档
**模型**：Claude Opus 4.7 (claude.ai/code)
**Agent**：PM → Architecture
**计划关联**：Phase 0 — 项目现状分析
**修改文件**：
- `.claude/plans/fullstack-plan.md` — 新建

**变更说明**：
完成项目全栈分析。前端 UI 完成度 ~98%（对标设计原型），后端基础设施 0%。创建了完整的 7 阶段全栈开发计划，涵盖 CloudBase 架构、文档/关系数据库设计、Redis 缓存 key 设计、云函数清单、前端改造方案、管理后台设计和部署上线流程。

**验证**：
计划文件已通过计划模式审批并写入 `.claude/plans/fullstack-plan.md`。

---

### 2026-05-18 — 建立 7 角色 Subagent 协作体系

**类型**：配置
**模型**：deepseek-v4-pro
**Agent**：PM
**计划关联**：Phase 0 — 开发工具链准备
**修改文件**：
- `.claude/agents/pm-agent.md` — PM 编排器
- `.claude/agents/product-agent.md` — 产品经理
- `.claude/agents/architecture-agent.md` — 技术架构师
- `.claude/agents/frontend-agent.md` — 前端开发
- `.claude/agents/backend-agent.md` — 后端开发
- `.claude/agents/qa-agent.md` — 测试
- `.claude/agents/cicd-agent.md` — CI/CD 部署
- `.claude/skills/miniprogram-development` — 微信小程序开发 skill
- `.claude/skills/auth-wechat-miniprogram` — 微信鉴权 skill
- `.claude/skills/cloudbase-document-database-in-wechat-miniprogram` — CloudBase 数据库 skill
- `CLAUDE.md` — 更新 subagent 使用指南

**变更说明**：
建立了完整的 7 角色 subagent 协作体系，定义每个角色的专长领域、触发条件、可用工具和输出格式。从 skills 生态安装了 3 个腾讯 CloudBase 技能包到项目本地。

**验证**：
所有 agent 定义文件和 skills 目录已创建，推送到 dev 分支。

---

### 2026-05-18 — 定义开发日志规则

**类型**：文档 / 配置
**模型**：deepseek-v4-pro
**Agent**：PM
**计划关联**：Phase 0 — 开发工具链准备
**修改文件**：
- `.claude/plans/devlog.md` — 新建
- `CLAUDE.md` — 添加开发日志维护规则

**变更说明**：
创建开发日志文件并定义标准记录格式（日期、类型、计划关联、修改文件、变更说明、验证）。在 CLAUDE.md 中新增规则：每次完成实际开发工作后自动更新 devlog.md。

**验证**：
规则已写入 CLAUDE.md，本记录即第一条按格式记录的开发日志。无需额外验证。

---

### 2026-05-20 13:50 — Phase 1.1 基础设施初始化

**类型**：配置 / 后端
**模型**：deepseek-v4-pro
**Agent**：PM → Backend + CI/CD
**计划关联**：Phase 1.1.2 / 1.1.3 / 1.1.4 — TCB 环境初始化
**修改文件**：
- `miniprogram/cloudfunctions/.gitkeep` — 新建云函数目录
- `miniprogram/project.config.json` — 添加 `cloudfunctionRoot: "cloudfunctions/"`
- `miniprogram/app.js` — `onLaunch` 中初始化 `wx.cloud.init({ env: 'xingshu-XXXXXX', traceUser: true })`

**变更说明**：
创建了云函数根目录并配置微信开发者工具识别云函数路径。在 app.js 入口注入 CloudBase 初始化代码（envId 使用占位符 `xingshu-XXXXXX`，待用户创建 TCB 环境后替换真实 envId）。1.1.1（TCB 环境开通）需用户在腾讯云控制台手动完成。

**验证**：
- `project.config.json` 中 `cloudfunctionRoot` 字段已添加
- `app.js` 中 `wx.cloud.init` 调用已注入 onLaunch
- `cloudfunctions/` 目录已创建，含 `.gitkeep` 确保 git 追踪

---

### 2026-05-20 14:00 — Phase 1.1.1 完成 + 1.2/1.3 设计就绪

**类型**：配置 / 数据库
**模型**：deepseek-v4-pro
**Agent**：PM → Backend
**计划关联**：Phase 1.1.1 / 1.2 / 1.3
**修改文件**：
- `miniprogram/app.js` — envId 替换为 `awakebook-env-1g0oford0bea44cc`
- `.claude/plans/fullstack-plan.md` — 标记 1.1.1 完成

**变更说明**：
用户提供了 TCB 环境 ID，已更新 app.js 中的 `wx.cloud.init` 配置。Phase 1.2（文档 DB 6 集合、MySQL 3 表）和 1.3（Redis 10 组缓存 key）的完整 schema 已在 fullstack-plan.md 中设计完毕。下一步需在 TCB 控制台创建集合，或通过 Phase 2 的第一个云函数自动创建。

**验证**：
- `wx.cloud.init` env 参数已设置为真实环境 ID
- 数据库 schema 设计文档完整，待 TCB 控制台或云函数执行创建

---

### 2026-05-20 14:30 — Phase 1.2 数据库集合与索引创建

**类型**：数据库
**模型**：deepseek-v4-pro
**Agent**：PM → Backend
**计划关联**：Phase 1.2 — 文档数据库集合与索引
**操作工具**：TCB CLI (`tcb db nosql execute`)

**变更说明**：
通过 TCB CLI 连接 `awakebook-env-1g0oford0bea44cc`，完成了以下操作：

1. **创建 6 个集合**：`users`、`diaries`、`comments`、`interactions`、`tags`、`orders`

2. **创建 4 组索引**：
   - `diaries._openid` 升序索引
   - `diaries.permission` + `diaries.createdAt` 降序复合索引
   - `diaries.tags` 数组索引
   - `comments.diaryId` + `comments.createdAt` 降序复合索引
   - `interactions._openid` + `interactions.targetId` + `interactions.action` 唯一复合索引

3. **种子数据**：写入 20 个默认标签到 `tags` 集合（与 mock.js 同步）

**验证**：
- 所有集合创建成功（insert 返回 ok）
- 所有索引创建成功（createIndexes 返回 ok）
- 20 个标签文档已写入 tags 集合

---

### 2026-05-20 14:50 — 架构切换至纯 MySQL

**类型**：数据库 / 架构
**模型**：deepseek-v4-pro
**Agent**：PM → Architecture + Backend
**计划关联**：Phase 1.2 — 数据库设计（架构变更）
**修改文件**：
- `.claude/plans/fullstack-plan.md` — 架构图重绘，文档 DB → 纯 MySQL
- `miniprogram/cloudfunctions/common/db.js` — 新建共享连接池模块

**变更说明**：
用户提供 cpolar MySQL 数据库（`33.tcp.cpolar.top:11028/xingshu_dev`）。经分析，项目数据为强关系型（users→diaries→comments，interactions，orders），更适合 MySQL。

完成操作：
1. 通过 mysql2 连接并执行完整 DDL，创建 9 张表：`users`、`tags`、`diaries`、`diary_tags`、`comments`、`interactions`、`orders`、`payment_logs`、`admin_logs`
2. 所有表含外键约束、索引、InnoDB 引擎、utf8mb4 字符集
3. `diary_tags` 为 diaries↔tags 多对多关联表
4. `comments.parent_id` 自引用外键支持嵌套回复
5. `interactions` 含唯一复合索引防重复点赞/收藏
6. 20 个默认标签写入 `tags` 表
7. 创建 `cloudfunctions/common/db.js` 连接池模块供云函数共用
8. 计划文件架构图更新：纯 MySQL + 云函数(mysql2) + 云存储

**验证**：
- 9 张表 `SHOW TABLES` 确认存在
- 外键约束已定义（users→diaries→comments 级联删除）
- 连接池配置就绪，云函数可通过 `require('../common/db.js')` 使用
- 已清理 TCB 文档 DB 中不再使用的 6 个集合（users, diaries, comments, interactions, tags, orders）

---

### 2026-05-20 15:00 — MySQL 统一增加 created_by / updated_by 审计字段

**类型**：数据库
**模型**：deepseek-v4-pro
**Agent**：PM → Backend
**计划关联**：Phase 1.2 — 数据库规范完善
**修改文件**：
- MySQL 9 张表 — 全部新增审计字段

**变更说明**：
为所有业务表统一增加 `created_by` 和 `updated_by` 字段，形成审计规范：
- `users` — created_by/updated_by (OpenID), 记录注册和管理员修改人
- `tags` — created_by/updated_by (OpenID), 记录标签创建/修改人
- `diaries` — created_by/updated_by (user_id), 日记归属 + 修改记录
- `diary_tags` — created_by (user_id), 记录标签关联时间
- `comments` — created_by/updated_by (user_id)
- `interactions` — created_by (user_id), 记录操作人
- `orders` — updated_by (OpenID), 订单修改追溯
- `payment_logs` — created_by (OpenID), 支付操作人
- `admin_logs` — updated_by (OpenID), 管理员操作修改追溯

**验证**：
- `INFORMATION_SCHEMA.COLUMNS` 确认全部 9 张表均具有 created_at / updated_at / created_by / updated_by 四个审计字段

---

### 2026-05-20 16:30 — PRD 评审 + Schema 补充 + Plan 调整

**类型**：数据库 / 文档
**模型**：deepseek-v4-pro
**Agent**：PM → Architecture + Backend
**计划关联**：Phase 1.2 补充 + 全计划调整
**修改文件**：
- MySQL — users 表新增 `registered_at`, `last_active`
- MySQL — diaries 表新增 `status` (active/deleted)
- MySQL — orders 表新增 `plan`, `valid_from`, `valid_until`, `note`
- `.claude/plans/fullstack-plan.md` — 管理后台扩编、微信支付移除、timeline 调整

**变更说明**：
1. 用户提供了 `doc/` 下 PRD 和原型设计文档，全面评审后做出以下调整：

2. **Schema 补充**：
   - `users.registered_at` / `users.last_active` — 管理后台需要注册时间和活跃度追踪
   - `diaries.status` ENUM('active','deleted') — 管理后台逻辑删除标记
   - `orders.plan` / `valid_from` / `valid_until` / `note` — 丰富订单信息

3. **Plan 调整**：
   - Phase 4（管理后台）从简要描述扩展为完整独立 Web 应用（Vue 3 + Vite），
     包含：KPI 看板 + 4 大模块 CRUD（用户/日记/评论/订单）+ 筛选/分页/导出
   - 微信在线支付明确排除，保留线下转账 + 管理员手动确认模式
   - 配色方案保持原有暖纸色系（`#FBF7EE`），不采用 PRD 中的淡蓝主色
   - 里程碑时间延长 2 周以适配管理后台规模

**验证**：
- `INFORMATION_SCHEMA.COLUMNS` 确认 3 张表的 8 个新字段已就位

---

### 2026-05-20 17:00 — Phase 2 云函数全部完成

**类型**：云函数 / 后端
**模型**：deepseek-v4-pro
**Agent**：PM → Backend
**计划关联**：Phase 2.1 ~ 2.6
**修改文件**：
- `miniprogram/cloudfunctions/login/index.js` + `package.json`
- `miniprogram/cloudfunctions/getUserInfo/index.js` + `package.json`
- `miniprogram/cloudfunctions/updateUserProfile/index.js` + `package.json`
- `miniprogram/cloudfunctions/createDiary/index.js` + `package.json`
- `miniprogram/cloudfunctions/updateDiary/index.js` + `package.json`
- `miniprogram/cloudfunctions/deleteDiary/index.js` + `package.json`
- `miniprogram/cloudfunctions/getDiaryList/index.js` + `package.json`
- `miniprogram/cloudfunctions/getDiaryDetail/index.js` + `package.json`
- `miniprogram/cloudfunctions/toggleLike/index.js` + `package.json`
- `miniprogram/cloudfunctions/toggleFavorite/index.js` + `package.json`
- `miniprogram/cloudfunctions/createComment/index.js` + `package.json`
- `miniprogram/cloudfunctions/getComments/index.js` + `package.json`
- `miniprogram/cloudfunctions/deleteComment/index.js` + `package.json`
- `miniprogram/cloudfunctions/createOrder/index.js` + `package.json`
- `miniprogram/cloudfunctions/getOrderList/index.js` + `package.json`
- `miniprogram/cloudfunctions/checkMemberStatus/index.js` + `package.json`
- `miniprogram/cloudfunctions/activateMember/index.js` + `package.json`
- `miniprogram/cloudfunctions/getTags/index.js` + `package.json`
- `miniprogram/cloudfunctions/addTag/index.js` + `package.json`
- `miniprogram/cloudfunctions/updateTag/index.js` + `package.json`
- `miniprogram/cloudfunctions/generateMiniCode/index.js` + `package.json`

**变更说明**：
完成全部 20 个云函数开发（21 个函数目录含 1 个 common 工具模块）。架构遵循：
- 统一 `{ code: 0, data }` / `{ code: -1, msg }` 响应格式
- 所有用户操作通过 `cloud.getWXContext().OPENID` 获取身份
- MySQL 事务用于 createDiary/updateDiary（diary + tags 原子操作）
- interactions 唯一索引天然防重点赞/收藏
- 评论支持一级 + 二级回复（parent_id 自引用）
- 会员状态自动降级（member_until 过期 → authed）
- 日记列表支持 mode 三模式（square/collections/mine）+ 关键词/标签/作者/权限筛选

**验证**：
- 所有 21 个目录均含 index.js + package.json
- getDiaryList 支持分页 + 多条件筛选 + JOIN 查询
- createDiary 含事务回滚保护
- toggleLike/toggleFavorite 使用唯一索引防重

---

### 2026-05-20 17:30 — Phase 3 前端改造完成

**类型**：前端
**模型**：deepseek-v4-pro
**Agent**：PM → Frontend + Backend
**计划关联**：Phase 3.1 ~ 3.3
**修改文件**：
- `miniprogram/app.js` — 移除 mock 依赖，添加 `wx.cloud.init` + login 流程
- `miniprogram/api/request.js` — 统一云函数调用封装（{code, data} 格式）
- `miniprogram/api/user.js` — login, getUserInfo, updateProfile, checkMember
- `miniprogram/api/diary.js` — getList, getDetail, create, update, remove
- `miniprogram/api/social.js` — toggleLike, toggleFav, createComment, getComments, deleteComment
- `miniprogram/api/tag.js` — getAll, add
- `miniprogram/utils/mapper.js` — MySQL snake_case → WXML camelCase 字段映射
- `miniprogram/pages/square/index.js` — API 调用 + 分页加载 + mapper
- `miniprogram/pages/collections/index.js` — API 调用 + 分页 + mapper
- `miniprogram/pages/mine/index.js` — API 调用 + 分页 + mapper
- `miniprogram/pages/member/index.js` — user mapper 适配
- `miniprogram/pages/detail/index.js` — diary + comment mapper 适配
- `miniprogram/pages/detail/index.wxml` — 恢复 camelCase 字段引用
- `miniprogram/pages/compose/index.js` — createDiary/updateDiary API 调用
- `miniprogram/components/diary-card/index.js` — 字段双兼容（新旧字段名）
- `miniprogram/components/diary-card/index.wxml` — 新字段名 + 会员标识
- `miniprogram/components/poster-sheet/index.js` — 字段双兼容

**变更说明**：
完成前端全面改造，从 mock 数据切换到云函数 API：

1. **API 封装层**：5 个模块（request/user/diary/social/tag），统一 `{ code, data }` 处理
2. **app.js 重构**：移除 `data/mock` 导入，onLaunch 调用 login 云函数，globalData 作为 API 缓存
3. **字段映射**：`utils/mapper.js` 自动将 MySQL snake_case 转为 WXML 所用的 camelCase（author→author_name, likes→like_count 等）
4. **6 个页面全部改造**：列表页增加分页加载（onReachBottom）、搜索改为 API 调用、点赞/收藏/删除走云函数
5. **diary-card 双兼容**：观察者同时支持新旧字段名，平滑过渡

**验证**：
- 所有页面 JS 不再引用 mock.js
- API 调用链路：页面 → api/*.js → request.js → wx.cloud.callFunction → 云函数 → MySQL
- mapper 函数覆盖 diary/user/comment/reply 所有字段映射
- 分页参数 page/pageSize 在列表页统一支持

---

### 2026-05-20 17:45 — Phase 4 管理后台完成

**类型**：前端 / 管理后台
**模型**：deepseek-v4-pro
**Agent**：PM → Frontend
**计划关联**：Phase 4.1 ~ 4.5
**修改文件**：
- `admin/` — Vue 3 + Vite 项目（全新）
- `admin/src/main.js` — 应用入口 + Vue Router
- `admin/src/App.vue` — 侧边栏布局
- `admin/src/router/index.js` — 6 条路由
- `admin/src/api/index.js` — Mock API 层
- `admin/src/data/mock.js` — 9 用户 + 5 日记 + 5 评论种子数据
- `admin/src/views/Dashboard.vue` — KPI 看板 + 活动流
- `admin/src/views/Users.vue` — 用户列表 + 筛选
- `admin/src/views/UserDetail.vue` — 用户详情 + 日记列表
- `admin/src/views/Diaries.vue` — 日记列表 + 筛选 + 删除
- `admin/src/views/DiaryDetail.vue` — 日记详情 + 评论管理
- `admin/src/views/Interactions.vue` — 互动数据管理

**变更说明**：
构建了完整的管理后台 Web 应用（Vue 3 + Vite + Vue Router）：
- 侧边栏布局（深蓝主色 #3578F6，按 PRD 规范）
- 数据概览：5 个 KPI 卡片 + 活动流时间线
- 用户管理：列表 + 身份筛选 + 关键词搜索 + 详情页
- 日记管理：列表 + 权限/关键词筛选 + 删除 + 详情页（含评论管理）
- 互动数据：评论列表 + 搜索 + 删除
- 所有 API 封装为可替换的 mock 层，后续替换为真实云函数 HTTP API
- 构建产物 ~100KB（gzip ~36KB）

**验证**：
- `npm run build` 构建成功，无错误
- 6 个页面均编译出独立 JS/CSS chunk
- 路由导航完整（Dashboard/Users/UserDetail/Diaries/DiaryDetail/Interactions）

---

### 2026-05-20 18:15 — Phase 5 测试完成

**类型**：测试
**模型**：deepseek-v4-pro
**Agent**：PM → QA + Backend
**计划关联**：Phase 5.1 ~ 5.5
**修改文件**：
- `miniprogram/cloudfunctions/createOrder/index.js` — 修复管理员权限校验（结果已使用）
- `miniprogram/cloudfunctions/activateMember/index.js` — 增加管理员验证 + 订单状态改为 pending→paid 流程
- `test/api-test.js` — 新建 API 集成测试脚本（15 项，14 PASS / 1 FAIL 已修复）
- `test/checklist.md` — 新建功能回归测试清单（3×3 矩阵 + 组件测试 + 边界记录）

**变更说明**：

1. **安全审查**（全面扫描 21 个云函数）：
   - SQL 注入：全部安全（参数化查询）
   - 发现 2 个 CRITICAL：`createOrder` 管理员检查未执行、`activateMember` 无权限验证
   - 发现 4 个 HIGH：`toggleLike/toggleFavorite/createComment/getComments` 缺少目标存在性验证
   - 以上 CRITICAL 问题已修复

2. **API 集成测试**：连接生产 MySQL，验证 15 项数据结构完整性：
   - 9 张表存在性、字段、外键、索引、种子数据、软删除机制 — 全部通过
   - 发现 `diary_tags` 外键查询 bug（`KEY_COLUMN_USAGE` 返回多行，已修复查询条件）

3. **回归测试清单**：覆盖 3×3 身份权限矩阵（9 种组合）、6 页面功能、3 种 Sheet 组件

**验证**：
- 安全审查报告：0 SQL 注入风险、2 个 CRITICAL 已修复
- API 测试：15 项 PASS
- 管理后台构建成功（`admin/dist/` 产出 ~100KB）

---

### 2026-05-20 18:45 — 计划全面标注 Agent 分派

**类型**：文档 / 配置
**模型**：deepseek-v4-pro
**Agent**：PM
**计划关联**：工具链完善
**修改文件**：
- `.claude/agents/pm-agent.md` — 新增「任务-Agent 分配规则」章节
- `.claude/plans/fullstack-plan.md` — 所有 Phase 任务标注 `[Agent: xxx]`

**变更说明**：
1. PM Agent 定义新增强制性分派规则：每个 Task 有且仅有一个主 Agent
2. fullstack-plan.md 中 Phase 2~7 所有任务（60+ 项）已标注 Agent
3. 跨领域任务已拆分（如 6.1 CI/CD ↔ 6.2 Backend）

**验证**：
- 计划中每个 `[ ]` / `[x]` 行均有 `[Agent: xxx]` 标记
- PM 拆解新任务时将自动遵循标注格式

---

### 2026-05-20 19:15 — Phase 5.4 E2E 流程测试完成

**类型**：测试
**模型**：deepseek-v4-pro
**Agent**：PM → QA
**计划关联**：Phase 5.4 — 端到端流程测试
**修改文件**：
- `test/e2e-flow-test.js` — 新建 E2E 流程测试（20 用例）
- `test/checklist.md` — 更新结果：3×3 矩阵 9 项标注「✅ 后端」、新增 E2E 结果表

**变更说明**：
编写并运行了完整的端到端流程测试，模拟真实用户行为直接操作 MySQL：

1. **API 集成测试**：15/15 PASS（复测通过）
2. **E2E 流程测试**：20/20 PASS，覆盖：
   - 身份流程：guest 注册 → authed 升级 → member 激活 → 过期自动降级
   - 3×3 权限矩阵：public/member/private 隔离全部验证
   - 社交互动：点赞/取消/重赞、收藏/取消、评论 + 回复 + 软删除
   - 防重机制：点赞唯一索引、标签唯一约束
   - 订单流转：pending → paid 状态变更
   - 数据一致性：user.diary_count 与 diaries 表对齐
3. 测试清单更新：第 1-3 节标注后端验证状态，第 5 节新增 18 项 E2E 结果

**验证**：
- `node test/api-test.js` → 15/15 PASS
- `node test/e2e-flow-test.js` → 20/20 PASS
- 所有测试数据已自动清理

---

### 2026-07-03 15:30 — Loop Engineering 第一阶段：风险修复 + 验证闭环

**类型**：配置 | 测试
**模型**：claude-fable-5
**Agent**：主会话直接执行
**计划关联**：Loop Engineering 落地路径第一阶段（风险修复 + 后端验证环）
**修改文件**：
- `.env` / `.env.example` — 数据库连接配置唯一来源（.env 不入 Git）
- `config/db.js` — 共享配置加载器，test/ 脚本统一由此读取连接信息
- `scripts/sync-db-config.js` — 从 .env 重新生成 20 个云函数 db.js
- `.gitignore` — 排除 .env、cloudfunctions/*/db.js、project.private.config.json
- `test/api-test.js` / `e2e-flow-test.js` / `seed.js` / `reset-user.js` — 内嵌连接信息改为引用 config/db.js
- `test/ping-db.js` — 连通性快速检查（5 秒超时，循环遇错应停止而非重试）
- `test/unit/{filter,mapper,color}.test.js` — utils 纯函数单测 24 条（node:test）
- `test/fn-harness.js` — 云函数本地调用 harness（拦截 wx-server-sdk 注入 OPENID）
- `test/fn-smoke-test.js` — 云函数只读冒烟测试 5 条
- `package.json` — 新增 test / test:unit / test:e2e / sync-db 脚本
- `cloudbaserc.json` — envId 修正为 cloud1-1gpabyik2db3478f（与 app.js 对齐）
- `CLAUDE.md` — 更新测试章节与云函数连接配置说明

**变更说明**：
1. 风险修复：数据库凭据从 24 处硬编码（20 个 db.js + 4 个测试脚本）收敛到根目录 .env 单一来源；
   20 个 db.js 移出 Git 追踪（git rm --cached），由 sync 脚本按需生成。
2. Loop Engineering 第一阶段：建立统一 npm test 验证闭环——连通性检查 → utils 单测 →
   MySQL 集成测试 → 云函数本地冒烟测试，任一失败退出码非 0，可作为自动化循环的出口判据。
3. 云函数代码首次可本地真实执行（此前 e2e 测试仅直连 SQL，不经过云函数代码路径）。

**遗留风险**（需用户决策）：
- 数据库密码仍存在于 Git 历史中，且当前密码强度弱。建议：改 MySQL 密码 → 更新 .env →
  npm run sync-db → 重新部署 20 个云函数（顺序不可颠倒，否则线上云函数断连）。

**验证**：
- `npm test` → 连通性 OK + 24/24 单测 + 15/15 集成 + 5/5 冒烟，EXIT=0
- `npm run test:e2e` → 20/20 PASS，测试数据自动清理
- `git check-ignore` 确认 .env、db.js、project.private.config.json 均被忽略

---

### 2026-07-03 16:10 — 2.2.7 日记配图上传（自主循环第 1 轮）

**类型**：前端 | 云函数 | 数据库 | 测试
**模型**：claude-fable-5
**Agent**：自主循环（/loop 动态节奏）
**计划关联**：Phase 2.2.7 — uploadDiaryImage
**修改文件**：
- MySQL `diaries` 表 — 新增 `images JSON NULL` 列（附加性迁移）
- `miniprogram/cloudfunctions/createDiary/index.js` — INSERT 支持 images（JSON 序列化存 fileID 数组）
- `miniprogram/cloudfunctions/updateDiary/index.js` — UPDATE 支持 images（空数组清除为 NULL）
- `miniprogram/utils/mapper.js` — diary() 增加 images 兜底空数组
- `miniprogram/pages/compose/index.{js,wxml,wxss}` — 九宫格选图（wx.chooseMedia）、预览、删除；发布时 wx.cloud.uploadFile 直传云存储（cloudPath: diary-images/），编辑模式保留已有 fileID 不重复上传
- `miniprogram/pages/detail/index.{js,wxml,wxss}` — 正文下方渲染配图（widthFix），点击 wx.previewImage
- `test/fn-roundtrip-test.js` — 新增云函数写入回环测试 5 条（create 带图 → detail 验证 JSON 解析 → update 替换/清除 → delete，结束硬删测试数据）
- `test/api-test.js` — 新增 images 列存在性断言（15→16 条）
- `test/unit/mapper.test.js` — 新增 images 兜底断言（24→25 条）
- `package.json` — npm test 接入回环测试

**变更说明**：
选择 2.2.7 而非 2.1.4（头像上传）：member/auth 页存在约 900 行来源不明的未提交改动，
自主提交会混入未经确认的内容；2.2.7 涉及的 compose/detail 页与云函数均无冲突。
上传采用前端 wx.cloud.uploadFile 直传云存储方案，无需新增云函数，
云函数侧仅存 fileID 数组（diaries.images JSON 列）。

**遗留**：
- createDiary / updateDiary / getDiaryDetail / getDiaryList 需重新部署后线上才生效
- diary-card 列表缩略图未做（计划项仅要求上传链路，可作为后续 polish）
- 2.1.4 头像上传阻塞中：等用户确认 member/auth 页未提交改动的处置方式

**验证**：
- `npm test` 全绿：连通性 + 25/25 单测 + 16/16 集成 + 5/5 冒烟 + 5/5 回环，EXIT=0
- 回环测试确认 JSON 列经 mysql2 自动解析为数组、空数组清除、软删除后不可查

---

### 2026-07-03 16:25 — 7.3 数据库备份脚本（自主循环第 2 轮）

**类型**：后端 | 配置
**模型**：claude-fable-5
**Agent**：自主循环（/loop 动态节奏）
**计划关联**：Phase 7.3 — 数据备份
**修改文件**：
- `scripts/backup-db.js` — 纯 Node 备份脚本（无需 mysqldump）：SHOW CREATE TABLE + 分批 INSERT 导出到 backups/*.sql；--verify 模式恢复到临时库比对行数后删除临时库
- `package.json` — 新增 npm run backup
- `.gitignore` — 排除 backups/
- `.claude/plans/fullstack-plan.md` — 7.3 打勾（定时调度 schtasks 命令见脚本头部注释，需宿主机手动启用）

**变更说明**：
选择 7.3 而非 4.2.4（admin 导出 Excel）：admin 仍用 mock 数据，导出功能等 API 对接后做才有意义；
备份脚本在密码轮换悬而未决 + cpolar 隧道脆弱的背景下价值最高。JSON 列（diaries.images）
经 JSON.stringify 后转义写入，恢复校验确认无损。

**验证**：
- `node scripts/backup-db.js --verify` → 9 张表 56 行导出 17.8KB，恢复临时库后行数全部一致，临时库已清理
- `npm test` 回归全绿（25 单测 + 16 集成 + 5 冒烟 + 5 回环）
- `git check-ignore backups/` 确认备份产物不入 Git

---

### 2026-07-03 16:40 — 6.2 数据库索引优化（自主循环第 3 轮）

**类型**：数据库 | 测试
**模型**：claude-fable-5
**Agent**：自主循环（/loop 动态节奏）
**计划关联**：Phase 6.2 — 数据库索引优化 + 慢查询分析
**修改文件**：
- MySQL `diaries` 表 — 新增复合索引 `idx_status_created (status, created_at)`；删除冗余索引 `idx_user_id`（被 `idx_user_permission` 最左前缀覆盖，外键约束经确认仍由复合索引支撑）
- MySQL `users` 表 — 删除重复索引 `idx_openid`（与唯一索引 `openid` 完全重复）
- `test/api-test.js` — 新增 idx_status_created 存在性断言（16→17 条）

**变更说明**：
广场页热查询（status 过滤 + created_at 倒序分页）EXPLAIN 对比：
- 优化前：type=ALL（全表扫描），Using filesort
- 优化后：type=ref，key=idx_status_created，Backward index scan，无 filesort
两处冗余索引删除可降低写放大。慢查询日志为服务器级配置（需 SUPER 权限开启
slow_query_log），当前数据量下暂无必要，上线后如需开启在 MySQL 服务端配置。

**验证**：
- EXPLAIN 前后对比确认走索引、消除 filesort
- diaries.user_id 外键约束确认完好
- `npm test` 全绿：25 单测 + 17 集成 + 5 冒烟 + 5 回环

---

### 2026-07-03 16:55 — 3.4.3 本地缓存（自主循环第 4 轮）

**类型**：前端 | 测试
**模型**：claude-fable-5
**Agent**：自主循环（/loop 动态节奏）
**计划关联**：Phase 3.4.3 — 本地缓存
**修改文件**：
- `miniprogram/utils/cache.js` — 新增 TTL 本地缓存封装（wx.setStorageSync，统一 xs_cache: 前缀，存储异常静默降级）
- `miniprogram/app.js` — loadTags 改为 stale-while-revalidate：冷启动先用缓存标签兜底，网络返回后刷新缓存（TTL 60 分钟）
- `miniprogram/pages/square/index.js` — 广场首屏缓存：无搜索/筛选时先渲染缓存的第一页，网络返回后覆盖并回写缓存（TTL 10 分钟）
- `test/unit/cache.test.js` — 缓存模块单测 6 条（TTL 过期、异常降级、前缀隔离）

**变更说明**：
最小化接入：只缓存两处冷启动体感最明显的数据（标签库 + 广场第一页），
均为 stale-while-revalidate 模式，缓存只做兜底展示，不改变任何网络请求行为，
搜索/筛选路径不走缓存。前缀隔离避免与业务 storage 冲突。

**验证**：
- `npm test` 全绿：31/31 单测（新增 6 条）+ 17 集成 + 5 冒烟 + 5 回环
- 缓存展示效果需在微信开发者工具人工回归（断网冷启动应显示上次的广场列表与标签）

**注**：Phase 3.4 至此全部完成。

---

### 2026-07-03 17:30 — 分支代码巡查：修复 2 处竞态（自主循环第 5 轮）

**类型**：前端 | 测试
**模型**：claude-fable-5
**Agent**：自主循环（/loop 动态节奏）
**计划关联**：无对应计划项（第 1-4 轮改动的质量巡查）
**修改文件**：
- `miniprogram/pages/square/index.js` — _loadDiaries 增加 _loading 防重入标志
- `miniprogram/pages/compose/index.js` — onPublish 增加 _publishing 防双击标志（try/finally 保证复位）

**变更说明**：
巡查第 1-4 轮改动发现两处被放大的竞态：
1. 广场页：3.4.3 首屏缓存使列表瞬间可滚动，用户在首次网络返回前触底，
   onReachBottom 会用未自增的 page=1 再次请求并重复追加第一页。防重入修复。
2. 发布页：2.2.7 图片上传拉长了发布耗时，双击「发布」会创建两条相同日记。防双击修复。
其余改动（备份脚本转义、harness、mapper、索引迁移）巡查无问题。

**验证**：
- node --check 两页面语法通过
- `npm test` 全绿：31 单测 + 17 集成 + 5 冒烟 + 5 回环
- 竞态场景为时序相关，建议开发者工具弱网模式下人工复核（Network → Slow 3G，冷启动立即触底滚动）

---

### 2026-07-03 17:50 — 剩余任务重组为上线路线图

**类型**：文档
**模型**：claude-fable-5
**Agent**：主会话直接执行
**计划关联**：计划文件结构优化（用户提出剩余任务先后次序难分）
**修改文件**：
- `.claude/plans/fullstack-plan.md` — 过时的「里程碑时间线」（按周排期）替换为「上线路线图」：剩余 13 个计划项 + 4 个会话中新识别任务重组为 M1-M5 五个里程碑；原 Phase 章节对应条目改为 ⏩ 指针，勾选状态收敛到路线图单处维护

**变更说明**：
排序原则：① 依赖链优先（M1.1 脏文件决策解锁 M1.2 头像上传；新增 M1.3 admin API
对接解锁 M1.4，且为会员线下激活闭环的上线前置）；② 责任人分批（M1 Claude 为主、
M2 用户在场批处理、M3 协作、M4 微信平台人工、M5 上线后不阻塞）。
新增此前不在计划内的 4 个任务：M1.1 脏文件处置、M1.3 admin 对接真实 API、
M2.1 云函数 dev 部署、M2.2 人工回归、M3.1 密码轮换。

**验证**：
- grep 确认全文未勾选项 17 个全部位于路线图章节，原位置无残留复选框

---

### 2026-07-03 18:20 — M1.1 脏文件入库 + M1.2 头像上传核验关闭

**类型**：前端 | 配置 | 文档 | 测试
**模型**：claude-fable-5
**Agent**：主会话直接执行
**计划关联**：上线路线图 M1.1 / M1.2（=2.1.4）
**修改文件**：
- 提交 5d764b4 — member 页 UI 升级（印章徽标、权益双行卡片）+ auth 页移除微信一键取号改为手动输入（6 月 4 日遗留改动，用户确认入库）
- 提交 f93e520 — project.config.json 开发者工具配置漂移
- 提交 6d1d13c — doc/04_醒书日记四方旅程图.html 设计文档
- `.claude/plans/fullstack-plan.md` — M1.1 / M1.2 打勾

**变更说明**：
M1.1：入库前核验——node --check 语法通过，auth/member 两页 wxml 事件绑定与 js 方法
逐一比对无悬空引用。M1.2：核验发现头像上传链路 Phase 6 已完整实现
（button open-type="chooseAvatar" → 临时路径检测 → wx.cloud.uploadFile 到 avatars/ →
updateUserProfile 存 avatar_url），无需新开发，通过 harness 做了
设置→读回→还原的回环验证后直接关闭该项。

**验证**：
- updateUserProfile 头像回环：PASS（mock_me 设置 fake fileID → 读回一致 → 还原）
- wxml/js 绑定一致性比对：无差异
- 提交后工作区干净（仅 settings.local.json 随权限授权自然变化）

---

### 2026-07-03 19:10 — M1.3 管理后台对接真实 API

**类型**：后端 | 前端 | 云函数 | 测试 | 配置
**模型**：claude-fable-5
**Agent**：主会话直接执行
**计划关联**：上线路线图 M1.3 — admin 对接真实云函数 API
**修改文件**：
- `miniprogram/cloudfunctions/admin/` — 新增管理端统一云函数（第 23 个）：action 路由 10 个动作（login/users/userDetail/diaries/diaryDetail/comments/kpi/activity/trend/deleteDiary/deleteComment）；密码登录签发 12h HMAC token（crypto.timingSafeEqual 校验）；删除操作事务联动清理互动/评论并写 admin_logs 审计；不依赖 wx-server-sdk
- `.env` / `.env.example` — 新增 ADMIN_PASSWORD
- `scripts/sync-db-config.js` — 扩展：同步生成 admin 云函数 secret.js（gitignore 排除）
- `config/db.js` — adminPassword 以不可枚举属性暴露（避免混入 mysql2 连接参数）
- `admin/src/api/index.js` — mock 全量替换为 @cloudbase/js-sdk 调用（匿名登录 + callFunction），返回形状与原 mock 一致，页面组件零改动；-401 自动登出跳转
- `admin/src/views/Login.vue` — 新增密码登录页
- `admin/src/router/index.js` — /login 路由 + 全局前置守卫
- `admin/src/App.vue` — 登录页脱离侧边栏布局渲染；侧边栏新增退出登录
- `admin/src/data/mock.js` — 删除（改造后无引用）
- `test/fn-admin-test.js` — 11 条测试：鉴权 4 条（错误密码/无 token/伪造 token/正常登录）+ 形状 6 条（与库内数量比对）+ 删除联动闭环 1 条
- `package.json` / `CLAUDE.md` — npm test 接入 admin 测试；文档同步

**变更说明**：
鉴权方案经用户确认采用密码登录。踩坑一处：diaries.updated_by 为整型（用户 id），
管理员操作不写该列，审计统一走 admin_logs（全 varchar 列）。

**上线前置（用户操作）**：
1. TCB 控制台开启匿名登录（js-sdk 调用云函数的前提）
2. 部署 admin 云函数（需先 npm run sync-db 生成 db.js/secret.js）
3. 管理后台部署到静态托管后，把域名加入 TCB WEB 安全域名

**验证**：
- `node test/fn-admin-test.js` → 11/11 PASS（含 deleteDiary 事务联动：日记软删 + 互动清零 + 评论隐藏 + 审计入库）
- `npm test` 全绿：31 单测 + 17 集成 + 5 冒烟 + 5 回环 + 11 admin = 69 条
- `admin && npm run build` 构建通过（826KB，js-sdk 体积占主）

---

### 2026-07-03 21:00 — PRD v2.0：融入会员转化策略（筛选型价值观社区）

**类型**：文档
**模型**：claude-fable-5
**Agent**：主会话直接执行（Product 视角）
**计划关联**：新增策略文档落地（doc/醒书日记的会员转化策略设计.md → PRD）
**修改文件**：
- `doc/醒书日记小程序及管理后台PRD文档.md` — 升级至 v2.0，头部增加版本修订记录

**变更说明**：
产品定位从"内容付费转化"调整为"价值观社区筛选"，核心变更点：
1. 一章：产品理念改写（筛选而非转化、三层漏斗、北极星指标=首篇创作转化率）
2. 二章：目标人群画像补充（认真生活者，对套路敏感 → 克制原则）
3. 三章：新增落地欢迎屏、编辑精选、今日话题、首篇创作特殊规则（标题可选/
   默认仅自己可见/微鼓励/高光时刻）；授权触发时机改为互动冲动瞬间 + 欢迎时刻页；
   会员内容墙改为"预览 30% + 渐隐"软筛选（替代完全不可见）；会员套餐改为
   新增 3.1.6 创作激励与荣誉体系；
   管理后台新增运营管理（精选/话题/首篇回应队列/荣誉激励）与转化漏斗监控
4. 四章：信息架构补充 3 个新页面与后台"运营管理"菜单
5. 五章：购买页改投名状文案+线下转账（年卡 365 唯一套餐，月卡降为后续迭代备选）；授权页文案重构为"加入仪式"；
   新增 5.1.13 首篇高光时刻、5.1.14 授权欢迎时刻页说明
6. 七章：权限管控交互改渐隐预览；会员权限状态同步更新
7. 新增八章：会员转化与筛选运营策略总纲（漏斗图、设计原则、指标体系、风险）
8. 同步修正与实现不一致处：支付=线下转账（原文微信支付）、授权=手机号手动
   输入（原文微信一键授权）

**验证**：
- 全文 v2 变更点均带 (v2 新增/调整) 标注，可与 v1 区分溯源
- 版本修订记录、策略文档交叉引用完整

---

### 2026-07-03 21:40 — PRD v2.1：命名"醒书"+ 活动栏目 + 日记权限矩阵收紧

**类型**：文档
**模型**：claude-fable-5
**Agent**：主会话直接执行（Product 视角）
**计划关联**：用户补充需求落地（PRD v2.0 → v2.1）
**修改文件**：
- `doc/醒书日记小程序及管理后台PRD文档.md` — 升级 v2.1，修订记录同步

**变更说明**：
1. 命名：小程序正式命名"醒书"，"醒书日记"降为产品内日记模块名
2. 新增"醒书活动"一级栏目（3.1.7 + Tab 第 2 位 + 5.1.15/5.1.16 页面说明）：
   活动预告/报名/往期图文回顾；详情与报名仅需微信授权（轻授权），不强制手机号
3. 授权分层（3.1.5 新增）：微信授权（轻，活动用）/ 手机号验证（重，日记用），
   用户身份维持三态：未授权 / 已授权非会员 / 已授权会员
4. 日记权限矩阵收紧（v2.1 核心变更，附矩阵表）：未授权仅可浏览列表卡片，
   点击任意日记详情触发手机号验证引导；已授权非会员可读公众详情全文、
   会员日记预览 30% 渐隐；会员全量。同步修订 5.1.1 交互、7.4.1 身份/权限状态
5. 管理后台新增"活动管理"菜单（发布/报名名单/回顾）
6. 第八章补注：权限收紧后 Step1 沉浸阅读发生在列表摘要+欢迎屏层面，
   详情点击即 Step2 前移；活动栏目为更低门槛的互补认同路径

**验证**：
- 修订记录 v2.1 行完整；全文 v2.1 变更点均带标注；与 v2.0 渐隐规则合并为统一矩阵表

---

### 2026-07-03 22:00 — 活动模块 MVP 边界划定 + 路线图插入 M1.5/M6

**类型**：文档
**模型**：claude-fable-5
**Agent**：主会话直接执行（PM 视角）
**计划关联**：用户决策落地——活动模块首发必须有、第一阶段从简
**修改文件**：
- `doc/醒书日记小程序及管理后台PRD文档.md` — 3.1.7 新增"首发范围划分"：MVP（列表两态/文字+图片详情/固定两字段一键报名/名额/后台 CRUD+名单查看）与后续迭代（可配置表单/候补/核销/富文本/提醒/Excel）边界明确
- `.claude/plans/fullstack-plan.md` — 路线图插入 **M1.5 v2.1 首发功能包**（M1.5.1 活动 MVP 含表结构与云函数拆解 / M1.5.2 权限矩阵收紧 / M1.5.3 授权文案+改名）；新增 **M6 v2 产品迭代**（五步引导/今日话题/编辑精选/激励荣誉/漏斗埋点/活动迭代/月卡备选，上线后按运营数据排优先）；依赖图更新

**变更说明**：
入选首发的判断依据：活动模块为用户明确要求；权限矩阵收紧属行为变更（上线后再改
会造成老用户体验突变），必须随首发；授权文案是低成本捎带项。其余 v2 功能全部
推迟到 M6，避免拖累上线节奏。

**验证**：
- PRD 3.1.7 首发红线与路线图 M1.5.1 范围红线一致
- 依赖图 M1.5 正确插入 M1.4 与 M2.1 之间

---

### 2026-07-03 23:00 — 醒书活动模块原型 2 屏（M1.5.1 前置设计）

**类型**：文档 | 前端（原型）
**模型**：claude-fable-5
**Agent**：主会话直接执行（Product/Frontend 视角，计划模式经用户批准）
**计划关联**：M1.5.1 前置——用户确认混合策略：仅活动模块出原型，其余直接开发
**修改文件**：
- `project/src/activities.jsx` — 新增：ActivityListScreen（预告/往期两分组 + 活动卡片）、ActivityDetailScreen（封面/信息卡/图文/底部报名栏三态）、SignupSheet（称呼必填+联系方式选填）、气质化封面占位（暖纸底大号衬线单字+醒書印章角）
- `project/src/data.js` — SEED_ACTIVITIES：3 条预告（含 1 条名额已满、1 条已报名演示态）+ 2 条往期回顾（图文+照片占位）
- `project/src/app.jsx` — Tab 扩为 5 个（活动第 2 位，日历勾图标）；activity 路由；signup/cancel 状态流转 + toast
- `project/src/styles.css` — 尾部追加活动样式（卡片/封面/四态角标/进度条/报名栏/表单/照片网格），全部复用既有 CSS 变量，未引入新色值
- `project/index.html` — 加载 activities.jsx（screens 与 app 之间一行）

**变更说明**：
按批准的计划执行：改 git 追踪的根 project/ 落地版，未动 doc/ 交付包与 22MB 快照；
screens.jsx/components.jsx 零改动（新屏独立成文件）。视觉完全沿用暖纸/印章/衬线体系。

**验证**：
- esbuild JSX 语法检查通过（activities.jsx / app.jsx）
- 已在用户浏览器打开 project/index.html 待视觉验收：活动 Tab 两分组、
  详情三态报名栏（102 已报名可取消 / 103 名额已满置灰 / 101 可报名弹表单）、
  往期回顾无报名栏 + 照片网格
- 用户确认视觉后进入 M1.5.1 小程序实现（本原型即视觉规格）

---

### 2026-07-03 23:40 — PRD v2.2 分享裂变与推荐人 + 活动海报原型

**类型**：文档 | 前端（原型）
**模型**：claude-fable-5
**Agent**：主会话直接执行
**计划关联**：用户新需求落地（PRD v2.2）+ M1.5.4 立项
**修改文件**：
- `doc/醒书日记小程序及管理后台PRD文档.md` — v2.2：3.1.5 新增"分享裂变与推荐人关系"（带参小程序码 scene=目标+分享人ID；新用户首绑定推荐人、不覆盖、不可自荐；老用户扫码只跳转）；3.1.1 日记转发增强；3.1.7 活动海报分享 + 首发 MVP 纳入海报；3.2 用户管理加推荐人展示；5.1.5/5.1.16 页面说明同步
- `.claude/plans/fullstack-plan.md` — 新增 M1.5.4（generateMiniCode 扩展 / users.referrer_user_id / login 解析 scene / 活动海报弹层 / admin 推荐人展示）
- `project/src/activities.jsx` — 新增 ActivityPosterSheet（封面+标题+时间地点+报名数+带参码占位+推荐人说明文案）；详情页 TopBar 加分享入口
- `project/src/screens.jsx` — 日记 PosterSheet 二维码下加一行推荐人说明（唯一改动）

**变更说明**：
推荐人绑定规则在 PRD 中定死：仅新用户首次绑定、后续不覆盖、分享人不能是自己、
老用户扫码只跳转。激励规则明确划归 M6 迭代，本期只做关系记录。
原型海报上用小字文案可视化推荐机制（"醒书人 No.8 与你分享 · 扫码进入将记录 TA 为你的推荐人"）。

**验证**：
- esbuild JSX 校验通过；本地服务器 http://localhost:4173 正常（file:// 空白问题已定位为
  Babel XHR 受 CORS 限制，已改用 http-server 承载）
- 待用户浏览器验收：活动详情右上分享图标 → 海报弹层；日记海报新增推荐人小字

---

### 2026-07-03 23:55 — PRD v2.2 补充：管理员可修改用户推荐人

**类型**：文档
**模型**：claude-fable-5
**Agent**：主会话直接执行
**计划关联**：用户补充需求（并入 v2.2）
**修改文件**：
- `doc/醒书日记小程序及管理后台PRD文档.md` — 修订记录 v2.2 行、3.1.5 绑定规则（扫码不可覆盖 + 管理员人工修改例外）、3.2 用户管理、5.2.3 用户详情页（修改推荐人弹窗 + "他推荐的用户"标签页）
- `.claude/plans/fullstack-plan.md` — M1.5.4 补充 admin 修改/清空推荐人（校验非本人、无循环，写审计）

**变更说明**：
推荐人的修改权限收敛为"扫码路径首绑定不可覆盖，仅管理员后台可改"，
用于纠错与线下场景补录；校验规则：不可选本人、不得互为推荐形成循环；
所有修改写 admin_logs（旧值→新值）。

**验证**：PRD 三处规则表述一致（3.1.5 / 3.2 / 5.2.3 交叉引用无冲突）

---

### 2026-07-04 00:05 — 海报去除推荐人可见信息（推荐参数仅隐含于码中）

**类型**：文档 | 前端（原型）
**模型**：claude-fable-5
**Agent**：主会话直接执行
**计划关联**：用户反馈修正（v2.2 细化）
**修改文件**：
- `project/src/screens.jsx` — 日记海报移除推荐人说明文案（还原为仅"扫描二维码查看完整日记"）
- `project/src/activities.jsx` — 活动海报移除推荐人说明文案
- `doc/醒书日记小程序及管理后台PRD文档.md` — 3.1.5 明确：推荐人参数仅隐含在 scene 中，海报画面不展示任何推荐人信息

**验证**：esbuild JSX 校验通过；刷新 http://localhost:4173 海报画面已无推荐人文字

---

### 2026-07-04 00:30 — M1.5 功能测试用例编写（Loop 验收规格）+ 原型验收通过

**类型**：测试 | 文档
**模型**：claude-fable-5
**Agent**：主会话直接执行（QA 视角）
**计划关联**：M1.5 开发前置（用户确认：先写用例支撑 loop 及时验证）
**修改文件**：
- `test/m15-test-cases.md` — 新增：M1.5.1-M1.5.4 共 28 条自动化用例（ACT-A×11 / PERM-A×8 / REF-A×9，
  对应待创建的 fn-activity/fn-permission/fn-referral 三个测试文件）+ 18 条人工用例（归入 M2.2 批次）
  + Loop 协作约定（用例→测试先行→实现→全绿→打勾）
- `CLAUDE.md` — 测试文档清单加入 m15-test-cases.md
- `.claude/plans/fullstack-plan.md` — M1.5 头部标注验收规格与原型验收状态

**变更说明**：
用例直接从 PRD v2.1/v2.2 规则推导，关键行为断言包括：会员日记截断内容不得出现在
响应任何字段（PERM-A04）、guest 列表放宽到公众+会员卡片可见（PERM-A08，行为变更点）、
推荐人首绑定不覆盖/不可自荐/老用户不绑定（REF-A03~A05）、admin 改推荐人的本人与
循环校验（REF-A08/A09）。generateMiniCode 等依赖微信 API 的项标注人工验证不阻塞 loop。
另：活动模块原型（活动两屏+海报）已获用户验收，进入实现阶段。

**验证**：用例 ID 体系与三个测试文件命名对齐；npm test 渐进挂载策略已写明

---

### 2026-07-04 01:00 — M1.4 admin 导出与批量操作

**类型**：前端 | 云函数 | 测试
**模型**：claude-fable-5
**Agent**：主会话直接执行
**计划关联**：M1.4（=4.2.4 + 4.3.5）
**修改文件**：
- `miniprogram/cloudfunctions/admin/index.js` — deleteDiary 抽出 deleteDiaryById 复用；新增 deleteDiaries 批量 action（逐条独立事务、成败分账、汇总审计）
- `admin/src/utils/csv.js` — 新增 CSV 导出工具（UTF-8 BOM，Excel 打开中文不乱码）
- `admin/src/views/Users.vue` — 导出按钮（按当前筛选结果，11 列）
- `admin/src/views/Diaries.vue` — 复选框全选/单选 + 批量删除（失败明细提示）+ 导出
- `admin/src/api/index.js` — deleteDiaries 封装
- `test/fn-admin-test.js` — 新增批量删除用例（2 有效 + 1 无效 ID 的成败分账断言），11→12 条

**验证**：fn-admin-test 12/12；npm test 全绿（70 条）；admin build 通过
**注**：admin 云函数改动需重新部署后线上生效（wxcloud CLI 可代劳）

---

### 2026-07-04 02:00 — M1.5.1 醒书活动模块 MVP（测试先行，ACT-A01~A11 全绿）

**类型**：数据库 | 云函数 | 前端 | 测试
**模型**：claude-fable-5
**Agent**：主会话直接执行
**计划关联**：M1.5.1（PRD v2.1 3.1.7，验收规格 test/m15-test-cases.md）
**修改文件**：
- MySQL — 新表 activities（status: draft/online/finished，含回顾字段）+ activity_signups（(activity_id,user_id) 唯一约束 + 双外键）
- `miniprogram/cloudfunctions/activity/` — 新云函数（第 24 个）：list/detail/signup/cancelSignup；报名走事务行锁（FOR UPDATE）校验名额/截止/状态，重复报名靠唯一约束兜底
- `miniprogram/cloudfunctions/admin/index.js` — 新增 activityList/activitySave/activitySignups 三个管理 action（写审计）
- `miniprogram/api/activity.js` + `pages/activities/` + `pages/activity-detail/`（照已验收原型实现：两分组列表、角标三态、报名弹层、往期回顾、防重复提交）
- `miniprogram/app.json` + `custom-tab-bar/index.js` — Tab 扩为 5 个（活动第 2 位 ▢/▣）；collections/mine/member 页 selected 索引 +1
- `admin/src/views/Activities.vue` + router + App.vue 导航 — 活动发布/编辑/上下线 + 报名名单弹窗
- `test/fn-activity-test.js` — ACT-A01~A11 全覆盖，接入 npm test

**验证**：fn-activity-test 11/11；npm test 全绿（81 条）；admin build 通过；全部新 JS node --check 通过
**待用户操作**：控制台新建云函数 `activity`（Nodejs16.13，同 admin 流程）后我用 CLI 推代码；活动页 UI 待开发者工具人工回归（ACT-M01~M06）

---

### 2026-07-04 02:50 — M1.5.2 日记权限矩阵收紧（PERM-A01~A08 全绿）

**类型**：云函数 | 前端 | 测试
**模型**：claude-fable-5
**Agent**：主会话直接执行
**计划关联**：M1.5.2（PRD v2.1 权限矩阵，验收规格 test/m15-test-cases.md）
**修改文件**：
- `cloudfunctions/getDiaryDetail` — guest 返回引导码 -3（不泄露内容）；authed 读会员日记服务端截断前 30% + truncated 标记；作者/会员全文；-2 拦截码废弃
- `cloudfunctions/getDiaryList` — square 列表对 guest/authed 放宽到公众+会员卡片；无完整阅读权的行 content 截断 80 字 + excerpt 标记（防列表接口泄露全文）
- `miniprogram/utils/auth-guard.js` — 新增 requireAuth(redirect)：guest 互动瞬间跳验证页并支持回跳
- `miniprogram/app.js` — 移除 guest 强制跳验证页（克制原则：游客可自由浏览列表）
- `pages/auth/index.js` — 支持 redirect 参数，验证成功直达原目标
- `pages/square/index.js` — 卡片点击/点赞/收藏/写日记四个触发点接入 requireAuth；移除 member-guard 拦截
- `pages/collections/index.js` — 移除 member-guard 拦截（会员日记直接进详情看渐隐）
- `pages/detail/index.{js,wxml,wxss}` — -3 引导码跳验证（带回跳）；truncated 渐隐遮罩 + "完整内容向会员开放" + 金色了解会员按钮
- `api/request.js` — 新增 raw 选项（调用方自行处理引导码）；`api/diary.js` getDetailRaw
- `test/fn-permission-test.js` — PERM-A01~A08 + A08b 共 9 条（含"截断内容不得出现在响应任何字段"的防泄露断言）
- `test/fn-smoke-test.js` — 旧断言"游客只见 public"按 v2.1 矩阵更新（行为变更被测试显式捕获）

**验证**：fn-permission-test 9/9；npm test 全绿（90 条）；全部改动 JS node --check 通过
**注**：getDiaryDetail/getDiaryList 需重新部署；member-guard 组件保留但广场/收藏页不再触发（M6 清理）

---

### 2026-07-04 03:10 — M1.5.3 授权页文案重构 + 标题改"醒书"

**类型**：前端
**模型**：claude-fable-5
**计划关联**：M1.5.3（PRD 5.1.12）
**修改文件**：
- `pages/auth/index.wxml` — 标题"成为醒书的一员"；副文案双版本（互动触发情境版/通用版）；承诺文案；按钮"加入醒书"
- `pages/auth/index.js` — fromInteraction 状态（有 redirect 即情境版文案）
- `miniprogram/app.json` — navigationBarTitleText 改"醒书"

**验证**：node --check 通过；AUTH-M01~M03 归入 M2.2 人工回归
**注**：微信平台侧小程序名称变更需用户在 mp.weixin.qq.com 操作
