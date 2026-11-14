/* Демо-поставщик данных: выдуманные монеты, цены двигаются случайно. Интерфейс тот же, что у live.js. */
MB.providers = MB.providers || {};
MB.providers.demo = (() => {
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
  const r = MB.util.rng(42); let timer = null;
  const tick = () => {
    tokens.forEach(t => {
      const step = (r() - 0.49) * 0.018; t.price = Math.max(t.price * 0.2, t.price * (1 + step));
      t.series.push(t.price); t.series.shift(); t.mc = t.price * t.supply; t.chg24 = (t.price / t.series[t.series.length - 25] - 1) * 100;
    });
    MB.util.bus.emit('tick');
  };
  const sorters = { fav: (a, b) => b.vol24 - a.vol24, trend: (a, b) => b.vol24 / b.mc - a.vol24 / a.mc, fresh: (a, b) => a.ageDays - b.ageDays, gain: (a, b) => b.chg24 - a.chg24, vol: (a, b) => b.vol24 - a.vol24 };
  return {
    start() { if (!timer) timer = setInterval(tick, 2500); },
    async list(filter = 'trend', q = '') { const s = q.trim().toLowerCase(), fav = MB.store.get().fav; return tokens.filter(t => filter !== 'fav' || fav.includes(t.id)).filter(t => !s || t.sym.toLowerCase().includes(s) || t.name.toLowerCase().includes(s)).sort(sorters[filter] || sorters.trend); },
    async get(id) { return tokens.find(t => t.id === id) || null; },
    async series(id, tf) { const t = tokens.find(x => x.id === id); if (!t) return []; return tf === '1h' ? t.series.slice(-24) : tf === '1d' ? t.series.slice(-72) : t.series; },
    /** Свечи из ряда цен: tf 1h — по 1 точке на свечу, 1d — по 2, 1w — по 4. Тени детерминированы номером свечи. */
    async candles(id, tf) {
      const t = tokens.find(x => x.id === id); if (!t) return []; const g = tf === '1h' ? 1 : tf === '1d' ? 2 : 4, n = tf === '1h' ? 24 : tf === '1d' ? 72 : 168, s = t.series.slice(-n - 1), out = [];
      for (let i = 1; i < s.length; i += g) { const part = s.slice(i, i + g), o = s[i - 1], c = part[part.length - 1], rr = MB.util.rng(t.hue * 1000 + i + s.length), w = Math.abs(c - o) * 0.6 + c * 0.004; out.push({ o, c, h: Math.max(o, c, ...part) + rr() * w, l: Math.max(c * 0.01, Math.min(o, c, ...part) - rr() * w) }); }
      return out;
    },
    solUsd: async () => MB.config.SOL_USD_DEMO,
    has: sym => tokens.some(t => t.sym.toLowerCase() === sym.toLowerCase()),
    add(c) { const t = build(c); tokens.push(t); return t; },
    all: () => tokens,
  };
})();
