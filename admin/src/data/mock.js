export const adminUsers = [
  { id: 'U-1001', nickname: '清逸', realName: '林清逸', phone: '138****6082', avatarHue: 60,
    identity: 'member', memberUntil: '2027-02-24', daysLeft: 286, diaries: 14, likes: 326, registeredAt: '2025-11-08', lastActive: '2026-05-20' },
  { id: 'U-1002', nickname: '砚秋', realName: '陈砚秋', phone: '135****8821', avatarHue: 35,
    identity: 'member', memberUntil: '2026-12-10', daysLeft: 209, diaries: 38, likes: 1042, registeredAt: '2025-10-02', lastActive: '2026-05-20' },
  { id: 'U-1003', nickname: '陆明远', realName: '', phone: '159****9911', avatarHue: 200,
    identity: 'member', memberUntil: '2027-01-15', daysLeft: 246, diaries: 22, likes: 537, registeredAt: '2025-09-21', lastActive: '2026-05-19' },
  { id: 'U-1004', nickname: '叶清和', realName: '叶清和', phone: '137****9912', avatarHue: 280,
    identity: 'authed', memberUntil: null, daysLeft: 0, diaries: 9, likes: 142, registeredAt: '2026-02-14', lastActive: '2026-05-20' },
  { id: 'U-1005', nickname: '林知微', realName: '', phone: '188****0012', avatarHue: 15,
    identity: 'authed', memberUntil: null, daysLeft: 0, diaries: 5, likes: 48, registeredAt: '2026-03-01', lastActive: '2026-05-12' },
  { id: 'U-1006', nickname: '苏景行', realName: '苏景行', phone: '133****4455', avatarHue: 100,
    identity: 'member', memberUntil: '2026-08-22', daysLeft: 99, diaries: 67, likes: 2154, registeredAt: '2025-07-18', lastActive: '2026-05-09' },
  { id: 'U-1007', nickname: '何怀瑾', realName: '', phone: '139****4488', avatarHue: 240,
    identity: 'authed', memberUntil: null, daysLeft: 0, diaries: 12, likes: 178, registeredAt: '2026-04-02', lastActive: '2026-05-08' },
  { id: 'U-1008', nickname: '微信用户1029', realName: '', phone: '', avatarHue: 320,
    identity: 'guest', memberUntil: null, daysLeft: 0, diaries: 0, likes: 0, registeredAt: '2026-05-13', lastActive: '2026-05-20' },
]

export const adminDiaries = [
  { id: 'D-2401', title: '晨起读《大学》三十分钟', author: '砚秋', authorId: 'U-1002', createdAt: '2026-05-15 06:42',
    tags: ['修身为本','知止有定','要事第一'], permission: 'public', likes: 48, favorites: 12, comments: 6, shares: 2, status: 'active',
    content: '今日五点半起床，泡一壶老白茶，翻开《大学》。\n\n"知止而后有定，定而后能静，静而后能安，安而后能虑，虑而后能得"。每读一次，体会更深一层。' },
  { id: 'D-2400', title: '与同事一次艰难的谈话', author: '陆明远', authorId: 'U-1003', createdAt: '2026-05-14 22:18',
    tags: ['移情聆听','双赢思维'], permission: 'member', likes: 124, favorites: 38, comments: 21, shares: 9, status: 'active',
    content: '今天和团队成员谈绩效问题。本想直接指出问题，但提醒自己——先理解，再被理解。' },
  { id: 'D-2398', title: '关于"慎独"的一点思考', author: '叶清和', authorId: 'U-1004', createdAt: '2026-05-12 23:05',
    tags: ['君子慎独','修身为本'], permission: 'member', likes: 86, favorites: 24, comments: 11, shares: 4, status: 'active',
    content: '《中庸》言："君子慎其独也"。独处时所为，最见心性。' },
  { id: 'D-2395', title: '今日的复盘与明日的清单', author: '林知微', authorId: 'U-1005', createdAt: '2026-05-11 21:30',
    tags: ['日新又新','要事第一'], permission: 'public', likes: 32, favorites: 9, comments: 3, shares: 1, status: 'active',
    content: '复盘今日：上午写作两小时（达标）、下午会议偏多（待优化）。' },
  { id: 'D-2392', title: '生财有道，先义而后利', author: '苏景行', authorId: 'U-1006', createdAt: '2026-05-09 15:40',
    tags: ['生财有道','以义为利'], permission: 'public', likes: 215, favorites: 67, comments: 38, shares: 22, status: 'active',
    content: '创业八年，越来越觉得：长久的利，必先源于义。' },
]

export const adminComments = [
  { id: 'c1', diaryId: 'D-2401', diaryTitle: '晨起读...', user: '陆明远', userId: 'U-1003', content: '"虑而后能得"——今天读到这里也停了很久。', time: '2026-05-15 08:42' },
  { id: 'c2', diaryId: 'D-2401', diaryTitle: '晨起读...', user: '叶清和', userId: 'U-1004', content: '请问砚秋老师，老白茶是哪个山头的？', time: '2026-05-15 10:18' },
  { id: 'c3', diaryId: 'D-2401', diaryTitle: '晨起读...', user: '清逸', userId: 'U-1001', content: '收藏了。今日要事第一。', time: '2026-05-15 11:02' },
  { id: 'c4', diaryId: 'D-2400', diaryTitle: '与同事一...', user: '砚秋', userId: 'U-1002', content: '移情聆听不是技巧，是修养——说得真好。', time: '2026-05-14 23:10' },
  { id: 'c5', diaryId: 'D-2400', diaryTitle: '与同事一...', user: '苏景行', userId: 'U-1006', content: '管理团队多年，最深的体会就是先听后说。', time: '2026-05-15 09:32' },
]

export const adminKpi = {
  users: { value: 1284, delta: 12.4 },
  members: { value: 326, delta: 8.1 },
  diaries: { value: 4827, delta: 22.6 },
  interactions: { value: 38241, delta: 15.3 },
  revenue: { value: 118990, delta: 6.2 },
}

export const adminActivity = [
  { type: 'order', text: '管理员 砚秋 为「清逸」创建年度会员订单', time: '2026-02-24 10:32' },
  { type: 'diary', text: '砚秋 发布《晨起读《大学》三十分钟》', time: '今天 06:42' },
  { type: 'warning', text: '苏景行 的会员将在 99 天后到期', time: '今天 00:01' },
  { type: 'user', text: '微信用户0871 完成注册', time: '今天 06:11' },
  { type: 'diary', text: '陆明远 发布《与同事一次艰难的谈话》', time: '昨天 22:18' },
]

export const adminTrend = Array.from({length:30}, (_,i) => ({
  date: `${5 - Math.floor((29-i)/7)}/${Math.floor((29-i)%30/2)+1}`,
  newUsers: 2 + (i*37+11)%6,
  newDiaries: 6 + (i*17+3)%14,
  interactions: 80 + (i*23+7)%220,
}))
