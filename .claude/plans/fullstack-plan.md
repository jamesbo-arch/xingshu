# 醒书日记 — 全栈开发计划

## 当前状态评估

| 维度 | 完成度 | 说明 |
|------|--------|------|
| 前端 UI | ~98% | 6 页面 + 4 组件 + 交互完整，对标设计原型 |
| 数据层 | 0% | 纯内存 mock 数据，无持久化 |
| 后端 API | 0% | 无服务器、无云函数、无接口 |
| 数据库 | 0% | 无关系数据库、无文档数据库 |
| 用户认证 | 0% | 无微信登录、无 OpenID/UnionID |
| 缓存 | 0% | 无 Redis/本地缓存 |
| 支付 | 0% | 仅有线下转账说明文字 |
| 管理后台 | 0% | 无内容管理、无用户管理 |
| CI/CD | 0% | 无自动化部署流水线 |
| 运维监控 | 0% | 无日志、无告警、无监控 |

**结论：项目处于"高保真前端原型"阶段，需从零搭建全栈基础设施。**

---

## 总体架构设计

```
┌──────────────────────────────────────────────────────┐
│                    微信小程序前端                       │
│  (WXML/WXSS/JS — miniprogram/)                       │
│  6 pages + 4 components + custom tab-bar             │
└────────────────┬─────────────────────────────────────┘
                 │ wx.cloud / wx.request (HTTPS)
                 ▼
┌──────────────────────────────────────────────────────┐
│              腾讯 CloudBase (TCB) 云开发               │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ 云函数        │  │ MySQL (外部) │  │ 云存储      │ │
│  │ (Node.js)    │  │ 33.tcp.     │  │ (图片/文件) │ │
│  │ + mysql2     │  │ cpolar.top  │  │             │ │
│  │              │  │              │  │ • avatars/  │ │
│  │ • auth       │  │ • users      │  │ • images/   │ │
│  │ • diary CRUD │  │ • diaries    │  │ • posters/  │ │
│  │ • social     │  │ • comments   │  │             │ │
│  │ • member     │  │ •interactions│  └────────────┘ │
│  │ • admin      │  │ • tags       │                 │
│  │ • payment    │  │ • diary_tags │                 │
│  └──────────────┘  │ • orders     │                 │
│                     │ • payment_   │                 │
│  ┌──────────────┐   │   logs       │                 │
│  │ 定时触发器    │  │ • admin_logs │                 │
│  │ (定期任务)   │  └──────────────┘                 │
│  └──────────────┘                                    │
└──────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│              辅助服务（后期）                          │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │ Redis 缓存   │  │ COS 对象存储  │                  │
│  │ 热数据/限流  │  │ 大规模文件    │                  │
│  └──────────────┘  └──────────────┘                  │
└──────────────────────────────────────────────────────┘
```

### 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 云平台 | 腾讯 CloudBase (TCB) | 微信原生集成、免运维、小程序内直接调用 |
| 关系数据库 | MySQL (自建，cpolar 隧道) | 全部业务数据，9 张表，ACID 事务 |
| 缓存 | Redis (后期) | 热数据加速、排行榜、限流 |
| 云函数 | Node.js 18+ | TCB 原生支持，JS 与前端同语言 |
| 云存储 | TCB 云存储 + COS | 图片、海报、用户头像 |
| 支付 | 线下转账 | 管理员手动确认，不接入微信支付 |
| CI/CD | GitHub Actions + miniprogram-ci | 自动上传、版本管理 |

---

## Phase 1 — 基础设施搭建（预计 2-3 天）

### 1.1 TCB 环境初始化
- [x] **1.1.1** 开通腾讯 CloudBase 环境（envId: `awakebook-env-1g0oford0bea44cc`）
- [x] **1.1.2** 初始化云开发目录 `miniprogram/cloudfunctions/`
- [x] **1.1.3** 更新 `project.config.json` 添加 `cloudfunctionRoot`
- [x] **1.1.4** 更新 `app.js` 添加 `wx.cloud.init({ env: 'xingshu-XXXXXX', traceUser: true })`

### 1.2 数据库设计

- [x] **1.2** MySQL 9 张表已创建：users, tags, diaries, diary_tags, comments, interactions, orders, payment_logs, admin_logs
- [x] **1.2** 种子数据：20 个标签已写入
- [x] **1.2** 连接配置：`33.tcp.cpolar.top:11028/xingshu_dev`

#### 1.2.1 MySQL 表设计

完整 DDL 已通过 `mysql2` 执行，9 张表结构如下：

| 表名 | 说明 | 关键字段 | 索引 |
|------|------|---------|------|
| `users` | 用户 | openid, nickname, identity, avatar_hue, member_until | openid(unique), identity |
| `tags` | 标签库 | name, usage_count | name(unique) |
| `diaries` | 日记 | user_id, title, content, permission | user_id, permission, created_at |
| `diary_tags` | 日记-标签关联 | diary_id, tag_id | (diary_id,tag_id) PK |
| `comments` | 评论 | user_id, diary_id, parent_id, content | diary_id, parent_id, user_id |
| `interactions` | 点赞/收藏 | user_id, target_type, target_id, action | (user,target,action) unique |
| `orders` | 会员订单 | user_id, amount, status, transaction_id | user_id, status |
| `payment_logs` | 支付回调日志 | order_id, event_type, raw_data(JSON) | order_id |
| `admin_logs` | 管理员操作日志 | admin_openid, action, detail(JSON) | admin_openid, created_at |

外键关系：`users → diaries → comments`，`users → interactions`，`users → orders`，`diaries ← diary_tags → tags`

**MySQL 连接**：`33.tcp.cpolar.top:11028/xingshu_dev`（用户 `james`）

### 1.3 缓存结构设计（Redis）

| Key Pattern | 类型 | TTL | 说明 |
|-------------|------|-----|------|
| `diary:{id}` | Hash | 1h | 单篇日记缓存 |
| `diary:list:{type}:{page}` | String(JSON) | 5min | 日记列表分页缓存（type=square/collections/mine）|
| `diary:hot:day` | ZSet | 24h | 热门日记（按互动数排序） |
| `user:{openid}` | Hash | 30min | 用户信息缓存 |
| `user:{openid}:like:diary` | Set | 永久 | 用户点赞日记 ID 集合 |
| `user:{openid}:fav:diary` | Set | 永久 | 用户收藏日记 ID 集合 |
| `tags:top` | String(JSON) | 1h | 热门标签 |
| `rate:{openid}:{action}` | String | 60s | 接口限流计数器 |
| `session:{token}` | Hash | 2h | 管理员后台登录态 |

---

## Phase 2 — 云函数开发（预计 3-4 天）

### 2.1 用户与认证
- [x] **2.1.1** `login` — `wx.login()` → 获取 OpenID → 创建/更新用户记录 → 返回用户信息
- [x] **2.1.2** `getUserInfo` — 获取当前用户详情 + 统计数据
- [x] **2.1.3** `updateUserProfile` — 更新昵称、真实姓名、手机号
- [ ] **2.1.4** `updateAvatar` — 上传头像到云存储 → 更新 avatarUrl（Phase 3 前端一并处理）

### 2.2 日记 CRUD
- [x] **2.2.1** `createDiary` — 创建日记（事务：INSERT diaries + diary_tags + 更新计数）
- [x] **2.2.2** `updateDiary` — 修改日记（校验归属、事务更新标签关联）
- [x] **2.2.3** `deleteDiary` — 软删除日记（status='deleted'，校验归属）
- [x] **2.2.4** `getDiaryList` — 分页获取日记列表（mode: square/collections/mine, 关键词/标签/作者/权限筛选）
- [x] **2.2.5** `getDiaryDetail` — 获取日记详情 + 互动状态 + 标签
- [x] **2.2.6** `searchDiaries` — 已合并到 `getDiaryList` 的 keyword 参数
- [ ] **2.2.7** `uploadDiaryImage` — 上传日记配图到云存储（Phase 3 前端一并处理）

### 2.3 社交互动
- [x] **2.3.1** `toggleLike` — 点赞/取消点赞（原子 INSERT/DELETE，更新计数）
- [x] **2.3.2** `toggleFavorite` — 收藏/取消收藏
- [x] **2.3.3** `createComment` — 发布评论/回复（支持 parent_id 嵌套）
- [x] **2.3.4** `getComments` — 获取评论列表（分页 + 嵌套回复 + isMine 标记）
- [x] **2.3.5** `deleteComment` — 删除评论（软删除，校验归属）

### 2.4 会员与订单（线下转账）
- [x] **2.4.1** `createOrder` — 管理员创建会员订单（线下转账确认后）
- [x] **2.4.2** `getOrderList` — 用户订单列表
- [x] **2.4.3** `checkMemberStatus` — 检查会员状态（含过期自动降级）
- [x] **2.4.4** `activateMember` — 管理员确认收款后激活会员

### 2.5 标签管理
- [x] **2.5.1** `getTags` — 获取全部标签（按使用量排序）
- [x] **2.5.2** `addTag` — 管理员添加标签（含重名校验）
- [x] **2.5.3** `updateTag` — 管理员编辑/禁用标签

### 2.6 小程序码生成
- [x] **2.6.1** `generateMiniCode` — 生成日记分享小程序码 → 云存储

---

## Phase 3 — 前端改造（预计 3-4 天）

### 3.1 数据层重构
- [ ] **3.1.1** 创建 `miniprogram/api/` HTTP 封装层
  - `api/request.js` — 统一请求方法（wx.cloud.callFunction 或 wx.request）
  - `api/diary.js` — 日记相关 API
  - `api/user.js` — 用户相关 API
  - `api/social.js` — 社交互动 API
  - `api/member.js` — 会员/支付 API
  - `api/tag.js` — 标签 API
- [ ] **3.1.2** 重构 `app.js` globalData 方法
  - `toggleLike` → 调用云函数 + 乐观更新 UI
  - `toggleFav` → 调用云函数 + 乐观更新 UI
  - `addDiary/updateDiary/deleteDiary` → 调用云函数 + 刷新列表
  - `updateUser` → 调用云函数

### 3.2 认证接入
- [ ] **3.2.1** 登录页/流程：`app.js onLaunch` 调用 `wx.login` + `login` 云函数
- [ ] **3.2.2** 游客态处理：未登录可浏览公开内容，操作时引导登录
- [ ] **3.2.3** 会员态处理：member-guard 改为基于真实数据校验

### 3.3 页面改造
- [ ] **3.3.1** 广场页：分页加载（上拉加载更多）、下拉刷新
- [ ] **3.3.2** 收藏页：分页加载、同步真实收藏状态
- [ ] **3.3.3** 我的日记页：分页加载、真实删除
- [ ] **3.3.4** 会员中心：对接真实订单、微信支付流程
- [ ] **3.3.5** 详情页：真实评论发布/回复、真实小程序码海报
- [ ] **3.3.6** 撰写页：图片上传、草稿自动保存

### 3.4 离线与容错
- [ ] **3.4.1** 网络异常全局处理（断网提示、重试）
- [ ] **3.4.2** 乐观更新 + 失败回滚（点赞/收藏场景）
- [ ] **3.4.3** 本地缓存热数据（wx.setStorage 缓存首页列表）

---

## Phase 4 — 管理后台（独立 Web 应用，预计 5-7 天）

> 依据：PRD 第 5.2 节 + 原型 `doc/醒书日记-原型设计/untitled/project/src/admin/`

### 4.1 首页 — 数据概览
- [ ] **4.1.1** KPI 卡片：总用户数、会员数、日记数、总互动数、收入（线下转账汇总）
- [ ] **4.1.2** 趋势图：用户增长、日记发布、互动数据趋势（日/周/月/年切换）
- [ ] **4.1.3** 最近活动流：新注册、新日记、到期提醒、订单记录
- [ ] **4.1.4** 数据每10分钟自动刷新，Hover 显示具体数值

### 4.2 用户管理
- [ ] **4.2.1** 用户列表：表格（ID/手机号/昵称/身份/会员期/注册时间/最后活跃）+ 筛选 + 分页
- [ ] **4.2.2** 筛选条件：按身份类型、注册时间范围、关键词搜索
- [ ] **4.2.3** 用户详情页：基础信息 +「发布日记」tab +「互动记录」tab
- [ ] **4.2.4** 导出用户列表（Excel）

### 4.3 日记管理
- [ ] **4.3.1** 日记列表：表格（ID/标题/作者/时间/标签/权限/互动数据）+ 多条件筛选 + 分页
- [ ] **4.3.2** 筛选条件：关键词（标题/内容）、标签、时间范围、作者、权限、互动数据范围
- [ ] **4.3.3** 日记详情页：完整内容 + 4 tab 互动数据（点赞/收藏/评论/转发）
- [ ] **4.3.4** 单个/批量删除日记 + 导出列表（Excel）
- [ ] **4.3.5** 删除违规评论

### 4.4 互动数据管理
- [ ] **4.4.1** 点赞数据页：按日记/用户筛选，表格展示
- [ ] **4.4.2** 收藏数据页：按日记/用户筛选
- [ ] **4.4.3** 评论数据页：按日记/用户/内容筛选，支持删除
- [ ] **4.4.4** 转发数据页：按日记/用户筛选

### 4.5 技术方案
- **Vue 3 + Vite** Web 应用
- 通过云函数 HTTP API 访问 MySQL
- 部署：腾讯云静态网站托管 或 CloudBase 静态托管
- UI 配色：深蓝主色 `#3578F6`（与小程序暖纸色区分，体现专业高效）

---

## Phase 5 — 测试（预计 2-3 天）

- [ ] **5.1** 云函数单元测试（jest 或 vitest）
- [ ] **5.2** API 接口测试（Postman / 自动化脚本）
- [ ] **5.3** 前端功能回归测试（按 QA agent 的 3×3 身份权限矩阵）
- [ ] **5.4** 性能测试：日记列表分页、并发点赞
- [ ] **5.5** 安全测试：SQL 注入、XSS、权限越界
- [ ] **5.6** 真机兼容性测试（iOS / Android 各两个版本）

---

## Phase 6 — 部署与上线（预计 1-2 天）

- [ ] **6.1** TCB 环境切换到生产环境
- [ ] **6.2** 数据库索引优化 + 慢查询分析
- [ ] **6.3** 配置微信小程序合法域名
- [ ] **6.4** 云函数发布（上线版本）
- [ ] **6.5** 小程序代码上传 → 体验版测试 → 提交审核
- [ ] **6.6** 审核通过 → 发布上线
- [ ] **6.7** Git tag 打版 `v1.0.0`

---

## Phase 7 — 运维与迭代（持续）

- [ ] **7.1** 监控告警：云函数错误率、API 延迟、数据库慢查询
- [ ] **7.2** 日志系统：云函数日志 + 用户行为埋点
- [ ] **7.3** 数据备份：数据库定时备份
- [ ] **7.4** 后续功能迭代：通知推送、圈子/话题、AI 写作辅助

---

## 里程碑时间线

```
Week 1: Phase 1 (基础设施) ✅ Done + Phase 2 开始
Week 2: Phase 2 完成 (云函数) + Phase 3 开始 (前端改造)
Week 3: Phase 3 完成 (前端 API 接入) + Phase 4 开始 (管理后台)
Week 4-5: Phase 4 完成 (管理后台：Vue 3 + 4 模块 + KPI 看板)
Week 6: Phase 5 (测试) + Phase 6 (部署上线)
Week 7+: Phase 7 (运维监控 + 持续迭代)

> 微信在线支付不在范围内，会员付费采用线下转账 + 管理员手动确认模式。
```

---

## 关键文件速查

| 文件/目录 | 说明 |
|-----------|------|
| `miniprogram/data/mock.js` | 当前 mock 数据 schema（迁移基线） |
| `miniprogram/app.js` | globalData 方法和 `wx.cloud.init` 入口 |
| `miniprogram/api/` | **新建** API 封装层 |
| `miniprogram/cloudfunctions/` | **新建** 云函数目录 |
| `.claude/agents/` | Subagent 定义文件（按需分派） |
| `.claude/plans/devlog.md` | 开发日志（每次执行后更新） |
