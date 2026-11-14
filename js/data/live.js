/* Живой поставщик: DexScreener (список, цены) + GeckoTerminal (история цены). Сеть Solana.
   ВНИМАНИЕ: написан по публичной документации API и не проверен в боевом режиме. */
MB.providers = MB.providers || {};
MB.providers.live = (() => {
  const TF = { '15s': ['second', 15], '1m': ['minute', 1], '5m': ['minute', 5], '15m': ['minute', 15], '1h': ['hour', 1], '4h': ['hour', 4], '1d': ['day', 1] };
  const C = MB.config, cache = new Map(); let timer = null, solUsd = 0, solTs = 0;
  const j = async url => { const r = await fetch(url); if (!r.ok) throw new Error('Сеть: ' + r.status); return r.json(); };
  const fromPair = p => ({
    id: p.baseToken.address, sym: p.baseToken.symbol, name: p.baseToken.name, desc: '', mint: p.baseToken.address, pool: p.pairAddress,
    price: +p.priceUsd || 0, mc: p.marketCap || p.fdv || 0, supply: (p.marketCap || p.fdv || 0) / (+p.priceUsd || 1), vol24: (p.volume && p.volume.h24) || 0,
    chg24: (p.priceChange && p.priceChange.h24) || 0, ageDays: p.pairCreatedAt ? (Date.now() - p.pairCreatedAt) / 864e5 : 0, holders: null,
    liquidityUsd: (p.liquidity && p.liquidity.usd) || 0, hue: parseInt(p.baseToken.address.slice(0, 3), 36) % 360, series: [], icon: p.info && p.info.imageUrl,
    // Подробности для строки и страницы монеты (как в pump.fun): изменения за 5 мин / 1 ч / 6 ч, сделки за сутки, площадка.
    chg5m: (p.priceChange && p.priceChange.m5) || 0, chg1h: (p.priceChange && p.priceChange.h1) || 0, chg6h: (p.priceChange && p.priceChange.h6) || 0,
    buys24: (p.txns && p.txns.h24 && p.txns.h24.buys) || 0, sells24: (p.txns && p.txns.h24 && p.txns.h24.sells) || 0, vol1h: (p.volume && p.volume.h1) || 0,
    dex: p.dexId || '', pump: /pump$/.test(p.baseToken.address),
    socials: [...((p.info && p.info.websites) || []).map(w => ({ type: 'website', url: w.url })), ...((p.info && p.info.socials) || []).map(s => ({ type: s.type, url: s.url }))].filter(l => l && typeof l.url === 'string' && /^https:\/\//.test(l.url)).slice(0, 4),
  });
  const group = pairs => { const by = {}; (pairs || []).filter(p => p.chainId === 'solana').forEach(p => { (by[p.baseToken.address] = by[p.baseToken.address] || []).push(p); }); return Object.values(by).map(best).filter(Boolean).map(fromPair); };
  /** Пары для списка монет (до 30 за запрос — ограничение DexScreener). */
  const byMints = async mints => { const out = []; for (let i = 0; i < mints.length; i += 30) { const d = await j(C.DEX_API + '/latest/dex/tokens/' + mints.slice(i, i + 30).join(',')); out.push(...group(d.pairs)); } return out; };
  /** Новые монеты: последние профили токенов на DexScreener. */
  async function fresh() { const prof = await j(C.DEX_API + '/token-profiles/latest/v1'); return byMints([...new Set((prof || []).filter(x => x.chainId === 'solana').map(x => x.tokenAddress))].slice(0, 30)); }
  let poolCache = null, poolTs = 0; const tradeCache = new Map();
  /** Сделки из GeckoTerminal (до 300, новые первыми); запоминаются на 10 с, чтобы вкладка «Сделки» и свечи 15 с не делали лишних запросов. */
  async function rawTrades(self, id) {
    const hit = tradeCache.get(id); if (hit && Date.now() - hit.at < 10000) return hit.list;
    const t = cache.get(id) || await self.get(id); if (!t || !t.pool) return [];
    const d = await j(`${C.GECKO_API}/networks/solana/pools/${t.pool}/trades`);
    const list = ((d && d.data) || []).map(x => x.attributes || {}).filter(a => !a.is_anomalous).map(a => { const sell = a.kind === 'sell';
      return { ts: Date.parse(a.block_timestamp) / 1000 || 0, side: sell ? 'sell' : 'buy', usd: +a.volume_in_usd || 0, tokens: +(sell ? a.from_token_amount : a.to_token_amount) || 0,
        price: +(sell ? a.price_from_in_usd : a.price_to_in_usd) || 0, who: String(a.tx_from_address || ''), tx: String(a.tx_hash || '') }; });
    tradeCache.set(id, { at: Date.now(), list }); return list;
  }
  /** Общий набор монет (в тренде + новые) для фильтров «Скоро на бирже» и «На бирже». */
  async function pool() { if (poolCache && Date.now() - poolTs < 15000) return poolCache; const [a, b] = await Promise.all([trending().catch(() => []), fresh().catch(() => [])]); const m = new Map(); [...a, ...b].forEach(t => m.set(t.id, t)); poolCache = [...m.values()]; poolTs = Date.now(); return poolCache; }
  const best = pairs => (pairs || []).filter(p => p.chainId === 'solana').sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0))[0];
  const sorters = { trend: (a, b) => b.vol24 - a.vol24, fresh: (a, b) => a.ageDays - b.ageDays, soon: (a, b) => b.mc - a.mc, graduated: (a, b) => b.vol24 - a.vol24, gain: (a, b) => b.chg24 - a.chg24, vol: (a, b) => b.vol24 - a.vol24 };
  async function trending() {
    const boosts = await j(C.DEX_API + '/token-boosts/top/v1');
    const mints = [...new Set(boosts.filter(b => b.chainId === 'solana').map(b => b.tokenAddress))].slice(0, 30);
    if (!mints.length) return [];
    const d = await j(C.DEX_API + '/latest/dex/tokens/' + mints.join(','));
    const by = {}; (d.pairs || []).forEach(p => { (by[p.baseToken.address] = by[p.baseToken.address] || []).push(p); });
    return Object.values(by).map(best).filter(Boolean).map(fromPair);
  }
  return {
    start() { if (!timer) timer = setInterval(() => MB.util.bus.emit('refresh'), 15000); },
    async list(filter = 'trend', q = '') {
      let out;
      if (q.trim()) { const d = await j(C.DEX_API + '/latest/dex/search?q=' + encodeURIComponent(q.trim())); const by = {}; (d.pairs || []).filter(p => p.chainId === 'solana').forEach(p => { (by[p.baseToken.address] = by[p.baseToken.address] || []).push(p); }); out = Object.values(by).map(best).map(fromPair); }
      else if (filter === 'fresh') out = await fresh();
      // pump.fun: монета сначала торгуется на «кривой» pump.fun (площадка pumpfun), а набрав капитализацию — выходит на биржу (PumpSwap / Raydium).
      else if (filter === 'soon') out = (await pool()).filter(t => t.dex === 'pumpfun');
      else if (filter === 'graduated') out = (await pool()).filter(t => t.pump && t.dex !== 'pumpfun');
      else out = await trending();
      out.forEach(t => cache.set(t.id, t)); if (filter === 'fav') { const fav = MB.store.get().fav; out = out.filter(t => fav.includes(t.id)); }
      return out.sort(sorters[filter] || sorters.trend);
    },
    /** Обновить сразу несколько монет одним запросом (для строк списка). */
    async many(ids) { const ts = await byMints(ids); ts.forEach(t => cache.set(t.id, t)); return ts; },
    async get(id) { const d = await j(C.DEX_API + '/latest/dex/tokens/' + id); const p = best(d.pairs); if (!p) return cache.get(id) || null; const t = fromPair(p); cache.set(id, t); return t; },
    /** Свечи GeckoTerminal (до 300 штук, старые → новые). tf: 15s, 1m, 5m, 15m, 1h, 4h, 1d. */
    async candles(id, tf) {
      const t = cache.get(id) || await this.get(id); if (!t || !t.pool) return [];
      // Секундные свечи у GeckoTerminal платные — собираем 15-секундные сами из последних 300 сделок (≈ последние минуты торгов).
      if (tf === '15s') { const tr = (await rawTrades(this, id)).filter(x => x.price > 0).sort((a, b) => a.ts - b.ts), out = [];
        for (const x of tr) { const b = Math.floor(x.ts / 15) * 15, c = out[out.length - 1]; if (c && c.t === b) { c.h = Math.max(c.h, x.price); c.l = Math.min(c.l, x.price); c.c = x.price; } else out.push({ t: b, o: c ? c.c : x.price, h: Math.max(x.price, c ? c.c : x.price), l: Math.min(x.price, c ? c.c : x.price), c: x.price }); }
        return out; }
      const [unit, agg] = TF[tf] || TF['5m'];
      const d = await j(`${C.GECKO_API}/networks/solana/pools/${t.pool}/ohlcv/${unit}?aggregate=${agg}&limit=300`);
      return ((d.data && d.data.attributes && d.data.attributes.ohlcv_list) || []).map(c => ({ t: c[0], o: +c[1], h: +c[2], l: +c[3], c: +c[4] })).sort((x, y) => x.t - y.t);
    },
    /** Последние сделки по монете (GeckoTerminal): покупка/продажа, сумма в $, цена, кошелёк, время. */
    async trades(id) { return (await rawTrades(this, id)).slice(0, 50); },
    /** Крупнейшие держатели (узел Solana): до 20 счетов и их доля от всех монет. Первым обычно стоит пул ликвидности или кривая pump.fun. */
    async holders(id) {
      const t = cache.get(id) || await this.get(id); if (!t) return [];
      const [sup, big] = await Promise.all([MB.wallet.rpc('getTokenSupply', [t.mint]), MB.wallet.rpc('getTokenLargestAccounts', [t.mint])]);
      const total = +(sup && sup.value && sup.value.uiAmount) || 0; if (!total) return [];
      return ((big && big.value) || []).map(a => ({ who: String(a.address), qty: +a.uiAmount || 0, pct: (+a.uiAmount || 0) / total * 100 }));
    },
    async series(id, tf) { return (await this.candles(id, tf)).map(c => c.c); },
    async solUsd() { if (solUsd && Date.now() - solTs < 60000) return solUsd; /* цена SOL обновляется раз в минуту */ const d = await j(C.DEX_API + '/latest/dex/tokens/' + C.SOL_MINT); const p = best(d.pairs); solUsd = p ? +p.priceUsd : solUsd; solTs = Date.now(); return solUsd; },
  };
})();
