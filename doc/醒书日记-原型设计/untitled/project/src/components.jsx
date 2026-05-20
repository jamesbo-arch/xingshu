// src/components.jsx — atoms: Avatar, SealTag, PermissionBadge, DiaryCard

function Avatar({ name, hue = 30, size = 36, isMember = false }) {
  const ch = (name || '?').slice(0, 1);
  const bg = `oklch(0.55 0.08 ${hue})`;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div className="avatar" style={{
        width: size, height: size, background: bg,
        fontSize: size * 0.42,
      }}>{ch}</div>
      {isMember && (
        <div style={{
          position: 'absolute', right: -2, bottom: -2,
          width: size * 0.4, height: size * 0.4, borderRadius: '50%',
          background: 'linear-gradient(135deg, #E5C16D, #B89968)',
          border: `1.5px solid var(--paper-card)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: size * 0.22, fontFamily: 'var(--font-serif)',
          fontWeight: 700,
        }}>会</div>
      )}
    </div>
  );
}

function SealTag({ children, lg = false, muted = false, onClick, selected = false }) {
  return (
    <span
      onClick={onClick}
      className={`seal-tag ${lg ? 'lg' : ''} ${muted ? 'muted' : ''}`}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        ...(selected && { background: 'rgba(182, 69, 47, 0.12)', borderWidth: 1.5 }),
      }}
    >
      {children}
    </span>
  );
}

function PermissionBadge({ permission }) {
  if (permission === 'public') {
    return (
      <span className="perm-badge perm-public">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>
        公众
      </span>
    );
  }
  if (permission === 'member') {
    return (
      <span className="perm-badge perm-member">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>
        会员
      </span>
    );
  }
  return (
    <span className="perm-badge perm-private">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="11" width="16" height="10" rx="1.5"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>
      私密
    </span>
  );
}

// Interactive stat (heart/bookmark/comment/share) with animation
function StatBtn({ icon: IconComp, count, active, color, onClick, disabled, animateOnActive }) {
  const [anim, setAnim] = React.useState(false);
  const [floats, setFloats] = React.useState([]);
  const handle = (e) => {
    if (disabled) return onClick?.(e);
    if (animateOnActive) {
      setAnim(true);
      setTimeout(() => setAnim(false), 400);
      if (!active) {
        const id = Math.random();
        setFloats(f => [...f, id]);
        setTimeout(() => setFloats(f => f.filter(x => x !== id)), 700);
      }
    }
    onClick?.(e);
  };
  return (
    <button onClick={handle} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '6px 10px', background: 'transparent', border: 'none',
      color: active ? color : 'var(--ink-3)', cursor: 'pointer',
      fontSize: 13, fontFamily: 'var(--font-body)', position: 'relative',
    }}>
      <span className={anim ? 'like-anim' : ''} style={{ display: 'inline-flex', position: 'relative' }}>
        <IconComp filled={active} size={18}/>
        {floats.map(id => (
          <span key={id} className="float-heart" style={{
            left: 4, top: 0, color, fontSize: 14, fontWeight: 700,
          }}>+1</span>
        ))}
      </span>
      <span style={{ minWidth: 14 }}>{count}</span>
    </button>
  );
}

// Card variant 4 (round avatar, large radius, color accent dot on cover)
function DiaryCard({ d, onOpen, onLike, onFav, onEdit, onDelete, showActions }) {
  const isPrivate = d.permission === 'private';
  return (
    <div
      className={`diary-card ${d.authorIsMember ? 'is-member' : ''} ${isPrivate ? 'is-private' : ''}`}
      onClick={onOpen}
      style={{ cursor: onOpen ? 'pointer' : 'default' }}
    >
      {/* author row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Avatar name={d.author} hue={d.avatarHue} size={36} isMember={d.authorIsMember}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500, fontFamily: 'var(--font-title)' }}>
            {d.author}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>
            {d.time}
          </div>
        </div>
        <PermissionBadge permission={d.permission}/>
      </div>

      {/* title */}
      <div className="title-serif" style={{
        fontSize: 17, lineHeight: 1.45, marginBottom: 6,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {d.title}
      </div>

      {/* excerpt */}
      <div className="body-text" style={{
        fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-2)',
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', whiteSpace: 'pre-wrap', marginBottom: 12,
      }}>
        {d.content}
      </div>

      {/* tags */}
      {d.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {d.tags.slice(0, 3).map(t => <SealTag key={t}>{t}</SealTag>)}
        </div>
      )}

      {/* divider */}
      <div style={{ height: 0.5, background: 'rgba(126,102,64,0.14)', margin: '0 -16px 4px' }}/>

      {/* stats */}
      <div onClick={(e) => e.stopPropagation()} style={{
        display: 'flex', alignItems: 'center', marginLeft: -10, marginRight: -10,
      }}>
        <StatBtn icon={IconHeart} count={d.likes} active={d.isLiked} color="var(--like)"
                 onClick={onLike} animateOnActive/>
        <StatBtn icon={IconBookmark} count={d.favorites} active={d.isFavorited} color="var(--fav)"
                 onClick={onFav} animateOnActive/>
        <StatBtn icon={IconComment} count={d.comments} active={false} color="var(--blue)"
                 onClick={onOpen}/>
        <StatBtn icon={IconShare} count={d.shares} active={false} color="var(--blue)"
                 onClick={(e) => { e.stopPropagation(); onLike?.({ poster: true }); }}/>
        {showActions && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                    style={{ padding: '6px 10px', background: 'transparent', border: 'none',
                             color: 'var(--ink-3)', cursor: 'pointer', fontSize: 13,
                             fontFamily: 'var(--font-title)' }}>编辑</button>
            <button onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                    style={{ padding: '6px 10px', background: 'transparent', border: 'none',
                             color: 'var(--danger)', cursor: 'pointer', fontSize: 13,
                             fontFamily: 'var(--font-title)' }}>删除</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Empty state
function EmptyState({ icon, title, hint, cta, onCta }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--ink-4)' }}>
      <div style={{ fontSize: 56, marginBottom: 12, fontFamily: 'var(--font-serif)',
                    color: 'var(--ink-5)', letterSpacing: 6 }}>
        {icon || '空'}
      </div>
      <div style={{ fontSize: 15, color: 'var(--ink-3)', marginBottom: 6,
                    fontFamily: 'var(--font-title)' }}>{title}</div>
      {hint && <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 18 }}>{hint}</div>}
      {cta && (
        <button className="btn btn-ghost" onClick={onCta} style={{ marginTop: 8 }}>
          {cta}
        </button>
      )}
    </div>
  );
}

// Top bar inside iOS frame (custom, not the IOSNavBar)
function TopBar({ title, subtitle, onBack, right, big }) {
  return (
    <div style={{
      padding: '8px 16px 12px',
      display: 'flex', alignItems: big ? 'flex-end' : 'center',
      gap: 8, minHeight: big ? 80 : 44,
    }}>
      {onBack && (
        <button onClick={onBack} style={{
          padding: 8, background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--ink)', marginLeft: -8,
        }}>
          <IconChevron dir="left" size={24}/>
        </button>
      )}
      <div style={{ flex: 1 }}>
        {big ? (
          <div className="title-serif" style={{
            fontSize: 28, letterSpacing: 4, lineHeight: 1.2,
          }}>{title}</div>
        ) : (
          <div className="title-serif" style={{
            fontSize: 17, textAlign: onBack ? 'left' : 'left',
            letterSpacing: 2,
          }}>{title}</div>
        )}
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {right}
      </div>
    </div>
  );
}

Object.assign(window, {
  Avatar, SealTag, PermissionBadge, StatBtn, DiaryCard, EmptyState, TopBar,
});
