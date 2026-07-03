# M1.5 首发功能包 · 功能测试用例（PRD v2.2 对齐）

> 用途：作为 Loop 开发 M1.5.1–M1.5.4 的**验收规格**。每个功能先按本文档编写自动化测试（确认失败）→ 实现 → 测试通过 → 打勾提交。
> 自动化用例通过 `test/fn-harness.js` 本地真实执行云函数（无需部署）；人工用例在 M2.2 于微信开发者工具批量回归。
> 用例 ID 规则：`模块-A/M-序号`（A=自动化，M=人工）。自动化测试文件与断言需标注对应用例 ID。

## 落地测试文件与 npm test 挂载

| 测试文件（待创建） | 覆盖 | 挂载时机 |
|---|---|---|
| `test/fn-activity-test.js` | ACT-A01 ~ A11 | M1.5.1 完成时 |
| `test/fn-permission-test.js` | PERM-A01 ~ A08 | M1.5.2 完成时 |
| `test/fn-referral-test.js` | REF-A01 ~ A09 | M1.5.4 完成时 |

全部遵循现有约定：直连 MySQL 校验副作用、测试数据以 `test_` 前缀创建并在结束时硬删、失败退出码非 0。

---

## M1.5.1 醒书活动模块 MVP

### 自动化用例（fn-activity-test.js）

| ID | 用例 | 预期 |
|----|------|------|
| ACT-A01 | 表结构 | `activities`、`activity_signups` 存在；signups 有 (activity_id, user_id) 唯一约束 |
| ACT-A02 | 活动列表 | `activity:list` 返回 upcoming/past 状态；`draft`（未上线）活动不出现 |
| ACT-A03 | 活动详情 | `activity:detail` 字段完整：标题/时间/地点/形式/名额/已报名数/图文（images 为数组） |
| ACT-A04 | 正常报名 | `activity:signup`（称呼必填）→ code 0；signups 新增一行；已报名数 +1 |
| ACT-A05 | 重复报名 | 同一用户对同一活动二次报名 → 拒绝（唯一约束），计数不变 |
| ACT-A06 | 名额已满 | signedUp ≥ capacity 时报名 → 拒绝并返回明确 msg |
| ACT-A07 | 截止时间 | 超过 signup_deadline 报名 → 拒绝 |
| ACT-A08 | 称呼必填 | 空称呼报名 → code -1 |
| ACT-A09 | 取消报名 | `activity:cancelSignup` → 行移除/失效，计数 -1；未报名者取消 → 报错 |
| ACT-A10 | 轻授权可报名 | 仅有 openid 的 guest 身份（未验证手机号）可正常报名——活动只需微信授权 |
| ACT-A11 | admin 活动管理 | admin 云函数：创建/编辑/上下线活动；报名名单查询返回称呼/联系方式/报名时间 |

### 人工用例（开发者工具，M2.2 执行）

| ID | 用例 | 预期 |
|----|------|------|
| ACT-M01 | Tab 栏 | 5 个 Tab，「醒书活动」位于第 2 位，图标与激活态正常 |
| ACT-M02 | 列表两分组 | 近期预告 / 往期回顾分组正确；角标三态（报名中/已报名/名额已满）与数据一致 |
| ACT-M03 | 详情三态报名栏 | 可报名（朱砂按钮）/ 已报名（可取消）/ 名额满（置灰）随数据切换 |
| ACT-M04 | 报名表单 | 称呼必填校验提示；联系方式可留空；成功/取消均有 toast |
| ACT-M05 | 往期回顾形态 | 顶部标「活动回顾」、无报名栏、图文与照片正常展示 |
| ACT-M06 | 视觉一致性 | 卡片/角标/进度条与原型（project/ 活动两屏）一致 |

---

## M1.5.2 日记权限矩阵收紧

### 自动化用例（fn-permission-test.js）

以三个种子身份执行：guest（未验证手机号）、authed（mock_me 类）、member（mock_yanqiu 类）+ 作者本人。

| ID | 用例 | 预期 |
|----|------|------|
| PERM-A01 | guest 看公众日记详情 | getDiaryDetail 返回引导码（约定 code=-3 needAuth），**响应不含 content 全文** |
| PERM-A02 | guest 看会员日记详情 | 同上（引导码，不泄露内容） |
| PERM-A03 | authed 看公众日记 | code 0，content 全文 |
| PERM-A04 | authed 看会员日记 | code 0，content 为服务端截断的前约 30%，带 `truncated: true`；**被截断部分不出现在响应任何字段** |
| PERM-A05 | member 看会员日记 | code 0，全文，无 truncated 标记 |
| PERM-A06 | 作者本人 | 作者（无论身份）看自己的会员/私密日记 → 全文 |
| PERM-A07 | 私密日记隔离 | 非作者任何身份：列表不出现、详情返回"日记不存在" |
| PERM-A08 | guest 列表可见范围 | getDiaryList square 对 guest 返回公众+会员日记**卡片**（标题/摘要），与 PRD 矩阵一致 |

> 注意：PERM-A08 是行为变更——当前实现 guest 列表只返回 public，需按 v2.1 矩阵放宽到"公众+会员的卡片可见"。摘要字段截断长度在实现时定义并断言。

### 人工用例

| ID | 用例 | 预期 |
|----|------|------|
| PERM-M01 | guest 点卡片 | 进入邀请式验证引导（非强制拦截弹窗），验证成功后直达该日记详情 |
| PERM-M02 | 渐隐视觉 | authed 打开会员日记：内容 30% 处渐隐遮罩 +「完整内容向会员开放」+ 开通入口跳转购买页 |
| PERM-M03 | 会员全文 | Tweaks/真实会员身份下无渐隐 |

---

## M1.5.3 授权页文案重构

| ID | 用例 | 预期 |
|----|------|------|
| AUTH-M01（人工） | 文案 | 标题「成为醒书的一员」；互动触发进入时显示情境文案；承诺文字在底部 |
| AUTH-M02（人工） | 触发点 | 详情点击/点赞/收藏/评论/新建 五个触发点均进入验证页 |
| AUTH-M03（人工） | 回跳 | 验证成功回到原页面并自动完成原动作（如直达刚才点的日记） |
| AUTH-A01（自动） | 身份升级 | updateUserProfile upgradeToAuthed：guest→authed 单向，不降级（已有覆盖，回归即可） |

---

## M1.5.4 分享海报带参码 + 推荐人

### 自动化用例（fn-referral-test.js）

| ID | 用例 | 预期 |
|----|------|------|
| REF-A01 | 表结构 | users 存在 `referrer_user_id` 列（可空，外键或逻辑引用 users.id） |
| REF-A02 | 新用户绑定 | login 携带 scene（分享人 A）且 openid 首次出现 → 新用户 referrer_user_id = A |
| REF-A03 | 不覆盖 | 已有推荐人的用户 login 携带分享人 B 的 scene → referrer 仍为 A |
| REF-A04 | 不可自荐 | scene 分享人 = 用户本人 → 不绑定（referrer 保持 NULL） |
| REF-A05 | 老用户扫码 | 无推荐人的**老**用户（非首次登录）扫码 → 不绑定，仅正常登录 |
| REF-A06 | scene 无效值 | 分享人 ID 不存在/非法 → 忽略，登录正常 |
| REF-A07 | admin 修改推荐人 | admin action 修改成功；admin_logs 记录（含旧值→新值） |
| REF-A08 | admin 校验-本人 | 推荐人选用户本人 → 拒绝 |
| REF-A09 | admin 校验-循环 | A 的推荐人是 B 时，把 B 的推荐人改为 A → 拒绝（互为推荐） |

### 人工用例（部分需部署后真机验证）

| ID | 用例 | 预期 |
|----|------|------|
| REF-M01 | 日记海报码 | 生成的小程序码扫码直达对应日记详情页（需部署 generateMiniCode 后验证） |
| REF-M02 | 活动海报码 | 扫码直达对应活动详情页 |
| REF-M03 | 端到端推荐 | 用新微信号扫他人分享码注册 → 管理后台该用户推荐人显示正确 |
| REF-M04 | 海报无推荐人信息 | 两种海报画面均不出现任何推荐人字样（参数仅在码中） |
| REF-M05 | admin 修改交互 | 用户详情「修改」→ 搜索选人/清空 → 即时生效；「他推荐的用户」列表正确 |

---

## Loop 开发协作约定

1. **每个子任务的循环节奏**：读本文档对应用例 → 创建/扩展 `fn-*-test.js`（断言注明用例 ID）→ 跑测试确认失败 → 实现功能 → 测试全绿 → `npm test` 回归 → 打勾 + devlog + commit。
2. **npm test 渐进挂载**：新测试文件在对应功能完成的同一提交中接入 `package.json` 的 test 脚本。
3. **不可本地自动化的项**（generateMiniCode 依赖微信 API、UI 交互）标注为人工用例，统一归入 M2.2 回归批次，勿在 loop 中阻塞。
4. 用例与 PRD 冲突时以 PRD 为准并同步修订本文档（记录修订原因）。
