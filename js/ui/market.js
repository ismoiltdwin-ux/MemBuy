/* Экран «Рынок»: поиск, фильтры, список монет. */
MB.views = MB.views || {};
MB.views.market = (() => {
  const { esc, price, usd } = MB.util; let filter = 'trend', q = '', root;
  const FILTERS = [['trend', 'В тренде'], ['fresh', 'Новые'], ['soon', 'Скоро на бирже'], ['graduated', 'На бирже'], ['gain', 'Растут'], ['vol', 'По объёму'], ['fav', '★ Избранное']];
  const CKEY = 'membuy-caution-hidden';
  const age = d => d < 1 / 24 ? Math.max(1, Math.round(d * 1440)) + ' мин' : d < 1 ? Math.round(d * 24) + ' ч' : Math.round(d) + ' дн.';
  const pc = (label, v) => `<i class="${v >= 0 ? 'up' : 'down'}"><em>${label}</em> ${MB.util.pct(v || 0)}</i>`;
  /** Цифры строки: капитализация, объём, сделки и изменения цены — как в pump.fun. */
  const stats = t => `<small class="st"><span>МК ${usd(t.mc)}</span> · <span>Об. ${usd(t.vol24)}</span>${t.buys24 != null ? ` · <span>Сделок: ${MB.util.num((t.buys24 || 0) + (t.sells24 || 0), 0)}</span>` : ''}</small>
      <span class="chs">${pc('5 мин', t.chg5m)}${pc('1 ч', t.chg1h)}${pc('6 ч', t.chg6h)}</span>`;
  const badge = t => t.dex === 'pumpfun' ? '<span class="dexb pf">pump.fun</span>' : t.pump ? '<span class="dexb">биржа</span>' : '';
  const row = t => `<a class="row mrow" data-id="${esc(t.id)}" href="#t-${esc(t.id)}">
      ${MB.ui.avatar(t)}<span class="nm"><b>${esc(t.name)}</b><small>${esc(t.sym)} · <span>${age(t.ageDays)}</span> ${badge(t)}</small><span class="sx">${stats(t)}</span></span>
      ${MB.chart.spark(t.series, t.chg24 >= 0)}<span class="pr"><b class="p">${price(t.price)}</b><span class="c">${MB.ui.chg(t.chg24)}</span></span></a>`;
  const caution = () => { try { if (localStorage.getItem(CKEY)) return ''; } catch (e) { /* нет хранилища */ }
    return `<div class="note caution" id="caution"><b>Осторожно</b><span>Новые монеты очень волатильны. Выпустить монету может кто угодно, в том числе мошенники.</span><button class="x" id="cx" aria-label="Скрыть предупреждение">×</button></div>`; };
  /** Живой режим: официальная монета $MBUY закреплена над списком. */
  async function official() {
    const C = MB.config, box = root && root.querySelector('#official'); if (!box || !C.LIVE || !C.OFFICIAL_MINT) return;
    const t = await MB.data.get(C.OFFICIAL_MINT).catch(() => null); if (!t || !root || !root.contains(box)) return;
    if (!t.icon) t.icon = 'img/icon-192.png';
    box.innerHTML = `<div class="offc"><b class="offl">★ Официальная монета Membuy</b>${row(t)}</div>`;
  }
  async function fill() {
    const list = root.querySelector('#list');
    try { const items = await MB.data.list(filter, q); list.innerHTML = items.length ? items.map((t, i) => row(t) + (i === Math.min(3, items.length - 1) && !q.trim() ? MB.ads.card(MB.ads.pick('market', 0)) : '')).join('') : (filter === 'fav' && !q.trim() ? MB.ui.empty('В избранном пусто', 'Откройте монету и нажмите «В избранное».') : MB.ui.empty('Ничего не найдено', 'Попробуйте другое название или тикер.')); }
    catch (e) { list.innerHTML = MB.ui.empty('Не удалось загрузить монеты', esc(e.message), '<button class="btn ghost" id="retry">Повторить</button>'); const b = list.querySelector('#retry'); if (b) b.onclick = fill; }
  }
  return {
    async mount(el) {
      root = el;
      el.innerHTML = `<section class="hero"><h1>Мемкоины Solana <span>в одном месте</span></h1><p>Находите монеты, смотрите графики и меняйте SOL на монету за пару касаний. Ключи остаются в вашем кошельке.</p></section>
        <div class="tools"><label class="search"><span class="sr">Поиск монеты</span><input id="q" type="search" placeholder="Название или тикер" autocomplete="off" value="${esc(q)}"></label>
        <div class="chips" role="tablist" aria-label="Сортировка">${FILTERS.map(([k, n]) => `<button class="chip ${k === filter ? 'on' : ''}" role="tab" aria-selected="${k === filter}" data-f="${k}">${n}</button>`).join('')}</div></div>
        <div id="official"></div>${caution()}<div class="list" id="list" aria-live="off"></div>`;
      official();
      const cx = el.querySelector('#cx'); if (cx) cx.onclick = () => { try { localStorage.setItem(CKEY, '1'); } catch (e) { /* нет хранилища */ } el.querySelector('#caution').remove(); };
      el.querySelector('#q').addEventListener('input', e => { q = e.target.value; fill(); });
      el.querySelectorAll('.chip[data-f]').forEach(c => c.onclick = () => { filter = c.dataset.f; el.querySelectorAll('.chip[data-f]').forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-selected', x === c); }); fill(); });
      await fill();
    },
    /** На тике меняем только цифры в готовых строках: список не перерисовывается, поэтому нажатия не теряются. */
    async onTick() {
      if (!root) return; const rows = [...root.querySelectorAll('#list a.row[data-id]')], ids = rows.map(a => a.dataset.id); if (!ids.length) return;
      const list = MB.data.many ? await MB.data.many(ids).catch(() => []) : await Promise.all(ids.map(id => MB.data.get(id).catch(() => null)));
      const by = {}; list.filter(Boolean).forEach(t => { by[t.id] = t; }); if (!root) return;
      for (const a of rows) { const t = by[a.dataset.id]; if (!t) continue; a.querySelector('.p').textContent = price(t.price); a.querySelector('.c').innerHTML = MB.ui.chg(t.chg24); a.querySelector('.sx').innerHTML = stats(t); }
    },
    unmount() { root = null; },
  };
})();
