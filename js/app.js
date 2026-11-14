/* Точка входа: выбор поставщика данных, маршруты, шапка. Маршруты — простые якоря: #market, #portfolio, #history, #t-<id>. */
(() => {
  const C = MB.config; MB.data = MB.providers[C.MODE === 'live' ? 'live' : 'demo'];
  const main = document.getElementById('view'); let cur = null;
  const routes = { market: MB.views.market, feed: MB.views.feed, leaders: MB.views.leaders, profile: MB.views.profile, create: MB.views.create, ads: MB.views.ads, invite: MB.views.invite, prefs: MB.views.prefs, search: MB.views.search, notes: MB.views.notes };
  const SUB = { create: 'profile', ads: 'profile', invite: 'profile', prefs: 'profile', notes: 'profile', search: 'market' };
  function header() {
    const st0 = MB.store.get(); document.getElementById('bell').classList.toggle('has', st0.unread > 0); document.getElementById('bell').setAttribute('aria-label', 'Уведомления' + (st0.unread ? ': новых ' + st0.unread : ''));
    document.getElementById('walletSlot').innerHTML = MB.ui.walletBtn();
    document.getElementById('walletBtn').onclick = async () => {
      try { if (MB.store.get().wallet.connected) { await MB.wallet.disconnect(); MB.ui.toast('Кошелёк отключён'); } else { await MB.wallet.connect(); MB.ui.toast('Кошелёк подключён'); } }
      catch (e) { MB.ui.toast(e.message, 'err'); }
    };
  }
  async function route() {
    let h = decodeURIComponent(location.hash.slice(1)) || 'market'; if (C.LIVE && C.DEMO_ONLY.includes(h)) h = 'market';
    if (cur && cur.unmount) cur.unmount();
    document.querySelectorAll('[data-nav]').forEach(a => { const on = a.dataset.nav === (h.startsWith('t-') ? 'market' : (SUB[h] || h)); a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (h.startsWith('t-')) { cur = MB.views.token; await cur.mount(main, h.slice(2)); } else { cur = routes[h] || routes.market; await cur.mount(main); }
    window.scrollTo(0, 0);
  }
  let tn = 0;
  /** Раз в несколько тиков записывает стоимость портфеля для графика в профиле. */
  async function equity() { const st = MB.store.get(); if (!st.wallet.connected || ++tn % 4) return; const sol = await MB.data.solUsd().catch(() => 0); let eq = st.wallet.sol * sol; for (const [id, h] of Object.entries(st.holdings)) { const t = await MB.data.get(id).catch(() => null); if (t) eq += h.qty * t.price; } MB.store.update(s => { s.equity.push(eq); s.equity = s.equity.slice(-120); }, true); }
  MB.util.bus.on('tick', () => { equity(); if (cur && cur.onTick) cur.onTick(); });
  document.addEventListener('click', e => { const a = e.target.closest('[data-ad]'); if (a) MB.ads.click(a.dataset.ad); });
  MB.util.bus.on('refresh', () => cur && cur.onTick && cur.onTick());
  MB.util.bus.on('state', () => { header(); if (cur && cur.onState) cur.onState(); });
  window.addEventListener('hashchange', route);
  document.getElementById('demoBar').hidden = C.MODE !== 'demo';
  if (C.LIVE) { document.body.classList.add('live'); document.querySelectorAll('[data-nav]').forEach(a => { if (C.DEMO_ONLY.includes(a.dataset.nav)) a.hidden = true; }); }
  function langs() { document.querySelectorAll('.langs').forEach(box => { box.innerHTML = MB.i18n.LANGS.map(([k, n]) => `<button type="button" class="chip ${k === MB.i18n.lang ? 'on' : ''}" data-lang="${k}" aria-pressed="${k === MB.i18n.lang}">${n}</button>`).join(''); }); }
  document.addEventListener('click', e => { const b = e.target.closest('[data-lang]'); if (b) MB.i18n.set(b.dataset.lang); });
  MB.util.bus.on('lang', () => { header(); langs(); route(); });
  header(); langs(); MB.i18n.start(); MB.data.start(); MB.social.start(); route();
})();
