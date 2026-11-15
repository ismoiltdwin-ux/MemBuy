/* Экраны: приглашения, настройки, поиск, уведомления. */
MB.views = MB.views || {};
(() => {
  const { esc, price, usd } = MB.util;
  MB.views.invite = (() => {
    let root;
    /** Живой режим: личная ссылка, награды 10% (учёт в блокчейне, js/referral.js), выплаты владельцем. */
    const sol = l => MB.util.num(l / 1e9, 4) + ' SOL';
    async function live(el) {
      root = el; const st = MB.store.get(), R = MB.ref, pct = Math.round(R.share() * 100), fee = MB.config.PLATFORM_FEE_BPS / 100;
      if (!st.wallet.connected) {
        el.innerHTML = `<a class="back" href="#profile">← Профиль</a><h1 class="pt">Пригласить друзей</h1><div class="card stack refhero"><b class="big">${pct}%</b><p>комиссии площадки с каждой сделки друзей, которых вы пригласили</p></div>` + MB.ui.empty('Подключите кошелёк', 'Ваша личная ссылка привязана к адресу кошелька — на него и приходят награды.', '<button class="btn accent" id="rcon">Подключить кошелёк</button>');
        el.querySelector('#rcon').onclick = () => MB.wallet.connect().then(() => live(el), e => MB.ui.toast(e.message, 'err')); return;
      }
      const me = st.wallet.address, link = R.link(me), feeOn = await MB.fees.ready(); if (root !== el) return;
      const text = `Membuy: trade Solana memecoins in two taps, follow traders and chat. Join with my link 👇`;
      el.innerHTML = `<a class="back" href="#profile">← Профиль</a><h1 class="pt">Пригласить друзей</h1>
        <div class="card stack refhero"><b class="big">${pct}%</b><p>комиссии площадки с каждой сделки друзей, которых вы пригласили</p></div>
        <div class="card stack"><div class="fld"><span>Ваша личная ссылка</span><input id="rlink" class="inp" readonly value="${esc(link)}"></div>
          <div class="qgrid"><button class="btn accent" id="rshare">Поделиться</button><button class="btn ghost" id="rcopy">Скопировать ссылку</button></div></div>
        ${feeOn ? '' : '<div class="note">Комиссия площадки ещё не включена — награды начнут начисляться, как только владелец её включит.</div>'}
        <dl class="stats" id="rstats"><div><dt>Приглашено</dt><dd>…</dd></div><div><dt>Заработано</dt><dd>…</dd></div><div><dt>К выплате</dt><dd>…</dd></div></dl>
        <div class="card"><h2 class="h2">Как это работает</h2><ol class="ol"><li>Друг открывает Membuy по вашей ссылке и подключает Phantom.</li><li>С каждой его сделки площадка берёт комиссию ${fee}%.</li><li>${pct}% этой комиссии — ваши. Учёт идёт прямо в блокчейне: каждая сделка друга помечается вашим адресом.</li><li>Выплаты в SOL на ваш кошелёк делает владелец Membuy. Каждую выплату видно в Solscan.</li></ol>
          <p class="fine">Награда считается только с комиссии Membuy, без сборов сети и pump.fun. Приглашать самого себя нельзя. Мемкоины очень рискованны — не обещайте друзьям прибыль.</p></div>
        ${R.inviter() ? `<p class="hint">Вас пригласил <code class="ugc">${esc(MB.util.short(R.inviter()))}</code></p>` : ''}
        <div id="rowner"></div>`;
      const copy = () => { const inp = el.querySelector('#rlink'); if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => MB.ui.toast('Ссылка скопирована'), () => { inp.select(); }); else inp.select(); };
      el.querySelector('#rcopy').onclick = copy;
      el.querySelector('#rshare').onclick = () => navigator.share ? navigator.share({ title: 'Membuy', text, url: link }).catch(() => {}) : copy();
      const all = await R.stats().catch(() => ({})); if (root !== el) return;
      const mine = all[me] || { traders: new Set(), earnedLam: 0, paidLam: 0 };
      el.querySelector('#rstats').innerHTML = `<div><dt>Приглашено</dt><dd>${mine.traders.size}</dd></div><div><dt>Заработано</dt><dd>${sol(mine.earnedLam)}</dd></div><div><dt>К выплате</dt><dd>${sol(R.owed(mine))}</dd></div>`;
      if (!MB.fees.isOwner()) return;
      const rows = Object.entries(all).sort((a, b) => R.owed(b[1]) - R.owed(a[1]));
      const box = el.querySelector('#rowner');
      box.innerHTML = `<div class="card"><h2 class="h2">Выплаты пригласившим (владелец)</h2>${rows.length ? `<div class="list">${rows.map(([a, o], i) => `<div class="row"><span class="nm"><b><a class="ugc" href="#u-${esc(a)}">${esc(MB.util.short(a))}</a></b><small>Друзей: ${o.traders.size} · сделок: ${o.trades} · комиссия: ${sol(o.feeLam)}</small><small>Заработано: ${sol(o.earnedLam)} · выплачено: ${sol(o.paidLam)}</small></span><span class="pr"><b>${sol(R.owed(o))}</b>${R.owed(o) > 0 ? `<button class="btn accent sm2" data-pay="${i}">Выплатить</button>` : ''}</span></div>`).join('')}</div>` : MB.ui.empty('Пока никого', 'Здесь появятся пригласившие, когда их друзья начнут торговать.')}</div>`;
      box.querySelectorAll('[data-pay]').forEach(b => b.onclick = async () => { const [a, o] = rows[+b.dataset.pay]; b.disabled = true;
        try { const sig = await R.pay(a, R.owed(o)); MB.ui.toast('Выплачено ' + sol(R.owed(o))); await R.stats(true); live(el); void sig; } catch (e) { MB.ui.toast(e.message, 'err'); b.disabled = false; } });
    }
    return {
      mount(el) {
        if (MB.config.LIVE) return live(el);
        root = el; const st = MB.store.get(), code = st.profile.name.replace(/[^a-z0-9_]/gi, '').toUpperCase().slice(0, 12) || 'MEMBUY', link = location.origin + location.pathname + '?ref=' + code;
        el.innerHTML = `<a class="back" href="#profile">← Профиль</a><h1 class="pt">Пригласить друзей</h1>
          <div class="note">Демо: ссылка и код — образец. В живом режиме награды считаются по-настоящему, по сделкам в блокчейне.</div>
          <div class="card stack"><div class="fld"><span>Ваш код</span><b class="code">${esc(code)}</b></div>
            <div class="fld"><span>Ваша ссылка</span><input id="rlink" class="inp" readonly value="${esc(link)}"></div><button class="btn accent" id="rcopy">Скопировать ссылку</button></div>
          <dl class="stats"><div><dt>Приглашено</dt><dd>0</dd></div><div><dt>Заработано</dt><dd>$0</dd></div><div><dt>Ваша доля</dt><dd>${Math.round(MB.config.REF_SHARE_BPS / 100) || 10}% комиссии</dd></div></dl>
          <div class="card"><h2 class="h2">Как это будет работать</h2><ol class="ol"><li>Друг открывает Membuy по вашей ссылке и подключает кошелёк.</li><li>С каждой его сделки площадка берёт комиссию ${MB.config.PLATFORM_FEE_BPS / 100}%.</li><li>${Math.round(MB.config.REF_SHARE_BPS / 100) || 10}% этой комиссии начисляется вам.</li></ol></div>`;
        el.querySelector('#rcopy').onclick = () => { const inp = el.querySelector('#rlink'); const fb = () => { inp.focus(); inp.select(); MB.ui.toast('Ссылка выделена — скопируйте её'); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(() => MB.ui.toast('Ссылка скопирована'), fb); else fb(); };
      }, unmount() { root = null; },
    };
  })();
  MB.views.prefs = (() => {
    let root;
    function draw() {
      const st = MB.store.get();
      root.innerHTML = `<a class="back" href="#profile">← Профиль</a><h1 class="pt">Настройки</h1>
        <form class="card form" id="pform" novalidate><h2 class="h2">Профиль</h2><div class="fld"><span>Фото профиля</span><div class="crow">${MB.ui.userAva(st.profile.name, 40, 64)}<label class="btn ghost" for="pfile2">${st.profile.avatar ? 'Сменить фото' : 'Загрузить фото'}</label><input id="pfile2" type="file" accept="image/*" class="sr">${st.profile.avatar ? '<button type="button" class="btn ghost" id="pdel">Удалить фото</button>' : ''}</div></div><label class="fld"><span>Имя (латиница, цифры, _)</span><input id="pname" maxlength="20" value="${esc(st.profile.name)}" autocomplete="off"></label><label class="fld"><span>О себе</span><input id="pbio" maxlength="60" value="${esc(st.profile.bio)}" autocomplete="off"></label><button class="btn accent" type="submit">Сохранить</button></form>
        <div class="card form"><h2 class="h2">Язык</h2><div class="langs chips" role="group" aria-label="Язык">${MB.i18n.LANGS.map(([k, n]) => `<button type="button" class="chip ${k === MB.i18n.lang ? 'on' : ''}" data-lang="${k}" aria-pressed="${k === MB.i18n.lang}">${n}</button>`).join('')}</div></div>
        <div class="card form"><h2 class="h2">Сделки</h2><label class="fld inline"><span>Проскальзывание по умолчанию</span><select id="pslip">${[50, 100, 300, 500].map(b => `<option value="${b}" ${b === st.slippageBps ? 'selected' : ''}>${b / 100}%</option>`).join('')}</select></label>
          ${MB.config.LIVE ? `<label class="fld inline"><span>Скорость сделки</span><select id="pprio">${[['medium', 'Обычная (до 0,0002 SOL)'], ['high', 'Быстрая (до 0,001 SOL)'], ['veryHigh', 'Очень быстрая (до 0,003 SOL)']].map(([k, n]) => `<option value="${k}" ${k === (st.priority || 'high') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
          <label class="fld inline"><span>Уведомления о сделках</span><input type="checkbox" id="pnot" ${st.notify ? 'checked' : ''} style="width:22px;height:22px"></label></div>
        <div class="card form"><h2 class="h2">Режим</h2><p class="hint">${MB.config.MODE === 'demo' ? 'Демо: учебные монеты и сделки.' : 'Живой режим: настоящие сделки.'}</p>${MB.config.MODE === 'demo' ? '<button class="btn ghost" id="preset">Сбросить демо-счёт</button><div id="pconf" hidden class="crow"><span class="hint">Удалить все демо-данные?</span><button class="btn sell" id="pyes">Да, сбросить</button><button class="btn ghost" id="pno">Отмена</button></div>' : ''}</div>`;
      root.querySelector('#pform').addEventListener('submit', e => { e.preventDefault(); const n = root.querySelector('#pname').value.trim(); if (!/^[A-Za-z0-9_]{3,20}$/.test(n)) { MB.ui.toast('Имя: 3–20 латинских букв, цифр или _', 'err'); return; } const bio = root.querySelector('#pbio').value.trim(); MB.store.update(s => { const old = s.profile.name; s.profile = { name: n, bio, avatar: s.profile.avatar || '' }; s.myPosts.forEach(p => { if (p.user === old) p.user = n; }); }); MB.ui.toast('Профиль сохранён'); });
      root.querySelector('#pfile2').addEventListener('change', e => MB.util.squareImage(e.target.files[0], 128).then(url => { MB.store.update(s => { s.profile.avatar = url; }); MB.ui.toast('Фото профиля обновлено'); draw(); }, err => MB.ui.toast(err.message, 'err')));
      const pd = root.querySelector('#pdel'); if (pd) pd.onclick = () => { MB.store.update(s => { s.profile.avatar = ''; }); MB.ui.toast('Фото удалено'); draw(); };
      root.querySelector('#pslip').onchange = e => MB.store.update(s => { s.slippageBps = +e.target.value; }, true);
      const pp = root.querySelector('#pprio'); if (pp) pp.onchange = e => MB.store.update(s => { s.priority = e.target.value; }, true);
      root.querySelector('#pnot').onchange = e => MB.store.update(s => { s.notify = e.target.checked; }, true);
      const rs = root.querySelector('#preset'); if (rs) { rs.onclick = () => { root.querySelector('#pconf').hidden = false; rs.hidden = true; }; root.querySelector('#pno').onclick = draw; root.querySelector('#pyes').onclick = () => { MB.store.reset(); MB.ui.toast('Демо-счёт сброшен'); location.hash = 'market'; }; }
    }
    return { mount(el) { root = el; draw(); }, unmount() { root = null; } };
  })();
  MB.views.search = (() => {
    let root, q = '';
    const row = t => `<a class="row" href="#t-${esc(t.id)}">${MB.ui.avatar(t)}<span class="nm"><b>${esc(t.name)}</b><small>${esc(t.sym)} · кап. ${usd(t.mc)}</small></span><span class="pr"><b>${price(t.price)}</b>${MB.ui.chg(t.chg24)}</span></a>`;
    async function fill() {
      const box = root.querySelector('#sres'), st = MB.store.get();
      if (!q.trim()) { const rec = []; for (const id of st.recent) { const t = await MB.data.get(id).catch(() => null); if (t) rec.push(t); } if (!root) return;
        box.innerHTML = `<div class="shead"><h2 class="h2">Просмотренные недавно</h2>${rec.length ? '<button class="chip" id="sclr">Очистить</button>' : ''}</div><div class="list">${rec.length ? rec.map(row).join('') : MB.ui.empty('Пока пусто', 'Здесь появятся монеты, которые вы открывали.')}</div>`;
        const c = box.querySelector('#sclr'); if (c) c.onclick = () => { MB.store.update(s => { s.recent = []; }, true); fill(); }; return; }
      const items = await MB.data.list('trend', q).catch(() => []); if (!root) return; box.innerHTML = `<div class="list">${items.length ? items.map(row).join('') : MB.ui.empty('Ничего не найдено', 'Попробуйте другое название или тикер.')}</div>`;
    }
    return { mount(el) { root = el; q = ''; el.innerHTML = `<h1 class="pt">Поиск</h1><label class="search"><span class="sr">Поиск монеты</span><input id="sq2" type="search" placeholder="Название или тикер" autocomplete="off"></label><div id="sres" class="stack" style="margin-top:14px"></div>`; const i = el.querySelector('#sq2'); i.addEventListener('input', () => { q = i.value; fill(); }); i.focus(); return fill(); }, unmount() { root = null; } };
  })();
  MB.views.notes = { mount(el) { const st = MB.store.get(); MB.store.update(s => { s.unread = 0; }); el.innerHTML = `<h1 class="pt">Уведомления</h1><div class="list">${st.notes.length ? st.notes.map(n => `<div class="row"><span class="nm"><b>${esc(n.text)}</b><small>${new Date(n.ts).toLocaleString(MB.i18n.locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></span></div>`).join('') : MB.ui.empty('Уведомлений нет', 'Здесь появятся сообщения о сделках и кампаниях.')}</div>`; } };
})();
