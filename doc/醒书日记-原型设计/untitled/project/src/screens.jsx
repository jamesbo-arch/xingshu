// src/screens.jsx — screens: Square / Collections / MyDiaries / Member / Detail / Compose / Poster / Filter

// ───────────────── Search + filter header ─────────────────
function SearchBar({ value, onChange, onOpenFilter, activeFilters = 0 }) {
  return (
    <div style={{ padding: '0 16px 12px', display: 'flex', gap: 10 }}>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--paper-card)', border: '0.5px solid rgba(126,102,64,0.18)',
        borderRadius: 999, padding: '8px 14px',
      }}>
        <IconSearch size={16} stroke="var(--ink-3)"/>
        <input
          className="input-field"
          placeholder="搜索标题或内容"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ fontSize: 14, padding: 0 }}
        />
      </div>
      <button onClick={onOpenFilter} style={{
        width: 40, height: 40, borderRadius: 999, border: '0.5px solid rgba(126,102,64,0.18)',
        background: activeFilters > 0 ? 'var(--ink)' : 'var(--paper-card)',
        color: activeFilters > 0 ? 'var(--paper)' : 'var(--ink-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        position: 'relative',
      }}>
        <IconFilter size={18}/>
        {activeFilters > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6, width: 8, height: 8,
            borderRadius: 999, background: 'var(--vermilion)',
          }}/>
        )}
      </button>
    </div>
  );
}

// ───────────────── List screens ─────────────────
function ListScreen({ title, mode, app }) {
  const [search, setSearch] = React.useState('');

  const filtered = React.useMemo(() => {
    let arr = app.diaries;
    if (mode === 'collections') arr = arr.filter(d => d.isFavorited);
    if (mode === 'mine') arr = arr.filter(d => d.author === '我' || d.isMine);
    // Filter out private from public-facing list unless mine
    if (mode === 'square') arr = arr.filter(d => d.permission !== 'private' || d.isMine);
    // Apply filters
    const f = app.filters;
    if (search.trim()) {
      const s = search.trim();
      arr = arr.filter(d => d.title.includes(s) || d.content.includes(s));
    }
    if (f.tags?.length) {
      arr = arr.filter(d => f.tags.some(t => d.tags.includes(t)));
    }
    if (f.author?.trim()) {
      arr = arr.filter(d => d.author.includes(f.author.trim()));
    }

    // Time filtering — only one of three modes is active
    const tmode = f.timeMode || 'quick';
    const tsDate = (d) => {
      const m = (d.timestamp || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    };
    if (tmode === 'quick' && f.quickRange && f.quickRange !== 'all') {
      const now = new Date();
      const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      arr = arr.filter(d => {
        const dt = tsDate(d); if (!dt) return false;
        const diff = Math.floor((today0 - dt) / 86400000);
        switch (f.quickRange) {
          case 'today':      return diff === 0;
          case 'yesterday':  return diff === 1;
          case 'week':       return diff >= 0 && diff < 7;
          case 'month':      return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
          case 'last-month': {
            const lm = new Date(now.getFullYear(), now.getMonth() - 1);
            return dt.getFullYear() === lm.getFullYear() && dt.getMonth() === lm.getMonth();
          }
          case 'half-year':  return diff >= 0 && diff < 183;
          case 'year':       return diff >= 0 && diff < 365;
          default: return true;
        }
      });
    }
    if (tmode === 'range' && (f.dateFrom || f.dateTo)) {
      arr = arr.filter(d => {
        const ts = (d.timestamp || '').slice(0, 10);
        if (f.dateFrom && ts < f.dateFrom) return false;
        if (f.dateTo && ts > f.dateTo) return false;
        return true;
      });
    }
    if (tmode === 'ym' && (f.years?.length || f.months?.length)) {
      arr = arr.filter(d => {
        const m = (d.timestamp || '').match(/^(\d{4})-(\d{2})/);
        if (!m) return false;
        const y = +m[1], mo = +m[2];
        if (f.years?.length && !f.years.includes(y)) return false;
        if (f.months?.length && !f.months.includes(mo)) return false;
        return true;
      });
    }
    return arr;
  }, [app.diaries, mode, search, app.filters]);

  const f = app.filters;
  let timeActive = 0;
  if (f.timeMode === 'range' && (f.dateFrom || f.dateTo)) timeActive = 1;
  else if (f.timeMode === 'ym' && (f.years?.length || f.months?.length)) timeActive = 1;
  else if ((f.timeMode || 'quick') === 'quick' && f.quickRange && f.quickRange !== 'all') timeActive = 1;

  const activeFilterCount =
    (f.tags?.length || 0) +
    (f.author?.trim() ? 1 : 0) +
    timeActive;

  return (
    <div className="paper-bg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ paddingTop: 54, flexShrink: 0 }}>
        <TopBar title={title} big right={
          mode === 'square' && (
            <div className="member-chip" onClick={() => app.go('member')} style={{ cursor: 'pointer' }}>
              <IconStar filled size={11}/> 会员
            </div>
          )
        }/>
        <SearchBar value={search} onChange={setSearch}
                   onOpenFilter={() => app.openSheet('filter')}
                   activeFilters={activeFilterCount}/>
      </div>

      <div className="scroll-area" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 100px' }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="無"
            title={mode === 'mine' ? '尚无日记' : mode === 'collections' ? '尚未收藏' : '暂无符合的日记'}
            hint={mode === 'mine' ? '记下今日所思' : '换个关键词或筛选条件试试'}
            cta={mode === 'mine' ? '去写一则' : null}
            onCta={() => app.go('compose')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(d => (
              <DiaryCard
                key={d.id}
                d={d}
                onOpen={() => app.openDetail(d.id)}
                onLike={(opt) => opt?.poster ? app.openSheet('poster', d) : app.toggleLike(d.id)}
                onFav={() => app.toggleFav(d.id)}
                onEdit={() => app.openEdit(d.id)}
                onDelete={() => app.confirmDelete(d.id)}
                showActions={mode === 'mine'}
              />
            ))}
          </div>
        )}
      </div>

      <button className="fab" onClick={() => app.go('compose')}>
        <IconPen size={22}/>
      </button>
    </div>
  );
}

// ───────────────── Detail ─────────────────
function DetailScreen({ app }) {
  const d = app.diaries.find(x => x.id === app.detailId);
  const comments = window.SEED_COMMENTS.filter(c => c.diaryId === d?.id);
  const [commentText, setCommentText] = React.useState('');
  const inputRef = React.useRef(null);

  if (!d) return null;

  return (
    <div className="paper-bg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ paddingTop: 54, flexShrink: 0,
                    background: 'rgba(251,247,238,0.94)', backdropFilter: 'blur(12px)',
                    borderBottom: '0.5px solid rgba(126,102,64,0.12)' }}>
        <TopBar onBack={() => app.go('list')} title="日记"
                right={<button onClick={() => app.openSheet('poster', d)}
                               style={{ background:'transparent', border:'none', cursor:'pointer',
                                        color: 'var(--ink-2)', padding: 8 }}>
                          <IconShare size={20}/>
                       </button>}/>
      </div>

      <div className="scroll-area" style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 140px' }}>
        {/* title */}
        <h1 className="title-serif" style={{
          fontSize: 24, lineHeight: 1.4, margin: '12px 0 14px',
          letterSpacing: 1,
        }}>{d.title}</h1>

        {/* author meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Avatar name={d.author} hue={d.avatarHue} size={32} isMember={d.authorIsMember}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--font-title)' }}>
              {d.author}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{d.timestamp}</div>
          </div>
          <PermissionBadge permission={d.permission}/>
        </div>

        {/* tags */}
        {d.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {d.tags.map(t => <SealTag key={t} lg>{t}</SealTag>)}
          </div>
        )}

        {/* body */}
        <div className="body-text" style={{
          fontSize: 15.5, lineHeight: 1.9, color: 'var(--ink-2)',
          whiteSpace: 'pre-wrap', marginBottom: 32,
          letterSpacing: 0.3,
        }}>
          {d.content}
        </div>

        {/* seal at end */}
        <div style={{ textAlign: 'center', margin: '20px 0 32px' }}>
          <div style={{
            display: 'inline-block', padding: '10px 12px',
            border: '2px solid var(--vermilion)', borderRadius: 4,
            fontFamily: 'var(--font-serif)', color: 'var(--vermilion)',
            fontSize: 15, fontWeight: 700, letterSpacing: 4,
            background: 'rgba(182,69,47,0.04)',
            transform: 'rotate(-2deg)',
          }}>{d.author === '我' ? '吾心' : d.author}</div>
        </div>

        {/* divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
          <div style={{ flex: 1, height: 0.5, background: 'rgba(126,102,64,0.22)' }}/>
          <span className="title-serif" style={{ fontSize: 13, color: 'var(--ink-3)', letterSpacing: 4 }}>
            评论 · {comments.length}
          </span>
          <div style={{ flex: 1, height: 0.5, background: 'rgba(126,102,64,0.22)' }}/>
        </div>

        {/* comments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 12 }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10 }}>
              <Avatar name={c.user} hue={c.avatarHue} size={30}/>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500,
                                 fontFamily: 'var(--font-title)' }}>{c.user}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{c.time}</span>
                </div>
                <div className="body-text" style={{ fontSize: 14, marginTop: 4 }}>
                  {c.content}
                </div>
                {c.replies?.length > 0 && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--paper-2)',
                                borderRadius: 8, borderLeft: '2px solid var(--ink-5)' }}>
                    {c.replies.map(r => (
                      <div key={r.id} style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                        <span style={{ color: 'var(--blue)', fontFamily: 'var(--font-title)' }}>
                          {r.user}：
                        </span>{r.content}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* bottom action bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(251,247,238,0.96)',
        backdropFilter: 'blur(20px) saturate(160%)',
        borderTop: '0.5px solid rgba(126,102,64,0.18)',
        padding: '10px 14px calc(20px + env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center', gap: 8, zIndex: 18,
      }}>
        <button
          onClick={() => inputRef.current?.focus()}
          style={{
            flex: 1, padding: '10px 16px', borderRadius: 999,
            background: 'var(--paper-2)', border: '0.5px solid rgba(126,102,64,0.18)',
            textAlign: 'left', color: 'var(--ink-4)', fontSize: 13, cursor: 'text',
            fontFamily: 'var(--font-body)',
          }}
        >留下你的评论…</button>
        <StatBtn icon={IconHeart} count={d.likes} active={d.isLiked} color="var(--like)"
                 onClick={() => app.toggleLike(d.id)} animateOnActive/>
        <StatBtn icon={IconBookmark} count={d.favorites} active={d.isFavorited} color="var(--fav)"
                 onClick={() => app.toggleFav(d.id)} animateOnActive/>
      </div>
    </div>
  );
}

// ───────────────── Compose ─────────────────
function ComposeScreen({ app }) {
  const editing = app.editingId != null ? app.diaries.find(x => x.id === app.editingId) : null;
  const [title, setTitle] = React.useState(editing?.title || '');
  const [content, setContent] = React.useState(editing?.content || '');
  const [tags, setTags] = React.useState(editing?.tags || []);
  const [permission, setPermission] = React.useState(editing?.permission || 'public');
  const [showTagPicker, setShowTagPicker] = React.useState(false);

  const canSave = title.trim() && content.trim();

  const save = () => {
    if (!canSave) return;
    if (editing) {
      app.updateDiary(editing.id, { title, content, tags, permission });
      app.toast('已保存修改');
    } else {
      app.addDiary({ title, content, tags, permission });
      app.toast('发布成功');
    }
    app.go('list');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column',
                  background: 'var(--paper-card)' }}>
      <div style={{ paddingTop: 54, flexShrink: 0,
                    borderBottom: '0.5px solid rgba(126,102,64,0.12)' }}>
        <TopBar onBack={() => app.go('list')}
                title={editing ? '编辑日记' : '新建日记'}
                right={
                  <button onClick={save} disabled={!canSave}
                          className="btn btn-primary"
                          style={{ padding: '6px 14px', fontSize: 14, borderRadius: 8 }}>
                    {editing ? '保存' : '发布'}
                  </button>
                }/>
      </div>

      <div className="scroll-area" style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 120px' }}>
        <input
          className="input-field title-serif"
          placeholder="请输入日记标题"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 30))}
          style={{ fontSize: 22, padding: '12px 0', letterSpacing: 1 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      borderBottom: '0.5px solid rgba(126,102,64,0.18)' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>最多 30 字</span>
          <span style={{ fontSize: 11, color: title.length > 25 ? 'var(--warn)' : 'var(--ink-4)' }}>
            {title.length}/30
          </span>
        </div>

        <textarea
          className="input-field body-text"
          placeholder="今日所思、所学、所行……"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{
            fontSize: 15, padding: '16px 0', resize: 'none',
            minHeight: 240, lineHeight: 1.9, letterSpacing: 0.3,
            fontFamily: 'var(--font-body)',
          }}
        />
        <div style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'right' }}>
          {content.length} 字
        </div>

        {/* selected tags */}
        <div style={{ marginTop: 28 }}>
          <div className="title-serif" style={{ fontSize: 13, color: 'var(--ink-3)',
                                                letterSpacing: 3, marginBottom: 10 }}>
            标签 · {tags.length}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {tags.map(t => (
              <SealTag key={t} lg onClick={() => setTags(tags.filter(x => x !== t))}>
                {t} ×
              </SealTag>
            ))}
            <button onClick={() => setShowTagPicker(true)}
                    style={{ padding: '4px 10px', border: '1.2px dashed var(--ink-4)',
                             background: 'transparent', color: 'var(--ink-3)',
                             fontSize: 12, borderRadius: 2, cursor: 'pointer',
                             fontFamily: 'var(--font-title)', letterSpacing: 1 }}>
              + 添加
            </button>
          </div>
        </div>

        {/* permission */}
        <div style={{ marginTop: 28 }}>
          <div className="title-serif" style={{ fontSize: 13, color: 'var(--ink-3)',
                                                letterSpacing: 3, marginBottom: 10 }}>
            谁可见
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { v: 'public', label: '公众', hint: '所有用户可见', icon: IconUsers },
              { v: 'member', label: '会员', hint: '仅会员可见，沉淀优质内容', icon: IconStar },
              { v: 'private', label: '私密', hint: '仅自己可见，存于内心', icon: IconLock },
            ].map(opt => {
              const Iconx = opt.icon;
              const active = permission === opt.v;
              return (
                <div key={opt.v} onClick={() => setPermission(opt.v)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  background: active ? 'var(--paper-2)' : 'transparent',
                  border: active ? '1px solid var(--ink-2)' : '1px solid var(--ink-5)',
                  borderRadius: 10, cursor: 'pointer',
                }}>
                  <Iconx size={18}/>
                  <div style={{ flex: 1 }}>
                    <div className="title-serif" style={{ fontSize: 14, color: 'var(--ink)' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                      {opt.hint}
                    </div>
                  </div>
                  <div style={{
                    width: 18, height: 18, borderRadius: 50,
                    border: active ? '5px solid var(--ink)' : '1.5px solid var(--ink-5)',
                  }}/>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showTagPicker && (
        <TagPickerSheet
          selected={tags}
          onClose={() => setShowTagPicker(false)}
          onChange={setTags}
        />
      )}
    </div>
  );
}

function TagPickerSheet({ selected, onClose, onChange }) {
  const [local, setLocal] = React.useState(selected);
  const toggle = (t) => setLocal(l => l.includes(t) ? l.filter(x => x !== t) : [...l, t]);
  return (
    <>
      <div className="sheet-mask" onClick={onClose}/>
      <div className="sheet" style={{ maxHeight: '70%' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div className="title-serif" style={{ flex: 1, fontSize: 16, letterSpacing: 3 }}>
            选择标签
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none',
                                             cursor:'pointer', color:'var(--ink-3)' }}>
            <IconClose size={20}/>
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {window.TAGS.map(t => (
            <span key={t} onClick={() => toggle(t)}
                  className={`seal-tag lg`}
                  style={{
                    cursor: 'pointer',
                    background: local.includes(t) ? 'var(--vermilion)' : 'rgba(182, 69, 47, 0.04)',
                    color: local.includes(t) ? '#fff' : 'var(--vermilion)',
                  }}>
              {t}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }}
                  onClick={() => { setLocal([]); }}>清空</button>
          <button className="btn btn-primary" style={{ flex: 1 }}
                  onClick={() => { onChange(local); onClose(); }}>确定</button>
        </div>
      </div>
    </>
  );
}

// ───────────────── Filter Sheet ─────────────────
function FilterSheet({ app, onClose }) {
  const [local, setLocal] = React.useState(app.filters);
  const toggleTag = (t) => setLocal(l => ({
    ...l,
    tags: l.tags.includes(t) ? l.tags.filter(x => x !== t) : [...l.tags, t],
  }));
  return (
    <>
      <div className="sheet-mask" onClick={onClose}/>
      <div className="sheet">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <div className="title-serif" style={{ flex: 1, fontSize: 17, letterSpacing: 3 }}>
            筛选
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none',
                                             cursor:'pointer', color:'var(--ink-3)' }}>
            <IconClose size={20}/>
          </button>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div className="title-serif" style={{ fontSize: 12, color: 'var(--ink-3)',
                                                letterSpacing: 3, marginBottom: 10 }}>
            标签（可多选）
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
            {window.TAGS.map(t => (
              <span key={t} onClick={() => toggleTag(t)} className="seal-tag" style={{
                cursor: 'pointer',
                background: local.tags.includes(t) ? 'var(--vermilion)' : 'rgba(182,69,47,0.04)',
                color: local.tags.includes(t) ? '#fff' : 'var(--vermilion)',
              }}>{t}</span>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div className="title-serif" style={{ fontSize: 12, color: 'var(--ink-3)',
                                                letterSpacing: 3, marginBottom: 8 }}>
            作者
          </div>
          <input className="input-field" placeholder="输入作者昵称"
                 value={local.author || ''}
                 onChange={(e) => setLocal({ ...local, author: e.target.value })}
                 style={{ background: 'var(--paper-2)', padding: '10px 14px', borderRadius: 8,
                          fontSize: 14 }}/>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div className="title-serif" style={{ fontSize: 12, color: 'var(--ink-3)',
                                                letterSpacing: 3, marginBottom: 10 }}>
            时间范围
          </div>

          {/* Mode switcher */}
          <div style={{
            display: 'flex', background: 'var(--paper-2)',
            borderRadius: 9, padding: 3, marginBottom: 12,
          }}>
            {[
              { v: 'quick', l: '快速' },
              { v: 'range', l: '起止日期' },
              { v: 'ym',    l: '年 / 月' },
            ].map(m => {
              const on = local.timeMode === m.v;
              return (
                <div key={m.v}
                     onClick={() => setLocal(l => ({ ...l, timeMode: m.v }))}
                     style={{
                       flex: 1, padding: '7px 0', textAlign: 'center',
                       fontSize: 12, fontFamily: 'var(--font-title)', letterSpacing: 2,
                       borderRadius: 7, cursor: 'pointer',
                       background: on ? 'var(--paper-card)' : 'transparent',
                       color: on ? 'var(--ink)' : 'var(--ink-3)',
                       boxShadow: on ? '0 1px 3px rgba(58,44,22,0.08)' : 'none',
                       fontWeight: on ? 600 : 400,
                       transition: 'all .15s',
                     }}>{m.l}</div>
              );
            })}
          </div>

          {/* Quick — default */}
          {local.timeMode === 'quick' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {[
                { v: 'all',        l: '全部时间' },
                { v: 'today',      l: '今天' },
                { v: 'yesterday',  l: '昨天' },
                { v: 'week',       l: '本周' },
                { v: 'month',      l: '本月' },
                { v: 'last-month', l: '上月' },
                { v: 'half-year',  l: '近半年' },
                { v: 'year',       l: '近一年' },
              ].map(q => {
                const on = (local.quickRange || 'all') === q.v;
                return (
                  <div key={q.v}
                       onClick={() => setLocal(l => ({ ...l, quickRange: q.v }))}
                       style={{
                         padding: '10px 0', textAlign: 'center',
                         fontSize: 13, fontFamily: 'var(--font-body)',
                         borderRadius: 8, cursor: 'pointer',
                         background: on ? 'rgba(69, 119, 164, 0.10)' : 'var(--paper-2)',
                         color: on ? 'var(--blue)' : 'var(--ink-2)',
                         border: on ? '1px solid var(--blue)' : '1px solid transparent',
                         fontWeight: on ? 600 : 400,
                         letterSpacing: 1,
                       }}>{q.l}</div>
                );
              })}
            </div>
          )}

          {/* Range */}
          {local.timeMode === 'range' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={local.dateFrom || ''}
                     onChange={(e) => setLocal({ ...local, dateFrom: e.target.value })}
                     style={{ flex: 1, padding: '10px 12px', background: 'var(--paper-2)',
                              border: 'none', borderRadius: 8, fontSize: 13,
                              color: 'var(--ink-2)', fontFamily: 'var(--font-body)' }}/>
              <span style={{ alignSelf: 'center', color: 'var(--ink-4)' }}>—</span>
              <input type="date" value={local.dateTo || ''}
                     onChange={(e) => setLocal({ ...local, dateTo: e.target.value })}
                     style={{ flex: 1, padding: '10px 12px', background: 'var(--paper-2)',
                              border: 'none', borderRadius: 8, fontSize: 13,
                              color: 'var(--ink-2)', fontFamily: 'var(--font-body)' }}/>
            </div>
          )}

          {/* Year / Month */}
          {local.timeMode === 'ym' && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: 2 }}>年份</div>
                <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>可多选</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {[2023, 2024, 2025, 2026].map(y => {
                  const on = local.years.includes(y);
                  return (
                    <span key={y} onClick={() => setLocal(l => ({
                      ...l, years: l.years.includes(y) ? l.years.filter(x => x !== y) : [...l.years, y],
                    }))} className="seal-tag" style={{
                      cursor: 'pointer',
                      background: on ? 'var(--vermilion)' : 'rgba(182,69,47,0.04)',
                      color: on ? '#fff' : 'var(--vermilion)',
                      fontFamily: 'var(--font-body)', letterSpacing: 0.5,
                      minWidth: 56, textAlign: 'center',
                    }}>{y}年</span>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: 2 }}>月份</div>
                <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>可多选 · 跨年适用</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                {['一','二','三','四','五','六','七','八','九','十','十一','十二'].map((label, i) => {
                  const m = i + 1;
                  const on = local.months.includes(m);
                  return (
                    <span key={m} onClick={() => setLocal(l => ({
                      ...l, months: l.months.includes(m) ? l.months.filter(x => x !== m) : [...l.months, m],
                    }))} className="seal-tag" style={{
                      cursor: 'pointer',
                      background: on ? 'var(--vermilion)' : 'rgba(182,69,47,0.04)',
                      color: on ? '#fff' : 'var(--vermilion)',
                      textAlign: 'center', padding: '4px 0',
                    }}>{label}月</span>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }}
                  onClick={() => { setLocal({
                    tags: [], author: '',
                    timeMode: 'quick', quickRange: 'all',
                    dateFrom: '', dateTo: '',
                    years: [], months: [],
                  }); }}>
            重置
          </button>
          <button className="btn btn-primary" style={{ flex: 2 }}
                  onClick={() => { app.setFilters(local); onClose(); }}>
            应用筛选
          </button>
        </div>
      </div>
    </>
  );
}

// ───────────────── Poster Sheet ─────────────────
function PosterSheet({ d, onClose, app }) {
  const tags = d.tags?.slice(0, 3) || [];
  return (
    <>
      <div className="sheet-mask" onClick={onClose}/>
      <div className="sheet" style={{ maxHeight: '92%' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div className="title-serif" style={{ flex: 1, fontSize: 16, letterSpacing: 3 }}>
            转发海报
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none',
                                             cursor:'pointer', color:'var(--ink-3)' }}>
            <IconClose size={20}/>
          </button>
        </div>

        {/* poster */}
        <div style={{
          background: 'linear-gradient(165deg, #FBF7EE 0%, #F5EDD8 100%)',
          borderRadius: 14, padding: '28px 24px',
          border: '0.5px solid rgba(126,102,64,0.2)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* corner ornaments */}
          {[['top:14px;left:14px','tl'],['top:14px;right:14px','tr'],['bottom:14px;left:14px','bl'],['bottom:14px;right:14px','br']].map(([pos, k]) => (
            <div key={k} style={{
              position: 'absolute',
              ...Object.fromEntries(pos.split(';').map(s => s.split(':').map(x => x.trim())).map(([k2,v]) => [k2, v])),
              width: 18, height: 18,
              borderTop: k.includes('t') ? '1.5px solid var(--ink-3)' : 'none',
              borderBottom: k.includes('b') ? '1.5px solid var(--ink-3)' : 'none',
              borderLeft: k.includes('l') ? '1.5px solid var(--ink-3)' : 'none',
              borderRight: k.includes('r') ? '1.5px solid var(--ink-3)' : 'none',
            }}/>
          ))}

          <div style={{ textAlign: 'center', marginBottom: 18, paddingTop: 8 }}>
            <div className="title-serif" style={{ fontSize: 13, letterSpacing: 6,
                                                  color: 'var(--ink-3)' }}>醒書日記</div>
            <div style={{ width: 24, height: 0.5, background: 'var(--ink-4)',
                          margin: '8px auto 0' }}/>
          </div>

          <div className="title-serif" style={{
            fontSize: 22, lineHeight: 1.5, textAlign: 'center',
            color: 'var(--ink)', letterSpacing: 1, marginBottom: 14,
          }}>{d.title}</div>

          <div className="body-text" style={{
            fontSize: 13, lineHeight: 1.9, color: 'var(--ink-2)',
            whiteSpace: 'pre-wrap',
            display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', textAlign: 'justify',
          }}>{d.content}</div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center',
                        marginTop: 16 }}>
            {tags.map(t => <SealTag key={t}>{t}</SealTag>)}
          </div>

          <div style={{ height: 0.5, background: 'rgba(126,102,64,0.3)', margin: '20px 0 16px' }}/>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={d.author} hue={d.avatarHue} size={36} isMember={d.authorIsMember}/>
            <div style={{ flex: 1 }}>
              <div className="title-serif" style={{ fontSize: 13, color: 'var(--ink)' }}>
                {d.author}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>{d.time} · 自醒书广场</div>
            </div>
            {/* QR placeholder */}
            <div style={{
              width: 56, height: 56, background: '#fff',
              border: '0.5px solid var(--ink-5)', borderRadius: 6, padding: 4,
              display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1,
            }}>
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} style={{
                  background: ((i * 7 + (i % 5) * 3) % 3 === 0) ? 'var(--ink)' : 'transparent',
                  borderRadius: 0.5,
                }}/>
              ))}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', margin: '12px 0' }}>
          扫描二维码查看完整日记
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }}
                  onClick={() => { app.toast('图片已保存至相册'); onClose(); }}>
            保存图片
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }}
                  onClick={() => { app.toast('已唤起微信分享'); onClose(); }}>
            分享至微信
          </button>
        </div>
      </div>
    </>
  );
}

// ───────────────── Member center ─────────────────
function MemberScreen({ app }) {
  const u = app.user;
  const id = u.identity; // 'guest' | 'authed' | 'member'
  const isMember = id === 'member';
  const isGuest = id === 'guest';

  const displayName = u.nickname || u.wechatName || '未命名';

  const identityMeta = {
    guest:  { label: '游客', hint: '未授权手机号 · 仅可浏览公众日记', tone: 'var(--ink-3)' },
    authed: { label: '用户', hint: '已授权手机号 · 暂未开通会员',     tone: 'var(--ink-3)' },
    member: { label: '会员', hint: '已开通年度会员 · 优质日记可见',   tone: 'var(--gold-deep)' },
  }[id];

  return (
    <div className="paper-bg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ paddingTop: 54, flexShrink: 0 }}>
        <TopBar title="會員中心" big/>
      </div>

      <div className="scroll-area" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 100px' }}>

        {/* ── 身份卡 ── */}
        <div style={{
          padding: '20px 18px',
          background: isMember
            ? 'linear-gradient(135deg, #FCF1D9 0%, #F4E2B4 100%)'
            : 'var(--paper-card)',
          borderRadius: 14,
          border: isMember ? '1px solid var(--gold)' : '0.5px solid rgba(126,102,64,0.14)',
          boxShadow: isMember ? '0 8px 30px rgba(184,153,104,0.25)' : 'var(--shadow-1)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 14, right: 14,
            width: 50, height: 50,
            border: `2px solid ${isMember ? 'var(--vermilion)' : 'var(--ink-4)'}`,
            borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-serif)',
            color: isMember ? 'var(--vermilion)' : 'var(--ink-3)',
            fontSize: 11, fontWeight: 700, letterSpacing: 2, lineHeight: 1.2, textAlign: 'center',
            background: isMember ? 'rgba(182,69,47,0.06)' : 'rgba(168,163,155,0.06)',
            transform: 'rotate(4deg)',
          }}>
            {isMember ? <>會員<br/>之印</> : isGuest ? '游客' : '用户'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {isGuest ? (
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--paper-2)', border: '1.5px dashed var(--ink-4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ink-4)', fontSize: 22, fontFamily: 'var(--font-serif)',
              }}>?</div>
            ) : (
              <Avatar name={displayName} hue={u.avatarHue} size={56} isMember={isMember}/>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="title-serif" style={{ fontSize: 20, letterSpacing: 2,
                                                      whiteSpace: 'nowrap', overflow: 'hidden',
                                                      textOverflow: 'ellipsis' }}>
                  {isGuest ? '未授权' : displayName}
                </div>
                <span style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 3,
                  fontFamily: 'var(--font-title)', letterSpacing: 2,
                  background: isMember ? 'var(--gold)' : isGuest ? 'var(--ink-4)' : 'var(--blue)',
                  color: '#fff',
                }}>{identityMeta.label}</span>
              </div>
              <div style={{ fontSize: 11, color: identityMeta.tone, marginTop: 4,
                            lineHeight: 1.5 }}>
                {identityMeta.hint}
              </div>
              {!isGuest && u.realName && (
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                  实名：{u.realName}
                </div>
              )}
            </div>
          </div>

          {isMember && (
            <div style={{
              marginTop: 16, paddingTop: 14,
              borderTop: '0.5px solid rgba(184,153,104,0.4)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--gold-deep)', letterSpacing: 2 }}>
                  有效期 {u.memberFrom} — {u.memberUntil}
                </div>
                <div className="title-serif" style={{ fontSize: 14, color: 'var(--ink)', marginTop: 4 }}>
                  剩余 <span style={{ fontSize: 22, fontWeight: 700, margin: '0 2px' }}>{u.daysLeft}</span> 天
                </div>
              </div>
              <button onClick={() => app.openSheet('purchase')}
                      style={{ padding: '6px 12px', background: 'transparent',
                               border: '1px solid var(--gold-deep)', borderRadius: 6,
                               color: 'var(--gold-deep)', fontSize: 12,
                               fontFamily: 'var(--font-title)', letterSpacing: 2, cursor: 'pointer' }}>
                如何续费
              </button>
            </div>
          )}
        </div>

        {/* ── 身份对应的主操作区 ── */}
        {isGuest && (
          <button onClick={() => app.toast('请授权手机号（演示）')}
                  className="btn btn-primary"
                  style={{ marginTop: 14, width: '100%', padding: '14px',
                           letterSpacing: 4, fontFamily: 'var(--font-title)' }}>
            微信授权手机号 · 解锁完整功能
          </button>
        )}
        {id === 'authed' && (
          <div style={{
            marginTop: 14, padding: '16px 16px',
            background: 'var(--paper-card)', borderRadius: 12,
            border: '0.5px solid rgba(126,102,64,0.14)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span className="title-serif" style={{ fontSize: 14, color: 'var(--ink)',
                                                     letterSpacing: 2 }}>
                如何成为会员
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>线下开通 · ¥365 / 年</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 12 }}>
              本产品暂不支持小程序在线支付。请联系管理员转账后，
              由管理员在后台为您开通会员，开通后此页面将自动更新状态与有效期。
            </div>
            <button onClick={() => app.openSheet('purchase')}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px',
                             letterSpacing: 3, fontFamily: 'var(--font-title)' }}>
              查看开通方式
            </button>
          </div>
        )}

        {/* ── 个人资料 ── */}
        {!isGuest && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                          margin: '24px 0 10px', paddingLeft: 4 }}>
              <div className="title-serif" style={{ fontSize: 13, color: 'var(--ink-3)',
                                                    letterSpacing: 3 }}>个人资料</div>
              <button onClick={() => app.openSheet('profile')}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer',
                               color: 'var(--ink-3)', fontSize: 12,
                               fontFamily: 'var(--font-title)', letterSpacing: 2 }}>
                编辑 →
              </button>
            </div>
            <div style={{ background: 'var(--paper-card)', borderRadius: 10,
                          border: '0.5px solid rgba(126,102,64,0.14)' }}>
              <ProfileRow label="微信授权名" value={u.wechatName} muted/>
              <ProfileRow label="昵称" value={u.nickname || u.wechatName}
                          hint={!u.nickname ? '默认使用微信授权名' : null}/>
              <ProfileRow label="真实姓名" value={u.realName || '未填写'}
                          empty={!u.realName}/>
              <ProfileRow label="手机号" value={u.phone} muted last/>
            </div>
          </>
        )}

        {/* ── 互动统计 ── */}
        {!isGuest && (
          <>
            <div className="title-serif" style={{
              fontSize: 13, color: 'var(--ink-3)', letterSpacing: 3,
              margin: '24px 0 10px', paddingLeft: 4,
            }}>互动统计</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {[
                { lbl: '已记日记', v: u.stats.diaries, unit: '篇', color: 'var(--ink)' },
                { lbl: '获赞', v: u.stats.likes, unit: '次', color: 'var(--like)' },
                { lbl: '被收藏', v: u.stats.favorites, unit: '次', color: 'var(--fav)' },
                { lbl: '评论与转发', v: u.stats.comments + u.stats.shares, unit: '次', color: 'var(--blue)' },
              ].map(s => (
                <div key={s.lbl} style={{
                  background: 'var(--paper-card)', padding: '14px 14px',
                  borderRadius: 10, border: '0.5px solid rgba(126,102,64,0.14)',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', letterSpacing: 1 }}>{s.lbl}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
                    <span className="title-serif" style={{ fontSize: 22, color: s.color, fontWeight: 700 }}>
                      {s.v}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{s.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── 最近订单（仅会员） ── */}
        {isMember && u.latestOrder && (
          <>
            <div className="title-serif" style={{
              fontSize: 13, color: 'var(--ink-3)', letterSpacing: 3,
              margin: '24px 0 10px', paddingLeft: 4,
            }}>最近订单</div>
            <div style={{
              background: 'var(--paper-card)', borderRadius: 10,
              border: '0.5px solid rgba(126,102,64,0.14)', padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                            alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>订单号</div>
                  <div style={{ fontFamily: '"SF Mono", monospace', fontSize: 13,
                                color: 'var(--ink-2)', marginTop: 2 }}>
                    {u.latestOrder.id}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 3,
                  background: 'rgba(91,143,108,0.12)', color: 'var(--success)',
                  letterSpacing: 1, fontFamily: 'var(--font-title)',
                }}>已支付</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                            fontSize: 12, color: 'var(--ink-2)' }}>
                <div><span style={{ color: 'var(--ink-4)' }}>金额：</span>¥{u.latestOrder.amount}</div>
                <div><span style={{ color: 'var(--ink-4)' }}>方式：</span>{u.latestOrder.method}</div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--ink-4)' }}>录入：</span>
                  {u.latestOrder.createdBy} · {u.latestOrder.createdAt}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── 权益 ── */}
        <div className="title-serif" style={{
          fontSize: 13, color: 'var(--ink-3)', letterSpacing: 3,
          margin: '24px 0 10px', paddingLeft: 4,
        }}>会员权益</div>

        <div style={{ background: 'var(--paper-card)', borderRadius: 10,
                      border: '0.5px solid rgba(126,102,64,0.14)' }}>
          {[
            { t: '查看全部会员权限日记', d: '解锁优质内容，与志同道合者同行' },
            { t: '会员专属印记',         d: '日记卡片、评论区显示会员标识' },
            { t: '海报样式特权',         d: '使用专属海报模板' },
            { t: '优先收录推荐',         d: '高质量日记有机会进入广场首页推荐' },
          ].map((b, i, arr) => (
            <div key={b.t} style={{
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
              borderBottom: i < arr.length - 1 ? '0.5px solid rgba(126,102,64,0.1)' : 'none',
              opacity: isMember ? 1 : 0.65,
            }}>
              <span style={{ color: 'var(--gold)', fontSize: 16 }}>✦</span>
              <div style={{ flex: 1 }}>
                <div className="title-serif" style={{ fontSize: 14, color: 'var(--ink)' }}>{b.t}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{b.d}</div>
              </div>
              {isMember && (
                <span style={{ color: 'var(--success)' }}>
                  <IconCheck size={14}/>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value, hint, muted, empty, last }) {
  return (
    <div style={{
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      borderBottom: last ? 'none' : '0.5px solid rgba(126,102,64,0.1)',
    }}>
      <div style={{ width: 78, fontSize: 12, color: 'var(--ink-4)', letterSpacing: 1,
                    fontFamily: 'var(--font-title)' }}>{label}</div>
      <div style={{ flex: 1, fontSize: 14,
                    color: empty ? 'var(--ink-4)' : muted ? 'var(--ink-3)' : 'var(--ink)',
                    fontFamily: muted ? 'var(--font-body)' : 'var(--font-title)' }}>
        {value}
        {hint && <span style={{ fontSize: 11, color: 'var(--ink-4)', marginLeft: 8 }}>
          · {hint}
        </span>}
      </div>
    </div>
  );
}

// ───────────────── Profile edit sheet ─────────────────
function ProfileEditSheet({ app, onClose }) {
  const u = app.user;
  const [nickname, setNickname] = React.useState(u.nickname || u.wechatName);
  const [realName, setRealName] = React.useState(u.realName || '');

  const save = () => {
    app.updateUser({ nickname: nickname.trim() || u.wechatName, realName: realName.trim() });
    app.toast('已保存');
    onClose();
  };

  return (
    <>
      <div className="sheet-mask" onClick={onClose}/>
      <div className="sheet">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <div className="title-serif" style={{ flex: 1, fontSize: 17, letterSpacing: 3 }}>
            编辑资料
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none',
                                             cursor:'pointer', color:'var(--ink-3)' }}>
            <IconClose size={20}/>
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div className="title-serif" style={{ fontSize: 12, color: 'var(--ink-3)',
                                                letterSpacing: 3, marginBottom: 6 }}>
            微信授权名
          </div>
          <div style={{ padding: '10px 14px', background: 'var(--paper-2)', borderRadius: 8,
                        fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--font-title)' }}>
            {u.wechatName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
            来自微信，无法直接编辑
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div className="title-serif" style={{ fontSize: 12, color: 'var(--ink-3)',
                                                letterSpacing: 3, marginBottom: 6 }}>
            昵称 <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>· 用于广场展示</span>
          </div>
          <input className="input-field" placeholder={u.wechatName}
                 value={nickname}
                 onChange={(e) => setNickname(e.target.value.slice(0, 16))}
                 style={{ background: 'var(--paper-2)', padding: '10px 14px',
                          borderRadius: 8, fontSize: 14 }}/>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div className="title-serif" style={{ fontSize: 12, color: 'var(--ink-3)',
                                                letterSpacing: 3, marginBottom: 6 }}>
            真实姓名 <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>· 仅自己与管理员可见</span>
          </div>
          <input className="input-field" placeholder="选填，便于线下开通会员时核对"
                 value={realName}
                 onChange={(e) => setRealName(e.target.value.slice(0, 16))}
                 style={{ background: 'var(--paper-2)', padding: '10px 14px',
                          borderRadius: 8, fontSize: 14 }}/>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>取消</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={save}>保存</button>
        </div>
      </div>
    </>
  );
}

// ───────────────── 线下开通会员说明 ─────────────────
function PurchaseSheet({ onClose, app }) {
  const u = app.user;
  const ad = window.ADMIN_CONTACT;
  const isMember = u.identity === 'member';

  const steps = [
    { n: '壹', t: '联系管理员',
      d: `添加管理员微信 ${ad.wechat}，备注昵称与手机号` },
    { n: '貳', t: '完成线下转账',
      d: '管理员核对身份后告知收款方式，年度会员 ¥365' },
    { n: '叁', t: '管理员后台开通',
      d: '管理员收款后在后台创建订单并开通会员' },
    { n: '肆', t: '小程序自动激活',
      d: '本页自动更新身份与有效期，无需再操作' },
  ];

  return (
    <>
      <div className="sheet-mask" onClick={onClose}/>
      <div className="sheet" style={{ maxHeight: '90%' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div className="title-serif" style={{ flex: 1, fontSize: 17, letterSpacing: 3 }}>
            {isMember ? '如何续费' : '如何成为会员'}
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none',
                                             cursor:'pointer', color:'var(--ink-3)' }}>
            <IconClose size={20}/>
          </button>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #FCF1D9 0%, #F4E2B4 100%)',
          padding: '18px 20px', borderRadius: 12, border: '1px solid var(--gold)',
          marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div className="title-serif" style={{ fontSize: 13, color: 'var(--gold-deep)',
                                                  letterSpacing: 3 }}>年度會員</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
              <span className="title-serif" style={{ fontSize: 32, color: 'var(--ink)', fontWeight: 700 }}>
                ¥365
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>/ 年</span>
            </div>
          </div>
          <div style={{
            padding: '4px 10px', borderRadius: 4,
            border: '1px dashed var(--vermilion)', color: 'var(--vermilion)',
            fontFamily: 'var(--font-serif)', fontSize: 11, letterSpacing: 2,
          }}>线下支付</div>
        </div>

        <div style={{ marginBottom: 18 }}>
          {steps.map((s, i) => (
            <div key={s.n} style={{
              display: 'flex', gap: 12, padding: '10px 0',
              borderBottom: i < steps.length - 1 ? '0.5px solid rgba(126,102,64,0.1)' : 'none',
            }}>
              <div style={{
                width: 28, height: 28, flexShrink: 0,
                border: '1.5px solid var(--vermilion)', borderRadius: 4,
                color: 'var(--vermilion)', fontFamily: 'var(--font-serif)',
                fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(182,69,47,0.04)',
              }}>{s.n}</div>
              <div style={{ flex: 1 }}>
                <div className="title-serif" style={{ fontSize: 14, color: 'var(--ink)' }}>{s.t}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6, marginTop: 2 }}>
                  {s.d}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          background: 'var(--paper-2)', borderRadius: 10,
          padding: '14px 16px', marginBottom: 16,
        }}>
          <div className="title-serif" style={{ fontSize: 12, color: 'var(--ink-3)',
                                                letterSpacing: 3, marginBottom: 8 }}>
            管理员联系方式
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={ad.name.slice(-1)} hue={35} size={40}/>
            <div style={{ flex: 1 }}>
              <div className="title-serif" style={{ fontSize: 14, color: 'var(--ink)' }}>
                {ad.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                微信号 <span style={{ fontFamily: '"SF Mono", monospace',
                                     color: 'var(--ink)' }}>{ad.wechat}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>
                {ad.hours}
              </div>
            </div>
            <button onClick={() => { app.toast('已复制管理员微信号'); }}
                    className="btn btn-ghost"
                    style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }}>
              复制微信号
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 10, lineHeight: 1.6 }}>
            {ad.note}
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%', padding: '12px',
                                                     letterSpacing: 3 }}
                onClick={onClose}>
          我已了解
        </button>
      </div>
    </>
  );
}

Object.assign(window, {
  SearchBar, ListScreen, DetailScreen, ComposeScreen,
  FilterSheet, PosterSheet, MemberScreen, PurchaseSheet,
  ProfileEditSheet, ProfileRow,
});
