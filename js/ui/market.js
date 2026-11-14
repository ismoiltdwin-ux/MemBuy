/* Экран «Рынок»: поиск, фильтры, список монет. */
MB.views = MB.views || {};
MB.views.market = (() => {
  const { esc, price, usd } = MB.util; let filter = 'trend', q = '', root;
  const FILTERS = [['trend', 'В тренде'], ['fresh', 'Новые'], ['gain', 'Растут'], ['vol', 'По объёму'], ['fav', '★ Избранное']];
  const row = t => `<a class="row" data-id="${esc(t.id)}" href="#t-${esc(t.id)}">
      ${MB.ui.avatar(t)}<span class="nm"><b>${esc(t.name)}</b><small>${esc(t.sym)} · кап. ${usd(t.mc)}</small></span>
      ${MB.chart.spark(t.series, t.chg24 >= 0)}<span class="pr"><b class="p">${price(t.price)}</b><span class="c">${MB.ui.chg(t.chg24)}</span></span></a>`;
  async function fill() {
    const list = root.querySelector('#list');
    try { const items = await MB.data.list(filter, q); list.innerHTML = items.length ? items.map((t, i) => row(t) + (i === Math.min(3, items.length - 1) && !q.trim() ? MB.ads.card(MB.ads.pick('market', 0)) : '')).join('') : (filter === 'fav' && !q.trim() ? MB.ui.empty('В избранном пусто', 'Откройте монету и нажмите «В избранное».') : MB.ui.empty('Ничего не найдено', 'Попробуйте другое название или тикер.')); }
    catch (e) { list.innerHTML = MB.ui.empty('Не удалось загрузить монеты', esc(e.message), '<button class="btn ghost" id="retry">Повторить</button>'); const b = list.querySelector('#retry'); if (b) b.onclick = fill; }
  }
  return {
    async mount(el) {
      root = el;
      el.innerHTML = `<section class="hero"><h1>Мемкоины Solana <span>в одном месте</span></h1><p>Находите монеты, смотрите графики и меняйте SOL на монету за пару касаний. Ключи остаются в вашем кошельке.</p></section>
        <div class="tools"><label class="search"><span class="sr">Поиск монеты</span><input id="q" type="search" placeholder="Название или тикер" autocomplete="off" value="${esc(q)}"></label>
        <div class="chips" role="tablist" aria-label="Сортировка">${FILTERS.map(([k, n]) => `<button class="chip ${k === filter ? 'on' : ''}" role="tab" aria-selected="${k === filter}" data-f="${k}">${n}</button>`).join('')}</div></div>
        <div class="list" id="list" aria-live="off"></div>`;
      el.querySelector('#q').addEventListener('input', e => { q = e.target.value; fill(); });
      el.querySelectorAll('.chip').forEach(c => c.onclick = () => { filter = c.dataset.f; el.querySelectorAll('.chip').forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-selected', x === c); }); fill(); });
      await fill();
    },
    /** На тике меняем только цифры в готовых строках: список не перерисовывается, поэтому нажатия не теряются. */
    async onTick() { if (!root) return; for (const a of root.querySelectorAll('#list a.row[data-id]')) { const t = await MB.data.get(a.dataset.id).catch(() => null); if (!t || !root) continue; a.querySelector('.p').textContent = price(t.price); a.querySelector('.c').innerHTML = MB.ui.chg(t.chg24); } },
    unmount() { root = null; },
  };
})();
