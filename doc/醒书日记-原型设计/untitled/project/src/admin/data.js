// src/admin/data.js — admin backend seed data
window.ADMIN_USERS = [
  {
    id: 'U-1001', wechatName: '清逸', nickname: '清逸', realName: '林清逸',
    phone: '13888886082', avatarHue: 60,
    openid:  'oA1bC2dE3fG4hI5jK6lM7nO8pQ9rS0t',
    unionid: 'oW1xY2zA3bC4dE5fG6hI7jK8lM9nO0p',
    identity: 'member', memberFrom: '2026-02-24', memberUntil: '2027-02-24',
    daysLeft: 286,
    registeredAt: '2025-11-08 14:22', lastActive: '今天 09:14',
    stats: { diaries: 14, likes: 326, favorites: 89, comments: 47, shares: 12 },
  },
  {
    id: 'U-1002', wechatName: '砚秋', nickname: '砚秋', realName: '陈砚秋',
    phone: '13511118821', avatarHue: 35,
    openid:  'oB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1u',
    unionid: 'oX2yZ3aB4cD5eF6gH7iJ8kL9mN0oP1q',
    identity: 'member', memberFrom: '2025-12-10', memberUntil: '2026-12-10',
    daysLeft: 209,
    registeredAt: '2025-10-02 09:18', lastActive: '今天 11:02',
    stats: { diaries: 38, likes: 1042, favorites: 287, comments: 156, shares: 64 },
  },
  {
    id: 'U-1003', wechatName: '陆明远', nickname: '陆明远', realName: '',
    phone: '15922339911', avatarHue: 200,
    openid:  'oC3dE4fG5hI6jK7lM8nO9pQ0rS1tU2v',
    unionid: 'oY3zA4bC5dE6fG7hI8jK9lM0nO1pQ2r',
    identity: 'member', memberFrom: '2026-01-15', memberUntil: '2027-01-15',
    daysLeft: 246,
    registeredAt: '2025-09-21 16:40', lastActive: '昨天 22:18',
    stats: { diaries: 22, likes: 537, favorites: 124, comments: 82, shares: 26 },
  },
  {
    id: 'U-1004', wechatName: '叶清和', nickname: '叶清和', realName: '叶清和',
    phone: '13700009912', avatarHue: 280,
    openid:  'oD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3w',
    unionid: 'oZ4aB5cD6eF7gH8iJ9kL0mN1oP2qR3s',
    identity: 'authed', memberFrom: null, memberUntil: null, daysLeft: 0,
    registeredAt: '2026-02-14 18:30', lastActive: '今天 08:45',
    stats: { diaries: 9, likes: 142, favorites: 38, comments: 21, shares: 5 },
  },
  {
    id: 'U-1005', wechatName: '林知微', nickname: '知微', realName: '',
    phone: '18866550012', avatarHue: 15,
    openid:  'oE5fG6hI7jK8lM9nO0pQ1rS2tU3vW4x',
    unionid: 'oA5bC6dE7fG8hI9jK0lM1nO2pQ3rS4t',
    identity: 'authed', memberFrom: null, memberUntil: null, daysLeft: 0,
    registeredAt: '2026-03-01 10:11', lastActive: '5月12日',
    stats: { diaries: 5, likes: 48, favorites: 12, comments: 6, shares: 2 },
  },
  {
    id: 'U-1006', wechatName: '苏景行', nickname: '景行', realName: '苏景行',
    phone: '13322114455', avatarHue: 100,
    openid:  'oF6gH7iJ8kL9mN0oP1qR2sT3uV4wX5y',
    unionid: 'oB6cD7eF8gH9iJ0kL1mN2oP3qR4sT5u',
    identity: 'member', memberFrom: '2025-08-22', memberUntil: '2026-08-22',
    daysLeft: 99,
    registeredAt: '2025-07-18 22:05', lastActive: '5月9日',
    stats: { diaries: 67, likes: 2154, favorites: 612, comments: 388, shares: 142 },
  },
  {
    id: 'U-1007', wechatName: '何怀瑾', nickname: '怀瑾', realName: '',
    phone: '13900224488', avatarHue: 240,
    openid:  'oG7hI8jK9lM0nO1pQ2rS3tU4vW5xY6z',
    unionid: 'oC7dE8fG9hI0jK1lM2nO3pQ4rS5tU6v',
    identity: 'authed', memberFrom: null, memberUntil: null, daysLeft: 0,
    registeredAt: '2026-04-02 11:30', lastActive: '5月8日',
    stats: { diaries: 12, likes: 178, favorites: 46, comments: 28, shares: 9 },
  },
  {
    id: 'U-1008', wechatName: '微信用户1029', nickname: '', realName: '',
    phone: '', avatarHue: 320,
    openid:  'oH8iJ9kL0mN1oP2qR3sT4uV5wX6yZ7a',
    unionid: '',
    identity: 'guest', memberFrom: null, memberUntil: null, daysLeft: 0,
    registeredAt: '2026-05-13 19:52', lastActive: '今天 07:30',
    stats: { diaries: 0, likes: 0, favorites: 0, comments: 0, shares: 0 },
  },
  {
    id: 'U-1009', wechatName: '微信用户0871', nickname: '', realName: '',
    phone: '', avatarHue: 160,
    openid:  'oI9jK0lM1nO2pQ3rS4tU5vW6xY7zA8b',
    unionid: '',
    identity: 'guest', memberFrom: null, memberUntil: null, daysLeft: 0,
    registeredAt: '2026-05-15 06:11', lastActive: '今天 06:42',
    stats: { diaries: 0, likes: 0, favorites: 0, comments: 0, shares: 0 },
  },
];

window.ADMIN_ORDERS = [
  {
    id: 'XS-20260224-0871', userId: 'U-1001', userName: '清逸', userPhone: '13888886082',
    amount: 365, plan: '年度会员', method: '微信转账',
    paidAt: '2026-02-24 10:32', validFrom: '2026-02-24', validUntil: '2027-02-24',
    createdBy: '砚秋', createdAt: '2026-02-24 10:32',
    status: 'active', note: '老用户续费',
  },
  {
    id: 'XS-20251210-0654', userId: 'U-1002', userName: '砚秋', userPhone: '13511118821',
    amount: 365, plan: '年度会员', method: '支付宝转账',
    paidAt: '2025-12-10 15:08', validFrom: '2025-12-10', validUntil: '2026-12-10',
    createdBy: '砚秋', createdAt: '2025-12-10 15:08',
    status: 'active', note: '',
  },
  {
    id: 'XS-20260115-0541', userId: 'U-1003', userName: '陆明远', userPhone: '15922339911',
    amount: 365, plan: '年度会员', method: '银行转账',
    paidAt: '2026-01-15 09:22', validFrom: '2026-01-15', validUntil: '2027-01-15',
    createdBy: '砚秋', createdAt: '2026-01-15 09:24',
    status: 'active', note: '',
  },
  {
    id: 'XS-20250822-0218', userId: 'U-1006', userName: '苏景行', userPhone: '13322114455',
    amount: 365, plan: '年度会员', method: '现金',
    paidAt: '2025-08-22 14:50', validFrom: '2025-08-22', validUntil: '2026-08-22',
    createdBy: '砚秋', createdAt: '2025-08-22 14:52',
    status: 'expiring', note: '99 天后到期，可联系续费',
  },
  {
    id: 'XS-20250410-0102', userId: 'U-1002', userName: '砚秋', userPhone: '13511118821',
    amount: 365, plan: '年度会员', method: '微信转账',
    paidAt: '2024-12-10 11:00', validFrom: '2024-12-10', validUntil: '2025-12-10',
    createdBy: '砚秋', createdAt: '2024-12-10 11:00',
    status: 'expired', note: '已续费',
  },
];

window.ADMIN_DIARIES = [
  { id: 'D-2401', title: '晨起读《大学》三十分钟', author: '砚秋', authorId: 'U-1002',
    publishedAt: '2026-05-15 06:42', updatedAt: null,
    tags: ['修身为本', '知止有定', '要事第一'],
    permission: 'public', likes: 48, favorites: 12, comments: 6, shares: 2,
    content: '今日五点半起床，泡一壶老白茶，翻开《大学》。\n\n"知止而后有定，定而后能静，静而后能安，安而后能虑，虑而后能得"。每读一次，体会更深一层。今日所悟：知止，并非止步不前，而是知所止——明确边界与方向。心若无止，则终日逐物，劳而无功。\n\n记下三件今日要事：写完季度复盘、与父母通话、整理书柜。先做要紧不紧急之事。',
    status: 'active',
  },
  { id: 'D-2400', title: '与同事一次艰难的谈话', author: '陆明远', authorId: 'U-1003',
    publishedAt: '2026-05-14 22:18', updatedAt: '2026-05-14 22:45',
    tags: ['移情聆听', '双赢思维'],
    permission: 'member', likes: 124, favorites: 38, comments: 21, shares: 9,
    content: '今天和团队成员谈绩效问题。本想直接指出问题，但提醒自己——先理解，再被理解。\n\n听他讲了二十分钟，了解到家中情况的变化。后面的对话变得顺畅许多。最终我们一起制定了下一阶段的目标。\n\n移情聆听不是技巧，是修养。',
    status: 'active',
  },
  { id: 'D-2398', title: '关于"慎独"的一点思考', author: '叶清和', authorId: 'U-1004',
    publishedAt: '2026-05-12 23:05', updatedAt: null,
    tags: ['君子慎独', '修身为本'],
    permission: 'member', likes: 86, favorites: 24, comments: 11, shares: 4,
    content: '《中庸》言："君子慎其独也"。独处时所为，最见心性。今日独自在家，本想刷一晚短视频，转念把手机放进抽屉，读完了搁置许久的《明史纪事本末》第三卷。\n\n慎独不在大事，而在不被看见的小事里。',
    status: 'active',
  },
  { id: 'D-2395', title: '今日的复盘与明日的清单', author: '林知微', authorId: 'U-1005',
    publishedAt: '2026-05-11 21:30', updatedAt: null,
    tags: ['日新又新', '要事第一'],
    permission: 'public', likes: 32, favorites: 9, comments: 3, shares: 1,
    content: '日新又新——这是今天反复想到的四个字。每一天若不是新的，便是浪费的。\n\n复盘今日：上午写作两小时（达标）、下午会议偏多（待优化）、晚间陪孩子读书四十分钟（满意）。\n\n明日要事：① 完成提案初稿 ② 跑步五公里 ③ 给久未联系的老友打电话。',
    status: 'active',
  },
  { id: 'D-2392', title: '生财有道，先义而后利', author: '苏景行', authorId: 'U-1006',
    publishedAt: '2026-05-09 15:40', updatedAt: null,
    tags: ['生财有道', '以义为利'],
    permission: 'public', likes: 215, favorites: 67, comments: 38, shares: 22,
    content: '《大学》后篇专论"生财之大道"。生之者众，食之者寡，为之者疾，用之者舒，则财恒足矣。\n\n创业八年，越来越觉得：长久的利，必先源于义。短期的取巧，往往是长期的损失。',
    status: 'active',
  },
  { id: 'D-2390', title: '统合综效 · 一次跨部门协作', author: '何怀瑾', authorId: 'U-1007',
    publishedAt: '2026-05-08 18:12', updatedAt: null,
    tags: ['统合综效', '双赢思维'],
    permission: 'public', likes: 67, favorites: 18, comments: 7, shares: 3,
    content: '今天主持的项目协调会，财务、技术、市场三方意见相左。会前我做了一件事：把每个部门的核心诉求各自梳理一遍，会上请他们先听对方，再讲自己。\n\n一加一不是二，是三、是更多——这便是统合综效。',
    status: 'active',
  },
  { id: 'D-2386', title: '格物致知 · 一杯茶的滋味', author: '砚秋', authorId: 'U-1002',
    publishedAt: '2026-05-07 10:25', updatedAt: null,
    tags: ['格物致知'],
    permission: 'public', likes: 54, favorites: 16, comments: 4, shares: 1,
    content: '友人寄来一饼老白茶，我连泡了七道，每一道留心其香、其色、其韵。\n\n格物，是细察万物之理；致知，是由物及心。一杯茶里有四季，也有节制与丰饶之道。',
    status: 'active',
  },
];

// Sample comments per diary (admin-side view)
window.ADMIN_DIARY_COMMENTS = {
  'D-2401': [
    { id: 'c-1', user: '陆明远', userId: 'U-1003', avatarHue: 200,
      content: '"虑而后能得"——今天读到这里也停了很久。', time: '2026-05-15 08:42' },
    { id: 'c-2', user: '叶清和', userId: 'U-1004', avatarHue: 280,
      content: '请问砚秋老师，老白茶是哪个山头的？', time: '2026-05-15 10:18' },
    { id: 'c-3', user: '清逸', userId: 'U-1001', avatarHue: 60,
      content: '收藏了。今日要事第一要紧——明日开始尝试。', time: '2026-05-15 11:02' },
  ],
  'D-2400': [
    { id: 'c-4', user: '砚秋', userId: 'U-1002', avatarHue: 35,
      content: '移情聆听不是技巧，是修养——说得真好。', time: '2026-05-14 23:10' },
    { id: 'c-5', user: '苏景行', userId: 'U-1006', avatarHue: 100,
      content: '管理团队多年，最深的体会就是先听后说。', time: '2026-05-15 09:32' },
  ],
};


// Activity feed for dashboard
window.ADMIN_ACTIVITY = [
  { t: '订单', text: '管理员 砚秋 为「清逸」创建年度会员订单', time: '2026-02-24 10:32', kind: 'order' },
  { t: '日记', text: '砚秋 发布《晨起读《大学》三十分钟》', time: '今天 06:42', kind: 'diary' },
  { t: '会员', text: '苏景行 的会员将在 99 天后到期', time: '系统提醒 · 今天 00:01', kind: 'warning' },
  { t: '用户', text: '微信用户0871 完成注册', time: '今天 06:11', kind: 'user' },
  { t: '日记', text: '陆明远 发布《与同事一次艰难的谈话》', time: '昨天 22:18', kind: 'diary' },
  { t: '订单', text: '管理员 砚秋 为「陆明远」创建年度会员订单', time: '2026-01-15 09:24', kind: 'order' },
];

// 30-day trend (synthetic but plausible)
window.ADMIN_TREND = (() => {
  const days = 30, today = new Date('2026-05-15');
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const dayLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    const seed = i * 37 + 11;
    const newUsers = 2 + (seed % 6);
    const newDiaries = 6 + ((seed * 3) % 14);
    const interactions = 80 + ((seed * 11) % 220);
    out.push({ date: dayLabel, newUsers, newDiaries, interactions });
  }
  return out;
})();

// KPI snapshot
window.ADMIN_KPI = {
  users: { value: 1284, deltaPct: 12.4, trend: 'up' },
  members: { value: 326, deltaPct: 8.1, trend: 'up' },
  diaries: { value: 4827, deltaPct: 22.6, trend: 'up' },
  interactions: { value: 38241, deltaPct: 15.3, trend: 'up' },
  revenue: { value: 118990, deltaPct: 6.2, trend: 'up' },
  pendingOrders: { value: 3, deltaPct: -1, trend: 'flat' },
};

window.ADMIN_INFO = {
  ops: '砚秋',
  org: '醒书日记 · 运营后台',
  version: 'v0.1',
};
