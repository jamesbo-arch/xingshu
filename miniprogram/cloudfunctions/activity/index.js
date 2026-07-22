// 醒书活动云函数 — action 路由：list / detail / signup / cancelSignup（PRD v2.1 MVP）
// 活动仅需微信授权（openid 存在即可），与故事的登录验证相互独立
const cloud = require('wx-server-sdk')
const db = require('./db')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// owner_name = 主理人昵称（activities.owner_user_id → users）。
// 注意别跟 a.organizer 搞混：那是遗留文本列，全库都是默认值「醒书运营组」，
// 真正的主理人是后台「主理人」选择器写的 owner_user_id。列表只带昵称、不外泄用户 id。
const LIST_SELECT = `
  SELECT a.id, a.title, a.cover_url, a.type, a.city, a.location, a.organizer,
         a.capacity, a.signup_count, a.status, a.type_id, t.name AS type_name,
         ow.nickname AS owner_name,
         DATE_FORMAT(a.start_time, '%Y-%m-%d %H:%i') AS start_time,
         DATE_FORMAT(a.end_time, '%Y-%m-%d %H:%i') AS end_time,
         DATE_FORMAT(a.signup_deadline, '%Y-%m-%d %H:%i') AS signup_deadline
  FROM activities a
  LEFT JOIN activity_types t ON a.type_id = t.id
  LEFT JOIN users ow ON a.owner_user_id = ow.id`

// Banner 富文本正文里的配图存的是 cloud:// fileID（临时链接会过期，不能入库），
// 而 <rich-text> 的 <img> 渲染不了 cloud:// 协议，故读取时换成临时链接。
// **放在服务端做**：已发布的小程序端无需改动、不用重新提审。
async function resolveRichImages(html) {
  const ids = [...new Set(String(html || '').match(/cloud:\/\/[^"'\s>]+/g) || [])]
  if (!ids.length) return html
  try {
    const res = await cloud.getTempFileURL({ fileList: ids.slice(0, 50) })
    const map = {}
    for (const f of res.fileList || []) map[f.fileID] = f.tempFileURL || ''
    return String(html).replace(/cloud:\/\/[^"'\s>]+/g, (m) => map[m] || m)
  } catch (e) {
    // 换链失败只该丢图，不该把整个详情页拖成「内容不存在」——正文才是主体
    console.error('bannerDetail 配图换链失败', e)
    return html
  }
}

async function findUser(openid) {
  const [rows] = await db.query('SELECT id FROM users WHERE openid = ?', [openid])
  return rows.length ? rows[0] : null
}

// 报名数据可见权：活动主理人（owner_user_id）或该活动工作人员（activity_staff 白名单，后台管理）
async function isStatsViewer(activityId, ownerUserId, userId) {
  if (!userId) return false
  if (ownerUserId && Number(ownerUserId) === Number(userId)) return true
  const [rows] = await db.query(
    'SELECT id FROM activity_staff WHERE activity_id = ? AND user_id = ?', [activityId, userId])
  return rows.length > 0
}

// v2.0 活动收藏：与故事/问答同走 interactions（target_type='activity'）
async function isActivityFaved(userId, activityId) {
  const [rows] = await db.query(
    "SELECT id FROM interactions WHERE user_id = ? AND target_type = 'activity' AND target_id = ? AND action = 'favorite'",
    [userId, activityId])
  return rows.length > 0
}

// 一批活动的收藏集合（未登录返回空集）
async function favedActivityIds(user, rows) {
  if (!user || !rows.length) return new Set()
  const ids = rows.map(a => a.id)
  const [faved] = await db.query(
    `SELECT target_id FROM interactions
     WHERE user_id = ? AND target_type = 'activity' AND action = 'favorite'
       AND target_id IN (${ids.map(() => '?').join(',')})`,
    [user.id, ...ids])
  return new Set(faved.map(r => r.target_id))
}

// 当前用户对一批分享的点赞集合（游客/未注册返回空集）
async function likedPostIds(user, rows) {
  if (!user || !rows.length) return new Set()
  const ids = rows.map(p => p.id)
  const [liked] = await db.query(
    `SELECT target_id FROM interactions
     WHERE user_id = ? AND target_type = 'activity_post' AND action = 'like'
       AND target_id IN (${ids.map(() => '?').join(',')})`,
    [user.id, ...ids])
  return new Set(liked.map(r => r.target_id))
}

const handlers = {
  // 活动类型（分类）：小程序筛选用，仅启用项
  async typeList() {
    const [rows] = await db.query(
      'SELECT id, name, channel, schedule_hint FROM activity_types WHERE is_active = 1 ORDER BY sort, id')
    return rows
  },

  // 列表：仅 online（近期）与 finished（往期回顾），draft 不可见；可按类型筛选。
  // mode:'all' → 平铺全部按开始时间倒序（活动页「全部活动」页签）；默认仍返回 upcoming/past 两组（广场预告等）。
  // 每行标注 isSignedUp（当前用户是否已报名，游客/未注册恒 0），供列表「已报名」状态展示
  async list({ typeId, mode } = {}, openid) {
    const params = []
    let where = "WHERE a.status IN ('online', 'finished')"
    if (typeId) { where += ' AND a.type_id = ?'; params.push(typeId) }
    const [rows] = await db.query(`${LIST_SELECT} ${where}`, params)
    let signedSet = new Set()
    const user = await findUser(openid)
    if (user) {
      const [signed] = await db.query('SELECT activity_id FROM activity_signups WHERE user_id = ?', [user.id])
      signedSet = new Set(signed.map(s => s.activity_id))
    }
    const favedSet = await favedActivityIds(user, rows)
    rows.forEach(a => {
      a.isSignedUp = signedSet.has(a.id) ? 1 : 0
      a.isFavorited = favedSet.has(a.id) ? 1 : 0
      // 线上活动的 location 存腾讯会议号，仅报名用户在详情可见——列表一律不外泄
      if (a.type === 'online') a.location = ''
    })
    if (mode === 'all') {
      return { list: rows.sort((a, b) => b.start_time.localeCompare(a.start_time)) }
    }
    // online 按开始时间正序（最近的活动在前），finished 按开始时间倒序
    const upcoming = rows.filter(a => a.status === 'online')
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
    const past = rows.filter(a => a.status === 'finished')
      .sort((a, b) => b.start_time.localeCompare(a.start_time))
    return { upcoming, past }
  },

  async detail({ id } = {}, openid) {
    const [rows] = await db.query(
      `SELECT a.*, t.name AS type_name, t.schedule_hint,
              DATE_FORMAT(a.start_time, '%Y-%m-%d %H:%i') AS start_time,
              DATE_FORMAT(a.end_time, '%Y-%m-%d %H:%i') AS end_time,
              DATE_FORMAT(a.signup_deadline, '%Y-%m-%d %H:%i') AS signup_deadline,
              (a.start_time <= NOW()) AS started
       FROM activities a LEFT JOIN activity_types t ON a.type_id = t.id
       WHERE a.id = ? AND a.status != 'draft'`, [id])
    if (!rows.length) throw new Error('活动不存在')
    const a = rows[0]
    a.isSignedUp = false
    const user = await findUser(openid)
    if (user) {
      const [s] = await db.query(
        'SELECT id FROM activity_signups WHERE activity_id = ? AND user_id = ?', [id, user.id])
      a.isSignedUp = s.length > 0
    }
    // 报名数据入口：主理人或工作人员可见（详情页「报名数据」按钮）
    a.is_stats_viewer = user && (await isStatsViewer(a.id, a.owner_user_id, user.id)) ? 1 : 0
    // v2.0 现场分享发布权收窄为主理人 / 工作人员（普通报名用户不再有入口）
    a.canPost = !!a.is_stats_viewer && !!a.started
    delete a.started
    // v2.0 活动收藏态（登录用户才查）
    a.isFavorited = user ? await isActivityFaved(user.id, id) : false
    // 线上活动 location 存腾讯会议号：仅报名用户可见，未报名掩码并标记（前端展示「报名后可见」）
    if (a.type === 'online' && !a.isSignedUp) {
      a.location = ''
      a.locationLocked = 1
    }
    return a
  },

  async signup({ id, name, contact = '' } = {}, openid) {
    if (!name || !String(name).trim()) throw new Error('请留下你的称呼')
    const user = await findUser(openid)
    if (!user) throw new Error('user not found')

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      const [rows] = await conn.query(
        'SELECT capacity, signup_count, signup_deadline, status FROM activities WHERE id = ? FOR UPDATE', [id])
      if (!rows.length || rows[0].status !== 'online') throw new Error('活动不存在或未开放报名')
      const a = rows[0]
      if (a.signup_deadline && new Date(a.signup_deadline) < new Date()) throw new Error('报名已截止')
      if (a.capacity > 0 && a.signup_count >= a.capacity) throw new Error('名额已满')
      await conn.query(
        'INSERT INTO activity_signups (activity_id, user_id, name, contact) VALUES (?, ?, ?, ?)',
        [id, user.id, String(name).trim(), String(contact || '').trim()])
      await conn.query('UPDATE activities SET signup_count = signup_count + 1 WHERE id = ?', [id])
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      if (err.code === 'ER_DUP_ENTRY') throw new Error('你已报名该活动')
      throw err
    } finally {
      conn.release()
    }
    return true
  },

  // 报名名单：仅已报名用户可查看（含本人）；只返回称呼与头像，不外泄联系方式
  async signupList({ id } = {}, openid) {
    const user = await findUser(openid)
    if (!user) throw new Error('user not found')
    const [mine] = await db.query(
      'SELECT id FROM activity_signups WHERE activity_id = ? AND user_id = ?', [id, user.id])
    if (!mine.length) throw new Error('报名后即可查看名单')
    const [rows] = await db.query(
      `SELECT s.name, u.avatar_hue, u.avatar_url
       FROM activity_signups s JOIN users u ON s.user_id = u.id
       WHERE s.activity_id = ? ORDER BY s.id`, [id])
    return rows
  },

  // 报名数据（主理人/工作人员专用，只读）：全量报名信息 + 到场/收费状态 + 推荐人。
  // 鉴权凭 user_id 身份（owner 或 activity_staff 白名单），分享链接只是入口不授权
  async statsGet({ id } = {}, openid) {
    const user = await findUser(openid)
    if (!user) throw new Error('user not found')
    const [acts] = await db.query(
      `SELECT a.id, a.title, a.owner_user_id, a.capacity, a.price,
              DATE_FORMAT(a.start_time, '%Y-%m-%d %H:%i') AS start_time
       FROM activities a WHERE a.id = ? AND a.status != 'draft'`, [id])
    if (!acts.length) throw new Error('活动不存在')
    const a = acts[0]
    if (!(await isStatsViewer(a.id, a.owner_user_id, user.id))) throw new Error('你不是该活动的工作人员')
    const [rows] = await db.query(
      `SELECT s.id AS signup_id, s.name, s.contact, s.attended, s.paid,
              DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i') AS signed_at,
              u.id AS user_id, u.nickname, u.avatar_hue,
              r.id AS referrer_id, r.nickname AS referrer_nickname
       FROM activity_signups s JOIN users u ON s.user_id = u.id
       LEFT JOIN users r ON u.referrer_user_id = r.id
       WHERE s.activity_id = ? ORDER BY s.id ASC`, [id])
    return {
      activity: { id: a.id, title: a.title, start_time: a.start_time, capacity: a.capacity, price: a.price },
      stats: {
        total: rows.length,
        attended: rows.filter(x => x.attended).length,
        paid: rows.filter(x => x.paid).length,
      },
      list: rows,
    }
  },

  async cancelSignup({ id } = {}, openid) {
    const user = await findUser(openid)
    if (!user) throw new Error('user not found')
    const [r] = await db.query(
      'DELETE FROM activity_signups WHERE activity_id = ? AND user_id = ?', [id, user.id])
    if (!r.affectedRows) throw new Error('未报名该活动')
    await db.query('UPDATE activities SET signup_count = GREATEST(signup_count - 1, 0) WHERE id = ?', [id])
    return true
  },

  // ── 现场分享：仅已报名用户可发，活动开始后开放（含结束后补发）；先发后删 ──
  // 媒体二选一：最多 9 张照片 或 1 段视频（video 为云存储 fileID，CDN 临时链接支持 Range 流式播放）
  async postCreate({ id, content = '', images = [], video = '', videoPoster = '' } = {}, openid) {
    const user = await findUser(openid)
    if (!user) throw new Error('user not found')
    content = String(content || '').trim()
    video = String(video || '').trim()
    videoPoster = String(videoPoster || '').trim()
    if (!content && (!images || !images.length) && !video) throw new Error('写点文字、选张照片或视频吧')
    if (content.length > 1000) throw new Error('分享内容不超过 1000 字')
    if (images && images.length > 9) throw new Error('最多 9 张照片')
    if (video && images && images.length) throw new Error('照片与视频不能同时发布')
    if (video && !/^cloud:\/\//.test(video)) throw new Error('视频参数无效')
    const [acts] = await db.query(
      "SELECT id, owner_user_id FROM activities WHERE id = ? AND status IN ('online','finished') AND start_time <= NOW()", [id])
    if (!acts.length) throw new Error('活动尚未开始，开始后即可分享')
    // v2.0：现场分享入口收窄为活动主理人与工作人员（普通报名用户不再可发）
    if (!await isStatsViewer(id, acts[0].owner_user_id, user.id)) {
      throw new Error('仅活动主理人与工作人员可发布现场分享')
    }
    const [r] = await db.query(
      'INSERT INTO activity_posts (activity_id, user_id, content, images, video, video_poster, created_by) VALUES (?,?,?,?,?,?,?)',
      [id, user.id, content, images && images.length ? JSON.stringify(images) : null,
       video || null, (video && videoPoster) ? videoPoster : null, user.id])
    return { id: r.insertId }
  },

  // 分享列表：所有登录用户可看（详情页本身有登录门槛）；按分享时序正序（旧在前），
  // 前端分页向下追加即按发生顺序展现（备材→过程→成品）
  async postList({ id, page = 1, pageSize = 10 } = {}, openid) {
    page = Math.max(1, parseInt(page, 10) || 1)
    pageSize = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10))
    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) AS total FROM activity_posts WHERE activity_id = ? AND status = 'active'", [id])
    const [rows] = await db.query(
      `SELECT p.id, p.user_id, p.content, p.images, p.video, p.video_poster, p.like_count,
              u.nickname, u.avatar_hue, u.avatar_url,
              DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS created_at
       FROM activity_posts p JOIN users u ON p.user_id = u.id
       WHERE p.activity_id = ? AND p.status = 'active'
       ORDER BY p.id ASC LIMIT ? OFFSET ?`, [id, pageSize, (page - 1) * pageSize])
    const user = await findUser(openid)
    const likedSet = await likedPostIds(user, rows)
    const list = rows.map(p => ({
      ...p,
      images: p.images || [],
      video: p.video || '',
      video_poster: p.video_poster || '',
      isMine: !!user && p.user_id === user.id,
      isLiked: likedSet.has(p.id) ? 1 : 0,
    }))
    return { list, total, page, pageSize }
  },

  // 现场分享点赞：登录用户可赞，重复点取消；计数落 activity_posts.like_count，返回权威值供前端校准
  async postLike({ id } = {}, openid) {
    const user = await findUser(openid)
    if (!user) throw new Error('user not found')
    const [posts] = await db.query("SELECT id FROM activity_posts WHERE id = ? AND status = 'active'", [id])
    if (!posts.length) throw new Error('分享不存在')
    const [existing] = await db.query(
      "SELECT id FROM interactions WHERE user_id = ? AND target_type = 'activity_post' AND target_id = ? AND action = 'like'",
      [user.id, id])
    let liked
    if (existing.length) {
      await db.query('DELETE FROM interactions WHERE id = ?', [existing[0].id])
      await db.query('UPDATE activity_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?', [id])
      liked = false
    } else {
      await db.query(
        "INSERT INTO interactions (user_id, target_type, target_id, action, created_by) VALUES (?, 'activity_post', ?, 'like', ?)",
        [user.id, id, user.id])
      await db.query('UPDATE activity_posts SET like_count = like_count + 1 WHERE id = ?', [id])
      liked = true
    }
    const [[{ c }]] = await db.query('SELECT like_count c FROM activity_posts WHERE id = ?', [id])
    return { liked, likeCount: c }
  },

  // 跨活动分享流（活动页「活动分享」瀑布流）：聚合全部 active 分享倒序分页；
  // 游客可浏览（isLiked 恒 0），draft 活动的分享不外泄
  async postFeed({ page = 1, pageSize = 10 } = {}, openid) {
    page = Math.max(1, parseInt(page, 10) || 1)
    pageSize = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10))
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM activity_posts p JOIN activities a ON p.activity_id = a.id
       WHERE p.status = 'active' AND a.status != 'draft'`)
    const [rows] = await db.query(
      `SELECT p.id, p.activity_id, p.content, p.images, p.video, p.video_poster, p.like_count,
              DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS created_at,
              u.nickname, u.avatar_hue, u.avatar_url,
              a.title AS activity_title, t.name AS type_name, a.type AS activity_channel,
              DATE_FORMAT(a.start_time, '%Y-%m-%d') AS activity_date
       FROM activity_posts p
       JOIN activities a ON p.activity_id = a.id
       LEFT JOIN activity_types t ON a.type_id = t.id
       JOIN users u ON p.user_id = u.id
       WHERE p.status = 'active' AND a.status != 'draft'
       ORDER BY p.id DESC LIMIT ? OFFSET ?`, [pageSize, (page - 1) * pageSize])
    const user = await findUser(openid)
    const likedSet = await likedPostIds(user, rows)
    const list = rows.map(p => ({ ...p, images: p.images || [], video: p.video || '', video_poster: p.video_poster || '', isLiked: likedSet.has(p.id) ? 1 : 0 }))
    return { list, total, page, pageSize }
  },

  // v2.0 活动页顶部 Banner：仅启用项，按 sort 升序（免登录可见，纯运营展示内容）
  async bannerList() {
    const [rows] = await db.query(
      'SELECT id, image_url, title, link_type FROM banners WHERE is_active = 1 ORDER BY sort, id DESC')
    return rows
  },

  // Banner 详情（link_type='detail' 时可点进来）：富文本图文，免登录可读
  async bannerDetail({ id } = {}) {
    if (!id) throw new Error('缺少 Banner ID')
    const [rows] = await db.query(
      "SELECT id, title, content_rich, image_url FROM banners WHERE id = ? AND is_active = 1 AND link_type = 'detail'",
      [id])
    if (!rows.length) throw new Error('内容不存在')
    rows[0].content_rich = await resolveRichImages(rows[0].content_rich)
    return rows[0]
  },

  // v2.0 活动收藏：翻转式（授权即可，同故事/问答）
  async favToggle({ id } = {}, openid) {
    const user = await findUser(openid)
    if (!user) throw new Error('user not found')
    if (!id) throw new Error('缺少活动ID')
    const [existing] = await db.query(
      "SELECT id FROM interactions WHERE user_id = ? AND target_type = 'activity' AND target_id = ? AND action = 'favorite'",
      [user.id, id])
    if (existing.length) {
      await db.query('DELETE FROM interactions WHERE id = ?', [existing[0].id])
      return { active: false }
    }
    await db.query(
      "INSERT INTO interactions (user_id, target_type, target_id, action, created_by) VALUES (?, 'activity', ?, 'favorite', ?)",
      [user.id, id, user.id])
    return { active: true }
  },

  // 我收藏的活动（醒书会员 → 我的收藏 → 活动段），按收藏时间倒序
  async favList({} = {}, openid) {
    const user = await findUser(openid)
    if (!user) return { list: [] }
    const [rows] = await db.query(
      `${LIST_SELECT}
       JOIN interactions i ON i.target_id = a.id AND i.target_type = 'activity' AND i.action = 'favorite'
       WHERE i.user_id = ? AND a.status != 'draft'
       ORDER BY i.created_at DESC`, [user.id])
    rows.forEach(a => {
      a.isFavorited = 1
      if (a.type === 'online') a.location = ''
    })
    return { list: rows }
  },

  async postDelete({ id } = {}, openid) {
    const user = await findUser(openid)
    if (!user) throw new Error('user not found')
    const [r] = await db.query(
      "UPDATE activity_posts SET status = 'deleted' WHERE id = ? AND user_id = ? AND status = 'active'",
      [id, user.id])
    if (!r.affectedRows) throw new Error('无权删除或已删除')
    return true
  },
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action, payload = {} } = event || {}
  try {
    const handler = handlers[action]
    if (!handler) return { code: -1, msg: `未知操作: ${action}` }
    return { code: 0, data: await handler(payload, OPENID) }
  } catch (err) {
    return { code: -1, msg: err.message }
  }
}
