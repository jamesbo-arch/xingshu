// src/admin/components.jsx — shared admin atoms

const A = window;

// inline icons (line, 1.6 stroke)
const adminIcon = (paths, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {(Array.isArray(paths) ? paths : [paths]).map((d, i) => <path key={i} d={d}/>)}
  </svg>
);
const AIDash      = (p) => adminIcon(['M3 12l2-2 4 4 6-8 6 4','M3 21h18'], p?.size);
const AIUsers     = (p) => adminIcon(['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M23 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75'], p?.size);
const AIOrders    = (p) => adminIcon(['M9 11l3 3L22 4','M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'], p?.size);
const AIBook      = (p) => adminIcon(['M4 19.5A2.5 2.5 0 0 1 6.5 17H20','M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'], p?.size);
const AIChat      = (p) => adminIcon(['M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'], p?.size);
const AISettings  = (p) => adminIcon(['M12 1v6m0 10v6m11-11h-6M7 12H1m17.07-7.07-4.24 4.24M9.17 14.83l-4.24 4.24m0-14.14 4.24 4.24m9.66 9.66 4.24 4.24'], p?.size);
const AIPlus      = (p) => adminIcon(['M12 5v14M5 12h14'], p?.size);
const AIDownload  = (p) => adminIcon(['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4','M7 10l5 5 5-5','M12 15V3'], p?.size);
const AISearch    = (p) => adminIcon(['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z','m21 21-4.3-4.3'], p?.size);
const AIArrowUp   = (p) => adminIcon(['M7 17 17 7','M7 7h10v10'], p?.size);
const AIArrowDown = (p) => adminIcon(['M17 7 7 17','M17 17H7V7'], p?.size);
const AIClose     = (p) => adminIcon(['M18 6 6 18','m6 6 12 12'], p?.size);
const AIClock     = (p) => adminIcon(['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z','M12 6v6l4 2'], p?.size);
const AIWarn      = (p) => adminIcon(['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z','M12 9v4','M12 17h.01'], p?.size);
const AIRefresh   = (p) => adminIcon(['M3 12a9 9 0 0 1 15-6.7L21 8','M21 3v5h-5','M21 12a9 9 0 0 1-15 6.7L3 16','M3 21v-5h5'], p?.size);

// ───────── Avatar (admin) ─────────
function AvX({ name, hue = 35, size = 32 }) {
  const ch = (name || '?').slice(-1);
  return (
    <div className="avx"
         style={{ width: size, height: size, background: `oklch(0.55 0.08 ${hue})`,
                  fontSize: size * 0.44 }}>{ch}</div>
  );
}

// ───────── Identity chip ─────────
function IdentityChip({ value }) {
  const map = {
    guest:  { cls: 'chip guest',  label: '游客' },
    authed: { cls: 'chip authed', label: '用户' },
    member: { cls: 'chip member', label: '会员' },
  };
  const m = map[value] || map.guest;
  return <span className={m.cls}>{m.label}</span>;
}

// ───────── Status chip (order) ─────────
function OrderStatus({ value }) {
  const map = {
    active:   { cls: 'chip success', label: '生效中' },
    expiring: { cls: 'chip warn',    label: '即将到期' },
    expired:  { cls: 'chip muted',   label: '已过期' },
    pending:  { cls: 'chip warn',    label: '待生效' },
  };
  const m = map[value] || map.active;
  return <span className={m.cls}>{m.label}</span>;
}

// ───────── Toast ─────────
function useToast() {
  const [t, setT] = React.useState(null);
  const show = (msg, kind = 'success') => {
    setT({ msg, kind });
    setTimeout(() => setT(null), 2400);
  };
  const node = t && (
    <div className={`adm-toast ${t.kind}`}>{t.msg}</div>
  );
  return [show, node];
}

// ───────── Pagination (display only) ─────────
function Paginate({ total, page = 1, pageSize = 20, onPage }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = [];
  for (let i = 1; i <= Math.min(totalPages, 7); i++) pages.push(i);
  return (
    <div className="adm-paginate">
      <div>共 {total} 条 · 每页 {pageSize} 条</div>
      <div className="pages">
        <div className={`p ${page === 1 ? 'dis' : ''}`}
             onClick={() => page > 1 && onPage?.(page - 1)}>‹</div>
        {pages.map(p => (
          <div key={p} className={`p ${p === page ? 'active' : ''}`}
               onClick={() => onPage?.(p)}>{p}</div>
        ))}
        <div className={`p ${page === totalPages ? 'dis' : ''}`}
             onClick={() => page < totalPages && onPage?.(page + 1)}>›</div>
      </div>
    </div>
  );
}

// ───────── Modal shell ─────────
function Modal({ title, onClose, size, footer, children }) {
  return (
    <div className="adm-mask" onClick={onClose}>
      <div className={`adm-modal ${size === 'lg' ? 'lg' : ''}`}
           onClick={(e) => e.stopPropagation()}>
        <div className="adm-modal-header">
          <h2>{title}</h2>
          <button onClick={onClose}
                  style={{ marginLeft: 'auto', background: 'transparent',
                           border: 'none', cursor: 'pointer', color: 'var(--ink-3)',
                           padding: 6 }}>
            <AIClose size={18}/>
          </button>
        </div>
        <div className="adm-modal-body">{children}</div>
        {footer && <div className="adm-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ───────── Sidebar ─────────
function Sidebar({ page, onNav, badges }) {
  const items = [
    { k: 'dashboard',     lbl: '数据概览',     icon: AIDash },
    { k: 'orders',        lbl: '会员订单',     icon: AIOrders, badge: badges?.pending },
    { k: 'users',         lbl: '用户管理',     icon: AIUsers,  badge: badges?.users },
    { k: 'diaries',       lbl: '日记管理',     icon: AIBook,   badge: badges?.diaries },
    { k: 'interactions',  lbl: '互动数据',     icon: AIChat },
  ];
  const info = window.ADMIN_INFO;
  return (
    <aside className="adm-side">
      <div className="adm-brand">
        <div className="seal"><span>醒</span><span>書</span></div>
        <div>
          <div className="name">醒書日記</div>
          <div className="role">運營後臺</div>
        </div>
      </div>

      <div className="nav-group">主導航</div>
      {items.map(it => {
        const Ic = it.icon;
        return (
          <div key={it.k}
               className={`adm-nav-item ${page === it.k ? 'active' : ''}`}
               onClick={() => onNav(it.k)}>
            <span className="ic"><Ic size={17}/></span>
            <span>{it.lbl}</span>
            {it.badge != null && <span className="count">{it.badge}</span>}
          </div>
        );
      })}

      <div className="nav-group" style={{ marginTop: 'auto', paddingTop: 24 }}>系統</div>
      <div className="adm-nav-item"
           onClick={() => onNav('settings')}>
        <span className="ic"><AISettings size={17}/></span>
        <span>系統設置</span>
      </div>

      <div className="foot">
        <div className="op-name">
          <div className="av">秋</div>
          <div className="txt">
            <div>{info.ops}</div>
            <div style={{ fontSize: 10, color: 'var(--sidebar-dim)',
                          fontFamily: 'var(--font-body)', letterSpacing: 0,
                          marginTop: 2 }}>
              管理员
            </div>
          </div>
        </div>
        <div style={{ fontSize: 10, marginTop: 6, letterSpacing: 1 }}>
          {info.version} · {info.org}
        </div>
      </div>
    </aside>
  );
}

// ───────── Topbar ─────────
function Topbar({ title, subtitle, right }) {
  return (
    <div className="adm-topbar">
      <h1>{title}</h1>
      {subtitle && (
        <span style={{ fontSize: 12, color: 'var(--ink-4)', letterSpacing: 2,
                       fontFamily: 'var(--font-title)' }}>
          {subtitle}
        </span>
      )}
      <div className="sub">
        {right}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <kbd>⌘</kbd><kbd>K</kbd>
          <span style={{ marginLeft: 4 }}>快捷搜索</span>
        </span>
      </div>
    </div>
  );
}

// ───────── KPI card ─────────
function Kpi({ label, value, delta, featured, unit, icon }) {
  const up = delta > 0, down = delta < 0;
  return (
    <div className={`kpi ${featured ? 'featured' : ''}`}>
      <div className="lbl">{label}</div>
      <div className="val">
        {unit === '¥' && <span style={{ fontSize: 16, fontWeight: 400, marginRight: 2 }}>¥</span>}
        {Number(value).toLocaleString()}
        {unit && unit !== '¥' && <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4 }}>{unit}</span>}
      </div>
      {delta != null && (
        <div className={`delta ${up ? 'up' : down ? 'down' : 'flat'}`}>
          {up ? <AIArrowUp size={11}/> : down ? <AIArrowDown size={11}/> : null}
          {Math.abs(delta)}% <span style={{ color: 'var(--ink-4)', marginLeft: 2 }}>较上月</span>
        </div>
      )}
    </div>
  );
}

// ───────── Trend chart (inline svg) ─────────
function TrendChart({ data, height = 220 }) {
  const w = 1000, h = height - 40, padL = 36, padR = 12, padT = 10, padB = 24;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const max = Math.max(...data.map(d => Math.max(d.newDiaries * 8, d.interactions)));
  const xStep = innerW / (data.length - 1);
  const yFor = (v) => padT + innerH - (v / max) * innerH;
  const pathFor = (key) => data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${padL + i * xStep} ${yFor(d[key])}`).join(' ');

  return (
    <div className="trend-chart">
      <div className="legend">
        <span><span className="dot" style={{ background: '#4577A4' }}/>新增日记（×8 缩放）</span>
        <span><span className="dot" style={{ background: '#B89968' }}/>总互动数</span>
        <span><span className="dot" style={{ background: '#5B8F6C' }}/>新增用户</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}
           preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <g key={p}>
            <line x1={padL} y1={padT + innerH * p} x2={w - padR} y2={padT + innerH * p}
                  stroke="#E5DCC6" strokeWidth="0.5" strokeDasharray="2 4"/>
            <text x={padL - 6} y={padT + innerH * p + 4} fontSize="10" fill="#A8A39B"
                  textAnchor="end" fontFamily="SF Mono, monospace">
              {Math.round(max * (1 - p))}
            </text>
          </g>
        ))}
        {/* x labels */}
        {data.map((d, i) => i % 3 === 0 && (
          <text key={i} x={padL + i * xStep} y={h - 4} fontSize="10" fill="#A8A39B"
                textAnchor="middle" fontFamily="SF Mono, monospace">
            {d.date}
          </text>
        ))}
        {/* interactions area */}
        <path d={`${pathFor('interactions')} L ${padL + (data.length - 1) * xStep} ${padT + innerH} L ${padL} ${padT + innerH} Z`}
              fill="rgba(184, 153, 104, 0.12)"/>
        <path d={pathFor('interactions')}
              fill="none" stroke="#B89968" strokeWidth="2" strokeLinecap="round"/>
        {/* diaries (scaled) */}
        <path d={data.map((d, i) =>
          `${i === 0 ? 'M' : 'L'} ${padL + i * xStep} ${yFor(d.newDiaries * 8)}`).join(' ')}
              fill="none" stroke="#4577A4" strokeWidth="2" strokeLinecap="round"/>
        {/* users dots */}
        {data.map((d, i) => (
          <circle key={i} cx={padL + i * xStep} cy={yFor(d.newUsers * 20)}
                  r="2.5" fill="#5B8F6C"/>
        ))}
      </svg>
    </div>
  );
}

// ───────── Confirm Dialog ─────────
function ConfirmDialog({ title, hint, danger, confirmText = '確認',
                         cancelText = '取消', onCancel, onConfirm }) {
  return (
    <div className="adm-mask" onClick={onCancel}>
      <div className="adm-modal" style={{ width: 420 }}
           onClick={(e) => e.stopPropagation()}>
        <div className="adm-modal-body" style={{ padding: 28, textAlign: 'left' }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: danger ? 'rgba(182,69,47,0.12)' : 'rgba(192,147,83,0.16)',
              color: danger ? 'var(--vermilion)' : 'var(--warn)',
              display: 'grid', placeItems: 'center',
            }}>
              <AIWarn size={20}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16,
                            letterSpacing: 2, color: 'var(--ink)' }}>{title}</div>
              {hint && <div style={{ fontSize: 13, color: 'var(--ink-3)',
                                     marginTop: 6, lineHeight: 1.7 }}>{hint}</div>}
            </div>
          </div>
        </div>
        <div className="adm-modal-footer">
          <button className="btn-sm ghost" onClick={onCancel}>{cancelText}</button>
          <button className={`btn-sm ${danger ? 'vermilion' : 'primary'}`}
                  onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  AIDash, AIUsers, AIOrders, AIBook, AIChat, AISettings,
  AIPlus, AIDownload, AISearch, AIArrowUp, AIArrowDown, AIClose,
  AIClock, AIWarn, AIRefresh,
  AvX, IdentityChip, OrderStatus, useToast, Paginate, Modal,
  Sidebar, Topbar, Kpi, TrendChart, ConfirmDialog,
});
