/* Экран «Реклама»: рекламный кабинет (демо). */
MB.views = MB.views || {};
MB.views.ads = (() => {
  const { esc, usd, num } = MB.util; let root;
  const val = id => root.querySelector('#' + id).value;
  function preview() { const pl = val('apl'), days = Math.max(1, Math.min(30, Math.round(+val('adays') || 1))); root.querySelector('#aprice').textContent = usd(MB.ads.price(pl, days)); root.querySelector('#aprev').innerHTML = `<div class="row ad"><span class="adtag">Реклама</span><span class="nm"><b>${esc(val('atitle') || 'Заголовок объявления')}</b><small>${esc(val('atext') || 'Текст объявления')}</small></span><span class="pr"><b>→</b></span></div>`; }
  function campaigns() {
    const st = MB.store.get(), box = root.querySelector('#camps');
    box.innerHTML = st.campaigns.length ? st.campaigns.map(c => { const s = st.adStats[c.id] || { views: 0, clicks: 0 }, left = Math.max(0, Math.ceil((c.until - Date.now()) / 864e5)); return `<div class="row camp"><span class="nm"><b>${esc(c.title)}</b><small>${MB.ads.PLACEMENTS[c.placement].name} · ${c.status === 'active' ? 'идёт, осталось ' + left + ' дн.' : 'на паузе'} · ${usd(c.total)}</small><small>Показы: ${num(s.views, 0)} · Переходы: ${num(s.clicks, 0)}</small></span><span class="crow"><button class="chip" data-tg="${esc(c.id)}">${c.status === 'active' ? 'Пауза' : 'Запустить'}</button><button class="chip" data-rm="${esc(c.id)}">Удалить</button></span></div>`; }).join('') : MB.ui.empty('Кампаний пока нет', 'Создайте первую кампанию в форме выше.');
    root.querySelector('#income').textContent = usd(MB.ads.income());
  }
  /* ---------- Живой режим: оплата SOL на кошелёк площадки, объявления и модерация в блокчейне ---------- */
  const ST = { pending: 'На проверке', active: 'Показывается', ended: 'Срок закончился', rejected: 'Отклонено', underpaid: 'Оплаты не хватает' };
  const hoursTxt = h => h % 24 === 0 && h >= 24 ? (h / 24 === 1 ? '24 ч' : h / 24 + ' дн.') : h + ' ч';
  const planTxt = p => p.sol ? num(p.sol, 3) + ' SOL' : '$' + p.usd;
  async function livePrice() { const plan = MB.adchain.planOf(val('aplan')), su = await MB.data.solUsd().catch(() => 0); if (!root || !plan) return; const sol = MB.adchain.priceSol(plan, su);
    root.querySelector('#aprice').textContent = num(sol, 3) + ' SOL' + (su ? ' ≈ ' + usd(sol * su) : '');
    root.querySelector('#aprev').innerHTML = `<div class="row ad"><span class="adtag">Реклама</span><span class="nm"><b>${esc(val('atitle') || 'Заголовок')}</b><small>${esc(val('atext') || 'Текст объявления')}</small></span></div>`; }
  let solNow = 0;
  const adRow = (a, owner) => `<div class="row camp"><span class="nm"><b>${esc(a.title)}</b><small class="ugc">${esc(a.text)}</small><small class="ugc">${esc(a.link)}</small><small>${num(a.lamports / 1e9, 3)} SOL${owner && solNow ? ' ≈ ' + usd(a.lamports / 1e9 * solNow) : ''} · ${hoursTxt(a.hours)} · ${new Date(a.ts * 1000).toLocaleDateString(MB.i18n.locale())}</small></span>
    <span class="pr"><span class="tag ${a.status === 'active' ? 'buy' : a.status === 'rejected' ? 'sell' : ''}">${ST[a.status]}</span>${a.status === 'active' ? `<small>до ${new Date(a.until).toLocaleString(MB.i18n.locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>` : ''}
    ${owner && a.status === 'pending' ? `${a.flagged ? '<small class="down">Похоже на ловушку — проверьте ссылку</small>' : ''}<button class="btn accent" data-ok="${esc(a.sig)}">Одобрить</button><button class="btn ghost" data-no="${esc(a.sig)}">Отклонить</button>` : ''}${owner && a.status === 'active' ? `<button class="btn ghost" data-no="${esc(a.sig)}">Остановить</button>` : ''}</span></div>`;
  async function liveLists(force) {
    const box = root && root.querySelector('#camps'); if (!box) return; const st = MB.store.get(), owner = MB.adchain.isOwner();
    solNow = await MB.data.solUsd().catch(() => 0);
    let all; try { all = await MB.adchain.load(force); } catch (e) { box.innerHTML = MB.ui.empty('Не удалось загрузить объявления', e.message); return; } if (!root) return;
    const mine = all.filter(a => st.wallet.connected && a.payer === st.wallet.address);
    box.innerHTML = !st.wallet.connected ? MB.ui.empty('Кошелёк не подключён', 'Подключите кошелёк, чтобы видеть свои объявления.') : mine.length ? mine.map(a => adRow(a, false)).join('') : MB.ui.empty('Объявлений пока нет', 'Оплаченные объявления появятся здесь.');
    const mod = root.querySelector('#mod'); mod.hidden = !owner;
    if (owner) { const pend = all.filter(a => a.status === 'pending'), income = all.filter(a => a.status !== 'rejected').reduce((t, a) => t + a.lamports, 0) / 1e9;
      mod.innerHTML = `<h2 class="h2">Модерация (вы владелец площадки)</h2><p class="fine">Получено за рекламу: <b>${num(income, 3)} SOL</b>. Отклонённым рекламодателям верните оплату вручную из Phantom.</p>
        <div class="list">${pend.length ? pend.map(a => adRow(a, true)).join('') : MB.ui.empty('Новых объявлений нет', 'Здесь появятся оплаченные объявления, которые ждут проверки.')}</div>
        <h2 class="h2">Все объявления</h2><div class="list">${all.filter(a => a.status !== 'pending').map(a => adRow(a, true)).join('') || MB.ui.empty('Пока пусто', '')}</div>`; }
  }
  function liveMount(el) {
    if (!MB.adchain.enabled()) { el.innerHTML = '<a class="back" href="#profile">← Профиль</a><h1 class="pt">Реклама</h1>' + MB.ui.empty('Рекламная площадка ещё не настроена', 'Владелец сайта должен указать свой кошелёк для оплаты рекламы.'); return; }
    el.innerHTML = `<a class="back" href="#profile">← Профиль</a><h1 class="pt">Реклама</h1>
      <div class="note">Оплата в SOL уходит напрямую владельцу Membuy. Объявление включается сразу после оплаты и показывается оплаченное время. Если автопроверка сочтёт ссылку подозрительной, объявление включится после проверки владельцем; при отказе владелец возвращает оплату.</div>
      <dl class="stats"><div><dt>Место показа</dt><dd>В списке монет</dd></div>${MB.config.ADS_PLANS.map(p => `<div><dt>${hoursTxt(p.hours)}</dt><dd>${planTxt(p)}</dd></div>`).join('')}</dl>
      <form class="card form" id="aform" novalidate><h2 class="h2">Новое объявление</h2>
        <label class="fld"><span>Заголовок (до 40 знаков)</span><input id="atitle" maxlength="40" autocomplete="off"></label>
        <label class="fld"><span>Текст (до 90 знаков)</span><input id="atext" maxlength="90" autocomplete="off"></label>
        <label class="fld"><span>Ссылка</span><input id="alink" maxlength="120" placeholder="https://..." autocomplete="off"></label>
        <label class="fld"><span>Срок показа</span><select id="aplan">${MB.config.ADS_PLANS.map((p, i) => `<option value="${p.id}" ${i === 0 ? 'selected' : ''}>${hoursTxt(p.hours)} — ${planTxt(p)}</option>`).join('')}</select></label>
        <div class="fld"><span>Так объявление увидят пользователи</span><div id="aprev"></div></div>
        <div class="quote"><div><dt>К оплате</dt><dd><b id="aprice">—</b></dd></div></div>
        <button class="btn big accent" type="submit" id="apay">Оплатить и запустить</button>
        <p class="fine">Текст объявления записывается в блокчейн Solana вместе с оплатой и виден всем. Запрещены обещания дохода, обман, чужие товарные знаки и ссылки на сбор ключей или «удвоение» монет.</p></form>
      <div class="card" id="mod" hidden></div>
      <h2 class="h2">Мои объявления</h2><div class="list" id="camps"></div>`;
    ['atitle', 'atext', 'aplan'].forEach(id => el.querySelector('#' + id).addEventListener(id === 'aplan' ? 'change' : 'input', livePrice));
    el.querySelector('#aform').addEventListener('submit', async e => { e.preventDefault(); const b = el.querySelector('#apay'); if (b.disabled) return;
      try { if (!MB.store.get().wallet.connected) await MB.wallet.connect(); b.disabled = true; await MB.adchain.buy({ title: val('atitle'), text: val('atext'), link: val('alink'), plan: val('aplan') });
        MB.ui.toast('Оплачено. Объявление скоро появится'); ['atitle', 'atext', 'alink'].forEach(id => { el.querySelector('#' + id).value = ''; }); livePrice(); setTimeout(() => liveLists(true), 4000); }
      catch (err) { MB.ui.toast(err.message, 'err'); } finally { if (root) b.disabled = false; } });
    el.addEventListener('click', async e => { const b = e.target.closest('[data-ok],[data-no]'); if (!b || b.disabled) return; b.disabled = true;
      try { await MB.adchain.decide(b.dataset.ok || b.dataset.no, !!b.dataset.ok); MB.ui.toast(b.dataset.ok ? 'Объявление одобрено' : 'Объявление остановлено'); setTimeout(() => liveLists(true), 4000); } catch (err) { MB.ui.toast(err.message, 'err'); b.disabled = false; } });
    livePrice(); liveLists();
  }
  return {
    mount(el) {
      root = el; if (MB.config.LIVE) return liveMount(el); const P = MB.ads.PLACEMENTS;
      el.innerHTML = `<a class="back" href="#profile">← Профиль</a><h1 class="pt">Реклама</h1>
        <div class="note">Демо: оплата не списывается, объявление видно только в этом браузере. Для настоящей рекламы нужен сервер с приёмом оплаты и проверкой объявлений.</div>
        <dl class="stats"><div><dt>${P.feed.name}</dt><dd>$${P.feed.day} в день</dd></div><div><dt>${P.market.name}</dt><dd>$${P.market.day} в день</dd></div><div><dt>Доход площадки (демо)</dt><dd id="income">$0</dd></div></dl>
        <form class="card form" id="aform" novalidate><h2 class="h2">Новая кампания</h2>
          <label class="fld"><span>Заголовок (до 40 знаков)</span><input id="atitle" maxlength="40" autocomplete="off"></label>
          <label class="fld"><span>Текст (до 90 знаков)</span><input id="atext" maxlength="90" autocomplete="off"></label>
          <label class="fld"><span>Ссылка</span><input id="alink" placeholder="https://..." autocomplete="off"></label>
          <div class="two"><label class="fld"><span>Место показа</span><select id="apl">${Object.entries(P).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join('')}</select></label><label class="fld"><span>Дней (1–30)</span><input id="adays" inputmode="numeric" value="3"></label></div>
          <div class="fld"><span>Так объявление увидят пользователи</span><div id="aprev"></div></div>
          <div class="quote"><div><dt>Стоимость кампании</dt><dd><b id="aprice">$0</b></dd></div></div>
          <button class="btn big accent" type="submit">Запустить кампанию</button>
          <p class="fine">Объявления помечаются словом «Реклама». Запрещены обещания дохода, обман и чужие товарные знаки.</p></form>
        <h2 class="h2">Мои кампании</h2><div class="list" id="camps"></div>`;
      ['atitle', 'atext', 'apl', 'adays'].forEach(id => el.querySelector('#' + id).addEventListener('input', preview));
      el.querySelector('#aform').addEventListener('submit', e => { e.preventDefault(); try { MB.ads.create({ title: val('atitle'), text: val('atext'), link: val('alink'), placement: val('apl'), days: val('adays') }); MB.ui.toast('Кампания запущена'); ['atitle', 'atext', 'alink'].forEach(id => { el.querySelector('#' + id).value = ''; }); preview(); } catch (err) { MB.ui.toast(err.message, 'err'); } });
      el.querySelector('#camps').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.tg) MB.ads.toggle(b.dataset.tg); if (b.dataset.rm) MB.ads.remove(b.dataset.rm); });
      preview(); campaigns();
    },
    unmount() { root = null; }, onState() { if (root) (MB.config.LIVE ? liveLists() : campaigns()); },
  };
})();
