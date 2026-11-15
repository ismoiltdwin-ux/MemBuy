/* «Входящие» (#inbox: Сообщения / Активность) и диалог (#c-адрес). Работают только в живом режиме с сервером сообщений. */
MB.views = MB.views || {};
(() => {
  const { esc, short } = MB.util;
  const hue = a => parseInt(String(a).slice(0, 3), 36) % 360;
  const ava = (a, size = 44) => MB.ui.avatar({ sym: String(a).slice(0, 2).toUpperCase(), hue: hue(a) }, size);
  const time = ts => { const d = new Date(ts * 1000), today = new Date().toDateString() === d.toDateString(); return d.toLocaleString(MB.i18n.locale(), today ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit' }); };
  const gate = (el, title, then) => {
    if (!MB.chat.enabled()) { el.innerHTML = `<h1 class="pt">${title}</h1>` + MB.ui.empty('Сообщения ещё не настроены', 'Владелец сайта должен подключить сервер сообщений.'); return false; }
    if (!MB.store.get().wallet.connected || !MB.chat.loggedIn()) {
      el.innerHTML = `<h1 class="pt">${title}</h1>` + MB.ui.empty('Войдите в сообщения', 'Подпишите короткий текст в Phantom — это не транзакция и ничего не стоит. Так мы знаем, что кошелёк ваш.', '<button class="btn accent" id="clogin">Войти</button>');
      el.querySelector('#clogin').onclick = async () => { try { await MB.chat.login(); then(); } catch (e) { MB.ui.toast(e.message, 'err'); } }; return false; }
    return true;
  };

  MB.views.inbox = (() => {
    let root, tab = 'msgs';
    async function draw() {
      if (!root || !gate(root, 'Входящие', draw)) return;
      root.innerHTML = `<h1 class="pt">Входящие</h1><div class="chips tabsx" role="tablist"><button class="chip ${tab === 'msgs' ? 'on' : ''}" data-it="msgs" role="tab">Сообщения</button><button class="chip ${tab === 'act' ? 'on' : ''}" data-it="act" role="tab">Активность</button></div><div class="list" id="ibox"><div class="hint">Загружаем…</div></div>`;
      root.querySelectorAll('[data-it]').forEach(b => b.onclick = () => { tab = b.dataset.it; draw(); });
      const box = root.querySelector('#ibox');
      try {
        if (tab === 'msgs') { const d = await MB.chat.threads(); if (!root) return;
          box.innerHTML = d.items.length ? d.items.map(t => `<a class="row thr" href="#c-${esc(t.other)}">${ava(t.other)}<span class="nm"><b class="ugc">${esc(short(t.other))}</b><small class="ugc">${t.mine ? 'Вы: ' : ''}${esc(t.text)}</small></span><span class="pr"><small>${time(t.ts)}</small>${t.unread ? `<b class="badge">${t.unread}</b>` : ''}</span></a>`).join('')
            : MB.ui.empty('Сообщений пока нет', 'Писать можно тем, с кем у вас взаимная подписка. Найдите трейдеров в ленте.', '<a class="btn ghost" href="#feed">Открыть ленту</a>'); }
        else { const d = await MB.chat.activity(); if (!root) return;
          box.innerHTML = d.items.length ? d.items.map(a => `<div class="row thr"><a href="#u-${esc(a.who)}">${ava(a.who)}</a><span class="nm"><b><a class="ugc" href="#u-${esc(a.who)}">${esc(short(a.who))}</a></b><small>${a.back ? 'вы подписаны друг на друга' : 'подписался на вас'} · ${time(a.ts)}</small></span><span class="pr">${a.back ? `<a class="btn ghost sm2" href="#c-${esc(a.who)}">Сообщение</a>` : `<button class="btn accent sm2" data-back="${esc(a.who)}">Подписаться в ответ</button>`}</span></div>`).join('')
            : MB.ui.empty('Пока тихо', 'Здесь появятся люди, которые подписались на вас.');
          box.querySelectorAll('[data-back]').forEach(b => b.onclick = async () => { b.disabled = true; try { await MB.chat.follow(b.dataset.back, true); MB.ui.toast('Подписались. Теперь можно переписываться'); draw(); } catch (e) { MB.ui.toast(e.message, 'err'); b.disabled = false; } }); }
      } catch (e) { if (root) box.innerHTML = MB.ui.empty('Не удалось загрузить', esc(e.message)); }
    }
    return { mount(el) { root = el; return draw(); }, unmount() { root = null; }, onTick() { if (root && tab === 'msgs' && MB.chat.loggedIn()) draw(); } };
  })();

  MB.views.chatv = (() => {
    let root, other = '', last = 0, timer = null, busy = false;
    function bubbles(items, append) {
      const box = root && root.querySelector('#cmsgs'); if (!box) return;
      const html = items.map(m => `<div class="msg ${m.mine ? 'mine' : ''}"><p class="ugc">${esc(m.text)}</p><small>${time(m.ts)}</small></div>`).join('');
      if (append) box.insertAdjacentHTML('beforeend', html); else box.innerHTML = html || '<div class="hint">Напишите первое сообщение.</div>';
      if (items.length) { last = items[items.length - 1].id; box.scrollTop = box.scrollHeight; }
    }
    async function refresh() { if (!root || busy) return; busy = true; try { const d = await MB.chat.msgs(other, last); if (!root) return; if (d.items.length) { if (!last) bubbles(d.items); else bubbles(d.items, true); } note(d.mutual); } catch (e) { /* сеть: попробуем позже */ } finally { busy = false; } }
    function note(mutual) {
      const n = root && root.querySelector('#cnote'), form = root && root.querySelector('#cform'); if (!n) return;
      form.hidden = !mutual;
      n.innerHTML = mutual ? '' : `<div class="note">Писать можно только при взаимной подписке. Подпишитесь — когда этот трейдер подпишется в ответ, откроется чат.</div><button class="btn accent" id="cfol">Подписаться</button>`;
      const f = n.querySelector('#cfol'); if (f) f.onclick = async () => { try { const d = await MB.chat.follow(other, true); MB.ui.toast(d.mutual ? 'Подписка взаимная — можно писать' : 'Вы подписались. Ждём подписку в ответ'); note(d.mutual); } catch (e) { MB.ui.toast(e.message, 'err'); } };
    }
    async function mount(el, addr) {
      root = el; other = addr; last = 0;
      if (!MB.send.isAddr(addr)) { el.innerHTML = MB.ui.empty('Неверный адрес', ''); return; }
      if (!gate(el, 'Сообщения', () => mount(el, addr))) return;
      el.innerHTML = `<div class="chead"><a class="back" href="#inbox">←</a><a href="#u-${esc(addr)}">${ava(addr, 36)}</a><a class="ugc" href="#u-${esc(addr)}"><b>${esc(short(addr))}</b></a><button class="chip sm2" id="csend">Отправить монету</button></div>
        <div class="cmsgs" id="cmsgs"><div class="hint">Загружаем…</div></div><div id="cnote"></div>
        <form class="cform" id="cform" hidden><label class="sr" for="ctext">Сообщение</label><input id="ctext" class="inp" maxlength="1000" placeholder="Сообщение" autocomplete="off"><button class="btn accent" type="submit">➤</button></form>`;
      el.querySelector('#csend').onclick = () => MB.ui.sendSheet(addr);
      el.querySelector('#cform').addEventListener('submit', async e => { e.preventDefault(); const i = el.querySelector('#ctext'), t = i.value.trim(); if (!t) return; i.value = '';
        try { await MB.chat.send(other, t); await refresh(); } catch (err) { i.value = t; MB.ui.toast(err.message, 'err'); } });
      await refresh(); clearInterval(timer); timer = setInterval(refresh, 4000);
    }
    return { mount, unmount() { clearInterval(timer); timer = null; root = null; } };
  })();
})();
