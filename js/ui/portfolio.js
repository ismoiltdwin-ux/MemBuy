/* Экран «Профиль»: имя, подписки, стоимость портфеля с графиком, монеты и история сделок. */
MB.views = MB.views || {};
MB.views.profile = (() => {
  const { esc, price, usd, num } = MB.util; let root, tab = 'open';
  /** Карточка владельца: доход площадки, включение и вывод комиссии. Видна только кошельку FEE_WALLET. */
  async function income() {
    const box = root && root.querySelector('#income'); if (!box || !MB.fees.isOwner()) return;
    const on = await MB.fees.ready(), bal = on ? await MB.fees.balance() : 0; if (!root || !root.querySelector('#income')) return;
    box.innerHTML = `<div class="card stack"><h2 class="h2">Доход площадки (вы владелец)</h2>
      <p class="hint">${on ? `Комиссия со сделок ${MB.config.PLATFORM_FEE_BPS / 100}% включена. Накоплено: <b>${num(bal, 4)} SOL</b>.` : 'Комиссия со сделок выключена: для неё нужен отдельный счёт. Создание стоит около 0,002 SOL (залог сети, возвращается при выводе).'}</p>
      <p class="fine">Плата за выпуск монеты (${MB.config.CREATE_FEE_SOL} SOL) и оплата рекламы приходят прямо на ваш кошелёк.</p>
      <div class="qgrid">${on ? '<button class="btn accent" id="fwd">Вывести комиссию</button>' : '<button class="btn accent" id="fon">Включить комиссию</button>'}</div></div>`;
    const go = (fn, ok) => async () => { try { await fn(); MB.ui.toast(ok); setTimeout(() => income(), 5000); } catch (e) { MB.ui.toast(e.message, 'err'); } };
    const a = box.querySelector('#fon'), b = box.querySelector('#fwd');
    if (a) a.onclick = go(() => MB.fees.enable(), 'Счёт для комиссии создан');
    if (b) b.onclick = () => { if (confirm(MB.t('Вывести комиссию? Счёт закроется, все SOL придут на ваш кошелёк. Потом нажмите «Включить комиссию» снова.'))) go(() => MB.fees.withdraw(), 'Комиссия выведена')(); };
  }
  async function draw() {
    if (!root) return; const st = MB.store.get();
    if (!st.wallet.connected) { root.innerHTML = '<h1 class="pt">Профиль</h1>' + MB.ui.empty('Кошелёк не подключён', 'Подключите кошелёк, чтобы видеть свои монеты, сделки и результат.', '<button class="btn accent" id="cw">Подключить кошелёк</button>'); root.querySelector('#cw').onclick = () => MB.wallet.connect().catch(e => MB.ui.toast(e.message, 'err')); return; }
    const solUsd = await MB.data.solUsd().catch(() => 0), rows = []; let total = st.wallet.sol * solUsd;
    for (const [id, h] of Object.entries(st.holdings)) { const t = await MB.data.get(id).catch(() => null), val = t ? h.qty * t.price : 0; total += val; rows.push({ id, h, t, val, p: val - h.costUsd }); }
    if (!root) return; const cost = rows.reduce((a, r) => a + (r.h.costUsd > 0 ? r.h.costUsd : 0), 0);
    // Демо: результат от стартовых условных SOL. Живой режим: только по монетам, купленным в Membuy (у них известна цена входа).
    const start = MB.config.LIVE ? total - rows.reduce((a, r) => a + (r.h.costUsd > 0 ? r.p : 0), 0) : MB.config.DEMO_START_SOL * solUsd, pnl = total - start, pct = MB.config.LIVE ? (cost ? pnl / cost * 100 : 0) : (start ? pnl / start * 100 : 0);
    // Пустой портфель — как в pump.fun: «Купите свой первый токен сегодня» и три монеты в тренде.
    let firstBuy = MB.ui.empty('Монет пока нет', 'Купите первую монету на экране «Рынок».', '<a class="btn accent" href="#market">Открыть рынок</a>');
    if (!rows.length) { const top = (await MB.data.list('trend', '').catch(() => [])).slice(0, 3); if (!root) return;
      if (top.length) firstBuy = `<h2 class="h2">Купите свой первый токен сегодня</h2>${top.map(t => `<a class="row" href="#t-${esc(t.id)}">${MB.ui.avatar(t)}<span class="nm"><b>${esc(t.name)}</b><small>${esc(t.sym)}</small></span><span class="pr"><b>${usd(t.mc)}</b>${MB.ui.chg(t.chg24)}</span></a>`).join('')}<a class="btn ghost" href="#market">Все монеты</a>`; }
    // Закрытые позиции: монеты, которые куплены и полностью проданы. Результат = продажи − покупки.
    const closedMap = {}; [...st.trades].reverse().forEach(t => { if (st.holdings[t.id]) return; const c = closedMap[t.id] = closedMap[t.id] || { sym: t.sym, name: t.name, buy: 0, sell: 0, ts: 0 }; if (t.side === 'buy') c.buy += t.usd; else c.sell += t.usd; c.ts = t.ts; });
    const closed = Object.entries(closedMap).filter(([, c]) => c.sell > 0).sort((a, b) => b[1].ts - a[1].ts).map(([id, c]) => { const p = c.sell - c.buy; return `<a class="row" href="#t-${esc(id)}">${MB.ui.avatar({ sym: c.sym, hue: 200 })}<span class="nm"><b>${esc(c.name)}</b><small>Куплено на ${usd(c.buy)} · продано на ${usd(c.sell)}</small></span><span class="pr"><b class="${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '+' : ''}${usd(p)}</b></span></a>`; }).join('') || MB.ui.empty('Закрытых позиций нет', 'Здесь появятся монеты, которые вы купили и полностью продали.');
    const open = rows.length ? rows.sort((a, b) => b.val - a.val).map(r => `<a class="row" href="#t-${esc(r.id)}">${MB.ui.avatar(r.t || { sym: r.h.sym, hue: 200 })}<span class="nm"><b>${esc(r.h.name)}</b><small>${num(r.h.qty, 2)} ${esc(r.h.sym)} · ${r.t ? price(r.t.price) : '—'}</small></span><span class="pr"><b>${usd(r.val)}</b>${r.h.costUsd > 0 ? `<span class="chg ${r.p >= 0 ? 'up' : 'down'}">${r.p >= 0 ? '+' : ''}${usd(r.p)}</span>` : ''}</span></a>`).join('') : firstBuy;
    const hist = st.trades.length ? st.trades.map(t => `<div class="row"><span class="tag ${t.side}">${t.side === 'buy' ? 'Покупка' : 'Продажа'}</span><span class="nm"><b>${num(t.tokens, 2)} ${esc(t.sym)}</b><small>${new Date(t.ts).toLocaleString(MB.i18n.locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · по ${price(t.price)}</small></span><span class="pr"><b>${num(t.sol, 4)} SOL</b><small>${usd(t.usd)}</small></span></div>`).join('') : MB.ui.empty('Сделок пока нет', 'Здесь появятся ваши покупки и продажи.');
    root.innerHTML = `<div class="prof"><div class="pava">${MB.ui.userAva(st.profile.name, 40, 84)}<label class="chip photob" for="pfile">${st.profile.avatar ? 'Сменить фото' : 'Загрузить фото'}</label><input id="pfile" type="file" accept="image/*" class="sr"></div><div class="nm"><h1>${esc(st.profile.name)}</h1><small>${esc(st.profile.bio || 'Без описания')} · ${esc(MB.util.short(st.wallet.address))}</small><small>Подписки: <b>${st.following.length}</b> · Постов: <b>${st.myPosts.length}</b>${st.squad ? ' · Отряд: <b>' + esc(st.squad) + '</b>' : ''}</small></div></div>
      <div class="qgrid">${MB.config.LIVE ? '<a class="btn ghost" href="#invite">Пригласить друзей</a><a class="btn ghost" href="#create">Создать монету</a><a class="btn ghost" href="#ads">Реклама</a>' : '<a class="btn ghost" href="#invite">Пригласить друзей</a><a class="btn ghost" href="#create">Создать монету</a><a class="btn ghost" href="#ads">Реклама</a>'}<a class="btn ghost" href="#prefs">Настройки</a></div>
      <div class="card wcard"><small>Стоимость портфеля</small><b class="tot">${usd(total)}</b><div class="wline"><span>${num(st.wallet.sol, 4)} SOL свободно</span><span class="${pnl >= 0 ? 'up' : 'down'}">Результат: ${pnl >= 0 ? '+' : ''}${usd(pnl)} (${MB.util.pct(pct)})</span></div><canvas id="eq" role="img" aria-label="График стоимости портфеля"></canvas></div>
      <div class="card dep"><h2 class="h2">Кошелёк</h2><div class="qgrid dq"><a class="btn accent" href="#deposit">Депозит</a><a class="btn ghost" href="#deposit">Получить</a></div>${MB.config.LIVE ? `<p class="mut">Чтобы пополнить, отправьте SOL на этот адрес в сети Solana — с биржи или из другого кошелька.</p><code class="addr">${esc(st.wallet.address)}</code>` : ''}<div class="qgrid">${MB.config.LIVE ? '<button class="btn accent" id="wcopy">Скопировать адрес</button><button class="btn ghost" id="wref">Обновить баланс</button>' : ''}<button class="btn ghost" id="wdis">Отключить кошелёк</button></div></div>
            ${MB.config.LIVE ? '<div class="card stack creator"><h2 class="h2">Награды автора монет</h2><p class="hint">Если вы создали монету на pump.fun (в том числе через Membuy), вам идёт доля с каждой сделки этой монетой. Заберите её на свой кошелёк.</p><div class="qgrid"><button class="btn accent" id="cclaim">Забрать награды</button></div></div>' : ''}
      <div id="income"></div>
      <div class="chips tabsx" role="tablist"><button class="chip ${tab === 'open' ? 'on' : ''}" role="tab" aria-selected="${tab === 'open'}" data-tab="open">Открыто</button><button class="chip ${tab === 'closed' ? 'on' : ''}" role="tab" aria-selected="${tab === 'closed'}" data-tab="closed">Закрыто</button><button class="chip ${tab === 'hist' ? 'on' : ''}" role="tab" aria-selected="${tab === 'hist'}" data-tab="hist">История</button></div>
      <div class="list">${tab === 'open' ? open : tab === 'closed' ? closed : hist}</div>`;
    const wc = root.querySelector('#wcopy'); if (wc) wc.onclick = () => navigator.clipboard.writeText(st.wallet.address).then(() => MB.ui.toast('Адрес скопирован'), () => MB.ui.toast('Не удалось скопировать — выделите адрес вручную', 'err'));
    const wr = root.querySelector('#wref'); if (wr) wr.onclick = () => MB.wallet.refresh().then(() => MB.ui.toast('Баланс обновлён'), e => MB.ui.toast(e.message, 'err'));
    root.querySelector('#wdis').onclick = () => { if (confirm(MB.t('Отключить кошелёк?'))) MB.wallet.disconnect().then(() => MB.ui.toast('Кошелёк отключён')); };
    income();
    const cc = root.querySelector('#cclaim'); if (cc) cc.onclick = async () => { if (cc.disabled) return; cc.disabled = true; try { await MB.pumpcreate.claimCreatorFees(); MB.ui.toast('Награды отправлены на ваш кошелёк'); } catch (e) { MB.ui.toast(e.message, 'err'); } finally { cc.disabled = false; } };
    root.querySelectorAll('[data-tab]').forEach(c => c.onclick = () => { tab = c.dataset.tab; draw(); });
    root.querySelector('#pfile').addEventListener('change', e => MB.util.squareImage(e.target.files[0], 128).then(url => { MB.store.update(s => { s.profile.avatar = url; }); MB.ui.toast('Фото профиля обновлено'); }, err => MB.ui.toast(err.message, 'err')));
    const eq = st.equity.length > 1 ? st.equity : [start, total]; MB.chart.draw(root.querySelector('#eq'), eq);
  }
  return { mount(el) { root = el; return draw(); }, unmount() { root = null; }, onTick: draw, onState: draw };
})();
