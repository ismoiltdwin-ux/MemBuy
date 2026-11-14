/* Реклама. Демо: кампании хранятся в браузере, оплата не списывается. Живой режим: объявления из блокчейна — см. adchain.js. */
MB.ads = (() => {
  const S = MB.store;
  const PLACEMENTS = { feed: { name: 'В ленте', day: 5 }, market: { name: 'В списке монет', day: 8 } };
  const house = [
    { id: 'h1', title: 'Исмоил FX — курс Форекс', text: '15 уроков на таджикском: от первой свечи до плана торговли.', link: '', placement: 'any', house: true },
    { id: 'h2', title: 'Здесь может быть ваша реклама', text: 'Покажите свой проект трейдерам Membuy. От $5 в день.', link: '#ads', placement: 'any', house: true },
  ];
  const active = pl => S.get().campaigns.filter(c => c.status === 'active' && c.placement === pl && c.until > Date.now());
  const safe = url => /^https:\/\/[^\s"'<>]+$/i.test(url);
  return {
    PLACEMENTS, safe,
    /** Объявление для места показа; n — порядковый номер слота (для чередования). */
    pick(pl, n = 0) {
      if (!MB.config.LIVE) { const pool = [...active(pl), ...house]; return pool[n % pool.length]; }
      // Живой режим: оплаченные и одобренные объявления из блокчейна, затем свои; меняются раз в минуту.
      const paid = MB.adchain.active().map(a => ({ id: a.id, title: a.title, text: a.text, link: a.link })), own = house.filter(a => !a.link.startsWith('#') || (a.link === '#ads' && MB.adchain.enabled()));
      const pool = paid.length ? paid : own; return pool[(n + Math.floor(Date.now() / 60000)) % pool.length];
    },
    card(ad) {
      const { esc } = MB.util; S.update(s => { const a = s.adStats[ad.id] = s.adStats[ad.id] || { views: 0, clicks: 0 }; a.views++; }, true);
      const inner = `<span class="adtag">Реклама</span><span class="nm"><b>${esc(ad.title)}</b><small>${esc(ad.text)}</small></span>`;
      if (!ad.link) return `<div class="row ad">${inner}</div>`;
      const ext = !ad.link.startsWith('#');
      return `<a class="row ad" data-ad="${esc(ad.id)}" href="${esc(ad.link)}" ${ext ? 'target="_blank" rel="noopener sponsored"' : ''}>${inner}<span class="pr"><b>→</b></span></a>`;
    },
    click(id) { S.update(s => { const a = s.adStats[id] = s.adStats[id] || { views: 0, clicks: 0 }; a.clicks++; }, true); },
    price(pl, days) { return (PLACEMENTS[pl] ? PLACEMENTS[pl].day : 0) * days; },
    create({ title, text, link, placement, days }) {
      title = title.trim(); text = text.trim(); link = link.trim(); days = Math.round(+days);
      if (title.length < 3 || title.length > 40) throw new Error('Заголовок: от 3 до 40 знаков');
      if (text.length < 5 || text.length > 90) throw new Error('Текст: от 5 до 90 знаков');
      if (!safe(link)) throw new Error('Ссылка должна начинаться с https://');
      if (!PLACEMENTS[placement]) throw new Error('Выберите место показа');
      if (!(days >= 1 && days <= 30)) throw new Error('Срок: от 1 до 30 дней');
      const c = { id: 'c' + Date.now(), title, text, link, placement, days, total: this.price(placement, days), status: 'active', ts: Date.now(), until: Date.now() + days * 864e5 };
      S.update(s => { s.campaigns.unshift(c); }); S.note('Кампания «' + title + '» запущена'); return c;
    },
    toggle(id) { S.update(s => { const c = s.campaigns.find(x => x.id === id); if (c) c.status = c.status === 'active' ? 'paused' : 'active'; }); },
    remove(id) { S.update(s => { s.campaigns = s.campaigns.filter(c => c.id !== id); }); },
    income() { return S.get().campaigns.reduce((a, c) => a + c.total, 0); },
  };
})();
