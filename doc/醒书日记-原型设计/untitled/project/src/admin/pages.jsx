// src/admin/pages.jsx — admin pages

// ════════════════════════════════════════════════
// 1. Dashboard
// ════════════════════════════════════════════════
function DashboardPage({ app }) {
  const k = window.ADMIN_KPI;
  return (
    <>
      {/* KPI row */}
      <div className="kpi-grid">
        <Kpi label="總用戶" value={k.users.value} delta={k.users.deltaPct}/>
        <Kpi label="會員數" value={k.members.value} delta={k.members.deltaPct} featured/>
        <Kpi label="日記總數" value={k.diaries.value} delta={k.diaries.deltaPct}/>
        <Kpi label="總互動數" value={k.interactions.value} delta={k.interactions.deltaPct}/>
        <Kpi label="累計收入" value={k.revenue.value} delta={k.revenue.deltaPct} unit="¥"/>
        <Kpi label="即將到期" value={k.pendingOrders.value} delta={k.pendingOrders.deltaPct}/>
      </div>

      {/* Charts + activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div className="adm-card">
          <div className="adm-card-header">
            <h3>近 30 天趨勢</h3>
            <div className="more" style={{ display: 'flex', gap: 6 }}>
              <select className="input" style={{ fontSize: 12 }} defaultValue="30">
                <option value="7">近 7 天</option>
                <option value="30">近 30 天</option>
                <option value="90">近 90 天</option>
              </select>
              <button className="btn-sm ghost"><AIDownload size={13}/> 導出</button>
            </div>
          </div>
          <div className="adm-card-body">
            <TrendChart data={window.ADMIN_TREND}/>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card-header">
            <h3>最近動態</h3>
          </div>
          <div className="activity">
            {window.ADMIN_ACTIVITY.map((a, i) => (
              <div key={i} className={`item ${a.kind}`}>
                <span className="dot"/>
                <div className="txt">
                  {a.text}
                  <div className="time">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="adm-card" style={{ marginTop: 16 }}>
        <div className="adm-card-header">
          <h3>快速操作</h3>
        </div>
        <div className="adm-card-body" style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
        }}>
          {[
            { lbl: '創建會員訂單', sub: '為用戶開通會員', kind: 'orders', icon: AIPlus, primary: true },
            { lbl: '查看用戶列表', sub: '管理註冊用戶', kind: 'users', icon: AIUsers },
            { lbl: '審核日記', sub: '查看最新發布', kind: 'diaries', icon: AIBook },
            { lbl: '評論管理', sub: '處理互動內容', kind: 'interactions', icon: AIChat },
          ].map(q => {
            const Ic = q.icon;
            return (
              <div key={q.lbl} onClick={() => app.nav(q.kind)} style={{
                padding: '14px 16px',
                background: q.primary ? 'var(--ink)' : 'var(--bg-canvas)',
                color: q.primary ? 'var(--paper)' : 'var(--ink-2)',
                border: q.primary ? 'none' : '0.5px solid var(--tbl-border)',
                borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: q.primary ? 'rgba(255,255,255,0.08)' : 'var(--paper-2)',
                  display: 'grid', placeItems: 'center',
                  color: q.primary ? 'var(--gold)' : 'var(--ink-2)',
                }}><Ic size={18}/></div>
                <div>
                  <div style={{ fontFamily: 'var(--font-title)', fontSize: 14,
                                letterSpacing: 2, fontWeight: 600 }}>{q.lbl}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{q.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════
// 2. Orders page — list + create
// ════════════════════════════════════════════════
function OrdersPage({ app, toast }) {
  const [showCreate, setShowCreate] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(null);
  const [detailOrder, setDetailOrder] = React.useState(null);
  const [filter, setFilter] = React.useState({ q: '', status: 'all' });

  // Open create modal when redirected from UsersPage with a preset user
  React.useEffect(() => {
    if (app.presetOrderUser) setShowCreate(true);
  }, [app.presetOrderUser]);

  const orders = app.orders;
  const filtered = orders.filter(o => {
    if (filter.status !== 'all' && o.status !== filter.status) return false;
    if (filter.q.trim()) {
      const s = filter.q.trim();
      return o.id.includes(s) || o.userName.includes(s) || o.userPhone.includes(s);
    }
    return true;
  });

  return (
    <>
      {/* Sync banner */}
      <div className="sync-banner">
        <span className="ic"><AIWarn size={18}/></span>
        <div className="txt">
          <strong>線下開通會員流程：</strong>
          用戶聯繫管理員轉賬後，於此處創建訂單；訂單創建後，
          該用戶的小程序將實時更新為「會員」狀態。
          <span style={{ marginLeft: 6 }}>
            <a href="index.html" target="_blank">查看小程序效果 ↗</a>
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="adm-toolbar">
        <input className="input search" placeholder="搜索訂單號 / 用戶 / 手機號"
               value={filter.q}
               onChange={(e) => setFilter({ ...filter, q: e.target.value })}/>
        <select className="input" value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="all">所有狀態</option>
          <option value="active">生效中</option>
          <option value="expiring">即將到期</option>
          <option value="expired">已過期</option>
        </select>
        <div style={{ flex: 1 }}/>
        <button className="btn-sm ghost"><AIDownload size={13}/> 導出</button>
        <button className="btn-sm primary" onClick={() => setShowCreate(true)}>
          <AIPlus size={13}/> 創建訂單
        </button>
      </div>

      {/* Table */}
      <div className="adm-tbl-wrap">
        <table className="adm-tbl">
          <thead>
            <tr>
              <th>訂單號</th>
              <th>用戶</th>
              <th>套餐</th>
              <th>金額</th>
              <th>支付方式</th>
              <th>支付時間</th>
              <th>會員有效期</th>
              <th>狀態</th>
              <th>錄入</th>
              <th style={{ textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id} style={{ cursor: 'pointer' }}
                  onClick={() => setDetailOrder(o)}>
                <td className="mono">{o.id}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AvX name={o.userName} hue={(o.userId.charCodeAt(3) * 47) % 360} size={26}/>
                    <div>
                      <div style={{ fontFamily: 'var(--font-title)', color: 'var(--ink)' }}>
                        {o.userName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{o.userPhone || '—'}</div>
                    </div>
                  </div>
                </td>
                <td>{o.plan}</td>
                <td className="num">¥{o.amount}</td>
                <td>{o.method}</td>
                <td className="mono">{o.paidAt}</td>
                <td>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                    {o.validFrom} → {o.validUntil}
                  </div>
                </td>
                <td><OrderStatus value={o.status}/></td>
                <td style={{ fontSize: 12 }}>{o.createdBy}</td>
                <td className="actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-sm ghost"
                          onClick={() => setDetailOrder(o)}>詳情</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Paginate total={filtered.length} page={1} pageSize={20}/>
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateOrderModal
          app={app}
          presetUser={app.presetOrderUser}
          onClose={() => {
            setShowCreate(false);
            app.clearPresetOrderUser?.();
          }}
          onCreated={(order) => {
            setShowCreate(false);
            app.clearPresetOrderUser?.();
            setShowSuccess(order);
            toast('订单已创建，用户已成为会员', 'success');
          }}/>
      )}

      {showSuccess && (
        <OrderSuccessModal order={showSuccess} onClose={() => setShowSuccess(null)}/>
      )}

      {detailOrder && (
        <OrderDetailDrawer order={detailOrder} app={app} toast={toast}
                           onClose={() => setDetailOrder(null)}/>
      )}
    </>
  );
}

// ── Create order modal ─────────────────────────
function CreateOrderModal({ app, onClose, onCreated, presetUser }) {
  const [step, setStep] = React.useState(presetUser ? 2 : 1); // skip user picking
  const [user, setUser] = React.useState(presetUser || null);
  const [query, setQuery] = React.useState('');
  const [method, setMethod] = React.useState('微信转账');
  const [amount, setAmount] = React.useState(365);
  const [paidAt, setPaidAt] = React.useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = React.useState('');
  const [proof, setProof] = React.useState(null); // { name, dataUrl, size }

  const candidates = !query.trim() ? app.users.slice(0, 5)
    : app.users.filter(u =>
        u.nickname?.includes(query) || u.wechatName?.includes(query) ||
        u.realName?.includes(query) || u.phone?.includes(query) ||
        u.id.includes(query)).slice(0, 8);

  const validUntil = (() => {
    const d = new Date(paidAt);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const submit = () => {
    const today = new Date();
    const ymd = today.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(1000 + Math.floor(Math.random() * 9000)).slice(0, 4);
    const newOrder = {
      id: `XS-${ymd}-${seq}`,
      userId: user.id, userName: user.nickname || user.wechatName, userPhone: user.phone,
      amount, plan: '年度会员', method,
      paidAt: `${paidAt} ${String(today.getHours()).padStart(2,'0')}:${String(today.getMinutes()).padStart(2,'0')}`,
      validFrom: paidAt, validUntil,
      createdBy: window.ADMIN_INFO.ops,
      createdAt: today.toISOString().slice(0, 16).replace('T', ' '),
      status: 'active', note,
      proof: proof ? { name: proof.name, dataUrl: proof.dataUrl } : null,
    };
    app.addOrder(newOrder);
    onCreated(newOrder);
  };

  return (
    <Modal
      title={step === 1 ? '創建會員訂單 · 選擇用戶'
        : step === 2 ? '創建會員訂單 · 填寫信息'
        : '創建會員訂單 · 確認'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {step > 1 && (
            <button className="btn-sm ghost" onClick={() => setStep(step - 1)}>上一步</button>
          )}
          <button className="btn-sm ghost" onClick={onClose}>取消</button>
          {step < 3 && (
            <button className="btn-sm primary"
                    disabled={step === 1 && !user}
                    style={step === 1 && !user ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                    onClick={() => setStep(step + 1)}>
              下一步
            </button>
          )}
          {step === 3 && (
            <button className="btn-sm vermilion" onClick={submit}>
              確認創建並開通會員
            </button>
          )}
        </>
      }>

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14,
                    paddingBottom: 18, borderBottom: '0.5px solid var(--tbl-border)',
                    marginBottom: 18 }}>
        {[
          { n: 1, t: '選擇用戶' },
          { n: 2, t: '填寫訂單' },
          { n: 3, t: '確認開通' },
        ].map((s, i, arr) => (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: step >= s.n ? 'var(--vermilion)' : 'var(--paper-deep)',
                color: step >= s.n ? '#fff' : 'var(--ink-3)',
                display: 'grid', placeItems: 'center',
                fontFamily: 'var(--font-serif)', fontSize: 12, fontWeight: 600,
              }}>{s.n}</div>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-title)',
                             letterSpacing: 2,
                             color: step >= s.n ? 'var(--ink)' : 'var(--ink-4)' }}>
                {s.t}
              </span>
            </div>
            {i < arr.length - 1 && (
              <div style={{ flex: 1, height: 0.5,
                            background: step > s.n ? 'var(--vermilion)' : 'var(--tbl-border)' }}/>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1 — pick user */}
      {step === 1 && (
        <>
          <div className="field-row">
            <div className="label">搜索用戶 <span className="req">*</span></div>
            <div className="ctrl">
              <input className="field-input"
                     placeholder="輸入昵稱 / 真實姓名 / 手機號 / 用戶ID"
                     value={query}
                     onChange={(e) => setQuery(e.target.value)} autoFocus/>
              <div className="user-picker">
                {candidates.map(u => (
                  <div key={u.id} className="row" onClick={() => setUser(u)}
                       style={user?.id === u.id ? { background: 'var(--gold-soft)' } : {}}>
                    <div className="av" style={{ background: `oklch(0.55 0.08 ${u.avatarHue})` }}>
                      {(u.nickname || u.wechatName).slice(-1)}
                    </div>
                    <div className="info">
                      <div className="name">
                        {u.nickname || u.wechatName}
                        {u.realName && <span style={{ color: 'var(--ink-4)',
                                                       fontWeight: 400, marginLeft: 6 }}>
                          · {u.realName}
                        </span>}
                      </div>
                      <div className="meta">
                        <span className="mono">{u.id}</span>
                        {u.phone && <span style={{ marginLeft: 8 }}>{u.phone}</span>}
                      </div>
                    </div>
                    <IdentityChip value={u.identity}/>
                    {user?.id === u.id && (
                      <span style={{ marginLeft: 8, color: 'var(--success)',
                                     fontFamily: 'var(--font-title)', fontSize: 12 }}>
                        ✓ 已選
                      </span>
                    )}
                  </div>
                ))}
                {candidates.length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-4)',
                                fontSize: 12 }}>
                    沒有匹配的用戶
                  </div>
                )}
              </div>
              <div className="help">
                只能為「已授權手機號」或「現有會員」用戶創建訂單。
              </div>
            </div>
          </div>

          {user && (
            <div className="preview-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <AvX name={user.nickname || user.wechatName} hue={user.avatarHue} size={44}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16,
                                color: 'var(--ink)', letterSpacing: 2 }}>
                    {user.nickname || user.wechatName}
                    {user.realName && <span style={{ color: 'var(--ink-3)', marginLeft: 6,
                                                     fontFamily: 'var(--font-body)',
                                                     fontSize: 13 }}>
                      （{user.realName}）
                    </span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                    <span className="mono">{user.id}</span>
                    {user.phone && <span style={{ marginLeft: 10 }}>{user.phone}</span>}
                  </div>
                </div>
                <IdentityChip value={user.identity}/>
              </div>
              {user.identity === 'member' && (
                <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 8,
                              padding: 8, background: 'rgba(192,147,83,0.1)', borderRadius: 6 }}>
                  ⚠ 該用戶當前為會員，創建新訂單將延長其會員有效期至 {validUntil}。
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Step 2 — fill form */}
      {step === 2 && user && (
        <>
          <div className="field-row">
            <div className="label">用戶</div>
            <div className="ctrl">
              <div className="field-input readonly" style={{ display: 'flex',
                                                              alignItems: 'center', gap: 10 }}>
                <AvX name={user.nickname || user.wechatName} hue={user.avatarHue} size={24}/>
                <span style={{ fontFamily: 'var(--font-title)', color: 'var(--ink)' }}>
                  {user.nickname || user.wechatName}
                </span>
                <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>· {user.id}</span>
              </div>
            </div>
          </div>

          <div className="field-row">
            <div className="label">套餐 <span className="req">*</span></div>
            <div className="ctrl">
              <div className="seg-pick">
                <div className="opt active">年度會員 · ¥365 / 年</div>
                <div className="opt" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                  季度會員 · 暫未開放
                </div>
              </div>
            </div>
          </div>

          <div className="field-row">
            <div className="label">支付方式 <span className="req">*</span></div>
            <div className="ctrl">
              <div className="seg-pick">
                {['微信转账', '支付宝转账', '银行转账', '现金', '其他'].map(m => (
                  <div key={m} className={`opt ${method === m ? 'active' : ''}`}
                       onClick={() => setMethod(m)}>{m}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="field-row">
            <div className="label">實付金額 <span className="req">*</span></div>
            <div className="ctrl" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--ink-3)' }}>¥</span>
              <input className="field-input" type="number" value={amount}
                     onChange={(e) => setAmount(+e.target.value || 0)}
                     style={{ width: 140 }}/>
              <span className="help" style={{ marginTop: 0 }}>
                標準價 ¥365 · 可調整為優惠價
              </span>
            </div>
          </div>

          <div className="field-row">
            <div className="label">支付日期 <span className="req">*</span></div>
            <div className="ctrl">
              <input className="field-input" type="date" value={paidAt}
                     onChange={(e) => setPaidAt(e.target.value)}
                     style={{ width: 180 }}/>
              <div className="help">會員有效期將從此日期起算，至 {validUntil} 結束</div>
            </div>
          </div>

          <div className="field-row">
            <div className="label">備註</div>
            <div className="ctrl">
              <textarea className="field-input" rows="2"
                        placeholder="可填寫備註（如轉賬流水號、優惠原因等）"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        style={{ resize: 'vertical', minHeight: 60 }}/>
            </div>
          </div>

          <div className="field-row">
            <div className="label">支付憑證
              <div style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: 1,
                            fontWeight: 400, marginTop: 2 }}>可選</div>
            </div>
            <div className="ctrl">
              {!proof ? (
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '20px 16px',
                  border: '1.5px dashed var(--ink-5)', borderRadius: 8,
                  background: 'var(--bg-canvas)', cursor: 'pointer',
                  color: 'var(--ink-3)', fontSize: 13,
                  fontFamily: 'var(--font-title)', letterSpacing: 1,
                  transition: 'border-color .15s, background .15s',
                }} onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--vermilion)';
                  e.currentTarget.style.background = 'rgba(182,69,47,0.04)';
                }} onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ink-5)';
                  e.currentTarget.style.background = 'var(--bg-canvas)';
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                       strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="m21 15-5-5L5 21"/>
                  </svg>
                  上傳轉賬截圖或收款憑證
                  <input type="file" accept="image/*" hidden
                         onChange={(e) => {
                           const f = e.target.files?.[0];
                           if (!f) return;
                           if (f.size > 5 * 1024 * 1024) {
                             alert('圖片大小不能超過 5MB');
                             return;
                           }
                           const reader = new FileReader();
                           reader.onload = () => setProof({
                             name: f.name, size: f.size, dataUrl: reader.result,
                           });
                           reader.readAsDataURL(f);
                         }}/>
                </label>
              ) : (
                <div style={{
                  border: '0.5px solid var(--tbl-border)', borderRadius: 8,
                  padding: 10, background: 'var(--bg-canvas)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <img src={proof.dataUrl} alt="憑證"
                       style={{ width: 64, height: 64, objectFit: 'cover',
                                borderRadius: 6, border: '0.5px solid var(--tbl-border)' }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-title)', fontSize: 13,
                                  color: 'var(--ink)', whiteSpace: 'nowrap',
                                  overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {proof.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                      {(proof.size / 1024).toFixed(1)} KB · 已上傳
                    </div>
                  </div>
                  <button className="btn-sm ghost"
                          onClick={() => window.open(proof.dataUrl, '_blank')}>
                    預覽
                  </button>
                  <button className="btn-sm danger" onClick={() => setProof(null)}>
                    移除
                  </button>
                </div>
              )}
              <div className="help">
                支持 JPG/PNG，最大 5MB。憑證將與訂單一同存檔，便於後續核對。
              </div>
            </div>
          </div>
        </>
      )}

      {/* Step 3 — confirm */}
      {step === 3 && user && (
        <>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7,
                        marginBottom: 18 }}>
            請核對以下信息。確認後將立即為用戶開通會員，並通知用戶（如有手機號）。
          </div>

          <div className="preview-card" style={{ background: 'var(--paper-card)',
                                                  border: '1px solid var(--tbl-border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr',
                          gap: 12, fontSize: 13 }}>
              {[
                ['用戶', <span>
                  <span style={{ fontFamily: 'var(--font-title)', color: 'var(--ink)' }}>
                    {user.nickname || user.wechatName}
                  </span>
                  {user.realName && <span style={{ color: 'var(--ink-3)', marginLeft: 6 }}>
                    （{user.realName}）
                  </span>}
                  <span style={{ color: 'var(--ink-4)', marginLeft: 8 }}>· {user.phone || '—'}</span>
                </span>],
                ['套餐', '年度會員'],
                ['金額', <span style={{ fontFamily: 'var(--font-serif)',
                                       fontSize: 22, color: 'var(--vermilion)',
                                       fontWeight: 700 }}>¥{amount}</span>],
                ['支付方式', method],
                ['支付日期', paidAt],
                ['會員有效期', <span style={{ color: 'var(--gold-deep)',
                                              fontFamily: 'var(--font-title)' }}>
                  {paidAt} — {validUntil}
                </span>],
                ['備註', note || '—'],
                ['支付憑證', proof ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={proof.dataUrl} alt=""
                         style={{ width: 36, height: 36, objectFit: 'cover',
                                  borderRadius: 4, border: '0.5px solid var(--tbl-border)' }}/>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{proof.name}</span>
                  </div>
                ) : '—'],
                ['錄入人', `${window.ADMIN_INFO.ops}（${new Date().toISOString().slice(0,16).replace('T',' ')}）`],
              ].map(([k, v]) => (
                <React.Fragment key={k}>
                  <div style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-title)',
                                letterSpacing: 2 }}>{k}</div>
                  <div style={{ color: 'var(--ink-2)' }}>{v}</div>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div style={{
            marginTop: 18, padding: 14, background: 'var(--gold-soft)',
            borderRadius: 8, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7,
          }}>
            <strong style={{ color: 'var(--ink)', fontFamily: 'var(--font-title)',
                             letterSpacing: 2 }}>創建後將執行：</strong><br/>
            1. 該用戶身份立即變更為「會員」<br/>
            2. 用戶下次打開小程序，會員中心將同步更新有效期與訂單詳情<br/>
            3. 系統記錄此訂單，運營可在訂單列表查看與管理
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Order success modal ─────────────────────────
function OrderSuccessModal({ order, onClose }) {
  return (
    <Modal title="✓ 訂單已創建" onClose={onClose}
           footer={
             <>
               <a href="index.html" target="_blank" className="btn-sm ghost"
                  style={{ textDecoration: 'none' }}>
                 查看小程序效果 ↗
               </a>
               <button className="btn-sm primary" onClick={onClose}>完成</button>
             </>
           }>
      <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
        <div style={{
          width: 64, height: 64, margin: '0 auto 14px',
          border: '2px solid var(--vermilion)', borderRadius: 4,
          color: 'var(--vermilion)', fontFamily: 'var(--font-serif)',
          fontSize: 13, fontWeight: 700, letterSpacing: 2, lineHeight: 1.2,
          display: 'grid', placeItems: 'center',
          background: 'rgba(182,69,47,0.06)',
        }}>
          <div>會員<br/>之印</div>
        </div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18,
                      letterSpacing: 3, marginBottom: 4 }}>
          {order.userName} 已開通會員
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          有效期至 <span style={{ color: 'var(--gold-deep)',
                                  fontFamily: 'var(--font-title)' }}>
            {order.validUntil}
          </span>
        </div>
      </div>

      <div style={{
        background: 'var(--paper-2)', borderRadius: 8, padding: 14,
        fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>訂單號</span>
          <span className="mono" style={{ color: 'var(--ink-2)' }}>{order.id}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>金額</span>
          <span style={{ color: 'var(--ink-2)' }}>¥{order.amount} · {order.method}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>錄入人</span>
          <span style={{ color: 'var(--ink-2)' }}>{order.createdBy}</span>
        </div>
      </div>
    </Modal>
  );
}

// ── Order detail drawer ─────────────────────────
function OrderDetailDrawer({ order, app, onClose, toast }) {
  const user = app.users.find(u => u.id === order.userId);
  const statusMeta = {
    active:   { label: '生效中', stampLabel: '生效', expired: false },
    expiring: { label: '即將到期', stampLabel: '即將\n到期', expired: false },
    expired:  { label: '已過期', stampLabel: '已過\n期', expired: true },
    pending:  { label: '待生效', stampLabel: '待生效', expired: true },
  }[order.status] || { label: order.status, stampLabel: '', expired: false };

  // Synthesize timeline events
  const events = [
    { kind: 'done', lbl: '訂單創建並開通會員',
      meta: `${order.createdBy} · ${order.createdAt}` },
    { kind: 'done', lbl: '會員權益生效',
      meta: order.validFrom },
    order.status === 'expired'
      ? { kind: 'warn', lbl: '會員到期', meta: order.validUntil }
      : order.status === 'expiring'
      ? { kind: 'warn', lbl: `${order.validUntil} 到期 · 待提醒續費`, meta: '系統提醒' }
      : { kind: 'pending', lbl: `將於 ${order.validUntil} 到期`, meta: '預期事件' },
  ];

  return (
    <>
      <div className="adm-drawer-mask" onClick={onClose}/>
      <div className="adm-drawer">
        <div className="head">
          <h2>訂單詳情</h2>
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {order.id}
          </span>
          <div style={{ flex: 1 }}/>
          <OrderStatus value={order.status}/>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--ink-3)', padding: 6, marginRight: -6,
          }}>
            <AIClose size={18}/>
          </button>
        </div>

        <div className="body">
          {/* Header card */}
          <div className="order-head">
            <div className={`stamp ${statusMeta.expired ? 'expired' : ''}`}
                 style={{ whiteSpace: 'pre-line' }}>
              {statusMeta.stampLabel}
            </div>
            <div style={{ fontSize: 11, color: 'var(--gold-deep)', letterSpacing: 3,
                          fontFamily: 'var(--font-title)', marginBottom: 4 }}>
              {order.plan}
            </div>
            <div className="amount"><span className="cur">¥</span>{order.amount}</div>
            <div className="oid">訂單號 {order.id}</div>
            <div className="plan-row">
              <span style={{ color: 'var(--ink-4)',
                             fontFamily: 'var(--font-title)' }}>有效期</span>
              <span style={{ color: 'var(--gold-deep)',
                             fontFamily: 'var(--font-title)' }}>
                {order.validFrom} — {order.validUntil}
              </span>
            </div>
          </div>

          {/* User block */}
          <div className="drw-section">
            <div className="title">會員用戶</div>
            {user ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 14px', background: 'var(--paper-card)',
                border: '0.5px solid var(--tbl-border)', borderRadius: 10,
              }}>
                <AvX name={user.nickname || user.wechatName} hue={user.avatarHue} size={44}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16,
                                   letterSpacing: 2, color: 'var(--ink)' }}>
                      {user.nickname || user.wechatName}
                    </span>
                    {user.realName && <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                      （{user.realName}）
                    </span>}
                    <IdentityChip value={user.identity}/>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 4 }}>
                    <span className="mono">{user.id}</span>
                    {user.phone && <span style={{ marginLeft: 12 }}>{user.phone}</span>}
                    <span style={{ marginLeft: 12 }}>· 微信名 {user.wechatName}</span>
                  </div>
                </div>
                <button className="btn-sm ghost" onClick={() => {
                  onClose();
                  app.nav('users');
                }}>查看用戶</button>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>用戶信息已不可用</div>
            )}
          </div>

          {/* Payment info */}
          <div className="drw-section">
            <div className="title">支付信息</div>
            <dl className="drw-kv">
              <dt>金額</dt>
              <dd><span style={{ fontFamily: 'var(--font-serif)',
                                  color: 'var(--vermilion)', fontWeight: 700,
                                  fontSize: 16 }}>¥{order.amount}</span></dd>

              <dt>支付方式</dt>
              <dd>{order.method}</dd>

              <dt>支付時間</dt>
              <dd className="mono">{order.paidAt}</dd>

              <dt>套餐</dt>
              <dd>{order.plan}</dd>

              {order.note && (
                <>
                  <dt>備註</dt>
                  <dd>{order.note}</dd>
                </>
              )}
            </dl>

            {/* Proof */}
            {order.proof?.dataUrl && (
              <div style={{ marginTop: 14, padding: 12,
                            background: 'var(--paper-card)',
                            border: '0.5px solid var(--tbl-border)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', letterSpacing: 1,
                              fontFamily: 'var(--font-title)', marginBottom: 8 }}>
                  支付憑證
                </div>
                <img src={order.proof.dataUrl} alt="支付憑證"
                     className="proof-img"
                     onClick={() => window.open(order.proof.dataUrl, '_blank')}/>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 6 }}>
                  {order.proof.name} · 點擊放大查看
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="drw-section">
            <div className="title">訂單時間線</div>
            <div className="timeline">
              {events.map((e, i) => (
                <div key={i} className={`step ${e.kind}`}>
                  <div className="lbl">{e.lbl}</div>
                  <div className="meta">{e.meta}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit */}
          <div className="drw-section">
            <div className="title">操作記錄</div>
            <dl className="drw-kv">
              <dt>錄入人</dt>
              <dd>{order.createdBy}</dd>
              <dt>創建時間</dt>
              <dd className="mono">{order.createdAt}</dd>
              <dt>來源</dt>
              <dd>後台手動創建 · 線下支付</dd>
            </dl>
          </div>
        </div>

        <div className="foot">
          {order.status === 'active' && (
            <button className="btn-sm danger"
                    onClick={() => toast?.('退款功能待開發', 'danger')}>
              退款並停用
            </button>
          )}
          <button className="btn-sm ghost"
                  onClick={() => toast?.('打印功能待開發')}>
            打印憑證
          </button>
          <button className="btn-sm primary" onClick={onClose}>關閉</button>
        </div>
      </div>
    </>
  );
}

// ── User detail drawer (with edit mode) ─────────
function UserDetailDrawer({ user, app, onClose, toast }) {
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState({
    nickname: user.nickname || '',
    realName: user.realName || '',
    phone:    user.phone || '',
  });
  const [copied, setCopied] = React.useState(null);

  const copy = (label, val) => {
    if (!val) return;
    try {
      navigator.clipboard?.writeText(val);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch (e) {}
  };

  const save = () => {
    app.updateUser?.(user.id, form);
    toast?.('已保存用户资料', 'success');
    setEditing(false);
  };

  const cancelEdit = () => {
    setForm({
      nickname: user.nickname || '',
      realName: user.realName || '',
      phone:    user.phone || '',
    });
    setEditing(false);
  };

  // User's orders (filter from app)
  const userOrders = app.orders.filter(o => o.userId === user.id);

  // ID row component
  const IdRow = ({ label, value, dim, primary }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0',
      borderBottom: '0.5px solid var(--tbl-border)',
    }}>
      <div style={{
        width: 86, fontSize: 11, color: 'var(--ink-4)', letterSpacing: 2,
        fontFamily: 'var(--font-title)', flexShrink: 0,
      }}>{label}</div>
      <div style={{
        flex: 1, fontFamily: 'SF Mono, Menlo, monospace', fontSize: 12.5,
        color: dim ? 'var(--ink-4)' : 'var(--ink-2)',
        wordBreak: 'break-all', letterSpacing: 0.5,
      }}>
        {value || <span style={{ fontFamily: 'var(--font-body)' }}>未获取</span>}
      </div>
      {primary && (
        <span style={{
          padding: '2px 6px', fontSize: 10, borderRadius: 3,
          background: 'var(--vermilion)', color: '#fff',
          fontFamily: 'var(--font-title)', letterSpacing: 1, flexShrink: 0,
        }}>主键</span>
      )}
      {value && (
        <button className="btn-sm ghost" onClick={() => copy(label, value)}
                style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}>
          {copied === label ? '已复制' : '复制'}
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="adm-drawer-mask" onClick={editing ? cancelEdit : onClose}/>
      <div className="adm-drawer">
        <div className="head">
          <h2>{editing ? '編輯用戶資料' : '用戶詳情'}</h2>
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {user.id}
          </span>
          <div style={{ flex: 1 }}/>
          {!editing && <IdentityChip value={user.identity}/>}
          <button onClick={editing ? cancelEdit : onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--ink-3)', padding: 6, marginRight: -6,
          }}>
            <AIClose size={18}/>
          </button>
        </div>

        <div className="body">
          {/* Profile header card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '16px 18px', marginBottom: 22,
            background: 'var(--paper-card)',
            border: '0.5px solid var(--tbl-border)',
            borderRadius: 12,
          }}>
            <AvX name={user.nickname || user.wechatName} hue={user.avatarHue} size={64}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22,
                            letterSpacing: 2, color: 'var(--ink)' }}>
                {user.nickname || user.wechatName || '未设置昵称'}
              </div>
              {user.realName && (
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                  实名 · {user.realName}
                </div>
              )}
              <div style={{ display: 'flex', gap: 14, marginTop: 8,
                            fontSize: 11, color: 'var(--ink-4)' }}>
                <span>注册 {user.registeredAt}</span>
                <span>· 活跃 {user.lastActive}</span>
              </div>
            </div>
            {!editing && (
              <button className="btn-sm primary" onClick={() => setEditing(true)}>
                編輯
              </button>
            )}
          </div>

          {/* ── Identity IDs (read-only) ── */}
          <div className="drw-section">
            <div className="title">身份標識</div>
            <div style={{
              background: 'var(--paper-card)',
              border: '0.5px solid var(--tbl-border)',
              borderRadius: 10, padding: '0 14px',
            }}>
              <IdRow label="系統 ID" value={user.id} primary/>
              <IdRow label="WeChat OpenID" value={user.openid}/>
              <IdRow label="WeChat UnionID" value={user.unionid}
                     dim={!user.unionid}/>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 8,
                          lineHeight: 1.6 }}>
              系統 ID 為唯一主鍵，貫穿所有業務數據；
              OpenID 是用戶在當前小程序的唯一標識；
              UnionID 適用於同主體多應用識別。
            </div>
          </div>

          {/* ── Editable info ── */}
          <div className="drw-section">
            <div className="title">基礎資料</div>
            {!editing ? (
              <dl className="drw-kv">
                <dt>微信授權名</dt>
                <dd>{user.wechatName}
                  <span style={{ marginLeft: 8, fontSize: 11,
                                  color: 'var(--ink-4)' }}>只讀</span>
                </dd>
                <dt>昵稱</dt>
                <dd>{user.nickname || <span style={{ color: 'var(--ink-4)' }}>
                  未設置 · 默認使用微信授權名
                </span>}</dd>
                <dt>真實姓名</dt>
                <dd>{user.realName || <span style={{ color: 'var(--ink-4)' }}>未填寫</span>}</dd>
                <dt>手機號</dt>
                <dd className="mono">{user.phone || <span style={{
                  fontFamily: 'var(--font-body)', color: 'var(--ink-4)'
                }}>未授權</span>}</dd>
              </dl>
            ) : (
              <div>
                <div className="field-row">
                  <div className="label">微信授權名</div>
                  <div className="ctrl">
                    <input className="field-input readonly" value={user.wechatName}
                           readOnly/>
                    <div className="help">由微信授權獲取，不可修改</div>
                  </div>
                </div>
                <div className="field-row">
                  <div className="label">昵稱</div>
                  <div className="ctrl">
                    <input className="field-input" value={form.nickname}
                           placeholder={user.wechatName}
                           onChange={(e) => setForm({ ...form, nickname: e.target.value.slice(0, 16) })}/>
                    <div className="help">用於小程序廣場展示，不填則使用微信授權名</div>
                  </div>
                </div>
                <div className="field-row">
                  <div className="label">真實姓名</div>
                  <div className="ctrl">
                    <input className="field-input" value={form.realName}
                           placeholder="選填 · 用於線下開通會員時核對"
                           onChange={(e) => setForm({ ...form, realName: e.target.value.slice(0, 16) })}/>
                  </div>
                </div>
                <div className="field-row">
                  <div className="label">手機號</div>
                  <div className="ctrl">
                    <input className="field-input" value={form.phone}
                           placeholder="11 位手機號"
                           onChange={(e) => setForm({ ...form, phone: e.target.value.slice(0, 11) })}/>
                    <div className="help">通常由微信授權獲取，亦可手動修正</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Member info ── */}
          {!editing && (
            <div className="drw-section">
              <div className="title">會員狀態</div>
              {user.identity === 'member' ? (
                <div style={{
                  background: 'linear-gradient(135deg, #FFFBED, #F4E2B4)',
                  border: '1px solid var(--gold)',
                  borderRadius: 10, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--gold-deep)',
                                  letterSpacing: 2 }}>
                      有效期至
                    </div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18,
                                  color: 'var(--ink)', marginTop: 2 }}>
                      {user.memberUntil}
                    </div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div className="title-serif" style={{ fontSize: 13,
                                                          color: 'var(--gold-deep)' }}>
                      剩餘 <span style={{ fontSize: 22, fontWeight: 700 }}>
                        {user.daysLeft}
                      </span> 天
                    </div>
                  </div>
                </div>
              ) : user.identity === 'authed' ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', background: 'var(--paper-2)',
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    當前為普通用戶，尚未開通會員。
                  </span>
                  <button className="btn-sm vermilion"
                          style={{ marginLeft: 'auto' }}
                          onClick={() => {
                            onClose();
                            app.openCreateOrderFor(user);
                          }}>
                    開通會員
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--ink-4)',
                              padding: '10px 14px', background: 'var(--paper-2)',
                              borderRadius: 8 }}>
                  游客 · 未授權手機號，無法開通會員
                </div>
              )}
            </div>
          )}

          {/* ── Stats ── */}
          {!editing && (
            <div className="drw-section">
              <div className="title">互動統計</div>
              <div style={{ display: 'grid',
                            gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {[
                  { l: '日记', v: user.stats.diaries, c: 'var(--ink)' },
                  { l: '获赞', v: user.stats.likes, c: 'var(--like)' },
                  { l: '收藏', v: user.stats.favorites, c: 'var(--fav)' },
                  { l: '评论', v: user.stats.comments, c: 'var(--blue)' },
                  { l: '转发', v: user.stats.shares, c: 'var(--gold-deep)' },
                ].map(s => (
                  <div key={s.l} style={{
                    background: 'var(--paper-card)',
                    border: '0.5px solid var(--tbl-border)',
                    borderRadius: 8, padding: '10px 12px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)',
                                  letterSpacing: 1 }}>{s.l}</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18,
                                  color: s.c, fontWeight: 700, marginTop: 4 }}>
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Order history ── */}
          {!editing && userOrders.length > 0 && (
            <div className="drw-section">
              <div className="title">會員訂單（{userOrders.length}）</div>
              <div style={{ background: 'var(--paper-card)',
                            border: '0.5px solid var(--tbl-border)',
                            borderRadius: 10, overflow: 'hidden' }}>
                {userOrders.map((o, i) => (
                  <div key={o.id} style={{
                    padding: '10px 14px',
                    borderBottom: i < userOrders.length - 1
                      ? '0.5px solid var(--tbl-border)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5,
                  }}>
                    <span className="mono" style={{ color: 'var(--ink-3)' }}>
                      {o.id}
                    </span>
                    <span style={{ flex: 1, color: 'var(--ink-2)' }}>
                      ¥{o.amount} · {o.method}
                    </span>
                    <span style={{ color: 'var(--ink-4)', fontSize: 11 }}
                          className="mono">
                      {o.paidAt}
                    </span>
                    <OrderStatus value={o.status}/>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="foot">
          {editing ? (
            <>
              <button className="btn-sm ghost" onClick={cancelEdit}>取消</button>
              <button className="btn-sm primary" onClick={save}>保存修改</button>
            </>
          ) : (
            <>
              <button className="btn-sm danger"
                      onClick={() => toast?.('删除功能待开发', 'danger')}>
                刪除用戶
              </button>
              <div style={{ flex: 1 }}/>
              <button className="btn-sm ghost" onClick={onClose}>關閉</button>
              <button className="btn-sm primary" onClick={() => setEditing(true)}>
                編輯
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
function UsersPage({ app, toast }) {
  const [filter, setFilter] = React.useState({ q: '', identity: 'all' });
  const [detailUser, setDetailUser] = React.useState(null);
  const filtered = app.users.filter(u => {
    if (filter.identity !== 'all' && u.identity !== filter.identity) return false;
    if (filter.q.trim()) {
      const s = filter.q.trim();
      return u.nickname?.includes(s) || u.wechatName?.includes(s)
          || u.realName?.includes(s) || u.phone?.includes(s) || u.id.includes(s);
    }
    return true;
  });

  return (
    <>
      <div className="adm-toolbar">
        <input className="input search" placeholder="搜索用戶名 / 手機號 / 用戶ID"
               value={filter.q}
               onChange={(e) => setFilter({ ...filter, q: e.target.value })}/>
        <select className="input" value={filter.identity}
                onChange={(e) => setFilter({ ...filter, identity: e.target.value })}>
          <option value="all">所有身份</option>
          <option value="member">會員</option>
          <option value="authed">用戶</option>
          <option value="guest">游客</option>
        </select>
        <div style={{ flex: 1 }}/>
        <button className="btn-sm ghost"><AIDownload size={13}/> 導出</button>
        <button className="btn-sm primary"
                onClick={() => app.nav('orders')}>
          <AIPlus size={13}/> 為用戶開通會員
        </button>
      </div>

      <div className="adm-tbl-wrap">
        <table className="adm-tbl">
          <thead>
            <tr>
              <th>用戶ID</th>
              <th>用戶</th>
              <th>真實姓名</th>
              <th>手機號</th>
              <th>身份</th>
              <th>會員有效期</th>
              <th>已發日記</th>
              <th>互動數</th>
              <th>註冊時間</th>
              <th>最後活躍</th>
              <th style={{ textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ cursor: 'pointer' }}
                  onClick={() => setDetailUser(u)}>
                <td className="mono">{u.id}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AvX name={u.nickname || u.wechatName} hue={u.avatarHue} size={26}/>
                    <div>
                      <div style={{ fontFamily: 'var(--font-title)', color: 'var(--ink)' }}>
                        {u.nickname || u.wechatName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                        微信：{u.wechatName}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ color: u.realName ? 'var(--ink-2)' : 'var(--ink-4)' }}>
                  {u.realName || '未填'}
                </td>
                <td className="mono">{u.phone || '—'}</td>
                <td><IdentityChip value={u.identity}/></td>
                <td style={{ fontSize: 12 }}>
                  {u.memberUntil
                    ? <span>{u.memberUntil} <span style={{ color: 'var(--ink-4)' }}>
                        · 剩 {u.daysLeft} 天
                      </span></span>
                    : '—'}
                </td>
                <td className="num">{u.stats.diaries}</td>
                <td className="num">{u.stats.likes + u.stats.favorites + u.stats.comments + u.stats.shares}</td>
                <td className="mono">{u.registeredAt}</td>
                <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{u.lastActive}</td>
                <td className="actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-sm ghost"
                          onClick={() => setDetailUser(u)}>詳情</button>
                  {u.identity !== 'guest' && u.identity !== 'member' && (
                    <button className="btn-sm vermilion"
                            onClick={() => app.openCreateOrderFor(u)}>
                      開通會員
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Paginate total={filtered.length} page={1} pageSize={20}/>
      </div>

      {detailUser && (
        <UserDetailDrawer user={detailUser} app={app} toast={toast}
                          onClose={() => setDetailUser(null)}/>
      )}
    </>
  );
}

// ════════════════════════════════════════════════
// 4. Diaries page — full CRUD
// ════════════════════════════════════════════════
function DiariesPage({ app, toast }) {
  const [filter, setFilter] = React.useState({ q: '', permission: 'all', tag: 'all' });
  const [selected, setSelected] = React.useState(new Set());
  const [detailDiary, setDetailDiary] = React.useState(null);
  const [editDiary, setEditDiary] = React.useState(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [confirm, setConfirm] = React.useState(null);

  const allTags = React.useMemo(() => {
    const s = new Set();
    app.diaries.forEach(d => d.tags?.forEach(t => s.add(t)));
    return [...s];
  }, [app.diaries]);

  const filtered = app.diaries.filter(d => {
    if (filter.permission !== 'all' && d.permission !== filter.permission) return false;
    if (filter.tag !== 'all' && !d.tags.includes(filter.tag)) return false;
    if (filter.q.trim()) {
      const s = filter.q.trim();
      return d.title.includes(s) || d.author.includes(s)
          || d.id.includes(s) || d.content?.includes(s);
    }
    return true;
  });

  const allSelected = filtered.length > 0 && filtered.every(d => selected.has(d.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) filtered.forEach(d => next.delete(d.id));
    else filtered.forEach(d => next.add(d.id));
    setSelected(next);
  };
  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const onDelete = (d) => {
    setConfirm({
      title: '確認刪除該日記？',
      hint: <>
        <strong style={{ color: 'var(--ink)', fontFamily: 'var(--font-title)' }}>
          《{d.title}》
        </strong><br/>
        作者：{d.author} · 互動數：{d.likes + d.favorites + d.comments + d.shares}<br/><br/>
        刪除後將同步從小程序端移除，且<strong>所有點讚、收藏、評論、轉發數據將被一併清除</strong>，無法恢復。
      </>,
      danger: true,
      confirmText: '永久刪除',
      onConfirm: () => {
        app.deleteDiaries([d.id]);
        toast('日记已删除', 'success');
        setConfirm(null);
        setDetailDiary(null);
      },
    });
  };

  const onBatchDelete = () => {
    if (selected.size === 0) return;
    setConfirm({
      title: `確認批量刪除 ${selected.size} 條日記？`,
      hint: <>勾選的 {selected.size} 條日記及其所有互動數據將被永久刪除，無法恢復。</>,
      danger: true,
      confirmText: `刪除 ${selected.size} 條`,
      onConfirm: () => {
        app.deleteDiaries([...selected]);
        toast(`已删除 ${selected.size} 条日记`, 'success');
        setSelected(new Set());
        setConfirm(null);
      },
    });
  };

  return (
    <>
      <div className="adm-toolbar">
        <input className="input search" placeholder="搜索標題 / 內容 / 作者 / 日記ID"
               value={filter.q}
               onChange={(e) => setFilter({ ...filter, q: e.target.value })}/>
        <select className="input" value={filter.permission}
                onChange={(e) => setFilter({ ...filter, permission: e.target.value })}>
          <option value="all">所有權限</option>
          <option value="public">公眾</option>
          <option value="member">會員</option>
          <option value="private">私密</option>
        </select>
        <select className="input" value={filter.tag}
                onChange={(e) => setFilter({ ...filter, tag: e.target.value })}>
          <option value="all">所有標籤</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ flex: 1 }}/>
        {selected.size > 0 && (
          <span style={{ fontSize: 12, color: 'var(--ink-3)',
                         fontFamily: 'var(--font-title)', letterSpacing: 1 }}>
            已選 {selected.size} 條
          </span>
        )}
        <button className="btn-sm danger"
                disabled={selected.size === 0}
                style={selected.size === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                onClick={onBatchDelete}>
          批量刪除
        </button>
        <button className="btn-sm ghost"><AIDownload size={13}/> 導出</button>
        <button className="btn-sm primary" onClick={() => setShowCreate(true)}>
          <AIPlus size={13}/> 新建日記
        </button>
      </div>

      <div className="adm-tbl-wrap">
        <table className="adm-tbl">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll}/>
              </th>
              <th>日記ID</th>
              <th>標題</th>
              <th>作者</th>
              <th>標籤</th>
              <th>權限</th>
              <th className="num">點讚</th>
              <th className="num">收藏</th>
              <th className="num">評論</th>
              <th className="num">轉發</th>
              <th>發布時間</th>
              <th style={{ textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} style={{ cursor: 'pointer' }}
                  onClick={() => setDetailDiary(d)}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(d.id)}
                         onChange={() => toggleOne(d.id)}/>
                </td>
                <td className="mono">{d.id}</td>
                <td>
                  <div style={{ fontFamily: 'var(--font-title)', color: 'var(--ink)',
                                letterSpacing: 0.5 }}>
                    {d.title}
                    {d.updatedAt && (
                      <span style={{ marginLeft: 6, fontSize: 10,
                                     color: 'var(--ink-4)',
                                     fontFamily: 'var(--font-body)' }}>
                        · 已编辑
                      </span>
                    )}
                  </div>
                  {d.content && (
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2,
                                  maxWidth: 280, whiteSpace: 'nowrap',
                                  overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.content.replace(/\n+/g, ' ').slice(0, 50)}
                    </div>
                  )}
                </td>
                <td>{d.author}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {d.tags.slice(0, 2).map(t => <span key={t} className="seal-tag"
                      style={{ fontSize: 10, padding: '1px 6px' }}>{t}</span>)}
                    {d.tags.length > 2 && <span style={{ fontSize: 10,
                      color: 'var(--ink-4)' }}>+{d.tags.length - 2}</span>}
                  </div>
                </td>
                <td><span className={`perm ${d.permission}`}>
                  {d.permission === 'public' ? '公眾' :
                   d.permission === 'member' ? '會員' : '私密'}
                </span></td>
                <td className="num">{d.likes}</td>
                <td className="num">{d.favorites}</td>
                <td className="num">{d.comments}</td>
                <td className="num">{d.shares}</td>
                <td className="mono">{d.publishedAt}</td>
                <td className="actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-sm ghost"
                          onClick={() => setDetailDiary(d)}>查看</button>
                  <button className="btn-sm ghost"
                          onClick={() => setEditDiary(d)}>編輯</button>
                  <button className="btn-sm danger"
                          onClick={() => onDelete(d)}>刪除</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="12" style={{ padding: 60, textAlign: 'center',
                                            color: 'var(--ink-4)' }}>
                沒有匹配的日記
              </td></tr>
            )}
          </tbody>
        </table>
        <Paginate total={filtered.length} page={1} pageSize={20}/>
      </div>

      {detailDiary && (
        <DiaryDetailDrawer
          diary={detailDiary}
          app={app}
          onClose={() => setDetailDiary(null)}
          onEdit={() => { setEditDiary(detailDiary); setDetailDiary(null); }}
          onDelete={() => onDelete(detailDiary)}/>
      )}

      {editDiary && (
        <DiaryEditModal
          diary={editDiary}
          app={app}
          onClose={() => setEditDiary(null)}
          onSaved={() => {
            toast('日记已保存', 'success');
            setEditDiary(null);
          }}/>
      )}

      {showCreate && (
        <DiaryEditModal
          diary={null}
          app={app}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            toast('日记已发布', 'success');
            setShowCreate(false);
          }}/>
      )}

      {confirm && (
        <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)}/>
      )}
    </>
  );
}

// ── Diary detail drawer ─────────────────────────
function DiaryDetailDrawer({ diary, app, onClose, onEdit, onDelete }) {
  const author = app.users.find(u => u.id === diary.authorId);
  const comments = window.ADMIN_DIARY_COMMENTS?.[diary.id] || [];

  return (
    <>
      <div className="adm-drawer-mask" onClick={onClose}/>
      <div className="adm-drawer">
        <div className="head">
          <h2>日記詳情</h2>
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {diary.id}
          </span>
          <div style={{ flex: 1 }}/>
          <span className={`perm ${diary.permission}`}>
            {diary.permission === 'public' ? '公眾' :
             diary.permission === 'member' ? '會員' : '私密'}
          </span>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--ink-3)', padding: 6, marginRight: -6,
          }}>
            <AIClose size={18}/>
          </button>
        </div>

        <div className="body">
          {/* Title */}
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24,
                        lineHeight: 1.4, color: 'var(--ink)', letterSpacing: 1,
                        marginBottom: 14 }}>
            {diary.title}
          </div>

          {/* Author + time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                        paddingBottom: 14, marginBottom: 18,
                        borderBottom: '0.5px solid var(--tbl-border)' }}>
            <AvX name={author?.nickname || diary.author}
                 hue={author?.avatarHue || 35} size={32}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: 14,
                            color: 'var(--ink)' }}>
                {diary.author}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                <span className="mono">{diary.authorId}</span>
                <span style={{ marginLeft: 10 }}>· 发布 {diary.publishedAt}</span>
                {diary.updatedAt && (
                  <span style={{ marginLeft: 10 }}>
                    · 更新 {diary.updatedAt}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          {diary.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6,
                          marginBottom: 18 }}>
              {diary.tags.map(t => <span key={t} className="seal-tag lg">{t}</span>)}
            </div>
          )}

          {/* Content */}
          <div style={{
            background: 'var(--paper-card)',
            border: '0.5px solid var(--tbl-border)',
            borderRadius: 10, padding: '18px 20px', marginBottom: 22,
            fontSize: 14, lineHeight: 1.9, color: 'var(--ink-2)',
            whiteSpace: 'pre-wrap', letterSpacing: 0.3,
          }}>
            {diary.content || <span style={{ color: 'var(--ink-4)' }}>
              （該日記無正文內容）
            </span>}
          </div>

          {/* Interaction summary */}
          <div className="drw-section">
            <div className="title">互動數據</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: 8 }}>
              {[
                { l: '点赞', v: diary.likes, c: 'var(--like)' },
                { l: '收藏', v: diary.favorites, c: 'var(--fav)' },
                { l: '评论', v: diary.comments, c: 'var(--blue)' },
                { l: '转发', v: diary.shares, c: 'var(--gold-deep)' },
              ].map(s => (
                <div key={s.l} style={{
                  background: 'var(--paper-card)',
                  border: '0.5px solid var(--tbl-border)',
                  borderRadius: 8, padding: '10px 12px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--ink-4)',
                                letterSpacing: 1 }}>{s.l}</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20,
                                color: s.c, fontWeight: 700, marginTop: 4 }}>
                    {s.v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comments */}
          {comments.length > 0 && (
            <div className="drw-section">
              <div className="title">評論（{comments.length}）</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {comments.map(c => (
                  <div key={c.id} style={{
                    display: 'flex', gap: 10,
                    padding: '12px 14px',
                    background: 'var(--paper-card)',
                    border: '0.5px solid var(--tbl-border)',
                    borderRadius: 8,
                  }}>
                    <AvX name={c.user} hue={c.avatarHue} size={28}/>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-title)',
                                       fontSize: 13, color: 'var(--ink)' }}>
                          {c.user}
                        </span>
                        <span className="mono" style={{ fontSize: 10,
                                                         color: 'var(--ink-4)' }}>
                          {c.userId}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--ink-4)',
                                       marginLeft: 'auto', fontFamily: 'SF Mono, monospace' }}>
                          {c.time}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink-2)',
                                    marginTop: 4, lineHeight: 1.7 }}>
                        {c.content}
                      </div>
                    </div>
                    <button className="btn-sm danger"
                            style={{ alignSelf: 'flex-start' }}>
                      刪除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="foot">
          <button className="btn-sm danger" onClick={onDelete}>刪除日記</button>
          <div style={{ flex: 1 }}/>
          <button className="btn-sm ghost" onClick={onClose}>關閉</button>
          <button className="btn-sm primary" onClick={onEdit}>編輯</button>
        </div>
      </div>
    </>
  );
}

// ── Diary create / edit modal ───────────────────
function DiaryEditModal({ diary, app, onClose, onSaved }) {
  const isCreate = !diary;
  const [title, setTitle] = React.useState(diary?.title || '');
  const [content, setContent] = React.useState(diary?.content || '');
  const [tags, setTags] = React.useState(diary?.tags || []);
  const [permission, setPermission] = React.useState(diary?.permission || 'public');
  const [authorId, setAuthorId] = React.useState(diary?.authorId || app.users[0]?.id);
  const [showTagPicker, setShowTagPicker] = React.useState(false);

  const canSave = title.trim() && content.trim();

  const save = () => {
    if (!canSave) return;
    const author = app.users.find(u => u.id === authorId);
    const patch = {
      title: title.trim(),
      content: content.trim(),
      tags, permission,
    };
    if (isCreate) {
      const today = new Date();
      const seq = String(2402 + Math.floor(Math.random() * 99)).slice(0, 4);
      const newD = {
        id: `D-${seq}`,
        ...patch,
        author: author?.nickname || author?.wechatName,
        authorId: author?.id,
        publishedAt: today.toISOString().slice(0, 16).replace('T', ' '),
        updatedAt: null,
        likes: 0, favorites: 0, comments: 0, shares: 0,
        status: 'active',
      };
      app.addDiary(newD);
    } else {
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
      app.updateDiary(diary.id, { ...patch, updatedAt: now });
    }
    onSaved();
  };

  return (
    <Modal
      title={isCreate ? '新建日記' : '編輯日記'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn-sm ghost" onClick={onClose}>取消</button>
          <button className="btn-sm primary" onClick={save}
                  disabled={!canSave}
                  style={!canSave ? { opacity: 0.4, cursor: 'not-allowed' } : {}}>
            {isCreate ? '發布' : '保存修改'}
          </button>
        </>
      }>

      {isCreate && (
        <div className="field-row">
          <div className="label">作者 <span className="req">*</span></div>
          <div className="ctrl">
            <select className="field-input" value={authorId}
                    onChange={(e) => setAuthorId(e.target.value)}>
              {app.users.filter(u => u.identity !== 'guest').map(u => (
                <option key={u.id} value={u.id}>
                  {u.nickname || u.wechatName} · {u.id}
                  {u.realName ? ` (${u.realName})` : ''}
                </option>
              ))}
            </select>
            <div className="help">後台代發 · 將以該用戶身份發布</div>
          </div>
        </div>
      )}

      {!isCreate && (
        <div className="field-row">
          <div className="label">作者</div>
          <div className="ctrl">
            <input className="field-input readonly"
                   value={`${diary.author} · ${diary.authorId}`} readOnly/>
            <div className="help">原作者不可變更</div>
          </div>
        </div>
      )}

      <div className="field-row">
        <div className="label">標題 <span className="req">*</span></div>
        <div className="ctrl">
          <input className="field-input" value={title}
                 placeholder="請輸入標題"
                 onChange={(e) => setTitle(e.target.value.slice(0, 30))}/>
          <div className="help">最多 30 字 · 當前 {title.length} / 30</div>
        </div>
      </div>

      <div className="field-row">
        <div className="label">正文 <span className="req">*</span></div>
        <div className="ctrl">
          <textarea className="field-input" value={content}
                    placeholder="請輸入日記正文，支持分段"
                    rows="8"
                    onChange={(e) => setContent(e.target.value)}
                    style={{ resize: 'vertical', minHeight: 180,
                             lineHeight: 1.7, fontSize: 14 }}/>
          <div className="help">{content.length} 字 · 支持換行分段</div>
        </div>
      </div>

      <div className="field-row">
        <div className="label">標籤</div>
        <div className="ctrl">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6,
                        alignItems: 'center' }}>
            {tags.map(t => (
              <span key={t} className="seal-tag lg"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setTags(tags.filter(x => x !== t))}>
                {t} ×
              </span>
            ))}
            <button onClick={() => setShowTagPicker(!showTagPicker)}
                    className="btn-sm ghost"
                    style={{ padding: '4px 10px', fontSize: 11, borderRadius: 2,
                             border: '1.2px dashed var(--ink-4)' }}>
              + 添加標籤
            </button>
          </div>
          {showTagPicker && (
            <div style={{ marginTop: 10, padding: 12,
                          background: 'var(--paper-2)', borderRadius: 8,
                          border: '0.5px solid var(--tbl-border)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)',
                            marginBottom: 8, letterSpacing: 1,
                            fontFamily: 'var(--font-title)' }}>
                從 20 個系統標籤中選擇
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(window.TAGS || []).map(t => {
                  const on = tags.includes(t);
                  return (
                    <span key={t} className="seal-tag"
                          onClick={() => setTags(on ? tags.filter(x => x !== t) : [...tags, t])}
                          style={{
                            cursor: 'pointer',
                            background: on ? 'var(--vermilion)' : 'rgba(182,69,47,0.04)',
                            color: on ? '#fff' : 'var(--vermilion)',
                          }}>
                      {t}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="field-row">
        <div className="label">權限 <span className="req">*</span></div>
        <div className="ctrl">
          <div className="seg-pick">
            {[
              { v: 'public',  l: '公眾 · 所有人可見' },
              { v: 'member',  l: '會員 · 僅會員可見' },
              { v: 'private', l: '私密 · 僅自己可見' },
            ].map(opt => (
              <div key={opt.v}
                   className={`opt ${permission === opt.v ? 'active' : ''}`}
                   onClick={() => setPermission(opt.v)}>
                {opt.l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════
// 5. Interactions page (tabs)
// ════════════════════════════════════════════════
function InteractionsPage({ app }) {
  const [tab, setTab] = React.useState('likes');
  const tabs = [
    { k: 'likes',     l: '點讚數據', n: 4823 },
    { k: 'favorites', l: '收藏數據', n: 1247 },
    { k: 'comments',  l: '評論數據', n: 892 },
    { k: 'shares',    l: '轉發數據', n: 318 },
  ];
  // Synthesize rows from diaries x users
  const sample = [];
  app.diaries.forEach(d => {
    app.users.slice(0, 3).forEach((u, i) => {
      sample.push({
        id: `I-${d.id.slice(2)}-${u.id.slice(2)}-${tab[0]}`,
        diaryId: d.id, diaryTitle: d.title,
        userId: u.id, userName: u.nickname || u.wechatName, avatarHue: u.avatarHue,
        time: `2026-05-${15 - (i % 8)} ${10 + i}:${(i * 7) % 60 < 10 ? '0' : ''}${(i * 7) % 60}`,
        content: tab === 'comments' ? ['同道，共勉。', '受益良多，已收藏。', '請問茶具是哪家的？'][i % 3] : null,
      });
    });
  });

  return (
    <>
      {/* Tab strip */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16,
        borderBottom: '0.5px solid var(--tbl-border)',
      }}>
        {tabs.map(t => (
          <div key={t.k} onClick={() => setTab(t.k)} style={{
            padding: '10px 16px', cursor: 'pointer',
            fontFamily: 'var(--font-title)', fontSize: 13, letterSpacing: 2,
            color: tab === t.k ? 'var(--ink)' : 'var(--ink-3)',
            borderBottom: tab === t.k ? '2px solid var(--vermilion)' : '2px solid transparent',
            marginBottom: -0.5,
          }}>
            {t.l} <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-body)',
                                  marginLeft: 4 }}>· {t.n.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="adm-toolbar">
        <input className="input search" placeholder="搜索日記標題 / 用戶 / 內容"/>
        <input className="input" type="date" style={{ width: 140 }}/>
        <span style={{ color: 'var(--ink-4)' }}>—</span>
        <input className="input" type="date" style={{ width: 140 }}/>
        <div style={{ flex: 1 }}/>
        <button className="btn-sm ghost"><AIDownload size={13}/> 導出</button>
        {tab === 'comments' && <button className="btn-sm danger">批量刪除</button>}
      </div>

      <div className="adm-tbl-wrap">
        <table className="adm-tbl">
          <thead>
            <tr>
              {tab === 'comments' && <th style={{ width: 36 }}><input type="checkbox"/></th>}
              <th>{tab === 'likes' ? '點讚' : tab === 'favorites' ? '收藏' :
                   tab === 'comments' ? '評論' : '轉發'}ID</th>
              <th>日記</th>
              <th>用戶</th>
              {tab === 'comments' && <th>評論內容</th>}
              <th>時間</th>
              {tab === 'comments' && <th style={{ textAlign: 'right' }}>操作</th>}
            </tr>
          </thead>
          <tbody>
            {sample.map(s => (
              <tr key={s.id}>
                {tab === 'comments' && <td><input type="checkbox"/></td>}
                <td className="mono">{s.id}</td>
                <td>
                  <a href="#" onClick={(e) => { e.preventDefault(); app.nav('diaries'); }}
                     style={{ fontFamily: 'var(--font-title)', color: 'var(--ink)',
                              textDecoration: 'none', cursor: 'pointer',
                              borderBottom: '1px dashed transparent' }}
                     onMouseOver={(e) => {
                       e.currentTarget.style.color = 'var(--vermilion)';
                       e.currentTarget.style.borderBottomColor = 'var(--vermilion)';
                     }}
                     onMouseOut={(e) => {
                       e.currentTarget.style.color = 'var(--ink)';
                       e.currentTarget.style.borderBottomColor = 'transparent';
                     }}>
                    {s.diaryTitle}
                  </a>
                  <div className="mono" style={{ fontSize: 11 }}>{s.diaryId}</div>
                </td>
                <td>
                  <a href="#" onClick={(e) => { e.preventDefault(); app.nav('users'); }}
                     style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
                              color: 'var(--ink-2)', textDecoration: 'none', cursor: 'pointer' }}
                     onMouseOver={(e) => e.currentTarget.style.color = 'var(--vermilion)'}
                     onMouseOut={(e) => e.currentTarget.style.color = 'var(--ink-2)'}>
                    <AvX name={s.userName} hue={s.avatarHue} size={24}/>
                    <span>{s.userName}</span>
                  </a>
                </td>
                {tab === 'comments' && <td style={{ maxWidth: 300, color: 'var(--ink-2)' }}>
                  {s.content}
                </td>}
                <td className="mono">{s.time}</td>
                {tab === 'comments' && <td className="actions">
                  <button className="btn-sm danger">刪除</button>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
        <Paginate total={sample.length} page={1} pageSize={20}/>
      </div>
    </>
  );
}

Object.assign(window, {
  DashboardPage, OrdersPage, UsersPage, DiariesPage, InteractionsPage,
  CreateOrderModal, OrderSuccessModal, OrderDetailDrawer, UserDetailDrawer,
  DiaryDetailDrawer, DiaryEditModal,
});
