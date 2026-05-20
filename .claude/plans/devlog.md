# 开发日志 (Development Log)

> 记录醒书日记项目所有实质性开发操作。每完成一个步骤或修复一个问题后更新。

---

## 日志格式规范

每次记录遵循以下格式：

```markdown
### YYYY-MM-DD HH:MM — [标题]

**类型**：[前端 | 后端 | 数据库 | 云函数 | 测试 | 部署 | 配置 | 文档]
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
