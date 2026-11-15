/* Экран монеты: цена, график (линия или свечи), ваша позиция, показатели и панель покупки/продажи. */
MB.views = MB.views || {};
MB.views.token = (() => {
  const { esc, price, usd, num } = MB.util; let root, token, side = 'buy', tf = '5m', cdata = null, cseq = 0, raf = 0; const view = MB.chart.view(); let quote = null, qSeq = 0, status = null, busy = false;
  const hold = () => MB.store.get().holdings[token.id] || null, held = () => (hold() ? hold().qty : 0);
  const presets = () => side === 'buy' ? [['0.1', 0.1], ['0.5', 0.5], ['1', 1]].map(([l, v]) => `<button type="button" class="chip" data-v="${v}">${l} SOL</button>`).join('') : [25, 50, 100].map(p => `<button type="button" class="chip" data-p="${p}">${p}%</button>`).join('');
  /** Сумма из поля. При продаже число, почти равное остатку, считается «всем остатком», чтобы не оставалась пыль из-за округления. */
  const amount = () => { const el = root.querySelector('#amt'); if (!el) return NaN; const a = parseFloat(String(el.value).replace(',', '.').replace(/\s/g, '')), h = held(); return side === 'sell' && h > 0 && Math.abs(a - h) <= h * 1e-4 ? h : a; };
  function panel(keep) {
    const st = MB.store.get(), w = st.wallet, unit = side === 'buy' ? 'SOL' : esc(token.sym), bal = side === 'buy' ? `${num(w.sol, 3)} SOL` : `${num(held(), 2)} ${esc(token.sym)}`;
    const prev = keep && root.querySelector('#amt') ? root.querySelector('#amt').value : '';
    root.querySelector('#panel').innerHTML = `<div class="seg" role="tablist"><button type="button" role="tab" aria-selected="${side === 'buy'}" class="${side === 'buy' ? 'on buy' : ''}" data-s="buy">Купить</button><button type="button" role="tab" aria-selected="${side === 'sell'}" class="${side === 'sell' ? 'on sell' : ''}" data-s="sell">Продать</button></div>
      <label class="fld"><span>Сумма, ${unit}</span><input id="amt" inputmode="decimal" placeholder="0.0" autocomplete="off"><small>Доступно: ${w.connected ? bal : 'подключите кошелёк'}</small></label>
      <div class="chips">${presets()}</div>
      <label class="fld inline"><span>Проскальзывание</span><select id="slip">${[50, 100, 300, 500].map(b => `<option value="${b}" ${b === st.slippageBps ? 'selected' : ''}>${b / 100}%</option>`).join('')}</select></label>
      <dl class="quote" id="quote"></dl>
      <button type="button" class="btn big ${side}" id="go">${side === 'buy' ? 'Купить ' : 'Продать '}${esc(token.sym)}</button>
      <div id="tstatus" class="tstatus" role="status" aria-live="polite"></div>
      <p class="fine">${MB.config.MODE === 'demo' ? 'Демо-режим: сделка учебная, настоящие деньги не списываются.' : 'Сделка подписывается в вашем кошельке. Мемкоины очень рискованны.'}</p>`;
    const amt = root.querySelector('#amt'); if (prev) amt.value = prev;
    root.querySelectorAll('.seg button').forEach(b => b.onclick = () => { side = b.dataset.s; quote = null; status = null; panel(); });
    root.querySelectorAll('#panel .chip').forEach(c => c.onclick = () => { amt.value = c.dataset.v ? c.dataset.v : String(+(held() * c.dataset.p / 100).toFixed(4)); status = null; showStatus(); requote(); });
    amt.addEventListener('input', () => { status = null; showStatus(); requote(); });
    root.querySelector('#slip').onchange = e => { MB.store.update(s => { s.slippageBps = +e.target.value; }, true); requote(); };
    root.querySelector('#go').onclick = go; renderQuote(); showStatus(); if (prev) requote();
  }
  function showStatus() { const el = root && root.querySelector('#tstatus'); if (!el) return; el.className = 'tstatus' + (status ? ' ' + status.kind : ''); el.textContent = status ? status.text : ''; }
  const say = (text, kind = 'ok') => { if (!text) { status = null; showStatus(); return; } status = { text, kind }; showStatus(); MB.ui.toast(text, kind === 'err' ? 'err' : 'ok'); };
  function renderQuote() {
    const el = root.querySelector('#quote'); if (!el) return;
    if (!quote) { el.innerHTML = '<div class="hint">Введите сумму, чтобы увидеть расчёт.</div>'; return; }
    const outUnit = side === 'buy' ? esc(token.sym) : 'SOL', d = side === 'buy' ? 2 : 5;
    el.innerHTML = `<div><dt>Вы получите</dt><dd><b>≈ ${num(quote.out, d)} ${outUnit}</b></dd></div><div><dt>Минимум с учётом проскальзывания</dt><dd>${num(quote.minOut, d)} ${outUnit}</dd></div>
      <div><dt>Сумма сделки</dt><dd>${usd(quote.usd)}</dd></div><div><dt>Влияние на цену</dt><dd class="${quote.impactPct > 3 ? 'down' : ''}">${quote.impactPct.toFixed(2)}%</dd></div>
      <div><dt>Комиссия Membuy (${MB.config.PLATFORM_FEE_BPS / 100}%)</dt><dd>${usd(quote.feeUsd)}</dd></div>`;
  }
  async function requote() {
    const a = amount(), seq = ++qSeq;
    if (!(a > 0)) { quote = null; renderQuote(); return null; }
    try { const q = await MB.swap.quote({ side, token, amount: a, slippageBps: MB.store.get().slippageBps }); if (seq === qSeq && root) { quote = q; renderQuote(); } return q; }
    catch (e) { if (seq === qSeq && root) { quote = null; root.querySelector('#quote').innerHTML = `<div class="hint down">${esc(e.message)}</div>`; } return null; }
  }
  /** Одна кнопка делает всё: подключает кошелёк, если нужно, считает сделку и исполняет её. */
  async function go() {
    if (busy) return; const a = amount();
    if (!(a > 0)) { say('Введите сумму', 'err'); root.querySelector('#amt').focus(); return; }
    busy = true; const btn = root.querySelector('#go'); btn.disabled = true; btn.textContent = side === 'buy' ? 'Покупаем…' : 'Продаём…';
    try {
      if (!MB.store.get().wallet.connected) await MB.wallet.connect();
      const q = await MB.swap.quote({ side, token, amount: a, slippageBps: MB.store.get().slippageBps }); if (!q) throw new Error('Не удалось рассчитать сделку');
      await MB.swap.execute(q); qSeq++; quote = null;
      const msg = side === 'buy' ? `Куплено ${num(q.out, 2)} ${token.sym} за ${num(q.amountIn, 4)} SOL` : `Продано ${num(q.amountIn, 2)} ${token.sym} за ${num(q.out, 4)} SOL`;
      busy = false; if (root) { panel(); mypos(); chart(); say(msg); }
    } catch (e) { busy = false; if (root) { panel(true); say(e.message, 'err'); } }
  }
  function mypos() {
    const el = root.querySelector('#mypos'), h = hold(); if (!el) return;
    if (!h) { el.hidden = true; el.innerHTML = ''; return; }
    const val = h.qty * token.price, known = h.costUsd > 0, pnl = val - h.costUsd, avg = h.costUsd / h.qty; el.hidden = false;
    el.innerHTML = `<div class="mphead"><h2 class="h2">Ваша позиция</h2><button type="button" class="chip" id="sellall">Продать всё</button></div>
      <dl class="mp"><div><dt>Монет</dt><dd>${num(h.qty, 2)}</dd></div><div><dt>Стоимость</dt><dd>${usd(val)}</dd></div>${known ? `<div><dt>Средняя цена входа</dt><dd>${price(avg)}</dd></div><div><dt>Результат</dt><dd class="${pnl >= 0 ? 'up' : 'down'}">${pnl >= 0 ? '+' : ''}${usd(pnl)} (${MB.util.pct(pnl / h.costUsd * 100)})</dd></div>` : ''}</dl>`;
    el.querySelector('#sellall').onclick = () => { side = 'sell'; quote = null; status = null; panel(); root.querySelector('#amt').value = String(+held().toFixed(4)); requote(); root.querySelector('#panel').scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  }
  /** Загружает свечи выбранного таймфрейма и рисует их. Положение графика (куда пользователь его сдвинул) сохраняется. */
  async function chart() {
    const seq = ++cseq, cd = await MB.data.candles(token.id, tf).catch(() => []); if (seq !== cseq || !root) return;
    cdata = cd; redraw();
  }
  /** Перерисовка без загрузки — для жестов и смены вида (линия/свечи). */
  function redraw() {
    if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const c = root && root.querySelector('#cv'); if (!c || !cdata) return;
      const st = MB.store.get(), type = st.chartType, h = hold(), mc = st.chartUnit === 'mc' && token.supply > 0, k = mc ? token.supply : 1, avg = h && h.costUsd > 0 ? h.costUsd / h.qty * k : 0;
      // Капитализация = цена × количество монет (как на графике pump.fun).
      const cd = mc ? cdata.map(x => ({ t: x.t, o: x.o * k, h: x.h * k, l: x.l * k, c: x.c * k })) : cdata;
      MB.chart.draw(c, cd.map(x => x.c), { type, candles: cd, avg, view, times: cd.map(x => x.t), fmt: mc ? MB.util.usd : null }); });
  }
  let act = 'trades';
  const ago = ts => { const m = Math.max(0, Math.round(Date.now() / 1000 - ts) / 60); return m < 1 ? 'только что' : m < 60 ? Math.round(m) + ' мин назад' : Math.round(m / 60) + ' ч назад'; };
  const wl = (a, tx) => MB.config.LIVE && /^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(a) ? `<a class="lnk" href="https://solscan.io/${tx ? 'tx' : 'account'}/${esc(a)}" target="_blank" rel="noopener">${esc(MB.util.short(a))}</a>` : `<span>${esc(MB.util.short(a))}</span>`;
  /** Вкладки под графиком: «Сделки» (последние покупки и продажи) и «Держатели» (крупнейшие счета). */
  async function activity() {
    const box = root && root.querySelector('#actb'); if (!box || !token) return; const id = token.id;
    if (act === 'trades') { const tr = await MB.data.trades(id).catch(() => null); if (!root || !token || token.id !== id || act !== 'trades') return;
      box.innerHTML = !tr ? '<div class="hint">Не удалось загрузить сделки</div>' : !tr.length ? '<div class="hint">Сделок пока нет</div>' : `<div class="tlist">${tr.map(x => `<div class="trow"><span class="tag ${x.side}">${x.side === 'buy' ? 'Покупка' : 'Продажа'}</span><b>${usd(x.usd)}</b><small>${num(x.tokens, 0)}</small>${wl(x.who)}<small>${ago(x.ts)}</small></div>`).join('')}</div>`; }
    else { const hs = await MB.data.holders(id).catch(() => null); if (!root || !token || token.id !== id || act !== 'holders') return;
      box.innerHTML = !hs ? '<div class="hint">Не удалось загрузить держателей</div>' : !hs.length ? '<div class="hint">Нет данных о держателях</div>' : `<p class="fine">Первым обычно стоит пул ликвидности или кривая pump.fun.</p><div class="tlist">${hs.map((x, i) => `<div class="hrow"><span class="rk">${i + 1}</span>${wl(x.who)}<span class="bar"><i style="width:${Math.min(100, x.pct).toFixed(1)}%"></i></span><b>${x.pct.toFixed(2)}%</b></div>`).join('')}</div>`; }
  }
  function head() {
    root.querySelector('#px').innerHTML = `<b>${price(token.price)}</b>${MB.ui.chg(token.chg24)}`;
    root.querySelector('#stats').innerHTML = [['Капитализация', usd(token.mc)], ['Объём за 24 ч', usd(token.vol24)], ['Ликвидность', usd(token.liquidityUsd)], ['Держатели', token.holders == null ? '—' : num(token.holders, 0)], ['Возраст', token.ageDays < 1 ? 'меньше дня' : Math.round(token.ageDays) + ' дн.'],
      ...(token.chg5m != null ? [['Изменение за 5 мин', MB.ui.chg(token.chg5m)], ['Изменение за 1 ч', MB.ui.chg(token.chg1h)], ['Изменение за 6 ч', MB.ui.chg(token.chg6h)]] : []),
      ...(token.buys24 != null ? [['Покупок за 24 ч', `<span class="up">${num(token.buys24, 0)}</span>`], ['Продаж за 24 ч', `<span class="down">${num(token.sells24, 0)}</span>`]] : []),
      ...(token.dex ? [['Где торгуется', token.dex === 'pumpfun' ? 'pump.fun (кривая)' : token.pump ? 'Биржа (вышла с pump.fun)' : esc(token.dex)]] : [])].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    const sl = root.querySelector('#socl'), links = (token.socials || []).filter(l => MB.ads.safe(l.url));
    if (sl) { sl.hidden = !links.length; sl.innerHTML = links.map(l => `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener nofollow">${esc({ website: 'Сайт', twitter: 'X', telegram: 'Telegram', discord: 'Discord' }[l.type] || l.type)}</a>`).join(''); }
  }
  function favBtn() { const on = MB.store.get().fav.includes(token.id), b = root.querySelector('#fav'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.textContent = on ? '★ В избранном' : '☆ В избранное'; }
  const onResize = () => redraw();
  return {
    async mount(el, id) {
      root = el; quote = null; status = null; busy = false; side = 'buy'; cdata = null; Object.assign(view, MB.chart.view()); el.innerHTML = '<div class="empty"><p>Загружаем монету…</p></div>';
      try { token = await MB.data.get(id); } catch (e) { token = null; }
      if (!token) { el.innerHTML = MB.ui.empty('Монета не найдена', 'Возможно, ссылка устарела.', '<a class="btn ghost" href="#market">К списку монет</a>'); return; }
      MB.store.update(s => { s.recent = [token.id, ...s.recent.filter(x => x !== token.id)].slice(0, 8); }, true);
      const type = MB.store.get().chartType;
      el.innerHTML = `<a class="back" href="#market">← Все монеты</a>
        <div class="tgrid"><div class="tmain">
          <header class="thead">${MB.ui.avatar(token, 56)}<div><h1>${esc(token.name)}</h1><small>${esc(token.sym)} · ${esc(MB.util.short(token.mint))}</small><button type="button" class="chip favb" id="fav"></button><button type="button" class="chip favb" id="share">Поделиться</button></div><div class="px" id="px"></div></header>
          <div class="card chartc"><div class="ctools"><div class="chips tfs">${[['15s', '15 с'], ['1m', '1 м'], ['5m', '5 м'], ['15m', '15 м'], ['1h', '1 ч'], ['4h', '4 ч'], ['1d', '1 д']].map(([k, n]) => `<button type="button" class="chip ${k === tf ? 'on' : ''}" data-tf="${k}">${n}</button>`).join('')}</div>
            <div class="chips ctype" role="group" aria-label="Вид графика"><button type="button" class="chip ${type === 'line' ? 'on' : ''}" data-ct="line" aria-pressed="${type === 'line'}">Линия</button><button type="button" class="chip ${type === 'candle' ? 'on' : ''}" data-ct="candle" aria-pressed="${type === 'candle'}">Свечи</button></div></div>
            <div class="chips cunit" role="group" aria-label="Единицы графика"><button type="button" class="chip ${MB.store.get().chartUnit !== 'mc' ? 'on' : ''}" data-cu="price">Цена</button><button type="button" class="chip ${MB.store.get().chartUnit === 'mc' ? 'on' : ''}" data-cu="mc">Капитализация</button></div>
            <canvas id="cv" role="img" aria-label="График цены ${esc(token.sym)}"></canvas><div class="chint"><small>Двигайте график пальцем · два пальца — масштаб · двойное касание — сброс</small><button type="button" class="chip" id="creset" hidden>⟲ Сброс</button></div></div>
          <div class="card mypos" id="mypos" hidden></div>
          <div class="card actc"><div class="chips" role="tablist"><button type="button" class="chip on" role="tab" data-act="trades">Сделки</button><button type="button" class="chip" role="tab" data-act="holders">Держатели</button></div><div id="actb"><div class="hint">Загружаем…</div></div></div>
          <dl class="stats" id="stats"></dl><div class="chips socl" id="socl" hidden></div>
          ${token.desc ? `<div class="card about"><h2>О монете</h2><p>${esc(token.desc)}</p>${token.links && MB.ads.safe(token.links) ? `<p><a class="lnk" href="${esc(token.links)}" target="_blank" rel="noopener">Соцсеть монеты →</a></p>` : ''}</div>` : ''}
        </div><aside class="card panel" id="panel"></aside></div>`;
      el.querySelectorAll('.tfs .chip').forEach(c => c.onclick = () => { tf = c.dataset.tf; el.querySelectorAll('.tfs .chip').forEach(x => x.classList.toggle('on', x === c)); Object.assign(view, MB.chart.view()); el.querySelector('#creset').hidden = true; cdata = null; chart(); });
      const rs = el.querySelector('#creset'); rs.onclick = () => { Object.assign(view, MB.chart.view()); rs.hidden = true; redraw(); };
      MB.chart.attach(el.querySelector('#cv'), view, redraw, moved => { rs.hidden = !moved; });
      el.querySelectorAll('.cunit .chip').forEach(c => c.onclick = () => { MB.store.update(s => { s.chartUnit = c.dataset.cu; }, true); el.querySelectorAll('.cunit .chip').forEach(x => x.classList.toggle('on', x === c)); Object.assign(view, MB.chart.view()); redraw(); });
      act = 'trades'; el.querySelectorAll('[data-act]').forEach(c => c.onclick = () => { act = c.dataset.act; el.querySelectorAll('[data-act]').forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-selected', x === c); }); el.querySelector('#actb').innerHTML = '<div class="hint">Загружаем…</div>'; activity(); });
      el.querySelectorAll('.ctype .chip').forEach(c => c.onclick = () => { MB.store.update(s => { s.chartType = c.dataset.ct; }, true); el.querySelectorAll('.ctype .chip').forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-pressed', x === c); }); redraw(); });
      el.querySelector('#share').onclick = () => { const url = location.origin + location.pathname + location.search + '#t-' + token.id;
        if (navigator.share) navigator.share({ title: token.name, text: token.name + ' (' + token.sym + ') — Membuy', url }).catch(() => {});
        else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => MB.ui.toast('Ссылка скопирована'), () => MB.ui.toast('Не удалось скопировать ссылку', 'err')); };
      el.querySelector('#fav').onclick = () => { MB.store.update(s => { const i = s.fav.indexOf(token.id); if (i >= 0) s.fav.splice(i, 1); else s.fav.push(token.id); }, true); favBtn(); };
      favBtn(); head(); panel(); mypos(); chart(); activity(); window.addEventListener('resize', onResize);
    },
    unmount() { window.removeEventListener('resize', onResize); root = null; },
    async onTick() { if (!root || !token) return; const t = await MB.data.get(token.id).catch(() => null); if (!t || !root) return; token = t; head(); mypos(); chart(); if (act === 'trades') activity(); if (quote && !busy) requote(); },
    /** Состояние изменилось (например, подключили кошелёк в шапке): обновляем панель, не теряя введённую сумму. */
    onState() { if (root && token && !busy && root.querySelector('#panel')) { panel(true); mypos(); } },
  };
})();
