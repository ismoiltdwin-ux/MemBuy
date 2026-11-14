/* Живой поставщик: DexScreener (список, цены) + GeckoTerminal (история цены). Сеть Solana.
   ВНИМАНИЕ: написан по публичной документации API и не проверен в боевом режиме. */
MB.providers = MB.providers || {};
MB.providers.live = (() => {
  const TF = { '15s': ['second', 15], '1m': ['minute', 1], '5m': ['minute', 5], '15m': ['minute', 15], '1h': ['hour', 1], '4h': ['hour', 4], '1d': ['day', 1] };
  const C = MB.config, cache = new Map(); let timer = null, solUsd = 0;
  const j = async url => { const r = await fetch(url); if (!r.ok) throw new Error('Сеть: ' + r.status); return r.json(); };
  const fromPair = p => ({
    id: p.baseToken.address, sym: p.baseToken.symbol, name: p.baseToken.name, desc: '', mint: p.baseToken.address, pool: p.pairAddress,
    price: +p.priceUsd || 0, mc: p.marketCap || p.fdv || 0, supply: (p.marketCap || p.fdv || 0) / (+p.priceUsd || 1), vol24: (p.volume && p.volume.h24) || 0,
    chg24: (p.priceChange && p.priceChange.h24) || 0, ageDays: p.pairCreatedAt ? (Date.now() - p.pairCreatedAt) / 864e5 : 0, holders: null,
    liquidityUsd: (p.liquidity && p.liquidity.usd) || 0, hue: parseInt(p.baseToken.address.slice(0, 3), 36) % 360, series: [], icon: p.info && p.info.imageUrl,
  });
  const best = pairs => (pairs || []).filter(p => p.chainId === 'solana').sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0))[0];
  const sorters = { trend: (a, b) => b.vol24 - a.vol24, fresh: (a, b) => a.ageDays - b.ageDays, gain: (a, b) => b.chg24 - a.chg24, vol: (a, b) => b.vol24 - a.vol24 };
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
      else out = await trending();
      out.forEach(t => cache.set(t.id, t)); if (filter === 'fav') { const fav = MB.store.get().fav; out = out.filter(t => fav.includes(t.id)); }
      return out.sort(sorters[filter] || sorters.trend);
    },
    async get(id) { const d = await j(C.DEX_API + '/latest/dex/tokens/' + id); const p = best(d.pairs); if (!p) return cache.get(id) || null; const t = fromPair(p); cache.set(id, t); return t; },
    /** Свечи GeckoTerminal (до 300 штук, старые → новые). tf: 15s, 1m, 5m, 15m, 1h, 4h, 1d. */
    async candles(id, tf) {
      const t = cache.get(id) || await this.get(id); if (!t || !t.pool) return [];
      const [unit, agg] = TF[tf] || TF['5m'];
      const d = await j(`${C.GECKO_API}/networks/solana/pools/${t.pool}/ohlcv/${unit}?aggregate=${agg}&limit=300`);
      return ((d.data && d.data.attributes && d.data.attributes.ohlcv_list) || []).map(c => ({ t: c[0], o: +c[1], h: +c[2], l: +c[3], c: +c[4] })).sort((x, y) => x.t - y.t);
    },
    async series(id, tf) { return (await this.candles(id, tf)).map(c => c.c); },
    async solUsd() { if (solUsd) return solUsd; const d = await j(C.DEX_API + '/latest/dex/tokens/' + C.SOL_MINT); const p = best(d.pairs); solUsd = p ? +p.priceUsd : 0; return solUsd; },
  };
})();
