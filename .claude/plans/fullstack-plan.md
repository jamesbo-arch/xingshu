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
- [x] **2.1.1** `login` — `wx.login()` → 获取 OpenID → 创建/更新用户记录 → 返回用户信息  `[Backend]`
- [x] **2.1.2** `getUserInfo` — 获取当前用户详情 + 统计数据  `[Backend]`
- [x] **2.1.3** `updateUserProfile` — 更新昵称、真实姓名、手机号  `[Backend]`
- ⏩ **2.1.4** `updateAvatar` — 移入上线路线图 **M1.2**

### 2.2 日记 CRUD
- [x] **2.2.1** `createDiary` — 创建日记（事务：INSERT diaries + diary_tags + 更新计数）  `[Backend]`
- [x] **2.2.2** `updateDiary` — 修改日记（校验归属、事务更新标签关联）  `[Backend]`
- [x] **2.2.3** `deleteDiary` — 软删除日记（status='deleted'，校验归属）  `[Backend]`
- [x] **2.2.4** `getDiaryList` — 分页获取日记列表（mode: square/collections/mine, 关键词/标签/作者/权限筛选）  `[Backend]`
- [x] **2.2.5** `getDiaryDetail` — 获取日记详情 + 互动状态 + 标签  `[Backend]`
- [x] **2.2.6** `searchDiaries` — 已合并到 `getDiaryList` 的 keyword 参数  `[Backend]`
- [x] **2.2.7** `uploadDiaryImage` — 上传日记配图到云存储（前端 wx.cloud.uploadFile 直传，diaries.images JSON 列存 fileID）  `[Frontend]`

### 2.3 社交互动
- [x] **2.3.1** `toggleLike` — 点赞/取消点赞（原子 INSERT/DELETE，更新计数）  `[Backend]`
- [x] **2.3.2** `toggleFavorite` — 收藏/取消收藏  `[Backend]`
- [x] **2.3.3** `createComment` — 发布评论/回复（支持 parent_id 嵌套）  `[Backend]`
- [x] **2.3.4** `getComments` — 获取评论列表（分页 + 嵌套回复 + isMine 标记）  `[Backend]`
- [x] **2.3.5** `deleteComment` — 删除评论（软删除，校验归属）  `[Backend]`

### 2.4 会员与订单（线下转账）
- [x] **2.4.1** `createOrder` — 管理员创建会员订单（线下转账确认后）  `[Backend]`
- [x] **2.4.2** `getOrderList` — 用户订单列表  `[Backend]`
- [x] **2.4.3** `checkMemberStatus` — 检查会员状态（含过期自动降级）  `[Backend]`
- [x] **2.4.4** `activateMember` — 管理员确认收款后激活会员  `[Backend]`

### 2.5 标签管理
- [x] **2.5.1** `getTags` — 获取全部标签（按使用量排序）  `[Backend]`
- [x] **2.5.2** `addTag` — 管理员添加标签（含重名校验）  `[Backend]`
- [x] **2.5.3** `updateTag` — 管理员编辑/禁用标签  `[Backend]`

### 2.6 小程序码生成
- [x] **2.6.1** `generateMiniCode` — 生成日记分享小程序码 → 云存储  `[Backend]`

---

## Phase 3 — 前端改造（预计 3-4 天）✅ 已完成

### 3.1 数据层重构
- [x] **3.1.1** 创建 `miniprogram/api/` HTTP 封装层（request/user/diary/social/tag）  `[Frontend]`
- [x] **3.1.2** 重构 `app.js` 移除 mock 依赖，改用云函数 + globalData 缓存  `[Frontend]`

### 3.2 认证接入
- [x] **3.2.1** `app.js onLaunch` 调用 `login` 云函数  `[Frontend]`
- [x] **3.2.2** 游客态：未登录可浏览公开内容  `[Frontend]`
- [x] **3.2.3** 会员态：member-guard 基于真实 identity 校验  `[Frontend]`

### 3.3 页面改造
- [x] **3.3.1** 广场页：分页加载（onReachBottom）+ mapper  `[Frontend]`
- [x] **3.3.2** 收藏页：分页加载 + mapper  `[Frontend]`
- [x] **3.3.3** 我的日记页：分页加载 + API 删除  `[Frontend]`
- [x] **3.3.4** 会员中心：真实用户数据 + updateProfile API  `[Frontend]`
- [x] **3.3.5** 详情页：真实评论发布 + mapper 适配  `[Frontend]`
- [x] **3.3.6** 撰写页：createDiary/updateDiary API 调用  `[Frontend]`

### 3.4 离线与容错
- [x] **3.4.1** 网络异常：request.js 统一错误处理 + toast 提示  `[Frontend]`
- [x] **3.4.2** 乐观更新：点赞/收藏即时更新 UI + API 同步  `[Frontend]`
- [x] **3.4.3** 本地缓存（utils/cache.js TTL 封装；标签 + 广场首屏 stale-while-revalidate）  `[Frontend]`

---

## Phase 4 — 管理后台（独立 Web 应用）✅ 已完成

> 依据：PRD 第 5.2 节 + 原型 `doc/醒书日记-原型设计/untitled/project/src/admin/`

### 4.1 首页 — 数据概览
- [x] **4.1.1** KPI 卡片：总用户数、会员数、日记数、总互动数、收入  `[Frontend]`
- [x] **4.1.2** 趋势图：用户增长、日记发布、互动数据趋势（日/周/月/年切换）  `[Frontend]`
- [x] **4.1.3** 最近活动流：新注册、新日记、到期提醒、订单记录  `[Frontend]`
- [x] **4.1.4** 数据每10分钟自动刷新，Hover 显示具体数值  `[Frontend]`

### 4.2 用户管理
- [x] **4.2.1** 用户列表：表格（ID/手机号/昵称/身份/会员期/注册时间）+ 关键词筛选  `[Frontend]`
- [x] **4.2.2** 筛选条件：按身份类型筛选  `[Frontend]`
- [x] **4.2.3** 用户详情页：基础信息 + 发布日记列表  `[Frontend]`
- ⏩ **4.2.4** 导出用户列表（Excel）— 移入上线路线图 **M1.4**

### 4.3 日记管理
- [x] **4.3.1** 日记列表：表格（ID/标题/作者/时间/权限/互动数据）+ 筛选  `[Frontend]`
- [x] **4.3.2** 筛选条件：关键词（标题/内容）、权限类型  `[Frontend]`
- [x] **4.3.3** 日记详情页：完整内容 + 评论列表  `[Frontend]`
- [x] **4.3.4** 单个删除日记 + 删除评论  `[Frontend]`
- ⏩ **4.3.5** 批量操作 — 移入上线路线图 **M1.4**

### 4.4 互动数据管理
- [x] **4.4.1** 评论数据页：按内容/用户筛选，支持删除  `[Frontend]`
- [x] **4.4.2** 点赞/收藏/转发（tab 扩展预留）  `[Frontend]`

### 4.5 技术方案（已实施）
- **Vue 3 + Vite** Web 应用（`admin/` 目录）  `[Frontend]`
- Vue Router 4 单页路由（6 个页面）
- Mock 数据层（API 接口对齐 MySQL schema）
- 构建产物 ~100KB（JS + CSS 总量 ~36KB gzip）
- UI 配色：深蓝主色 `#3578F6`（PRD 规范）

---

## Phase 5 — 测试（预计 2-3 天）✅ 已完成

- [x] **5.1** 安全审查：21 个云函数全面扫描，修复 2 CRITICAL + 4 HIGH  `[QA]`
- [x] **5.2** API 集成测试：15 项 MySQL 直接验证，全部通过  `[QA]`
- [x] **5.3** 回归测试清单：3×3 身份权限矩阵 + 6 页面 + 3 组件  `[QA]`
- ⏩ **5.4** 真机/性能测试 — 移入上线路线图 **M2.3**

---

## Phase 6 — 部署与上线（预计 1-2 天）

- ⏩ **6.1** — 移入上线路线图 **M3.2**
- [x] **6.2** 数据库索引优化 + 慢查询分析（热路径复合索引 idx_status_created，清理 2 处冗余；慢查询日志需上线后在服务端开启）  `[Backend]`
- ⏩ **6.3** — 移入上线路线图 **M3.3**
- ⏩ **6.4** — 移入上线路线图 **M3.4**
- ⏩ **6.5** — 移入上线路线图 **M4.1**
- ⏩ **6.6** — 移入上线路线图 **M4.2**
- ⏩ **6.7** — 移入上线路线图 **M4.3**

---

## Phase 7 — 运维与迭代（持续）

- ⏩ **7.1** — 移入上线路线图 **M5.1**
- ⏩ **7.2** — 移入上线路线图 **M5.2**
- [x] **7.3** 数据备份：数据库定时备份（`npm run backup`，含 --verify 恢复校验；定时调度的 schtasks 命令见脚本头部注释，需宿主机手动启用）  `[Backend]`
- ⏩ **7.4** — 移入上线路线图 **M5.3**

---

## 上线路线图（剩余任务重组，2026-07-03）

> 原 Phase 编号保留用于溯源（括号内标注），**执行顺序与勾选状态以本表为准**，各 Phase 章节中对应条目已改为指针。
> 排序原则：① 依赖链优先——先做解锁性任务；② 责任人分批——Claude 可独立完成的排前面集中清掉，需用户在场的操作归拢成批，减少来回切换。
> 微信在线支付不在范围内，会员付费采用线下转账 + 管理员手动确认模式。

### M1 — 开发收尾（Claude 为主，头部有 2 个用户决策）

- [x] **M1.1** 处置 member/auth 页未提交改动 — 用户确认全部提交（5d764b4 UI 升级 / f93e520 配置 / 6d1d13c 文档）
- [x] **M1.2** (=2.1.4) 头像上传 — 核验发现 Phase 6 已实现（chooseAvatar → wx.cloud.uploadFile avatars/ → updateUserProfile），harness 回环验证通过
- [x] **M1.3** 管理后台对接真实云函数 API — admin 云函数（action 路由 + 密码登录 HMAC token）+ js-sdk 接入 + Login 页；11 条测试全绿。待用户：TCB 开匿名登录 + 部署 admin 云函数
- [ ] **M1.4** (=4.2.4 + 4.3.5) admin 导出用户 Excel + 批量操作  `[Claude]`

### M1.5 — PRD v2.1 首发功能包（Claude 为主；用户已确认活动模块首发、从简）

> 依据 PRD v2.1/v2.2（2026-07-03）。入选原则：活动模块为用户明确的首发必备；权限矩阵收紧属行为变更，上线后再改会造成体验混乱，必须随首发；授权页文案为低成本捎带项。其余 v2 功能全部归入 M6 上线后迭代。
> **验收规格**：`test/m15-test-cases.md`（原型已验收：project/ 活动两屏 + 海报）。每个子任务按"用例→测试先行→实现→全绿→打勾"的循环节奏执行。

- [ ] **M1.5.1** 醒书活动模块 MVP  `[Backend+Frontend]`
    - MySQL 新表：`activities`（标题/封面/正文/图片 JSON/时间/地点/线上线下/名额/报名截止/状态）+ `activity_signups`（activity_id + user_id 唯一，称呼必填、联系方式选填）
    - 云函数：`activity`（action 路由：list / detail / signup / cancelSignup，参照 admin 函数模式）；admin 云函数扩展活动管理 action（CRUD + 报名名单）
    - 小程序：新增 activities Tab 页（预告/往期两态）+ activity-detail 页（文字+图片、一键报名/取消）；tabBar 扩为 5 个（需图标素材）
    - 管理后台：Activities 管理页（创建/编辑/上下线 + 报名名单查看）
    - 范围红线：不做可配置表单、候补、核销、富文本、提醒、Excel 导出（见 PRD 3.1.7 首发范围划分）
- [ ] **M1.5.2** 日记权限矩阵收紧（PRD v2.1 矩阵表）  `[Backend+Frontend]`
    - getDiaryDetail：guest 请求公众日记返回引导码；authed 请求会员日记返回服务端截断的前 30% + truncated 标记
    - 详情页：guest 点击卡片进入验证引导（邀请式文案）；会员日记渐隐遮罩 + "完整内容向会员开放" + 开通入口
- [ ] **M1.5.3** 授权页文案重构 + 小程序名称"醒书"  `[Frontend]`
    - auth 页文案改为"成为醒书的一员"邀请式（PRD 5.1.12）；小程序展示名称改"醒书"（微信平台侧改名需用户在 mp 后台操作）
- [ ] **M1.5.4** 分享海报带参码 + 推荐人绑定（PRD v2.2）  `[Backend+Frontend]`
    - `generateMiniCode` 云函数扩展：支持日记/活动两种目标 + scene 携带分享人用户 ID（wxacode.getUnlimited）
    - `users` 表加 `referrer_user_id` 列；login 云函数解析启动 scene，新用户首次绑定推荐人（不覆盖、不可自荐）
    - 小程序：app onLaunch/onShow 解析 scene 直达对应详情页；活动详情页加分享入口 + 活动海报弹层（复用 poster-sheet 模式）；日记海报二维码替换为真实带参码
    - admin 后台：用户列表/详情展示推荐人与"他推荐的用户"；管理员可修改/清空用户推荐人（校验非本人、无循环，写 admin_logs）

### M2 — 部署与人工验证（需用户在场，建议一次批处理）

- [ ] **M2.1** 云函数部署到 dev 环境——createDiary/updateDiary 配图支持等本轮新代码上线  `[用户/CI-CD]`
- [ ] **M2.2** 开发者工具人工回归：配图上传 UI、断网冷启动缓存展示、弱网触底翻页、auth 流程（对照 `test/checklist.md`）`[用户+QA]`
- [ ] **M2.3** (=5.4) 真机/性能测试  `[用户+QA]`

### M3 — 安全加固与生产准备（用户 + Claude 协作）

- [ ] **M3.1** 数据库密码轮换：改 MySQL 密码 → 更新 `.env` → `npm run sync-db` → 重新部署全部云函数（**顺序不可颠倒**，密码已进 Git 历史，上线前必做）`[用户+Backend]`
- [ ] **M3.2** (=6.1) TCB 环境切换到生产环境  `[CI/CD]`
- [ ] **M3.3** (=6.3) 配置微信小程序合法域名  `[CI/CD]`
- [ ] **M3.4** (=6.4) 云函数发布（上线版本）  `[CI/CD]`

### M4 — 提审上线（用户，微信平台人工门槛）

- [ ] **M4.1** (=6.5) 小程序代码上传 → 体验版测试 → 提交审核  `[CI/CD]`
- [ ] **M4.2** (=6.6) 审核通过 → 发布上线  `[CI/CD]`
- [ ] **M4.3** (=6.7) Git tag 打版 `v1.0.0`  `[CI/CD]`

### M5 — 上线后运维（持续，不阻塞上线）

- [ ] **M5.1** (=7.1) 监控告警：云函数错误率、API 延迟、数据库慢查询  `[CI/CD]`
- [ ] **M5.2** (=7.2) 日志系统：云函数日志 + 用户行为埋点  `[Backend]`
- [ ] **M5.3** (=7.4) 后续功能迭代：通知推送、圈子/话题、AI 写作辅助  `[Product]`

### M6 — PRD v2 产品迭代（上线后，优先级由运营数据驱动）

- [ ] **M6.1** 五步引导流：落地欢迎屏、授权欢迎时刻页、首篇高光时刻页、首篇特殊规则（标题可选/默认私密/微鼓励）  `[Frontend]`
- [ ] **M6.2** 今日话题：话题表 + 云函数 + compose 页话题引导 + 后台话题管理  `[Backend+Frontend]`
- [ ] **M6.3** 编辑精选：精选表 + 广场首屏策展 + 后台精选管理（含当日金句）  `[Backend+Frontend]`
- [ ] **M6.4** 创作激励与荣誉：官方首篇回应队列、连续记录徽章、会员时长赠送  `[Backend+Frontend]`
- [ ] **M6.5** 转化漏斗埋点与后台漏斗看板（北极星：授权→首篇创作转化率）  `[Backend]`
- [ ] **M6.6** 活动模块迭代：可配置报名表单、候补、核销签到、富文本、提醒、报名导出  `[Backend+Frontend]`
- [ ] **M6.7** 月卡 30 元体验套餐（备选，视年卡转化数据决定是否启用）  `[Product]`

### 依赖关系一览

```
M1.1(用户决策) ──→ M1.2 ─┐
M1.3 ──→ M1.4 ──────────┼──→ M1.5.*（v2.1 首发功能包）──→ M2.1 ──→ M2.2 ──→ M2.3 ──→ M3.* ──→ M4.* 
                         │            （M3.1 密码轮换可提前，最晚不晚于 M3.4）
                         ├── M5.* 独立，上线后进行
                         └── M6.* 上线后迭代（依赖 M4 发布；M6 内部无强依赖，按运营数据排优先级）
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
