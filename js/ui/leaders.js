/* Экран «Рейтинг»: трейдеры, отряды, награды. */
MB.views = MB.views || {};
MB.views.leaders = (() => {
  const { esc, usd } = MB.util; let root, tab = 'traders', period = 'd';
  const TABS = [['traders', 'Трейдеры'], ['squads', 'Отряды'], ['rewards', 'Награды']], PER = [['d', 'День'], ['w', 'Неделя'], ['m', 'Месяц']];
  const money = v => `<b class="${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '+' : ''}${usd(v)}</b>`;
  async function myPnl() { const st = MB.store.get(); if (!st.wallet.connected) return 0; const sol = await MB.data.solUsd(); let eq = st.wallet.sol * sol; for (const [id, h] of Object.entries(st.holdings)) { const t = await MB.data.get(id); if (t) eq += h.qty * t.price; } return eq - MB.config.DEMO_START_SOL * sol; }
  async function draw() {
    if (!root) return; const box = root.querySelector('#lbody'), st = MB.store.get();
    if (tab === 'traders') {
      const rows = MB.social.leaders(period, await myPnl()); if (!root) return; const me = rows.find(r => r.me);
      box.innerHTML = `<div class="chips">${PER.map(([k, n]) => `<button class="chip ${k === period ? 'on' : ''}" data-per="${k}">${n}</button>`).join('')}</div>
        ${me ? `<div class="card mecard"><span>Ваше место: <b>#${me.rank}</b> из ${rows.length}</span>${money(me.pnl)}</div>` : '<div class="hint">Подключите кошелёк, чтобы попасть в рейтинг.</div>'}
        <div class="list">${rows.map(r => `<div class="row lrow ${r.me ? 'me' : ''}"><span class="rk ${r.rank <= 3 ? 'top' : ''}">${r.rank}</span>${MB.ui.userAva(r.name, r.hue, 40)}<span class="nm"><b>${esc(r.name)}${r.me ? ' (вы)' : ''}</b>${r.me ? '' : `<button class="chip sm2 ${st.following.includes(r.name) ? 'on' : ''}" data-follow="${esc(r.name)}">${st.following.includes(r.name) ? 'Вы подписаны' : 'Подписаться'}</button>`}</span><span class="pr">${money(r.pnl)}</span></div>`).join('')}</div>`;
    } else if (tab === 'squads') {
      const rows = MB.social.squads();
      box.innerHTML = `${st.squad ? `<div class="card mecard"><span>Ваш отряд: <b>${esc(st.squad)}</b></span><span class="hint">1 участник</span></div>` : `<div class="card"><b>Создайте свой отряд</b><p class="hint">Отряд — команда трейдеров с общим результатом.</p><div class="crow"><label class="sr" for="sq">Название отряда</label><input id="sq" class="inp" maxlength="20" placeholder="Название отряда"><button class="btn accent" id="sqgo">Создать отряд</button></div></div>`}
        <div class="list">${rows.map((r, i) => `<div class="row lrow ${r.mine ? 'me' : ''}"><span class="rk ${i < 3 ? 'top' : ''}">${i + 1}</span>${MB.ui.avatar({ sym: MB.t(r.name).slice(0, 2).toUpperCase(), hue: (i * 67) % 360 }, 40)}<span class="nm"><b>${esc(r.name)}</b><small>Участников: ${r.members}</small></span><span class="pr">${money(r.pnl)}</span></div>`).join('')}</div>`;
      const go = box.querySelector('#sqgo'); if (go) go.onclick = () => { try { MB.social.createSquad(box.querySelector('#sq').value); MB.ui.toast('Отряд создан'); } catch (e) { MB.ui.toast(e.message, 'err'); } };
    } else {
      box.innerHTML = `<div class="card"><b>Награды трейдерам — в планах</b><p class="hint">Идея: часть комиссии площадки раз в неделю делится между лучшими трейдерами. Сейчас призового фонда нет: он появится только после запуска торговли и сервера, который считает результаты.</p></div>
        <dl class="stats"><div><dt>Призовой фонд сейчас</dt><dd>$0</dd></div><div><dt>Источник фонда</dt><dd>Доля комиссии</dd></div><div><dt>Выплаты</dt><dd>Раз в неделю</dd></div></dl>`;
    }
    box.querySelectorAll('[data-per]').forEach(c => c.onclick = () => { period = c.dataset.per; draw(); });
    box.querySelectorAll('[data-follow]').forEach(c => c.onclick = () => MB.social.follow(c.dataset.follow));
  }
  return {
    mount(el) { root = el; el.innerHTML = `<h1 class="pt">Рейтинг</h1><div class="chips tabsx" role="tablist">${TABS.map(([k, n]) => `<button class="chip ${k === tab ? 'on' : ''}" role="tab" aria-selected="${k === tab}" data-tab="${k}">${n}</button>`).join('')}</div><div id="lbody" class="stack"></div>`;
      el.querySelectorAll('[data-tab]').forEach(c => c.onclick = () => { tab = c.dataset.tab; el.querySelectorAll('[data-tab]').forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-selected', x === c); }); draw(); }); return draw(); },
    unmount() { root = null; }, onState: draw,
  };
})();
