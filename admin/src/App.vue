<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-brand">醒书日记 · 管理后台</div>
      <nav>
        <router-link to="/" class="nav-item" active-class="active" exact>数据概览</router-link>
        <router-link to="/users" class="nav-item" active-class="active">用户管理</router-link>
        <router-link to="/diaries" class="nav-item" active-class="active">日记管理</router-link>
        <router-link to="/interactions" class="nav-item" active-class="active">互动数据</router-link>
      </nav>
      <div class="sidebar-footer">v0.1 · 运营后台</div>
    </aside>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F3F4F6; color: #1F2937; }
.app-layout { display:flex; min-height:100vh; }
.sidebar { width:220px; background:#3578F6; color:#fff; display:flex; flex-direction:column; padding:20px 0; }
.sidebar-brand { padding:0 20px 24px; font-size:16px; font-weight:700; letter-spacing:1px; border-bottom:1px solid rgba(255,255,255,.15); margin-bottom:12px; }
.nav-item { display:block; padding:12px 20px; color:rgba(255,255,255,.8); text-decoration:none; font-size:14px; transition:background .15s; }
.nav-item:hover, .nav-item.active { background:rgba(255,255,255,.12); color:#fff; }
.sidebar-footer { margin-top:auto; padding:16px 20px 0; font-size:12px; color:rgba(255,255,255,.5); border-top:1px solid rgba(255,255,255,.15); }
.main-content { flex:1; padding:24px 32px; overflow-y:auto; }
</style>
