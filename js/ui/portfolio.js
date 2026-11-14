/* Экран «Профиль»: имя, подписки, стоимость портфеля с графиком, монеты и история сделок. */
MB.views = MB.views || {};
MB.views.profile = (() => {
  const { esc, price, usd, num } = MB.util; let root, tab = 'open';
  async function draw() {
    if (!root) return; const st = MB.store.get();
    if (!st.wallet.connected) { root.innerHTML = '<h1 class="pt">Профиль</h1>' + MB.ui.empty('Кошелёк не подключён', 'Подключите кошелёк, чтобы видеть свои монеты, сделки и результат.', '<button class="btn accent" id="cw">Подключить кошелёк</button>'); root.querySelector('#cw').onclick = () => MB.wallet.connect().catch(e => MB.ui.toast(e.message, 'err')); return; }
    const solUsd = await MB.data.solUsd().catch(() => 0), rows = []; let total = st.wallet.sol * solUsd;
    for (const [id, h] of Object.entries(st.holdings)) { const t = await MB.data.get(id).catch(() => null), val = t ? h.qty * t.price : 0; total += val; rows.push({ id, h, t, val, p: val - h.costUsd }); }
    if (!root) return; const cost = rows.reduce((a, r) => a + (r.h.costUsd > 0 ? r.h.costUsd : 0), 0);
    // Демо: результат от стартовых условных SOL. Живой режим: только по монетам, купленным в Membuy (у них известна цена входа).
    const start = MB.config.LIVE ? total - rows.reduce((a, r) => a + (r.h.costUsd > 0 ? r.p : 0), 0) : MB.config.DEMO_START_SOL * solUsd, pnl = total - start, pct = MB.config.LIVE ? (cost ? pnl / cost * 100 : 0) : (start ? pnl / start * 100 : 0);
    const open = rows.length ? rows.sort((a, b) => b.val - a.val).map(r => `<a class="row" href="#t-${esc(r.id)}">${MB.ui.avatar(r.t || { sym: r.h.sym, hue: 200 })}<span class="nm"><b>${esc(r.h.name)}</b><small>${num(r.h.qty, 2)} ${esc(r.h.sym)} · ${r.t ? price(r.t.price) : '—'}</small></span><span class="pr"><b>${usd(r.val)}</b>${r.h.costUsd > 0 ? `<span class="chg ${r.p >= 0 ? 'up' : 'down'}">${r.p >= 0 ? '+' : ''}${usd(r.p)}</span>` : ''}</span></a>`).join('') : MB.ui.empty('Монет пока нет', 'Купите первую монету на экране «Рынок».', '<a class="btn accent" href="#market">Открыть рынок</a>');
    const hist = st.trades.length ? st.trades.map(t => `<div class="row"><span class="tag ${t.side}">${t.side === 'buy' ? 'Покупка' : 'Продажа'}</span><span class="nm"><b>${num(t.tokens, 2)} ${esc(t.sym)}</b><small>${new Date(t.ts).toLocaleString(MB.i18n.locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · по ${price(t.price)}</small></span><span class="pr"><b>${num(t.sol, 4)} SOL</b><small>${usd(t.usd)}</small></span></div>`).join('') : MB.ui.empty('Сделок пока нет', 'Здесь появятся ваши покупки и продажи.');
    root.innerHTML = `<div class="prof"><div class="pava">${MB.ui.userAva(st.profile.name, 40, 84)}<label class="chip photob" for="pfile">${st.profile.avatar ? 'Сменить фото' : 'Загрузить фото'}</label><input id="pfile" type="file" accept="image/*" class="sr"></div><div class="nm"><h1>${esc(st.profile.name)}</h1><small>${esc(st.profile.bio || 'Без описания')} · ${esc(MB.util.short(st.wallet.address))}</small><small>Подписки: <b>${st.following.length}</b> · Постов: <b>${st.myPosts.length}</b>${st.squad ? ' · Отряд: <b>' + esc(st.squad) + '</b>' : ''}</small></div></div>
      <div class="qgrid">${MB.config.LIVE ? '' : '<a class="btn ghost" href="#invite">Пригласить друзей</a><a class="btn ghost" href="#create">Создать монету</a><a class="btn ghost" href="#ads">Реклама</a>'}<a class="btn ghost" href="#prefs">Настройки</a></div>
      <div class="card wcard"><small>Стоимость портфеля</small><b class="tot">${usd(total)}</b><div class="wline"><span>${num(st.wallet.sol, 4)} SOL свободно</span><span class="${pnl >= 0 ? 'up' : 'down'}">Результат: ${pnl >= 0 ? '+' : ''}${usd(pnl)} (${MB.util.pct(pct)})</span></div><canvas id="eq" role="img" aria-label="График стоимости портфеля"></canvas></div>
      <div class="chips tabsx" role="tablist"><button class="chip ${tab === 'open' ? 'on' : ''}" role="tab" aria-selected="${tab === 'open'}" data-tab="open">Монеты</button><button class="chip ${tab === 'hist' ? 'on' : ''}" role="tab" aria-selected="${tab === 'hist'}" data-tab="hist">История</button></div>
      <div class="list">${tab === 'open' ? open : hist}</div>`;
    root.querySelectorAll('[data-tab]').forEach(c => c.onclick = () => { tab = c.dataset.tab; draw(); });
    root.querySelector('#pfile').addEventListener('change', e => MB.util.squareImage(e.target.files[0], 128).then(url => { MB.store.update(s => { s.profile.avatar = url; }); MB.ui.toast('Фото профиля обновлено'); }, err => MB.ui.toast(err.message, 'err')));
    const eq = st.equity.length > 1 ? st.equity : [start, total]; MB.chart.draw(root.querySelector('#eq'), eq);
  }
  return { mount(el) { root = el; return draw(); }, unmount() { root = null; }, onTick: draw, onState: draw };
})();
