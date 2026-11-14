/* Экраны: приглашения, настройки, поиск, уведомления. */
MB.views = MB.views || {};
(() => {
  const { esc, price, usd } = MB.util;
  MB.views.invite = (() => {
    let root;
    return {
      mount(el) {
        root = el; const st = MB.store.get(), code = st.profile.name.replace(/[^a-z0-9_]/gi, '').toUpperCase().slice(0, 12) || 'MEMBUY', link = location.origin + location.pathname + '?ref=' + code;
        el.innerHTML = `<a class="back" href="#profile">← Профиль</a><h1 class="pt">Пригласить друзей</h1>
          <div class="note">Демо: ссылка и код работают как образец. Начисления появятся после запуска сервера, который считает сделки приглашённых.</div>
          <div class="card stack"><div class="fld"><span>Ваш код</span><b class="code">${esc(code)}</b></div>
            <div class="fld"><span>Ваша ссылка</span><input id="rlink" class="inp" readonly value="${esc(link)}"></div><button class="btn accent" id="rcopy">Скопировать ссылку</button></div>
          <dl class="stats"><div><dt>Приглашено</dt><dd>0</dd></div><div><dt>Заработано</dt><dd>$0</dd></div><div><dt>Ваша доля</dt><dd>20% комиссии</dd></div></dl>
          <div class="card"><h2 class="h2">Как это будет работать</h2><ol class="ol"><li>Друг открывает Membuy по вашей ссылке и подключает кошелёк.</li><li>С каждой его сделки площадка берёт комиссию ${MB.config.PLATFORM_FEE_BPS / 100}%.</li><li>20% этой комиссии начисляется вам.</li></ol></div>`;
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
