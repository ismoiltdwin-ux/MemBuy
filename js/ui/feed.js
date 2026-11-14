/* Экран «Лента»: посты трейдеров, сделки, подписки, свой пост. */
MB.views = MB.views || {};
MB.views.feed = (() => {
  const { esc, usd, num } = MB.util; let root, tab = 'all';
  const TABS = [['all', 'Все'], ['following', 'Подписки'], ['top', 'Лучшие']];
  const ago = ts => { const m = Math.max(0, Math.round((Date.now() - ts) / 6e4)); return m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : m < 1440 ? Math.round(m / 60) + ' ч назад' : Math.round(m / 1440) + ' дн. назад'; };
  const uava = (u, size = 44) => MB.ui.userAva(u.name, u.name === MB.social.me() ? 40 : u.hue, size);
  function position(p) {
    const st = MB.store.get(), t = MB.providers.demo.all().find(x => x.id === p.coin); if (!p.coin || !t) return '';
    let pos = p.posUsd, pnl = p.pnlUsd;
    if (p.mine) { const h = st.holdings[p.coin]; if (!h) return `<a class="pos" href="#t-${esc(p.coin)}">${MB.ui.avatar(t, 36)}<span class="nm"><b>${esc(t.sym)}</b><small>${esc(t.name)}</small></span><span class="hint">позиция закрыта</span></a>`; pos = h.qty * t.price; pnl = pos - h.costUsd; }
    return `<a class="pos" href="#t-${esc(p.coin)}">${MB.ui.avatar(t, 36)}<span class="nm"><b>${esc(t.sym)}</b><small>${esc(t.name)}</small></span><span class="kv"><small>Позиция</small><b>${usd(pos)}</b></span><span class="kv"><small>Результат</small><b class="${pnl >= 0 ? 'up' : 'down'}">${pnl >= 0 ? '+' : ''}${usd(pnl)}</b></span></a>`;
  }
  function item(p) {
    const st = MB.store.get(), u = MB.social.user(p.user), mine = p.user === MB.social.me(), fol = st.following.includes(p.user);
    const head = `<div class="ph">${uava(u)}<div class="nm"><b>${esc(p.user)}</b><small>${ago(p.ts)}</small></div>${mine ? (p.mine ? `<button class="chip" data-del="${esc(p.id)}">Удалить</button>` : '') : `<button class="chip ${fol ? 'on' : ''}" data-follow="${esc(p.user)}">${fol ? 'Вы подписаны' : 'Подписаться'}</button>`}</div>`;
    if (p.kind === 'trade') { const t = MB.providers.demo.all().find(x => x.id === p.coin); return `<article class="post">${head}<a class="pos" href="#t-${esc(p.coin)}"><span class="tag ${p.side}">${p.side === 'buy' ? 'Купил' : 'Продал'}</span><span class="nm"><b>${esc(t ? t.sym : p.coin)}</b><small>при капитализации ${usd(p.mc)}</small></span><span class="kv"><small>Сумма</small><b>${usd(p.usd)}</b></span></a></article>`; }
    const liked = st.liked.includes(p.id);
    return `<article class="post">${head}<p class="pt2">${esc(p.text)}</p>${position(p)}<div class="acts"><button class="act ${liked ? 'on' : ''}" data-like="${esc(p.id)}" aria-pressed="${liked}">♥ ${num(p.likes + (liked ? 1 : 0), 0)}</button><span class="act">Просмотры: ${num(p.views, 0)}</span></div></article>`;
  }
  function list() {
    const el = root.querySelector('#flist'), items = MB.social.feed(tab); let n = 0;
    el.innerHTML = items.length ? items.map((p, i) => item(p) + (i % 5 === 2 ? MB.ads.card(MB.ads.pick('feed', n++)) : '')).join('') : MB.ui.empty('Здесь пока пусто', tab === 'following' ? 'Подпишитесь на трейдеров во вкладке «Все» или в рейтинге.' : 'Постов пока нет.');
  }
  function composer() {
    const st = MB.store.get(), box = root.querySelector('#composer');
    if (!st.wallet.connected) { box.innerHTML = '<div class="hint">Подключите кошелёк, чтобы писать посты.</div>'; return; }
    const prev = box.querySelector('#ptext') ? box.querySelector('#ptext').value : '', prevCoin = box.querySelector('#pcoin') ? box.querySelector('#pcoin').value : '';
    box.innerHTML = `<label class="sr" for="ptext">Текст поста</label><textarea id="ptext" maxlength="280" rows="2" placeholder="Что думаете о рынке?"></textarea>
      <div class="crow"><label class="sr" for="pcoin">Прикрепить монету</label><select id="pcoin"><option value="">Без монеты</option>${Object.entries(st.holdings).map(([id, h]) => `<option value="${esc(id)}">${esc(h.sym)} — моя позиция</option>`).join('')}</select><span class="cnt" id="pcnt">0/280</span><button class="btn accent" id="psend">Опубликовать</button></div>`;
    const ta = box.querySelector('#ptext'); ta.value = prev; box.querySelector('#pcoin').value = prevCoin; const cnt = () => { box.querySelector('#pcnt').textContent = ta.value.length + '/280'; }; cnt(); ta.addEventListener('input', cnt);
    box.querySelector('#psend').onclick = () => { const text = ta.value, coin = box.querySelector('#pcoin').value; if (!text.trim()) { MB.ui.toast('Напишите текст поста', 'err'); ta.focus(); return; } ta.value = ''; box.querySelector('#pcoin').value = '';
      try { MB.social.publish(text, coin); MB.ui.toast('Пост опубликован'); } catch (e) { const t2 = root.querySelector('#ptext'); if (t2) { t2.value = text; t2.focus(); } MB.ui.toast(e.message, 'err'); } };
  }
  const onSocial = () => { if (root) list(); };
  return {
    mount(el) {
      root = el;
      el.innerHTML = `<h1 class="pt">Лента</h1><div class="chips tabsx" role="tablist">${TABS.map(([k, n]) => `<button class="chip ${k === tab ? 'on' : ''}" role="tab" aria-selected="${k === tab}" data-tab="${k}">${n}</button>`).join('')}</div>
        <div class="card composer" id="composer"></div><div class="list" id="flist"></div>`;
      el.querySelectorAll('[data-tab]').forEach(c => c.onclick = () => { tab = c.dataset.tab; el.querySelectorAll('[data-tab]').forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-selected', x === c); }); list(); });
      el.querySelector('#flist').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.like) MB.social.like(b.dataset.like); else if (b.dataset.follow) MB.social.follow(b.dataset.follow); else if (b.dataset.del) MB.social.remove(b.dataset.del);
      });
      composer(); list(); MB.util.bus.on('social', onSocial);
    },
    unmount() { MB.util.bus.off('social', onSocial); root = null; },
    onState() { if (root) { composer(); list(); } },
  };
})();
