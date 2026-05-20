// src/admin/app.jsx — main admin app

const SYNC_KEY = 'xingshu_admin_sync';

function writeSync(payload) {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(payload)); } catch (e) {}
}

function AdminApp() {
  const [page, setPage] = React.useState('dashboard');
  const [users, setUsers] = React.useState(window.ADMIN_USERS);
  const [orders, setOrders] = React.useState(window.ADMIN_ORDERS);
  const [diaries, setDiaries] = React.useState(window.ADMIN_DIARIES);
  const [presetOrderUser, setPresetOrderUser] = React.useState(null);
  const [toast, toastNode] = useToast();

  // pending: orders status 'pending'
  const badges = {
    pending: orders.filter(o => o.status === 'pending').length || null,
  };

  const app = {
    users, orders, diaries,
    nav: setPage,
    presetOrderUser,
    clearPresetOrderUser: () => setPresetOrderUser(null),
    openCreateOrderFor: (u) => {
      setPresetOrderUser(u);
      setPage('orders');
    },
    updateUser: (id, patch) => {
      setUsers(us => us.map(u => u.id === id ? { ...u, ...patch } : u));
    },
    addDiary: (d) => setDiaries(ds => [d, ...ds]),
    updateDiary: (id, patch) =>
      setDiaries(ds => ds.map(d => d.id === id ? { ...d, ...patch } : d)),
    deleteDiaries: (ids) => {
      const idSet = new Set(ids);
      setDiaries(ds => ds.filter(d => !idSet.has(d.id)));
    },
    addOrder: (order) => {
      setOrders(os => [order, ...os]);
      // update user identity & member period
      setUsers(us => us.map(u => u.id === order.userId ? {
        ...u, identity: 'member',
        memberFrom: order.validFrom,
        memberUntil: order.validUntil,
        daysLeft: Math.ceil((new Date(order.validUntil) - new Date()) / 86400000),
      } : u));
      // sync to mini-program via localStorage
      const u = users.find(x => x.id === order.userId);
      writeSync({
        action: 'order_created',
        timestamp: Date.now(),
        user: {
          userId: order.userId,
          wechatName: u?.wechatName,
          nickname: u?.nickname,
          realName: u?.realName,
          phone: u?.phone,
          avatarHue: u?.avatarHue,
          identity: 'member',
          memberFrom: order.validFrom,
          memberUntil: order.validUntil,
          daysLeft: Math.ceil((new Date(order.validUntil) - new Date()) / 86400000),
        },
        order: {
          id: order.id, amount: order.amount, method: order.method,
          createdBy: order.createdBy, createdAt: order.createdAt,
          status: 'paid',
        },
      });
    },
  };

  const pageInfo = {
    dashboard:    { title: '數據概覽', sub: '近 30 天平台關鍵指標' },
    orders:       { title: '會員訂單', sub: '線下開通 · 創建並追蹤訂單' },
    users:       { title: '用戶管理', sub: '所有註冊用戶' },
    diaries:      { title: '日記管理', sub: '查看與審核日記內容' },
    interactions: { title: '互動數據', sub: '點讚 / 收藏 / 評論 / 轉發' },
    settings:     { title: '系統設置', sub: '' },
  }[page];

  const PageComp = {
    dashboard:    DashboardPage,
    orders:       OrdersPage,
    users:       UsersPage,
    diaries:      DiariesPage,
    interactions: InteractionsPage,
  }[page] || (() => <div style={{ padding: 40, color: 'var(--ink-3)' }}>該模塊建設中…</div>);

  return (
    <div className="admin-app">
      <Sidebar page={page} onNav={setPage} badges={badges}/>
      <div className="adm-main">
        <Topbar
          title={pageInfo.title}
          subtitle={pageInfo.sub}
          right={
            <a href="index.html" target="_blank"
               style={{ color: 'var(--ink-3)', textDecoration: 'none',
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontFamily: 'var(--font-title)', letterSpacing: 1 }}>
              小程序預覽 ↗
            </a>
          }
        />
        <div className="adm-content">
          <PageComp app={app} toast={toast}/>
        </div>
      </div>
      {toastNode}
    </div>
  );
}

const adminRoot = ReactDOM.createRoot(document.getElementById('root'));
adminRoot.render(<AdminApp/>);
