/* Подписки и личные сообщения (живой режим) через сервер SOCIAL_API (worker/social-worker.js).
   Вход — подпись текста в Phantom (signMessage), не транзакция. Ключ входа хранится только в этом браузере. */
MB.chat = (() => {
  const C = MB.config; let pollT = null, unread = 0;
  const enabled = () => C.LIVE && !!C.SOCIAL_API;
  const me = () => MB.store.get().wallet.address;
  const tkey = () => 'membuy-chat-' + me();
  const token = () => { try { return localStorage.getItem(tkey()) || ''; } catch (e) { return ''; } };
  const setToken = t => { try { if (t) localStorage.setItem(tkey(), t); else localStorage.removeItem(tkey()); } catch (e) { /* нет хранилища */ } };
  const b64 = u8 => { let s = ''; u8.forEach(b => { s += String.fromCharCode(b); }); return btoa(s); };

  async function raw(path, body, auth = true) {
    const r = await fetch(C.SOCIAL_API.replace(/\/$/, '') + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(auth && token() ? { Authorization: 'Bearer ' + token() } : {}) }, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    if (!r) throw new Error('Нет связи с сервером сообщений');
    const d = await r.json().catch(() => ({})); return { status: r.status, d };
  }
  /** Вход: сервер даёт одноразовый код, пользователь подписывает текст в Phantom. */
  async function login() {
    if (!MB.store.get().wallet.connected) await MB.wallet.connect();
    const n = await raw('/nonce?addr=' + encodeURIComponent(me()), null, false); if (n.status !== 200) throw new Error(n.d.error || 'Нет связи с сервером сообщений');
    const p = MB.wallet.provider(); if (!p || !p.signMessage) throw new Error('Кошелёк не умеет подписывать сообщения');
    let s; try { s = await p.signMessage(new TextEncoder().encode(n.d.text), 'utf8'); } catch (e) { throw MB.wallet.rejected(e); }
    const r = await raw('/login', { addr: me(), nonce: n.d.nonce, sig: b64(s.signature || s) }, false);
    if (r.status !== 200 || !r.d.token) throw new Error('Не удалось войти');
    setToken(r.d.token); return true;
  }
  /** Запрос с входом: если сессии нет или она истекла — один раз просим подпись. */
  async function api(path, body) {
    if (!token()) await login();
    let r = await raw(path, body); if (r.status === 401) { setToken(''); await login(); r = await raw(path, body); }
    if (r.status !== 200) throw new Error(r.d.error === 'You can only message people who follow you back' ? 'Писать можно только тем, кто подписан на вас в ответ' : r.d.error || 'Ошибка сервера сообщений');
    return r.d;
  }
  /** Синхронизирует локальный список подписок с сервером (для вкладки «Подписки» в ленте). */
  async function sync() { const d = await api('/me'); MB.store.update(s => { s.following = d.following; }, true); return d; }
  async function poll() {
    if (!enabled() || !token() || !MB.store.get().wallet.connected) return;
    const r = await raw('/unread').catch(() => null); if (!r || r.status !== 200) return;
    if (r.d.unread !== unread) { unread = r.d.unread; document.querySelectorAll('[data-nav=inbox]').forEach(a => a.classList.toggle('has', unread > 0)); }
  }
  return {
    enabled, loggedIn: () => !!token(), login: () => login().then(sync), sync,
    follow: async (to, on) => { const d = await api('/follow', { to, on }); MB.store.update(s => { const i = s.following.indexOf(to); if (on && i < 0) { s.following.push(to); if (MB.track) MB.track('follow'); } if (!on && i >= 0) s.following.splice(i, 1); }, true); return d; },
    relation: w => api('/relation?with=' + encodeURIComponent(w)),
    send: (to, text) => api('/send', { to, text }).then(d => (MB.track && MB.track('msg'), d)),
    stats: () => api('/stats'),
    msgs: (w, after = 0) => api('/msgs?with=' + encodeURIComponent(w) + '&after=' + after),
    threads: () => api('/threads'), activity: () => api('/activity'),
    open: (addr) => { location.hash = 'c-' + addr; },
    start() { if (!enabled() || pollT) return; poll(); pollT = setInterval(poll, 20000); },
  };
})();
