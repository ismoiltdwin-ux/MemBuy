/* Профиль трейдера (#u-адрес) и окно «Отправить» (как в pump.fun: монета → сумма → сводка → отправка). */
MB.views = MB.views || {};
(() => {
  const { esc, usd, num, short } = MB.util;
  const hue = a => parseInt(String(a).slice(0, 3), 36) % 360;

  /** Окно отправки. to — адрес получателя (если пусто, его вводят в окне). */
  MB.ui.sendSheet = async (to = '', label = '') => {
    const box = document.getElementById('onb'); if (!box) return;
    if (!MB.store.get().wallet.connected) { try { await MB.wallet.connect(); } catch (e) { MB.ui.toast(e.message, 'err'); return; } }
    let asset = null; const close = () => { box.hidden = true; box.innerHTML = ''; };
    const frame = inner => { box.hidden = false; box.innerHTML = `<div class="onb" role="dialog" aria-modal="true" aria-labelledby="sdt"><div class="card send">${inner}</div></div>`;
      box.querySelector('.onb').addEventListener('click', e => { if (e.target.classList.contains('onb')) close(); }); const x = box.querySelector('[data-close]'); if (x) x.onclick = close; };
    const who = () => label ? `${esc(label)} · ${esc(short(to))}` : esc(short(to));

    async function pick() {
      frame(`<div class="shead"><h2 id="sdt">Выберите монету для отправки</h2><button class="x" data-close aria-label="Закрыть">×</button></div><div class="list" id="slist"><div class="hint">Загружаем…</div></div>`);
      const list = await MB.send.assets().catch(() => []); const el = box.querySelector('#slist'); if (!el) return;
      el.innerHTML = list.length ? list.map((a, i) => `<button class="row sasset" data-i="${i}">${MB.ui.avatar(a, 40)}<span class="nm"><b>${esc(a.sym)}</b><small>${num(a.qty, 4)} ${esc(a.sym)}</small></span><span class="pr"><b>${a.usd ? usd(a.usd) : '—'}</b></span></button>`).join('') : MB.ui.empty('Нечего отправить', 'Пополните кошелёк.');
      el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { asset = list[+b.dataset.i]; amountStep(); });
    }
    function amountStep() {
      frame(`<div class="shead"><button class="x" id="sback" aria-label="Назад">‹</button><h2 id="sdt">Введите сумму</h2><button class="x" data-close aria-label="Закрыть">×</button></div>
        <label class="fld"><span>Кому</span>${to ? `<b class="ugc">${who()}</b>` : '<input id="sto" class="inp" placeholder="Адрес кошелька Solana" autocomplete="off">'}</label>
        <label class="fld"><span>Сумма, ${esc(asset.sym)}</span><input id="samt" inputmode="decimal" placeholder="0" autocomplete="off"><small>Баланс: ${num(asset.qty, 6)} ${esc(asset.sym)}<span id="susd"></span></small></label>
        <div class="chips">${[25, 50, 75, 100].map(p => `<button type="button" class="chip" data-p="${p}">${p}%</button>`).join('')}</div>
        <button class="btn big accent" id="snext">Далее</button>`);
      const amt = box.querySelector('#samt'), upd = () => { const v = +amt.value.replace(',', '.') || 0; box.querySelector('#susd').textContent = asset.price ? ' · ≈ ' + usd(v * asset.price) : ''; };
      amt.addEventListener('input', upd); box.querySelector('#sback').onclick = pick;
      box.querySelectorAll('[data-p]').forEach(c => c.onclick = () => { amt.value = String(+(asset.max * c.dataset.p / 100).toFixed(asset.id === 'SOL' ? 6 : 4)); upd(); });
      box.querySelector('#snext').onclick = () => { const t = to || (box.querySelector('#sto') || {}).value || ''; if (!MB.send.isAddr(t)) { MB.ui.toast('Неверный адрес получателя', 'err'); return; } to = t.trim();
        const v = +amt.value.replace(',', '.'); if (!(v > 0)) { MB.ui.toast('Введите сумму', 'err'); return; } if (v > asset.max + 1e-12) { MB.ui.toast(asset.id === 'SOL' ? 'Недостаточно SOL (оставьте немного на сборы сети)' : 'Недостаточно монет', 'err'); return; } summary(v); };
    }
    async function summary(v) {
      frame(`<div class="shead"><button class="x" id="sback" aria-label="Назад">‹</button><h2 id="sdt">Сводка</h2><button class="x" data-close aria-label="Закрыть">×</button></div>
        <div class="ssum">${MB.ui.avatar(asset, 56)}<b class="big">${num(v, 6)} ${esc(asset.sym)}</b><small>${asset.price ? '≈ ' + usd(v * asset.price) : ''}</small></div>
        <dl class="quote"><div><dt>Кому</dt><dd class="ugc">${who()}</dd></div><div><dt>Комиссия сети</dt><dd id="sfee">…</dd></div></dl>
        <p class="fine">Перевод в блокчейне нельзя отменить. Проверьте адрес получателя.</p><button class="btn big accent" id="sgo">Отправить ${num(v, 6)} ${esc(asset.sym)}</button><div id="sst" class="tstatus" role="status"></div>`);
      box.querySelector('#sback').onclick = amountStep;
      MB.send.preview(to, asset).then(f => { const el = box.querySelector('#sfee'); if (el) el.textContent = num(f.network, 6) + ' SOL' + (f.rent ? ' + ' + num(f.rent, 5) + ' SOL (счёт получателя)' : ''); }, () => {});
      box.querySelector('#sgo').onclick = async () => { const b = box.querySelector('#sgo'); if (b.disabled) return; b.disabled = true;
        try { const sig = await MB.send.transfer(to, asset, v); frame(`<div class="ssum"><h2 id="sdt">Отправлено ✅</h2><b class="big">${num(v, 6)} ${esc(asset.sym)}</b><small>${who()}</small></div><div class="qgrid"><a class="btn ghost" href="https://solscan.io/tx/${esc(sig)}" target="_blank" rel="noopener">Транзакция</a><button class="btn accent" data-close>Готово</button></div>`); }
        catch (e) { const s = box.querySelector('#sst'); if (s && e.message) { s.className = 'tstatus err'; s.textContent = e.message; } b.disabled = false; } };
    }
    pick();
  };

  /** Профиль трейдера: адрес, подписка, отправка, его посты в ленте. Сообщения — только при взаимной подписке (chat.js). */
  MB.views.user = (() => {
    let root, addr = '';
    async function draw() {
      if (!root) return; const st = MB.store.get(), me = st.wallet.address, fol = st.following.includes(addr), mine = addr === me;
      const posts = MB.postchain && MB.postchain.enabled() ? (await MB.postchain.load().catch(() => [])).filter(p => p.author === addr) : [];
      if (!root) return; const name = (posts.find(p => p.name) || {}).name || '';
      const sol = await MB.wallet.rpc('getBalance', [addr]).then(r => r.value / 1e9, () => null); if (!root) return;
      const chat = MB.chat && MB.chat.enabled();
      root.innerHTML = `<a class="back" href="#feed">← Лента</a>
        <div class="prof">${MB.ui.avatar({ sym: (name || addr).slice(0, 2).toUpperCase(), hue: hue(addr) }, 84)}<div class="nm"><h1 class="ugc">${esc(name || short(addr))}</h1><small><code class="ugc">${esc(short(addr))}</code> <button class="chip sm2" id="ucopy">Скопировать адрес</button></small>${sol != null ? `<small>Баланс: <b>${num(sol, 3)} SOL</b></small>` : ''}</div></div>
        ${mine ? '' : `<div class="qgrid"><button class="btn ${fol ? 'ghost' : 'accent'}" id="ufol">${fol ? 'Вы подписаны' : 'Подписаться'}</button>${chat ? '<button class="btn ghost" id="umsg">Сообщение</button>' : ''}<button class="btn ghost" id="usend">Отправить</button></div>`}
        <div id="umsgnote"></div>
        <h2 class="h2">Посты</h2><div class="list">${posts.length ? posts.slice(0, 20).map(p => `<article class="post"><p class="pt2">${esc(p.text)}</p><small class="hint">${new Date(p.ts * 1000).toLocaleString(MB.i18n.locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></article>`).join('') : MB.ui.empty('Постов пока нет', '')}</div>`;
      root.querySelector('#ucopy').onclick = () => navigator.clipboard && navigator.clipboard.writeText(addr).then(() => MB.ui.toast('Адрес скопирован'), () => {});
      const f = root.querySelector('#ufol'); if (f) f.onclick = async () => { MB.store.update(s => { const i = s.following.indexOf(addr); if (i >= 0) s.following.splice(i, 1); else s.following.push(addr); }, true); if (chat) await MB.chat.follow(addr, !fol).catch(e => MB.ui.toast(e.message, 'err')); draw(); };
      const s = root.querySelector('#usend'); if (s) s.onclick = () => MB.ui.sendSheet(addr, name);
      const m = root.querySelector('#umsg'); if (m) m.onclick = () => MB.chat.open(addr, name);
    }
    return { mount(el, a) { root = el; addr = a; el.innerHTML = '<div class="empty"><p>Загружаем профиль…</p></div>'; if (!MB.send.isAddr(a)) { el.innerHTML = MB.ui.empty('Неверный адрес', ''); return; } return draw(); }, unmount() { root = null; }, onState() { if (root) draw(); } };
  })();
})();
