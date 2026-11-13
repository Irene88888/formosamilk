const App = {
  SESSION_KEY: 'ds_session',
  USER_KEY: 'ds_user',

  get session() { try { return localStorage.getItem(this.SESSION_KEY) || ''; } catch (e) { return ''; } },
  get user() { try { return JSON.parse(localStorage.getItem(this.USER_KEY) || 'null'); } catch (e) { return null; } },
  setSession(token, user) {
    try {
      if (token) localStorage.setItem(this.SESSION_KEY, token);
      if (user) localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } catch (e) { /* 無痕模式等情況無法儲存時，本頁仍可使用 */ }
  },
  clearSession() {
    try { localStorage.removeItem(this.SESSION_KEY); localStorage.removeItem(this.USER_KEY); } catch (e) { /* 忽略 */ }
  },
  homeFor(role) { return { '員工': 'staff.html', '客戶': 'customer.html', '廠商': 'supplier.html' }[role] || 'index.html'; },

  /** 呼叫後端；失敗時丟出錯誤（err.auth 表示登入問題） */
  async api(action, payload = {}) {
    const url = (window.APP_CONFIG || {}).API_URL || '';
    if (!url || url.includes('請貼上')) throw new Error('尚未設定後端網址，請編輯 config.js 的 API_URL');
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action, session: App.session }, payload)),
      });
    } catch (e) {
      throw new Error('連不上後端，請確認網路與 config.js 的 API_URL');
    }
    let data;
    try { data = await res.json(); } catch (e) {
      throw new Error('後端回應格式錯誤，請確認 Apps Script 已部署為網頁應用程式，存取權為「所有人」');
    }
    if (!data.ok) { const err = new Error(data.error || '操作失敗'); err.auth = data.auth; throw err; }
    return data;
  },

  /** 頁面內使用：遇到登入問題自動回登入頁 */
  async call(action, payload) {
    try { return await App.api(action, payload); } catch (e) {
      if (e.auth) {
        if (e.auth === 'login') App.clearSession();
        location.href = 'index.html' + (e.auth === 'password' ? '#password' : '');
        return new Promise(() => {});
      }
      throw e;
    }
  },

  async logout() {
    try { await App.api('logout'); } catch (e) { /* 忽略 */ }
    App.clearSession();
    location.href = 'index.html';
  },

  /** 頁首：顯示登入者、修改密碼、登出 */
  header() {
    const t = (window.APP_CONFIG || {}).TITLE;
    if (t) document.querySelectorAll('[data-app-title]').forEach(el => { el.textContent = t; });
    const el = document.getElementById('who');
    const u = App.user;
    if (!el) return;
    if (!App.session) { location.href = 'index.html'; return; }
    el.innerHTML = `<span id="whoName">${App.esc(u ? (u.refName || u.name) : '')}</span>
      <a href="index.html#password">修改密碼</a>
      <button class="btn btn-ghost btn-sm" id="logoutBtn">登出</button>`;
    document.getElementById('logoutBtn').addEventListener('click', App.logout);
  },

  /** 頁面載入後用伺服器的最新名稱更新頁首（客戶或廠商改名後不必重新登入） */
  setWho(name) {
    if (!name) return;
    const el = document.getElementById('whoName');
    if (el) el.textContent = name;
    const u = App.user;
    if (u) { u.refName = name; App.setSession(null, u); }
  },

  esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  today(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },

  _toastTimer: null,
  toast(msg, isError = false) {
    const el = document.getElementById('toast');
    if (!el) return alert(msg);
    el.textContent = msg;
    el.classList.toggle('err', !!isError);
    el.classList.add('show');
    clearTimeout(App._toastTimer);
    App._toastTimer = setTimeout(() => el.classList.remove('show'), isError ? 5000 : 2600);
  },

  async busy(btn, label, fn) {
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = label;
    try { return await fn(); } finally {
      if (btn.isConnected) { btn.disabled = false; btn.textContent = old; }
    }
  },
};
