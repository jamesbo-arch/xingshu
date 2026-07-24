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

"醒书日记"（Xingshu Diary，产品品牌名）—— 一款带有社区互动和会员体系的微信小程序**故事**应用（内容实体于 2026-07-17 由「日记」全面改名「故事」，代码/表/云函数标识符均为 story）。最初在 `project/` 目录下以 HTML/CSS/JS 原型设计，然后在 `miniprogram/` 目录下实现。设计交接的聊天记录位于 `chats/chat1.md`。

应用有三种用户身份等级（`guest`、`authed`、`member`）；故事与问答均只有**两态**（`publish_status`：`draft` 暂存仅自己可见 / `published` 发布后面向会员），公众可见性由后台**精选**（`featured_stories` / `featured_questions` 副本表 + `is_featured` 标志）决定。后端采用腾讯 CloudBase 云函数（24 个小程序端 + admin + backupDb）+ MySQL 数据库（经 cpolar 隧道 `33.tcp.cpolar.top:11028` 连接）。身份认证（PRD v2.3）：微信登录半屏弹窗（`components/login-sheet`）仅获取 openid/unionid，登录后升级为 `authed`，不涉及手机号；会员通过线下转账 + 管理员手动确认激活；会员中心可退出登录（回退 guest，重新登录恢复会员）。`data/mock.js` 仅保留作为设计参考，不再用于运行时数据。

## 身份权限矩阵（前端功能差异，v2.0 四页签版）

三种身份的**实际功能差异**如下（以代码鉴权逻辑为准，改动鉴权时同步更新本表）：

| 功能 | guest 未授权 | authed 已授权非会员 | member 会员 |
|---|:---:|:---:|:---:|
| **底部页签** | **4 个**（广场/故事/问答/会员），三身份**固定相同** | 同左 | 同左 |
| 浏览故事列表 | ✅ 仅**精选故事**（副本全文） | ✅ 仅**精选故事**（副本全文） | ✅ **全部已发布故事**（原文全文，精选带金星徽章）；可点星标切精选视图 |
| 暂存(draft)故事进列表 | ❌（所有人均不进，仅作者「我的故事」可见，他人访问按不存在处理） | ❌ | ❌ |
| 打开故事详情读全文 | ✅ **精选故事免登录可读**；未精选→**-2 会员专享** | ✅ 精选→副本全文；未精选→-2 | ✅ 原文全文 |
| 点赞 / 收藏 | ❌ 点击那刻触发登录，登录后自动续做 | ✅（精选故事的互动**落在原故事**，计数共享） | ✅ |
| **评论故事**（v2.0 收窄） | ❌ | ❌ **会员专享**（服务端 -2） | ✅（仅原文视图；精选视图无评论区） |
| 写故事 / 编辑（暂存/发布两按钮） | ❌ 会员专享，弹窗引导开通 | ❌ 会员专享，弹窗引导开通 | ✅ |
| 浏览问答列表 / 详情 | ✅ 仅**精选问答**（副本正文 + **全部回复只读**） | ✅ 同 guest | ✅ 全部已发布问答原文 |
| 问答点赞 / 收藏 | ❌ 触发登录 | ✅ | ✅ |
| **发问 / 回答**（可匿名） | ❌ 会员专享 | ❌ 会员专享 | ✅ |
| 分享海报（**仅精选故事**有分享按钮） | ❌ 触发登录（海报含推荐码） | ✅ 含推荐人 | ✅ 含推荐人 |
| 转发好友（右上角原生菜单，所有故事可用） | ⚠️ 能转发，但不计分享数、无推荐人归属（原生菜单无法拦截） | ✅ 含推荐人 | ✅ 含推荐人 |
| 浏览活动列表 / 顶部 Banner | ✅ 免登录 | ✅ | ✅ |
| 进活动详情 / 报名 / 收藏活动 | ❌ 进详情即需登录 | ✅ | ✅ |
| **发布现场分享**（v2.0 收窄） | ❌ | ❌ | ⚠️ 仅该活动**主理人 / 工作人员**（与会员身份无关） |
| 编辑个人资料（昵称/姓名/手机号/头像） | ❌ 触发登录 | ✅ | ✅ |
| 会员状态 / 有效期 | — | 显示"开通引导" | ✅ 显示到期日 |

**v2.0 起「点赞数」全站不展示**（故事与问答的列表、详情均只显示自己是否已赞）；问答卡片保留**回答数**——答案数是问答的核心信息。

**要点**：
1. `guest → authed` 门槛（v3.0 收窄）：**精选故事对公众完全开放**——未登录也可进详情读全文（内容是运营认可的对外内容，登录墙前置只会挡住传播）。登录只拦**互动**：点赞/收藏/海报分享由 `utils/auth-guard.js` 的 `ensureLogin()` 在点击那刻拉起，登录成功后自动续做。（写故事/发问/评论另由 `ensureMember()` 与服务端会员校验拦，见下）
2. `authed → member` 的**实质差异**（v2.0 扩为四条）：① 读**全部已发布故事/问答的原文**（非会员只能看精选副本，未精选详情 -2）；② **写 / 编辑故事**；③ **发问 / 回答问答**；④ **评论故事**（v2.0 由 authed 收窄至会员，服务端 `createStoryComment` 返回 -2 兜底）。其余互动（点赞/收藏/分享/报名/收藏活动）authed 与 member **完全一致**。
2b. **页签（v2.0 起固定 4 个）**：醒书广场（首页，路由 `pages/activities`，内容为活动列表）/ 醒书故事 / 醒书问答 / 醒书会员，`custom-tab-bar/index.js` 的 `FULL_LIST` 全部 `minRole: 'guest'`。**「我的收藏」「我的故事」「我的问答」均不占页签**，入口收在醒书会员页的入口行（`navigateTo` 打开，页面仍在 app.json 的 pages 中注册、不在 tabBar.list）；authed 只给「我的收藏」一行（非会员无故事/问答可写）。`minRole` + `RANK` 的按身份裁剪机制**保留不删**（未来若再引入身份专属页签可直接复用）；`refresh(pagePath)` 按当前路径在裁剪后的列表里算 selected，**禁止用硬编码索引**。
3. **精选机制（v3.0 起，v2.0 由故事扩展到问答；「善选」已于 v2.0 全面改称「精选」，代码标识符与表名仍为 featured）**：管理员在后台「精选管理」按热度榜（`点赞*w1+收藏*w2+评论*w3`，权重可配默认 1/1/1）人工勾选纳入——拷贝原文生成 `featured_stories` / `featured_questions` **副本**（可修订，不影响作者原文），并置 `is_featured=1`。副本可上/下架（联动 is_featured）；作者删除或后台删除原内容时副本联动下架。精选内容的点赞/评论/收藏/计数**共享原内容**（target 均为原 id）。徽章口径（2026-07-17 对调）：**眼睛（ic-eye）=已发布**，**金星（ic-star-gold）=已入选精选**，折角文档（ic-draft）=暂存稿。
3a. **精选视图无评论（v2.0）**：精选副本是面向公众的对外版本，**一律不提供评论区**——非会员看到的、会员点星标筛选后看到的都是它。story-card 的 `featuredView` 属性隐藏评论计数；detail 页按后端回报的 `viaFeatured` 隐藏整个评论区与写评论入口。**问答例外**：精选问答**展示全部回复但只读**（回复即答案，藏起来就没有阅读价值），由 `qa.detail` 的 `canReply` 控制发送入口。
3b. **分享口径（v3.1）**：**分享海报仅精选故事提供**（story-card 与 detail 底栏的分享按钮按 `isFeatured` 显示；poster-sheet 仅「保存图片」一个按钮）。海报含**精选副本全文**（poster-sheet 经 `getStoryDetail { preferFeatured: true, silent: true }` 取副本）、无作者名、底部为**醒书咨询品牌栏**（驼色底 + 书本标 + 简介 + 带参小程序码），画布高度随全文动态计算（>6000px 截断加"扫码阅读全文"提示）。非精选故事只能走**右上角原生转发**；非会员点开转发链接：guest 先拉登录（可能本就是会员），登录后仍非会员 → toast 提示 + `switchTab` 转故事页看精选列表。
3c. **阅读记录（v3.1，v2.0 调整）**：`story_reads` 表（story_id/user_id/identity/via_featured/created_at，FK：story CASCADE、user SET NULL）。`getStoryDetail` 每次成功阅读落一行——**作者自读与 `silent` 不记**。v2.0 把「取精选副本」与「是否记阅读」拆成两个参数：`preferFeatured` 只管取副本，`silent` 才跳过记录。海报生成传 `silent`（那不是一次真实阅读），会员在星标筛选态阅读只传 `preferFeatured`、**照常计入**。readerId 取实际 users 行（guest 也记）。
4. 卡片「金色底 / 会徽章」按**作者身份**渲染（非会员作者金色卡、会员作者「会」徽章），与**浏览者**身份无关。
5. 鉴权判定的代码来源：详情级 `getStoryDetail` / `qa.detail`（不存在/draft 非作者 `-1` → 作者/member 原文 → **非会员含 guest**：命中上架副本则副本覆盖内容、未命中 `-2`）、列表级 `getStoryList` / `qa.list`（member/作者查原表；非会员含 guest JOIN 精选副本表返回副本全文）、前端动作级 `ensureLogin()`（**仅拦互动**：点赞/收藏/海报分享）与 `ensureMember()`（写/编辑故事、发问，拦所有非有效会员），服务端 `createStoryComment` / `qa.commentCreate` 再做会员兜底。**退出登录即回游客视角**：各云函数均把 `userId` 收窄为「授权态才取」（`userIdentity !== 'guest'`），故退出态用户不认作者特权（读不到自己的 draft）、不带出历史点赞/收藏态。
5b. **醒书问答（v2.0 新模块）**：`questions`（仅正文帖子式无标题、`is_anonymous`、`publish_status` draft/published、`is_featured`）+ `question_comments`（一层 `parent_id`，可匿名）+ `featured_questions`（精选副本）。云函数 `qa`（action 路由）：`list`/`detail`/`create`/`update`/`remove`/`commentList`/`commentCreate`/`commentDelete`/`like`/`favToggle`。**匿名脱敏**在服务端 `maskAuthor(row, scopeId)` 做——`is_anonymous=1` 即把昵称换成「**醒书同学**」、抹掉 `avatar_url`/`avatar_hue` 与会员徽章，**并删除 `user_id`**（否则拿匿名帖的 user_id 比对同一人的实名帖即可反查身份，脱敏形同虚设）。**对作者本人也不例外**（匿名要彻底；作者看到自己真名反而会怀疑匿名没生效）。「这条是不是我发的」由独立的 `isMine` 字段承担，删除按钮据它显示，不依赖昵称。
**匿名头像底色** `anon_hue`：由 `anonHue(scopeId, userId)`（FNV-1a）派生成 0~359 交给 `hueToColor()` 取色，前端渲染默认「醒」字 + 该底色。**scopeId 取问题 id，刻意按问题分域**——同一串问答里同一个人恒定同色、不同人不同色（正是要区分的场景），跨问答则不一致，避免凭颜色把同一匿名者散落各处的发言串成一条线。
**admin 后台走独立查询，始终返回真实作者**（另带 `isAnonymous` 标记供运营知情）。页面：`pages/qa`（页签）/`qa-detail`/`qa-compose`/`my-qa`，卡片组件 `components/qa-card`。
5c. **活动页 Banner 与收藏（v2.0）**：`banners` 表（image_url / title / `link_type` none|detail / content_rich / sort / is_active），小程序 `activity.bannerList` 只返回启用项按 sort 升序、**不外泄 content_rich**；`link_type='detail'` 才可点进 `pages/banner-detail`（rich-text 渲染，免登录）。后台强制「选跳详情页则详情内容非空」——否则用户点进去是白页。活动收藏走 `interactions` 的 `target_type='activity'`（`activity.favToggle` / `favList`）。**活动页布局**：Banner 与筛选栏 `flex-shrink:0` 固定，只有列表 `.act-scroll` 可滚（`flex:1` + **`min-height:0`**——缺了它 flex 子项会被内容撑开、把列表顶出屏幕）。**筛选全在本地做**：`_loadAll()` 一次取回全量（后端 mode:'all' 本就不分页），`_applyFilter()` 按 `activeTypeId`/`activeMonth` 过滤并插月份分隔行；月份候选由活动实际分布派生，故不会出现空月份。类型/月份各用一个**下拉面板**（`.filter-wrap` 相对定位 + `.dropdown` 绝对定位 `top:100%`），点按钮就地展开、选项换行平铺（原横滑 chip 在类型变多后难选）；`.dd-mask` 铺满屏接住外部点击收起，其 `z-index:10` **低于** `.filter-wrap` 的 `20`，故筛选按钮本身始终可点（可直接切另一个下拉）。面板贴顶展开不到底部，无需像底部弹层那样收 tab-bar。**现场分享发布权 v2.0 收窄为主理人/工作人员**（`postCreate` 与 `detail.canPost` 均走既有的 `isStatsViewer()`，普通报名用户不再有入口）；活动分享子栏目由 `pages/activities/index.js` 顶部的 `SHOW_FEED = false` 隐藏，**瀑布流与发布弹层代码全部保留**，置回 true 即恢复。
6. **身份两字段语义（2026-07-15 起）**：`users.identity` 只存**授权态**（`guest`=未登录/已退出，`authed`=已授权），**不再落库 `member`**；会员资格的唯一真相源是 `member_until`（`member_until >= 今天` 即有效会员，到期当天仍算）。对外 `identity` 一律为**派生值**，前端/admin 判断口径不变：小程序侧（权限口径）= 已授权且会员期有效 → `member`，guest 优先（退出登录的会员按 guest 拦截，重新登录即恢复 member）；admin 侧（资格口径）= 会员期有效即显示 `member`（含退出态，退费入口据此可用）。故事卡片的作者徽章（金卡/「会」徽章）按**作者 `member_until`** 派生，与作者登录态无关。建单/退费/后台设会员只写 `member_from`/`member_until`，**不动授权态**。有效会员判定 SQL 统一为 `identity <> 'guest' AND member_until >= CURDATE()`（内容闸/发文守卫），**写/编辑故事本身即要求有效会员**。因此**每个会员都必须有 `member_until`**（管理后台建单/设会员时强制填写）。历史库存的 `identity='member'` 已迁移为 `authed`（prod 上线需执行 `UPDATE users SET identity='authed' WHERE identity='member'`）。
6b. **v2.0 改版迁移（2026-07-22）**：`scripts/migrate-v2.js`（幂等）新建 `banners` / `questions` / `question_comments` / `featured_questions` 四表，并把 `interactions.target_type` 枚举扩为 `('comment','activity_post','story','activity','question')`。dev 库已执行；**prod 上线需执行 `XINGSHU_ENV_FILE=.env.prod node scripts/migrate-v2.js`**（先 backup-db），或走 `scripts/init-prod.js` 全新初始化（按 dev 现行结构复制，自动带上新表）。同时须全量部署云函数（新增 `qa`，改动 `activity`/`admin`/`getStoryList`/`getStoryDetail`/`createStoryComment`）并重新构建发布 admin。
7. **日记→故事迁移（2026-07-17，破坏性发版）**：表 `diaries→stories`、`diary_tags→story_tags`，列 `comments.diary_id→story_id`、`users.diary_count→story_count`，`interactions.target_type` 枚举 `diary→story`；`permission` 三态列已删除（private→draft，其余→published，存量公众日记批量转会员可读）；新增 `featured_stories` 表与 `stories.publish_status/is_featured`。云函数改名：`createDiary/updateDiary/deleteDiary/getDiaryDetail/getDiaryList → createStory/updateStory/deleteStory/getStoryDetail/getStoryList`（入参 `diaryId→storyId`、`permission→publishStatus`）。**页面路由与 scene `d=` 前缀保留不改**（旧分享码/路径兼容）。dev 库已迁移；**prod 上线需执行 `XINGSHU_ENV_FILE=.env.prod node scripts/migrate-diary-to-story.js`（先 backup-db），且须在新版过审后、点发布前的窗口内完成迁移+全量部署云函数**，旧版小程序在窗口后不可用（app.js 已加 UpdateManager 强制更新）。

## 开发方式

在微信开发者工具中打开 `miniprogram/` 作为项目根目录。appid 为 `wx454274f515182d02`，基础库版本 `2.26.0`。

项目为纯微信小程序原生代码——每个页面/组件包含四种文件：`.js`、`.json`、`.wxml`、`.wxss`。

`miniprogram/project.private.config.json` 由微信开发者工具本地生成（含个人 libVersion、compileHotReLoad 等设置），**不得纳入 Git 追踪**，已在 `.gitignore` 中排除。

### 小程序编码约定（踩坑记，务必遵守）

以下几条都因静态读码难发现、需真机才现形，务必默认遵守：

1. **WXML 绑定禁用方法调用判断选中/包含**：`{{arr.indexOf(x) >= 0}}` / `.includes()` 在 WXML `{{}}` 表达式中**不可靠、静默失效**（等值判断如 `a === b` 才可靠）。多选/选中态一律在 JS 预算**布尔查找表**对象，绑 `{{set[key]}}`（如 filter-sheet 的 `tagSet/yearSet/monthSet`、compose 的 `pickerTagSet`）。
2. **自定义组件用全局类必须开 `addGlobalClass`**：组件默认样式隔离，`app.wxss` 的全局类（seal-tag/perm-badge/btn-primary 等）穿不进组件——须在 `Component({ options: { addGlobalClass: true } })`。页面（Page）不隔离，无需此项。
3. **`dataset` 数字值可能变字符串**：`data-x="{{numberVal}}"` 取出常为字符串，与数字比较会不匹配——handler 里 `Number()` 强制转换。
4. **底部弹层被自定义 tab-bar 遮挡**：custom-tab-bar 是独立层（盖在页面级弹层之上，z-index 不跨层比较）。tab 页上的底部 sheet 打开时应隐藏 tab-bar（`getTabBar().setData({ hidden: true })`，见 square 的 `_tabBar()`），而非靠 padding 避让。非 tab 页（如 collections）无此问题，无需该处理。

## Git 提交规则

**`.claude/` 目录（含 agents、skills、settings）必须纳入 Git 追踪并在每次变更后推送。** 这些文件是项目开发环境的重要组成部分，与源代码等同对待。（开发日志 `doc/devlog.md` 与开发计划 `doc/fullstack-plan.md` 已于 2026-07-04 迁出 `.claude/`，见「开发日志维护」。）

**分支模型（v1.0.2 发版后启用，Phase 分支已退休）**：`main` 为始终可发布的主干，日常迭代直接在 `main` 上进行（较大功能可开短命 `feat/xxx`、`fix/xxx` 分支后合回 `main`）；不再创建 `phaseN` 分支。GitHub 仅作代码备份，实际发布以本机上传微信后台为准。历史 Phase 分支（phase1~phase6）保留不删。

## 版本与发版流程（强制）

**版本号语义（与微信后台版本号一致）**：`主.次.修`（MAJOR.MINOR.PATCH）——PATCH 修复/小优化（如下拉刷新、权限修复）；MINOR 用户可感知的新功能（如新页面、性别字段）；MAJOR 大改版/不兼容重构。git tag 名为 `v主.次.修`（如 `v1.0.2`），与每次上传微信后台的版本号一一对应。

**当用户说"发版 vX.Y.Z"（或"发版"由 Claude 建议版本号）时，Claude 自动执行**：
1. **汇总变更**：`git log <上一个tag>..HEAD` 取自上个 tag 以来的提交，提炼成**用户可感知的更新要点**（不是逐条 commit，而是产品视角归类，可参考 `doc/devlog.md`）。
2. **打带注释的 tag**：`git tag -a vX.Y.Z -m "<汇总要点>"` 并 `git push origin vX.Y.Z`。tag 指向当前发布的代码 commit。
3. **更新产品更新日志**：在 `doc/产品更新日志.md` **顶部**追加该版本条目（版本号 + 日期 + 更新要点，面向产品/运营，最新在最上）。
4. **同步版本号单一来源**：把仓库根 `package.json` 的 `version` 字段改为 X.Y.Z（管理后台侧边栏「vX.Y.Z · 运营后台」读取此字段，需重新 build 后生效）。
5. tag 与更新日志的"当前版本"须一致；`doc/devlog.md`（技术细节）与 `doc/产品更新日志.md`（版本要点）分工不同，两者都维护。

已发布：`v1.0.2`（2026-07-08，首个体验版）。

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

### 页面（v2.0 起共 14 个：4 个 tab 页 + 10 个非 tab 页）

| 页面 | 路由 | Tab | 用途 |
|------|-------|-----|---------|
| activities | `pages/activities/index` | **是 (0)** | 醒书广场——**小程序首页**（页签文案「醒书广场」，路由名仍为 activities）：顶部 Banner 轮播 + 活动列表（分享子栏目已隐藏） |
| stories | `pages/stories/index` | 是 (1) | 醒书故事——故事流，搜索、筛选、星标精选筛选（原路由 square，2026-07-24 改名 stories 以匹配内容） |
| qa | `pages/qa/index` | 是 (2) | 醒书问答——问答流，会员可发问 |
| member | `pages/member/index` | 是 (3) | 醒书会员——会员信息、购买流程、个人资料、我的故事/问答/收藏入口、设置 |
| collections | `pages/collections/index` | 否 | 我的收藏——故事 / 问答 / 活动三段（入口在醒书会员） |
| my-stories | `pages/my-stories/index` | 否 | 我的故事——自己的故事（含暂存），编辑/删除、作者数据视角（入口在醒书会员）（2026-07-24 由 mine 改名） |
| my-qa | `pages/my-qa/index` | 否 | 我的问答——自己的问答（含暂存），编辑/删除（入口在醒书会员） |
| story-detail | `pages/story-detail/index` | 否 | 故事详情——全文及评论，点赞/收藏/分享（精选视图无评论区）（2026-07-24 由 detail 改名；scene 前缀仍 `d=` 保兼容） |
| story-compose | `pages/story-compose/index` | 否 | 写故事——新建/编辑，含标签与暂存/发布（2026-07-24 由 compose 改名） |
| qa-detail | `pages/qa-detail/index` | 否 | 问答详情——问题正文 + 回答区（公众版只读） |
| qa-compose | `pages/qa-compose/index` | 否 | 提问——仅正文 + 匿名开关 + 暂存/发布 |
| activity-detail | `pages/activity-detail/index` | 否 | 活动详情——图文、报名/取消、收藏、邀请函、现场分享 |
| activity-stats | `pages/activity-stats/index` | 否 | 报名数据——主理人/工作人员移动端查看 |
| banner-detail | `pages/banner-detail/index` | 否 | Banner 详情——活动介绍类图文（rich-text，免登录） |

（另有 `pages/doc/index` 协议页。）原 `pages/auth`（手机号验证页）已于 PRD v2.3 废除，登录改为 `components/login-sheet` 半屏弹窗（仅取 openid/unionid，不涉及手机号）。

### 共享组件

- **`story-card`** — 列表中的单张故事卡片（头像、标签、状态徽章、操作栏）。触发 `open`、`like`、`fav`、`edit`、`delete`、`share` 事件。在故事页/收藏页/我的故事列表中复用。点击♡时有 +1 浮动淡出动画（CSS `@keyframes like-float-up`）。属性 `ownerStats`（作者数据视角，统计项改为查看人员清单）、`featuredView`（v2.0 精选视图，隐藏评论计数）。
- **`qa-card`** — 问答卡片（v2.0 新增，照 story-card 裁剪）。匿名问题由云函数脱敏后渲染为「匿」灰底头像 + 昵称「匿名」。属性 `showActions`（我的问答页显示编辑/删除）。触发 `open`/`like`/`fav`/`edit`/`delete`。**点赞与收藏只显状态不显数字，回复数保留**。
- **`filter-sheet`** — 底部筛选面板，包含标签选择、作者搜索和三种时间模式（快捷范围 / 起止日期 / 年月）。触发 `apply`（携带完整 filters 对象）和 `close` 事件。
- **`member-guard`** — 非会员点击会员专属内容时弹出的权限拦截弹窗。触发 `authorize` 和 `joinMember` 事件。已接入故事页和收藏页。
- **`poster-sheet`** — 分享海报底部弹窗，包含头像、摘要和保存/分享操作。已接入故事页、收藏页（`bind:share` on story-card）和详情页（底部栏 ↑ 按钮）。
- **`login-sheet`** — v2.3 微信登录半屏弹窗（协议勾选 + 微信图标登录，仅取 openid/unionid）。由 `utils/auth-guard.js` 的 `ensureLogin(page, action)` 拉起，登录成功自动续做原操作。已接入故事/问答/各详情页/会员中心。
- **`audience-sheet`** — 作者数据视角人员清单弹窗（阅读/点赞/收藏/评论，头像+昵称+时间，评论带内容）。仅「我的故事」页接入：`story-card` 开 `owner-stats` 后统计项点击触发 `viewread/viewlike/viewfav/viewcomment`，由 mine 页打开本弹窗（调 `getStoryAudience`）。**注**：浏览视角（广场/收藏/详情）的卡片与详情底栏已按需求隐藏收藏计数数字（图标与收藏操作保留）。

- **`splash-cover`** — 冷启动品牌蒙布（全屏不透明，标题「醒書知行社」+「修身為本」印章 + 社区简介 + 「我要进入」按钮，视觉规格换算自原型 `doc/醒书日记-原型设计/untitled/project/miniprogram.html` 的 SVG 占位图）。**每日首次冷启动弹一次**（`utils/splash.js` 的 `claim()` 写 `splash:day` 缓存，TTL 到次日 0 点；热启动不弹）。归属由 `app.js._pickSplash` 判定并存 `globalData.splashOwner`：扫码/转发直达详情页（scene 含 `d=`/`a=`，或 launchPath 为详情页）归 `'detail'`、由目标详情页认领，否则归 `'home'`——**不可让首页统一认领**，否则扫码时蒙布会在 `_initUser` 的 `navigateTo` 后被详情页盖住。已接入活动页（v2.0 起为启动首页，认领 `'home'`）/故事详情/活动详情/问答详情；首页需在 `onShow` 里 `_tabBar(true)` 让位（tab-bar 独立层会盖住蒙布）。点击按钮播「钤印 → 推开」两拍动效（560ms）后才触发 `enter` 事件并卸载。

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
| `social.js` | `toggleLike` / `toggleFav` / `createComment` / `getComments` / `deleteComment`（api 方法名保留；内部分别调云函数 `createStoryComment`/`getStoryComments`/`deleteStoryComment`） |
| `tag.js` | `getAll` / `add` |

所有 API 文件均通过 `mapper.js` 将 MySQL 行转为前端 camelCase 格式后再返回。

### 工具模块

- **`utils/filter.js`** — `applyFilters(stories, mode, search, filters)`。mode（`stories`/`collections`/`mine`）先按收藏/归属/可见性进行预筛选，再应用搜索关键词、标签、作者和时间筛选（快捷范围、日期范围或年月）。
- **`utils/mapper.js`** — MySQL `snake_case` ↔ 前端 `camelCase` 字段映射。`toDiary(dbRow)`、`toComment(dbRow)`、`toUser(dbRow)` 等函数将数据库行转为前端格式；反向映射 `fromDiary(data)` 用于写入。所有 API 层（`api/`）均先通过 mapper 再做返回。
- **`utils/color.js`** — `hueToColor(hue)` 根据色相值映射到暖土色系头像颜色。`getInitial(name)` 返回名字首字符作为头像兜底展示。
- **`utils/toast.js`** — 统一封装 `wx.showToast`：`success(title)`、`info(title, duration?)`、`error(title)`。

### 测试

统一入口为根目录 `npm test`（Loop Engineering 的验证闭环，任一失败即退出码非 0）：

```bash
npm test          # 全量：连通性检查 → 单测 + API + 冒烟/回环 + admin/活动/权限/问答/Banner/推荐人/授权/评论/标签，25 套件 260 条
npm run test:unit # 仅 utils 纯函数单测（node:test，不依赖数据库）
npm run test:e2e  # 20 条端到端流程测试（含写库与清理）
node test/seed.js       # 向 MySQL 插入种子数据
node test/reset-user.js # 列出所有用户；带 <openid> 参数重置指定用户为 guest（开发调试用）

npm run backup          # 手动全量备份到本地 backups/（加 --verify 导临时库校验）
npm run backup:upload   # 把最新本地备份加密后传云存储
npm run backup:restore  # 不带参列出云端备份；带 <cloudPath> [--verify] 下载解密
```

关键测试文件：
- `test/ping-db.js` — 数据库连通性检查，隧道不可达时 5 秒内失败并给出指引。**自动化循环遇到此失败应停止并报告，而非重试。**
- `test/unit/*.test.js` — `utils/`（filter/mapper/color）纯函数单测，使用 Node 内置 `node:test`
- `test/fn-harness.js` — 云函数本地调用 harness：拦截 `wx-server-sdk` 注入可控 OPENID，云函数代码无需部署即可本地真实执行
- `test/fn-smoke-test.js` — 基于 harness 的只读冒烟测试（getTags / getStoryList / getUserInfo）
- `test/fn-roundtrip-test.js` — 故事 CRUD 写入回环（含 images），测试数据自动清理
- `test/fn-admin-test.js` — admin 云函数测试（鉴权、数据形状、删除联动清理）
- `test/fn-qa-test.js` — 醒书问答小程序端（18 条：两态/会员门槛/精选副本/匿名脱敏/回复只读/赞藏）
- `test/fn-qa-admin-test.js` — 问答后台管理（8 条：真实作者/精选纳入修订上下架/删除联动）
- `test/fn-banner-test.js` — 活动页 Banner（9 条：CRUD/停用隔离/sort 排序/详情跳转约束/正文配图换链）
- `test/fn-activity-fav-test.js` — 活动收藏（6 条：翻转/列表标记/favList 排序/草稿隔离）

测试依赖根目录的 `mysql2`（根 `package.json` 唯一依赖），首次运行前需在仓库根目录 `npm install`。

测试文档：
- `test/checklist.md` — 回归测试清单（3×3 权限矩阵 + 6 页面 + 组件动画）
- `test/frontend-test-cases.md` — 前端测试用例（40+ 条，含 P0/P1/P2 优先级）
- `test/m15-test-cases.md` — M1.5 首发功能包验收用例（活动/权限矩阵/推荐人，自动化用例与 fn-*-test 文件一一对应，是 Loop 开发的验收规格）
- `test/常用测试指令.md` — 常用测试命令速查

### CloudBase 云函数

**环境 ID**（2026-07-13 两环境已对调）：**开发/体验槽位** = `cloud1-xingshu-prd-d1cev0fcca864`（个人版，承接体验版测试与日常开发，`cloudbaserc.json`、admin 的 `.env.dev`、`app.js` ENVS.dev 均指向它）；**release 槽位** = `cloud1-d9gbozhfp4a6c50c0`（原免费开发环境，`app.js` ENVS.prod、admin 的 `.env.prd` 指向它）。环境切换逻辑在 `app.js` 的 `_pickCloudEnv()`（按 `envVersion` 区分）与 admin 的 Vite mode（`.env.dev`/`.env.prd`）。历史环境：Phase 1 用 `awakebook-env-1g0oford0bea44cc`、Phase 2~6 用 `cloud1-1gpabyik2db3478f`，均已弃用勿再使用。

**云函数目录**：`miniprogram/cloudfunctions/` 下共 26 个云函数——24 个小程序端（按类别分组见完整计划 `doc/fullstack-plan.md` Phase 2；含 `getStoryAudience` 作者视角人员清单、v2.0 新增 `qa` 醒书问答 action 路由）+ 1 个管理端 `admin`（action 路由统一入口，供 Web 后台调用，不依赖 wx-server-sdk）+ 1 个运维端 `backupDb`（定时触发器每日 03:00 全量备份，无小程序调用方）。

**数据库备份（2026-07-22 起自动化）**：`backupDb` 云函数每日 03:00（cron 写在 `cloudbaserc.json` 的 `triggers`）导出全库 → gzip → **AES-256-GCM 加密** → 传云存储 `backups/<库名>-YYYYMMDD.sql.gz.enc`，保留 30 天。**必须加密**：云存储桶权限是「所有用户可读」（小程序显示头像/配图/视频所必需，不可改私有），明文备份等同公网泄露用户手机号与 openid。密钥由 `.env` 的 `ADMIN_PASSWORD` 经 scrypt 派生——**轮换该密码前须先解出全部历史备份**，否则永久打不开。加解密实现 `cloudfunctions/backupDb/crypto.js` 与导出实现 `dump.js` 由云函数与 `scripts/backup-db.js`、`scripts/upload-backup.js`、`scripts/restore-backup.js` **共用同一份**（本地脚本 require 进云函数目录），避免实现漂移。恢复与演练见 `doc/数据库备份与恢复.md`。

**数据库连接配置（唯一来源：根目录 `.env`）**：每个云函数目录下的 `db.js`（及 admin 的 `secret.js`）由 `npm run sync-db`（`scripts/sync-db-config.js`）从 `.env` 生成，**已从 Git 追踪中排除，勿手改、勿提交**。修改连接信息（如 cpolar 隧道地址变更）或管理员密码的流程：改 `.env` → `npm run sync-db` → 重新部署云函数。测试脚本统一通过 `config/db.js` 读取同一份 `.env`。当前连接目标为 `33.tcp.cpolar.top:11028/xingshu_dev`。新 clone 仓库后需先复制 `.env.example` 为 `.env` 并运行 `npm run sync-db`。

### 管理后台

`admin/` 是 Vue 3 + Vite 独立 Web 应用，UI 配色为深蓝主色 `#3578F6`。侧边栏菜单按角色过滤（`App.vue` 的 `NAV` 与 `router` 的 `meta.roles` 必须保持一致）：数据概览 / 会员订单 / 用户管理 / 故事管理 / **问答管理** / **精选管理** / 互动数据 / 活动管理 / **活动Banner** / 账号管理（后三个加粗项为 v2.0 新增或改名）。视图文件在 `src/views/`。

**已对接真实数据**：`src/api/index.js` 通过 `@cloudbase/js-sdk`（匿名登录，**需在 TCB 控制台开启**）调用 `admin` 云函数（action 路由）。鉴权为密码登录：密码存根目录 `.env` 的 `ADMIN_PASSWORD`，经 `npm run sync-db` 生成到云函数的 `secret.js`（不入 Git）；登录换取 12h 有效的 HMAC token 存 localStorage。删除操作会写 `admin_logs` 审计并联动清理互动数据。

```bash
cd admin
npm install       # 首次
npm run dev       # 本地开发服务器
npm run build     # 构建产物
```

**部署（强制，改完即做，无需再问）**：只要改动了 `admin/` 下的任何文件，完成后**自动执行构建 + 部署**，不要停在「build 通过」就交付——运营看到的是线上那份，本地 `dist/` 不算数。

```bash
cd admin && npm run build
npx -y -p @cloudbase/cli tcb hosting deploy admin/dist -e cloud1-xingshu-prd-d1cev0fcca864
```

部署后**必须回查**线上 `index.html` 引用的 `index-*.js` 哈希与本地 `admin/dist/assets/` 一致（`curl` 加时间戳绕缓存），确认发的是新版；并在 devlog 的「验证」里记一笔。访问地址 https://cloud1-xingshu-prd-d1cev0fcca864-1451247102.tcloudbaseapp.com （dev/体验槽位；prod 槽位构建用 `npm run build:prd`、部署 `-e cloud1-d9gbozhfp4a6c50c0`，**prod 部署仍需逐次确认**）。

> 静态托管走 COS，路由已是 hash 模式（见 2026-07-18 devlog），刷新子路由不会 404，部署后无需额外配置错误文档。浏览器可能缓存旧 `index.html`，交付时提示用户强刷。

### 设计参考

`project/index.html` 是最终原型（主设计文件）。`chats/chat1.md` 中的聊天记录包含设计决策：温暖文艺的视觉风格，衬线字体标题，纸质感，印章风格标签，会员内容采用金色点缀，背景色为 `#FBF7EE` 暖纸色。

产品需求文档位于 `doc/醒书日记小程序及管理后台PRD文档.md`，原型设计资料位于 `doc/醒书日记-原型设计/`。
