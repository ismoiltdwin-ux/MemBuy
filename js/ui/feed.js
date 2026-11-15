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
  /* ---------- Живой режим: посты из блокчейна (postchain.js) ---------- */
  const LTABS = [['all', 'Вызовы'], ['following', 'Подписки'], ['top', 'Лучшие']];
  let ltab = 'all', seq = 0;
  const agoS = ts => ago(ts * 1000);
  const hue = a => parseInt(String(a).slice(0, 3), 36) % 360;
  async function recentCard() {
    const box = root && root.querySelector('#recent'); if (!box) return; const ids = MB.store.get().recent.slice(0, 4);
    if (!ids.length) { box.innerHTML = ''; return; }
    const ts = MB.data.many ? await MB.data.many(ids).catch(() => []) : []; if (!root) return; const by = {}; ts.forEach(t => { by[t.id] = t; });
    const rows = ids.map(id => by[id]).filter(Boolean);
    box.innerHTML = rows.length ? `<div class="card recent"><div class="shead"><h2 class="h2">Недавно просмотренные</h2><button class="chip" id="rclr">Очистить</button></div>
      ${rows.map(t => `<div class="rrow"><a class="row" href="#t-${esc(t.id)}">${MB.ui.avatar(t, 40)}<span class="nm"><b>${esc(t.name)}</b><small>${esc(t.sym)}</small></span><span class="pr"><b>${usd(t.mc)}</b>${MB.ui.chg(t.chg24)}</span></a><button class="x" data-rm="${esc(t.id)}" aria-label="Убрать">×</button></div>`).join('')}</div>` : '';
    const c = box.querySelector('#rclr'); if (c) c.onclick = () => { MB.store.update(s => { s.recent = []; }, true); recentCard(); };
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { MB.store.update(s => { s.recent = s.recent.filter(x => x !== b.dataset.rm); }, true); recentCard(); });
  }
  function liveComposer() {
    const st = MB.store.get(), box = root.querySelector('#composer');
    if (!st.wallet.connected) { box.innerHTML = '<div class="hint">Подключите кошелёк, чтобы писать посты.</div>'; return; }
    if (box.querySelector('#ptext')) return; // не сбрасываем набранный текст при обновлениях
    box.innerHTML = `<label class="sr" for="ptext">Текст поста</label><textarea id="ptext" maxlength="280" rows="2" placeholder="Что думаете о рынке?"></textarea>
      <div class="crow"><label class="sr" for="pcoin">Прикрепить монету</label><select id="pcoin"><option value="">Без монеты</option>${Object.entries(st.holdings).map(([id, h]) => `<option value="${esc(id)}">${esc(h.sym)} — моя позиция</option>`).join('')}</select><span class="cnt" id="pcnt">0/280</span><button class="btn accent" id="psend">Опубликовать</button></div>
      <p class="fine">Пост записывается в блокчейн Solana: подтвердите в Phantom, сбор ${MB.config.POST_FEE_SOL} SOL. Ссылки и «раздачи» запрещены.</p>`;
    const ta = box.querySelector('#ptext'); ta.addEventListener('input', () => { box.querySelector('#pcnt').textContent = ta.value.length + '/280'; });
    box.querySelector('#psend').onclick = async () => { const b = box.querySelector('#psend'); if (b.disabled) return; b.disabled = true;
      try { await MB.postchain.publish({ text: ta.value, coin: box.querySelector('#pcoin').value, name: MB.store.get().profile.name }); ta.value = ''; box.querySelector('#pcnt').textContent = '0/280'; MB.ui.toast('Пост опубликован'); setTimeout(() => liveList(true), 4000); }
      catch (e) { MB.ui.toast(e.message, 'err'); } finally { b.disabled = false; } };
  }
  async function liveList(force) {
    const box = root && root.querySelector('#flist'); if (!box) return; const my = ++seq;
    let all; try { all = await MB.postchain.load(force); } catch (e) { box.innerHTML = MB.ui.empty('Не удалось загрузить посты', esc(e.message)); return; }
    if (!root || my !== seq) return; const st = MB.store.get(), me = st.wallet.address, owner = MB.fees.isOwner();
    let items = ltab === 'following' ? all.filter(p => st.following.includes(p.author) || p.author === me) : all.slice(0, 50);
    if (!items.length) { box.innerHTML = MB.ui.empty('Здесь пока пусто', ltab === 'following' ? 'Подпишитесь на авторов во вкладке «Вызовы».' : 'Будьте первым: напишите пост о своей монете.'); return; }
    // «Лучшие» — по размеру настоящей позиции автора в прикреплённой монете.
    const info = await Promise.all(items.map(async p => { if (!p.coin) return { p }; const [t, pos] = await Promise.all([MB.data.get(p.coin).catch(() => null), MB.postchain.position(p.author, p.coin).catch(() => null)]); return { p, t, val: t && pos ? pos.qty * t.price : 0 }; }));
    if (!root || my !== seq) return;
    if (ltab === 'top') info.sort((a, b) => (b.val || 0) - (a.val || 0));
    box.innerHTML = info.map(({ p, t, val }) => { const fol = st.following.includes(p.author), mine = p.author === me, nm = p.name || MB.util.short(p.author);
      const coin = t ? `<a class="pos" href="#t-${esc(t.id)}">${MB.ui.avatar(t, 36)}<span class="nm"><b>${esc(t.sym)}</b><small>${esc(t.name)}</small></span><span class="kv"><small>Позиция</small><b>${val > 0 ? usd(val) : 'продана'}</b></span><span class="kv"><small>24 ч</small><b>${MB.util.pct(t.chg24)}</b></span></a>` : '';
      return `<article class="post"><div class="ph"><a href="#u-${esc(p.author)}" aria-label="Профиль автора">${MB.ui.avatar({ sym: (p.name || p.author).slice(0, 2).toUpperCase(), hue: hue(p.author) }, 44)}</a><div class="nm"><a class="ugc" href="#u-${esc(p.author)}"><b>${esc(nm)}</b></a><small>${agoS(p.ts)}</small></div>
        ${mine ? '' : `<button class="chip ${fol ? 'on' : ''}" data-lfollow="${esc(p.author)}">${fol ? 'Вы подписаны' : 'Подписаться'}</button>`}</div>
        <p class="pt2">${esc(p.text)}</p>${coin}
        <div class="acts">${t ? `<span class="act">МК ${usd(t.mc)}</span>` : ''}<a class="act" href="https://solscan.io/tx/${esc(p.sig)}" target="_blank" rel="noopener">В блокчейне</a>${owner ? `<button class="act" data-hide="${esc(p.sig)}">Скрыть</button>` : ''}</div></article>`; }).join('');
  }
  function liveMount(el) {
    if (!MB.postchain.enabled()) { el.innerHTML = '<h1 class="pt">Лента</h1>' + MB.ui.empty('Лента ещё не настроена', ''); return; }
    el.innerHTML = `<h1 class="pt">Лента</h1><div class="chips tabsx" role="tablist">${LTABS.map(([k, n]) => `<button class="chip ${k === ltab ? 'on' : ''}" role="tab" aria-selected="${k === ltab}" data-ltab="${k}">${n}</button>`).join('')}</div>
      <div id="recent"></div><div class="card composer" id="composer"></div><div class="list" id="flist"><div class="hint">Загружаем посты…</div></div>`;
    el.querySelectorAll('[data-ltab]').forEach(c => c.onclick = () => { ltab = c.dataset.ltab; el.querySelectorAll('[data-ltab]').forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-selected', x === c); }); liveList(); });
    el.querySelector('#flist').addEventListener('click', async e => { const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.lfollow) { MB.store.update(s => { const i = s.following.indexOf(b.dataset.lfollow); if (i >= 0) s.following.splice(i, 1); else s.following.push(b.dataset.lfollow); }, true); liveList(); }
      if (b.dataset.hide && confirm(MB.t('Скрыть этот пост для всех?'))) { try { await MB.postchain.hide(b.dataset.hide); MB.ui.toast('Пост скрыт'); setTimeout(() => liveList(true), 4000); } catch (err) { MB.ui.toast(err.message, 'err'); } } });
    recentCard(); liveComposer(); liveList();
  }
  return {
    mount(el) {
      root = el; if (MB.config.LIVE) return liveMount(el);
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
    onState() { if (!root) return; if (MB.config.LIVE) { liveComposer(); return; } composer(); list(); },
    onTick() { if (root && MB.config.LIVE) liveList(); },
  };
})();
