// src/activities.jsx — 醒书活动模块原型（v2.1 MVP）：ActivityListScreen / ActivityDetailScreen / SignupSheet

// 局部小图标（icons.jsx 中无日历/地点/人数图标，此处内联）
function ActIconCalendar({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
}
function ActIconPin({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
}
function ActIconUsers({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

// 封面占位：暖纸深底 + 大号衬线单字 + 印章角（原型无真实图片，用气质化占位）
function ActivityCover({ a, height = 150 }) {
  return (
    <div className="act-cover" style={{ height, background: `oklch(0.93 0.02 ${a.coverHue})` }}>
      <span className="act-cover-char" style={{ color: `oklch(0.45 0.06 ${a.coverHue})` }}>
        {a.coverChar}
      </span>
      <span className="act-cover-seal">醒書</span>
    </div>
  );
}

function ActStatusBadge({ a }) {
  if (a.status === 'past') return <span className="act-badge act-badge-past">回顾</span>;
  if (a.signedByMe) return <span className="act-badge act-badge-signed">已报名</span>;
  if (a.signedUp >= a.capacity) return <span className="act-badge act-badge-full">名额已满</span>;
  return <span className="act-badge act-badge-open">报名中</span>;
}

function ActivityCard({ a, onOpen }) {
  const pct = Math.min(100, Math.round((a.signedUp / a.capacity) * 100));
  return (
    <div className="activity-card" onClick={onOpen}>
      <div style={{ position: 'relative' }}>
        <ActivityCover a={a}/>
        <div style={{ position: 'absolute', top: 10, right: 10 }}><ActStatusBadge a={a}/></div>
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <div className="title-serif" style={{ fontSize: 16, lineHeight: 1.45, marginBottom: 8 }}>
          {a.title}
        </div>
        <div className="act-meta">
          <ActIconCalendar/> <span>{a.datetime}</span>
        </div>
        <div className="act-meta" style={{ marginBottom: 10 }}>
          <ActIconPin/>
          <span>{a.type === 'online' ? '线上活动' : `${a.city} · ${a.location}`}</span>
        </div>
        {a.status === 'upcoming' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="act-progress"><div className="act-progress-fill" style={{ width: `${pct}%` }}/></div>
            <span style={{ fontSize: 11.5, color: 'var(--ink-4)', flexShrink: 0 }}>
              {a.signedUp}/{a.capacity} 人
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>{a.signedUp} 位醒书人参与</div>
        )}
      </div>
    </div>
  );
}

// ───────────────── 活动列表 ─────────────────
function ActivityListScreen({ app }) {
  const upcoming = app.activities.filter(a => a.status === 'upcoming');
  const past = app.activities.filter(a => a.status === 'past');
  return (
    <div className="paper-bg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ paddingTop: 54, flexShrink: 0 }}>
        <TopBar title="醒書活動" subtitle="线上线下，与同路人相见" big/>
      </div>
      <div className="scroll-area" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 100px' }}>
        {app.activities.length === 0 ? (
          <EmptyState icon="期" title="活动筹备中" hint="敬请期待"/>
        ) : (
          <>
            <div className="act-section-title">近期活動</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {upcoming.map(a => <ActivityCard key={a.id} a={a} onOpen={() => app.openActivity(a.id)}/>)}
            </div>
            {past.length > 0 && (
              <>
                <div className="act-section-title" style={{ marginTop: 26 }}>往期回顧</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {past.map(a => <ActivityCard key={a.id} a={a} onOpen={() => app.openActivity(a.id)}/>)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ───────────────── 报名表单弹层（MVP：称呼必填 + 联系方式选填）─────────────────
function SignupSheet({ a, app, onClose }) {
  const [name, setName] = React.useState('');
  const [contact, setContact] = React.useState('');
  const submit = () => {
    if (!name.trim()) { app.toast('请留下你的称呼'); return; }
    app.signupActivity(a.id, { name: name.trim(), contact: contact.trim() });
    onClose();
  };
  return (
    <>
      <div className="sheet-mask" onClick={onClose}/>
      <div className="sheet" style={{ padding: '20px 20px calc(28px + env(safe-area-inset-bottom))' }}>
        <div className="title-serif" style={{ fontSize: 17, letterSpacing: 2, marginBottom: 4 }}>
          报名 · {a.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 18 }}>{a.datetime}</div>
        <div className="act-form-label">你的称呼 *</div>
        <input className="input-field act-form-input" placeholder="怎么称呼你"
               value={name} onChange={e => setName(e.target.value)}/>
        <div className="act-form-label">联系方式（选填）</div>
        <input className="input-field act-form-input" placeholder="微信号或手机号，便于活动变更时通知你"
               value={contact} onChange={e => setContact(e.target.value)}/>
        <button className="btn act-signup-btn" style={{ width: '100%', marginTop: 20 }} onClick={submit}>
          确认报名
        </button>
        <div style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', marginTop: 10 }}>
          报名信息仅用于本次活动组织，不会公开
        </div>
      </div>
    </>
  );
}

// ───────────────── 活动详情 ─────────────────
function ActivityDetailScreen({ app }) {
  const a = app.activities.find(x => x.id === app.activityId);
  const [showSignup, setShowSignup] = React.useState(false);
  if (!a) return null;
  const isPast = a.status === 'past';
  const isFull = a.signedUp >= a.capacity && !a.signedByMe;
  const pct = Math.min(100, Math.round((a.signedUp / a.capacity) * 100));

  return (
    <div className="paper-bg" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ paddingTop: 54, flexShrink: 0 }}>
        <TopBar title={isPast ? '活動回顧' : '活動詳情'} onBack={() => app.go('list')}/>
      </div>

      <div className="scroll-area" style={{ flex: 1, overflowY: 'auto', paddingBottom: isPast ? 40 : 110 }}>
        <div style={{ padding: '0 16px' }}>
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            <ActivityCover a={a} height={180}/>
            <div style={{ position: 'absolute', top: 10, right: 10 }}><ActStatusBadge a={a}/></div>
          </div>

          <div className="title-serif" style={{ fontSize: 21, lineHeight: 1.5, marginBottom: 14 }}>
            {a.title}
          </div>

          <div className="act-info-card">
            <div className="act-meta"><ActIconCalendar/> <span>{a.datetime}</span></div>
            <div className="act-meta">
              <ActIconPin/>
              <span>{a.type === 'online' ? `线上 · ${a.location}` : `${a.city} · ${a.location}`}</span>
            </div>
            <div className="act-meta"><ActIconUsers/> <span>组织方：{a.organizer}</span></div>
            {!isPast && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <div className="act-progress"><div className="act-progress-fill" style={{ width: `${pct}%` }}/></div>
                <span style={{ fontSize: 11.5, color: 'var(--ink-4)', flexShrink: 0 }}>
                  已报名 {a.signedUp}/{a.capacity}
                </span>
              </div>
            )}
            {!isPast && a.deadline && (
              <div style={{ fontSize: 11.5, color: 'var(--vermilion)', marginTop: 2 }}>{a.deadline}</div>
            )}
          </div>

          {!isPast && (
            <>
              <div className="act-section-title">活動介紹</div>
              <div className="body-text" style={{ fontSize: 14.5, lineHeight: 1.9, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
                {a.content}
              </div>
              {a.notice && (
                <>
                  <div className="act-section-title" style={{ marginTop: 22 }}>報名須知</div>
                  <div className="body-text" style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--ink-3)' }}>
                    {a.notice}
                  </div>
                </>
              )}
            </>
          )}

          {isPast && a.review && (
            <>
              <div className="act-section-title">回顧</div>
              <div className="body-text" style={{ fontSize: 14.5, lineHeight: 1.9, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', marginBottom: 16 }}>
                {a.review.text}
              </div>
              <div className="act-photo-grid">
                {Array.from({ length: a.review.photos }).map((_, i) => (
                  <div key={i} className="act-photo" style={{ background: `oklch(0.9 0.02 ${(a.coverHue + i * 40) % 360})` }}>
                    <span style={{ color: `oklch(0.5 0.04 ${(a.coverHue + i * 40) % 360})` }}>照片</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 底部报名栏（仅未结束活动） */}
      {!isPast && (
        <div className="act-signup-bar">
          {a.signedByMe ? (
            <>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--ink-2)' }}>
                ✓ 已报名，期待相见
              </div>
              <button className="btn btn-ghost" onClick={() => app.cancelSignup(a.id)}>取消报名</button>
            </>
          ) : isFull ? (
            <button className="btn act-signup-btn" style={{ width: '100%', opacity: 0.4, cursor: 'default' }} disabled>
              名额已满
            </button>
          ) : (
            <button className="btn act-signup-btn" style={{ width: '100%' }} onClick={() => setShowSignup(true)}>
              报名参加
            </button>
          )}
        </div>
      )}

      {showSignup && <SignupSheet a={a} app={app} onClose={() => setShowSignup(false)}/>}
    </div>
  );
}

Object.assign(window, { ActivityListScreen, ActivityDetailScreen });
