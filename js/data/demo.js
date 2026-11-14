/* Демо-поставщик данных: выдуманные монеты, цены двигаются случайно. Интерфейс тот же, что у live.js. */
MB.providers = MB.providers || {};
MB.providers.demo = (() => {
  const TFS = { '15s': 15, '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
  const raw = [
    ['PLOV', 'Plov Inu', 0.00042, 4.2e6, 38, 2, 'Пёс, который охраняет казан. Монета сообщества любителей плова.'],
    ['SAMSA', 'Samsa Cat', 0.0000081, 8.1e5, 12, 1, 'Кот, который ворует самсу прямо из тандыра.'],
    ['YAK', 'Pamir Yak', 0.0127, 1.27e7, 5, 41, 'Самый спокойный як Памира. Держит и не продаёт.'],
    ['CHAI', 'Chai Frog', 0.00000312, 3.1e5, 96, 0, 'Лягушка из чайханы. Пьёт зелёный чай и не торопится.'],
    ['LAGMAN', 'Lagman Dragon', 0.00191, 1.9e6, -14, 9, 'Дракон длиной в одну лапшу.'],
    ['KURUT', 'Kurut Ball', 0.000064, 6.4e5, -31, 3, 'Маленький, солёный, твёрдый. Как рынок.'],
    ['TILLA', 'Tilla', 0.0000231, 2.3e5, 210, 0, 'Обезьянка, которая нашла первый самородок. «Тилло» — золото.'],
    ['OSH', 'Osh Bear', 0.0052, 5.2e6, 7, 17, 'Медведь, который знает, где лучший ош.'],
    ['NAVRUZ', 'Navruz Sprout', 0.00078, 7.8e5, 64, 4, 'Росток сумалака. Растёт раз в год, зато сильно.'],
    ['DUTAR', 'Dutar Monkey', 0.000118, 1.18e6, -6, 6, 'Играет на дутаре, пока график падает.'],
    ['KOK', 'Kok Chai Whale', 0.0331, 3.3e7, 2, 88, 'Кит, который пьёт только кок-чай.'],
    ['SOMSA', 'Mini Somsa', 0.00000094, 9.4e4, -52, 1, 'Младший брат Samsa Cat. Очень маленький.'],
  ];
  const tokens = raw.map(([sym, name, price, mc, chg, ageDays, desc], k) => {
    const r = MB.util.rng(1000 + k * 77), n = 168, series = []; let p = price / (1 + chg / 100);
    for (let i = 0; i < n; i++) { const drift = (price - p) / (n - i) * 0.9; p = Math.max(price * 0.05, p + drift + (r() - 0.5) * price * 0.06); series.push(p); }
    series[n - 1] = price;
    return { id: sym, sym, name, desc, mint: 'DEMO' + sym, price, mc, supply: mc / price, vol24: mc * (0.08 + r() * 0.5), chg24: chg, ageDays, holders: Math.round(200 + r() * mc / 900), liquidityUsd: mc * 0.12, hue: Math.round(r() * 360), series };
  });
  /** Собирает монету, созданную пользователем в демо-режиме. */
  const build = c => { const price = 0.000004, n = 168, rr = MB.util.rng(c.seed), series = []; for (let i = 0; i < n; i++) series.push(price * (0.97 + rr() * 0.06)); series[n - 1] = price;
    return { id: c.sym, sym: c.sym, name: c.name, desc: c.desc, mint: 'DEMO' + c.sym, price, mc: 4000, supply: 1e9, vol24: 600, chg24: 0, ageDays: (Date.now() - c.ts) / 864e5, holders: 1, liquidityUsd: 2400, hue: c.seed % 360, series, icon: c.icon, mine: true, links: c.links }; };
  MB.store.get().coins.forEach(c => tokens.push(build(c)));
  /** Подробности как в pump.fun: изменения за 5 мин / 1 ч / 6 ч, сделки за сутки, площадка (до $1 млн — «кривая» pump.fun, дальше — биржа). */
  const enrich = t => { const s = t.series, n = s.length, ch = k => (t.price / s[Math.max(0, n - 1 - k)] - 1) * 100; t.chg5m = ch(1); t.chg1h = ch(2); t.chg6h = ch(6);
    const tx = Math.round(t.vol24 / 85); t.buys24 = Math.round(tx * 0.56); t.sells24 = tx - t.buys24; t.dex = t.mc < 1e6 ? 'pumpfun' : 'pumpswap'; t.pump = true; t.socials = t.socials || []; return t; };
  tokens.forEach(enrich);
  const r = MB.util.rng(42); let timer = null;
  const tick = () => {
    tokens.forEach(t => {
      const step = (r() - 0.49) * 0.018; t.price = Math.max(t.price * 0.2, t.price * (1 + step));
      t.series.push(t.price); t.series.shift(); t.mc = t.price * t.supply; t.chg24 = (t.price / t.series[t.series.length - 25] - 1) * 100; enrich(t);
    });
    MB.util.bus.emit('tick');
  };
  const sorters = { fav: (a, b) => b.vol24 - a.vol24, trend: (a, b) => b.vol24 / b.mc - a.vol24 / a.mc, fresh: (a, b) => a.ageDays - b.ageDays, soon: (a, b) => b.mc - a.mc, graduated: (a, b) => b.vol24 - a.vol24, gain: (a, b) => b.chg24 - a.chg24, vol: (a, b) => b.vol24 - a.vol24 };
  return {
    start() { if (!timer) timer = setInterval(tick, 2500); },
    async list(filter = 'trend', q = '') { const s = q.trim().toLowerCase(), fav = MB.store.get().fav; return tokens.filter(t => filter !== 'fav' || fav.includes(t.id)).filter(t => filter !== 'soon' || t.dex === 'pumpfun').filter(t => filter !== 'graduated' || t.dex !== 'pumpfun').filter(t => !s || t.sym.toLowerCase().includes(s) || t.name.toLowerCase().includes(s)).sort(sorters[filter] || sorters.trend); },
    async get(id) { return tokens.find(t => t.id === id) || null; },
    /** Учебные свечи для любого таймфрейма: детерминированное случайное блуждание, которое заканчивается текущей ценой. */
    async candles(id, tf) {
      const t = tokens.find(x => x.id === id); if (!t) return []; const sec = TFS[tf] || 300, n = 240, r = MB.util.rng(t.hue * 7919 + sec), vol = 0.004 * Math.sqrt(sec / 60), now = Math.floor(Date.now() / 1000 / sec) * sec;
      const out = []; let c = t.price;
      for (let i = 0; i < n; i++) { const o = i === 0 ? c : c / (1 + (r() - 0.5) * 2 * vol + (r() - 0.48) * vol * 0.3), w = Math.abs(c - o) * 0.5 + c * vol * r(); out.push({ t: now - i * sec, o, c, h: Math.max(o, c) + w * r(), l: Math.max(c * 0.01, Math.min(o, c) - w * r()) }); c = o; }
      out.reverse(); const lastC = out[n - 1]; lastC.o = out[n - 2].c; lastC.h = Math.max(lastC.h, lastC.o, lastC.c); lastC.l = Math.min(lastC.l, lastC.o, lastC.c);
      return out;
    },
    async series(id, tf) { const t = tokens.find(x => x.id === id); if (!t) return []; return tf ? (await this.candles(id, tf)).map(c => c.c) : t.series; },
    /** Учебные сделки и держатели: выдуманные, но правдоподобные (кошельки-заглушки). */
    async trades(id) { const t = tokens.find(x => x.id === id); if (!t) return []; const now = Math.floor(Date.now() / 1000), r = MB.util.rng(t.hue + Math.floor(now / 30)), out = [];
      for (let i = 0; i < 25; i++) { const usd = Math.round(5 + r() * r() * 900), side = r() > 0.45 ? 'buy' : 'sell'; out.push({ ts: now - i * Math.round(20 + r() * 120), side, usd, tokens: usd / t.price, who: 'Demo' + Math.floor(r() * 1e9).toString(36) + 'Wallet', tx: '' }); }
      return out; },
    async holders(id) { const t = tokens.find(x => x.id === id); if (!t) return []; const r = MB.util.rng(t.hue * 13); let left = 100; const out = [{ who: 'pump.fun кривая / пул', pct: 0 }];
      for (let i = 0; i < 19; i++) { const p = Math.max(0.1, left * (0.04 + r() * 0.08)); left -= p; out.push({ who: 'Demo' + Math.floor(r() * 1e9).toString(36) + 'Holder', pct: p }); }
      out[0].pct = Math.max(5, left * 0.6); out.sort((a, b) => b.pct - a.pct); out.forEach(h => { h.qty = h.pct / 100 * t.supply; }); return out; },
    solUsd: async () => MB.config.SOL_USD_DEMO,
    has: sym => tokens.some(t => t.sym.toLowerCase() === sym.toLowerCase()),
    add(c) { const t = enrich(build(c)); tokens.push(t); return t; },
    all: () => tokens,
  };
})();
