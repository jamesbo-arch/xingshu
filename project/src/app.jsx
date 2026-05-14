// src/app.jsx — main App: state + tabs + sheet routing

function TabBar({ tab, setTab }) {
  const tabs = [
    { k: 'square', lbl: '醒书广场', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
    )},
    { k: 'collections', lbl: '我的收藏', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
    )},
    { k: 'mine', lbl: '我的日记', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
    )},
    { k: 'member', lbl: '會員中心', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>
    )},
  ];
  return (
    <div className="tab-bar">
      {tabs.map(t => (
        <div key={t.k} className={`tab-item ${tab === t.k ? 'active' : ''}`}
             onClick={() => setTab(t.k)}>
          {t.icon}
          <div className="lbl">{t.lbl}</div>
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({ title, hint, danger, onCancel, onConfirm }) {
  return (
    <>
      <div className="sheet-mask" onClick={onCancel}/>
      <div style={{
        position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'var(--paper-card)', borderRadius: 14, width: '78%',
        padding: '24px 20px', zIndex: 110, textAlign: 'center',
        boxShadow: 'var(--shadow-3)',
      }}>
        <div className="title-serif" style={{ fontSize: 16, letterSpacing: 2, marginBottom: 8 }}>
          {title}
        </div>
        {hint && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 18,
                               lineHeight: 1.6 }}>{hint}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>取消</button>
          <button className="btn"
                  style={{ flex: 1,
                           background: danger ? 'var(--danger)' : 'var(--ink)',
                           color: '#fff' }}
                  onClick={onConfirm}>确定</button>
        </div>
      </div>
    </>
  );
}

function App({ tweak }) {
  const [tab, setTab] = React.useState('square');
  const [route, setRoute] = React.useState('list'); // list | detail | compose
  const [detailId, setDetailId] = React.useState(null);
  const [editingId, setEditingId] = React.useState(null);
  const [sheet, setSheet] = React.useState(null); // { kind, payload }
  const [confirm, setConfirm] = React.useState(null);
  const [toast, setToastMsg] = React.useState(null);
  const [diaries, setDiaries] = React.useState(window.SEED_DIARIES);
  const [user, setUser] = React.useState({ ...window.CURRENT_USER });
  // sync identity from tweak panel
  React.useEffect(() => {
    if (tweak.identity && tweak.identity !== user.identity) {
      setUser(u => ({ ...u, identity: tweak.identity }));
    }
  }, [tweak.identity]);
  const [filters, setFilters] = React.useState({
    tags: [], author: '',
    timeMode: 'quick', quickRange: 'all',
    dateFrom: '', dateTo: '',
    years: [], months: [],
  });

  const showToast = (m) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(null), 2400);
  };

  const app = {
    diaries, filters, detailId, editingId,
    user,
    setFilters,
    updateUser: (patch) => setUser(u => ({ ...u, ...patch })),
    go: (r) => {
      setRoute(r);
      if (r === 'list') { setDetailId(null); setEditingId(null); }
    },
    openDetail: (id) => { setDetailId(id); setRoute('detail'); },
    openEdit: (id) => { setEditingId(id); setRoute('compose'); },
    openSheet: (kind, payload) => setSheet({ kind, payload }),
    closeSheet: () => setSheet(null),
    toast: showToast,
    toggleLike: (id) => {
      setDiaries(ds => ds.map(d => d.id === id
        ? { ...d, isLiked: !d.isLiked, likes: d.likes + (d.isLiked ? -1 : 1) }
        : d));
    },
    toggleFav: (id) => {
      setDiaries(ds => ds.map(d => d.id === id
        ? { ...d, isFavorited: !d.isFavorited, favorites: d.favorites + (d.isFavorited ? -1 : 1) }
        : d));
      const cur = diaries.find(d => d.id === id);
      showToast(cur?.isFavorited ? '已取消收藏' : '已收藏');
    },
    addDiary: ({ title, content, tags, permission }) => {
      const newD = {
        id: Date.now(),
        title, content, tags, permission,
        author: '我', avatarHue: 60, isMine: true,
        time: '刚刚', timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
        likes: 0, favorites: 0, comments: 0, shares: 0,
        isLiked: false, isFavorited: false, authorIsMember: false,
      };
      setDiaries(ds => [newD, ...ds]);
    },
    updateDiary: (id, patch) => {
      setDiaries(ds => ds.map(d => d.id === id ? { ...d, ...patch } : d));
    },
    confirmDelete: (id) => {
      setConfirm({
        title: '删除日记？',
        hint: '删除后不可恢复，相关互动数据将一并清除',
        danger: true,
        onConfirm: () => {
          setDiaries(ds => ds.filter(d => d.id !== id));
          setConfirm(null);
          showToast('已删除');
        },
      });
    },
  };

  const onTab = (k) => {
    setTab(k);
    setRoute('list');
    setDetailId(null);
    setEditingId(null);
    setSheet(null);
  };

  // Body content by tab/route
  let body;
  if (route === 'compose') {
    body = <ComposeScreen app={app}/>;
  } else if (route === 'detail') {
    body = <DetailScreen app={app}/>;
  } else if (tab === 'square') {
    body = <ListScreen title="醒書廣場" mode="square" app={app}/>;
  } else if (tab === 'collections') {
    body = <ListScreen title="我的收藏" mode="collections" app={app}/>;
  } else if (tab === 'mine') {
    body = <ListScreen title="我的日記" mode="mine" app={app}/>;
  } else if (tab === 'member') {
    body = <MemberScreen app={app}/>;
  }

  const showTabBar = route === 'list';

  return (
    <div data-fontset={tweak.fontset}
         style={{ position: 'relative', height: '100%', overflow: 'hidden',
                  background: 'var(--paper)' }}>
      {/* iOS status bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 }}>
        <IOSStatusBar dark={false}/>
      </div>

      <div style={{ height: '100%', paddingBottom: showTabBar ? 78 : 0 }}>
        {body}
      </div>

      {showTabBar && <TabBar tab={tab} setTab={onTab}/>}

      {/* Sheets */}
      {sheet?.kind === 'filter' && (
        <FilterSheet app={app} onClose={() => setSheet(null)}/>
      )}
      {sheet?.kind === 'poster' && sheet.payload && (
        <PosterSheet d={sheet.payload} app={app} onClose={() => setSheet(null)}/>
      )}
      {sheet?.kind === 'purchase' && (
        <PurchaseSheet app={app} onClose={() => setSheet(null)}/>
      )}
      {sheet?.kind === 'profile' && (
        <ProfileEditSheet app={app} onClose={() => setSheet(null)}/>
      )}

      {confirm && (
        <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)}/>
      )}

      {toast && <div className="toast">{toast}</div>}

      {/* Home indicator */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 60,
        height: 34, display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        paddingBottom: 8, pointerEvents: 'none',
      }}>
        <div style={{
          width: 139, height: 5, borderRadius: 100,
          background: 'rgba(42, 39, 35, 0.35)',
        }}/>
      </div>
    </div>
  );
}

// Mount inside an iOS device frame with Tweaks
function Root() {
  const [t, setT] = useTweaks(window.__TWEAKS_DEFAULTS);

  const setTweak = (k, v) => setT({ [k]: v });

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center',
                  padding: 24, background: '#E8E2D4',
                  backgroundImage: 'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)',
                  backgroundSize: '24px 24px' }}>
      <div style={{ width: 402, height: 874, borderRadius: 48, overflow: 'hidden',
                    position: 'relative', boxShadow: '0 40px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.12)',
                    background: '#000' }}>
        {/* dynamic island */}
        <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
                      width: 126, height: 37, borderRadius: 24, background: '#000', zIndex: 50 }}/>
        <App tweak={t}/>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="模拟身份">
          <TweakRadio label="当前身份"
                      value={t.identity}
                      options={[
                        { value: 'guest',  label: '游客' },
                        { value: 'authed', label: '用户' },
                        { value: 'member', label: '会员' },
                      ]}
                      onChange={(v) => setTweak('identity', v)}/>
        </TweakSection>

        <TweakSection title="字体方案">
          <TweakRadio label="标题字体"
                      value={t.fontset}
                      options={[
                        { value: 'serif', label: '宋体标题' },
                        { value: 'kai',   label: '楷体全文' },
                        { value: 'modern',label: '现代黑体' },
                      ]}
                      onChange={(v) => setTweak('fontset', v)}/>
        </TweakSection>

        <TweakSection title="主色">
          <TweakColor label="主色调"
                      value={t.primary}
                      options={['#4577A4', '#3E5C7B', '#5B7A5A', '#8C6B47']}
                      onChange={(v) => {
                        setTweak('primary', v);
                        document.documentElement.style.setProperty('--blue', v);
                      }}/>
        </TweakSection>

        <TweakSection title="会员强调">
          <TweakRadio label="风格"
                      value={t.memberStyle}
                      options={[
                        { value: 'gold',  label: '金色描边' },
                        { value: 'soft',  label: '柔和高亮' },
                        { value: 'subtle',label: '仅小图标' },
                      ]}
                      onChange={(v) => {
                        setTweak('memberStyle', v);
                        document.body.setAttribute('data-member-style', v);
                      }}/>
        </TweakSection>

        <TweakSection title="文档">
          <TweakButton onClick={() => window.open('design-system.html', '_blank')}>
            打开设计系统页 →
          </TweakButton>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Root/>);
