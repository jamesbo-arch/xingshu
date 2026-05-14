// Mock data for 醒书日记 prototype
window.TAGS = [
  '积极主动', '以终为始', '要事第一', '双赢思维',
  '移情聆听', '统合综效', '知止有定', '修身为本',
  '格物致知', '君子慎独', '诚中形外', '十目所视',
  '有斐君子', '克明峻德', '日新又新', '听讼无讼',
  '正心修身', '絜矩之道', '生财有道', '以义为利',
];

// Avatar hues for placeholder avatars (oklch hue)
const HUES = [30, 60, 200, 240, 280, 350, 15, 100];

window.SEED_DIARIES = [
  {
    id: 1,
    title: '晨起读《大学》三十分钟',
    author: '砚秋',
    avatarHue: 35,
    content:
      '今日五点半起床，泡一壶老白茶，翻开《大学》。\n\n"知止而后有定，定而后能静，静而后能安，安而后能虑，虑而后能得"。每读一次，体会更深一层。今日所悟：知止，并非止步不前，而是知所止——明确边界与方向。心若无止，则终日逐物，劳而无功。\n\n记下三件今日要事：写完季度复盘、与父母通话、整理书柜。先做要紧不紧急之事。',
    time: '今天 06:42',
    timestamp: '2026-05-14 06:42',
    tags: ['修身为本', '知止有定', '要事第一'],
    permission: 'public',
    likes: 48,
    favorites: 12,
    comments: 6,
    shares: 2,
    isLiked: false,
    isFavorited: true,
    authorIsMember: true,
  },
  {
    id: 2,
    title: '与同事一次艰难的谈话',
    author: '陆明远',
    avatarHue: 200,
    content:
      '今天和团队成员谈绩效问题。本想直接指出问题，但提醒自己——先理解，再被理解。\n\n听他讲了二十分钟，了解到家中情况的变化。后面的对话变得顺畅许多。最终我们一起制定了下一阶段的目标。\n\n移情聆听不是技巧，是修养。',
    time: '昨天 22:18',
    timestamp: '2026-05-13 22:18',
    tags: ['移情聆听', '双赢思维'],
    permission: 'member',
    likes: 124,
    favorites: 38,
    comments: 21,
    shares: 9,
    isLiked: true,
    isFavorited: false,
    authorIsMember: true,
  },
  {
    id: 3,
    title: '关于"慎独"的一点思考',
    author: '叶清和',
    avatarHue: 280,
    content:
      '《中庸》言："君子慎其独也"。独处时所为，最见心性。今日独自在家，本想刷一晚短视频，转念把手机放进抽屉，读完了搁置许久的《明史纪事本末》第三卷。\n\n慎独不在大事，而在不被看见的小事里。',
    time: '5月12日',
    timestamp: '2026-05-12 23:05',
    tags: ['君子慎独', '修身为本'],
    permission: 'member',
    likes: 86,
    favorites: 24,
    comments: 11,
    shares: 4,
    isLiked: false,
    isFavorited: false,
    authorIsMember: true,
  },
  {
    id: 4,
    title: '今日的复盘与明日的清单',
    author: '林知微',
    avatarHue: 15,
    content:
      '日新又新——这是今天反复想到的四个字。每一天若不是新的，便是浪费的。\n\n复盘今日：上午写作两小时（达标）、下午会议偏多（待优化）、晚间陪孩子读书四十分钟（满意）。\n\n明日要事：① 完成提案初稿 ② 跑步五公里 ③ 给久未联系的老友打电话。',
    time: '5月11日',
    timestamp: '2026-05-11 21:30',
    tags: ['日新又新', '要事第一'],
    permission: 'public',
    likes: 32,
    favorites: 9,
    comments: 3,
    shares: 1,
    isLiked: false,
    isFavorited: false,
    authorIsMember: false,
  },
  {
    id: 5,
    title: '私密 · 关于父亲的一段记忆',
    author: '我',
    avatarHue: 60,
    content: '只写给自己看。\n\n父亲今天来电话，说院里的桂花树开了。',
    time: '5月10日',
    timestamp: '2026-05-10 19:00',
    tags: ['诚中形外'],
    permission: 'private',
    likes: 0,
    favorites: 0,
    comments: 0,
    shares: 0,
    isLiked: false,
    isFavorited: false,
    authorIsMember: false,
    isMine: true,
  },
  {
    id: 6,
    title: '生财有道，先义而后利',
    author: '苏景行',
    avatarHue: 100,
    content:
      '《大学》后篇专论"生财之大道"。生之者众，食之者寡，为之者疾，用之者舒，则财恒足矣。\n\n创业八年，越来越觉得：长久的利，必先源于义。短期的取巧，往往是长期的损失。',
    time: '5月9日',
    timestamp: '2026-05-09 15:40',
    tags: ['生财有道', '以义为利'],
    permission: 'public',
    likes: 215,
    favorites: 67,
    comments: 38,
    shares: 22,
    isLiked: false,
    isFavorited: true,
    authorIsMember: true,
  },
  {
    id: 7,
    title: '统合综效 · 一次跨部门协作',
    author: '何怀瑾',
    avatarHue: 240,
    content:
      '今天主持的项目协调会，财务、技术、市场三方意见相左。会前我做了一件事：把每个部门的核心诉求各自梳理一遍，会上请他们先听对方，再讲自己。\n\n一加一不是二，是三、是更多——这便是统合综效。',
    time: '5月8日',
    timestamp: '2026-05-08 18:12',
    tags: ['统合综效', '双赢思维'],
    permission: 'public',
    likes: 67,
    favorites: 18,
    comments: 7,
    shares: 3,
    isLiked: true,
    isFavorited: false,
    authorIsMember: false,
  },
  {
    id: 8,
    title: '格物致知 · 一杯茶的滋味',
    author: '砚秋',
    avatarHue: 35,
    content:
      '友人寄来一饼老白茶，我连泡了七道，每一道留心其香、其色、其韵。\n\n格物，是细察万物之理；致知，是由物及心。一杯茶里有四季，也有节制与丰饶之道。',
    time: '5月7日',
    timestamp: '2026-05-07 10:25',
    tags: ['格物致知'],
    permission: 'public',
    likes: 54,
    favorites: 16,
    comments: 4,
    shares: 1,
    isLiked: false,
    isFavorited: false,
    authorIsMember: true,
  },
];

window.SEED_COMMENTS = [
  {
    id: 'c1',
    diaryId: 1,
    user: '陆明远',
    avatarHue: 200,
    content: '"虑而后能得"——今天读到这里也停了很久。',
    time: '2小时前',
    replies: [
      { id: 'c1-1', user: '砚秋', avatarHue: 35, content: '同道。共勉。', time: '1小时前' },
    ],
  },
  {
    id: 'c2',
    diaryId: 1,
    user: '叶清和',
    avatarHue: 280,
    content: '请问砚秋老师，老白茶是哪个山头的？',
    time: '30分钟前',
    replies: [],
  },
  {
    id: 'c3',
    diaryId: 1,
    user: '我',
    avatarHue: 60,
    content: '收藏了。今日要事第一要紧——明日开始尝试。',
    time: '刚刚',
    replies: [],
    isMine: true,
  },
];

window.CURRENT_USER = {
  // 默认采用微信授权名称
  wechatName: '清逸',
  // 可编辑字段
  nickname: '清逸',       // 默认 = wechatName
  realName: '',           // 真实姓名，留空表示未填
  phone: '138****6082',
  avatarHue: 60,
  // 'guest' 未授权 · 'authed' 已授权用户 · 'member' 会员
  identity: 'authed',
  // 会员信息（identity === 'member' 时使用）
  memberFrom: '2026-02-24',
  memberUntil: '2027-02-24',
  daysLeft: 286,
  // 管理员后台创建的最新订单
  latestOrder: {
    id: 'XS-20260224-0871',
    amount: 365,
    method: '线下转账',
    createdBy: '管理员 · 砚秋',
    createdAt: '2026-02-24 10:32',
    status: 'paid',          // pending / paid
  },
  stats: {
    diaries: 14,
    likes: 326,
    favorites: 89,
    comments: 47,
    shares: 12,
  },
};

window.ADMIN_CONTACT = {
  name: '运营 · 砚秋',
  wechat: 'xingshu-ops',
  hours: '工作日 09:00 – 18:00',
  note: '请备注您的微信昵称与手机号，便于核对身份。',
};

