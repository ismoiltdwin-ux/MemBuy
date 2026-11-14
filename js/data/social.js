/* Соцсеть (демо): трейдеры, посты, подписки, рейтинги, отряды. Всё хранится в браузере.
   Для настоящей соцсети нужен сервер: этот модуль — единственное место, которое придётся заменить. */
MB.social = (() => {
  const S = MB.store, R = MB.util.rng(7);
  const names = ['pamir_whale', 'choyxona_dev', 'samsa_sniper', 'navruz_bull', 'kok_trader', 'dutar_degen', 'oshpaz', 'tilla_hunter', 'yak_holder', 'lagman_long', 'kurut_king', 'plov_master'];
  const users = names.map((name, k) => ({ name, hue: (k * 47) % 360, followers: Math.round(40 + R() * 4000), pnl: { d: Math.round((R() - 0.25) * 9000), w: Math.round((R() - 0.2) * 42000), m: Math.round((R() - 0.15) * 160000) } }));
  const texts = [['PLOV', 'Держу и не дёргаюсь. Казан большой, всем хватит.'], ['TILLA', 'Нашёл рано. Посмотрим, куда дойдёт.'], ['YAK', 'Спокойная монета для спокойных людей.'], ['CHAI', 'Зашёл маленькой суммой. Объём растёт.'], ['NAVRUZ', 'Сезонная история, но график красивый.'], ['SAMSA', 'Вышел наполовину, остальное оставил.'], ['LAGMAN', 'Ошибся со входом. Фиксирую убыток и иду дальше.'], ['OSH', 'Самый честный график на рынке за неделю.'], ['KOK', 'Кит не спит. Ликвидность хорошая.'], ['DUTAR', 'Музыка играет, график падает. Жду.']];
  const now = Date.now(); let seq = 1;
  const posts = texts.map(([coin, text], k) => { const pos = Math.round(30 + R() * 4000), pnl = Math.round((R() - 0.3) * pos * 1.4); return { id: 'p' + seq++, kind: 'post', user: names[k % names.length], text, coin, posUsd: pos, pnlUsd: pnl, likes: Math.round(R() * 60), views: Math.round(200 + R() * 9000), ts: now - (k * 37 + 4) * 6e4 }; });
  const user = n => users.find(u => u.name === n) || { name: n, hue: 200, followers: 0, pnl: { d: 0, w: 0, m: 0 } };
  const me = () => S.get().profile.name;
  let timer = null;
  function activity() {
    const toks = MB.providers.demo.all(), t = toks[Math.floor(R() * toks.length)], u = names[Math.floor(R() * names.length)];
    posts.unshift({ id: 'p' + seq++, kind: 'trade', user: u, coin: t.id, side: R() > 0.3 ? 'buy' : 'sell', usd: Math.round(20 + R() * 900), mc: t.mc, ts: Date.now() });
    if (posts.length > 60) posts.pop(); MB.util.bus.emit('social');
  }
  const squads = [['Памирцы', 14, 26790], ['Чайхана', 9, 21300], ['Тандыр', 16, 18400], ['Навруз', 4, 9800], ['Дутар', 11, 5200]].map(([name, members, pnl]) => ({ name, members, pnl }));
  return {
    start() { if (!timer && MB.config.MODE === 'demo') timer = setInterval(activity, 20000); },
    user, me,
    feed(tab) {
      const st = S.get(), all = [...st.myPosts, ...posts].sort((a, b) => b.ts - a.ts);
      if (tab === 'following') return all.filter(p => st.following.includes(p.user) || p.user === me());
      if (tab === 'top') return all.filter(p => p.kind === 'post').sort((a, b) => (b.likes + (st.liked.includes(b.id) ? 1 : 0)) - (a.likes + (st.liked.includes(a.id) ? 1 : 0)));
      return all;
    },
    like(id) { S.update(s => { const i = s.liked.indexOf(id); if (i >= 0) s.liked.splice(i, 1); else s.liked.push(id); }); },
    follow(name) { S.update(s => { const i = s.following.indexOf(name); if (i >= 0) s.following.splice(i, 1); else { s.following.push(name); } }); },
    publish(text, coin) { const t = text.trim(); if (!t) throw new Error('Напишите текст поста'); if (t.length > 280) throw new Error('Пост длиннее 280 знаков');
      S.update(s => { s.myPosts.unshift({ id: 'm' + Date.now(), kind: 'post', user: s.profile.name, text: t, coin: coin || null, likes: 0, views: 1, ts: Date.now(), mine: true }); s.myPosts = s.myPosts.slice(0, 50); }); },
    remove(id) { S.update(s => { s.myPosts = s.myPosts.filter(p => p.id !== id); }); },
    /** Рейтинг трейдеров за период d | w | m; myPnl — результат пользователя в долларах. */
    leaders(period, myPnl) { const st = S.get(), rows = users.map(u => ({ name: u.name, hue: u.hue, pnl: u.pnl[period] })); if (st.wallet.connected) rows.push({ name: me(), hue: 40, pnl: Math.round(myPnl), me: true }); return rows.sort((a, b) => b.pnl - a.pnl).map((r, i) => Object.assign(r, { rank: i + 1 })); },
    squads() { const st = S.get(), rows = squads.slice(); if (st.squad) rows.push({ name: st.squad, members: 1, pnl: 0, mine: true }); return rows.sort((a, b) => b.pnl - a.pnl); },
    createSquad(name) { const n = name.trim(); if (n.length < 3 || n.length > 20) throw new Error('Название отряда: от 3 до 20 знаков'); S.update(s => { s.squad = n; }); },
  };
})();
