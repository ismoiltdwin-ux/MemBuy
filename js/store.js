/* Состояние приложения: кошелёк, позиции, история. В демо хранится в localStorage этого браузера. */
MB.store = (() => {
  const KEY = MB.config.MODE === 'live' ? 'membuy-live-v1' : 'membuy-demo-v1';
  const fresh = () => ({
    wallet: { connected: false, address: '', sol: 0 }, holdings: {}, trades: [], slippageBps: MB.config.DEFAULT_SLIPPAGE_BPS,
    profile: { name: 'trader' + Math.floor(1000 + Math.random() * 9000), bio: '', avatar: '' }, following: [], liked: [], myPosts: [], squad: null,
    campaigns: [], adStats: {}, coins: [], recent: [], notes: [], unread: 0, equity: [], notify: true, fav: [], chartType: 'line',
  });
  let state = fresh();
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.wallet) state = Object.assign(fresh(), s); if (MB.config.MODE === 'live') state.wallet = { connected: false, address: '', sol: 0 }; } catch (e) { /* хранилище недоступно — работаем в памяти */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* игнорируем */ } };
  return {
    get: () => state,
    set(patch) { Object.assign(state, patch); save(); MB.util.bus.emit('state', state); },
    reset() { state = fresh(); save(); MB.util.bus.emit('state', state); },
    /** Меняет состояние функцией и сохраняет. silent=true — без перерисовки экранов. */
    update(fn, silent) { fn(state); save(); if (!silent) MB.util.bus.emit('state', state); },
    note(text) { if (!state.notify) return; state.notes.unshift({ text, ts: Date.now() }); state.notes = state.notes.slice(0, 30); state.unread++; save(); },
    /** Записывает исполненную сделку и обновляет позицию по средней цене. */
    applyTrade(t) {
      const h = state.holdings[t.id] || { qty: 0, costUsd: 0, sym: t.sym, name: t.name };
      if (t.side === 'buy') { h.qty += t.tokens; h.costUsd += t.usd; state.wallet.sol -= t.sol; }
      else { const part = Math.min(1, t.tokens / h.qty); h.costUsd -= h.costUsd * part; h.qty -= t.tokens; state.wallet.sol += t.sol; }
      if (h.qty <= 1e-9) delete state.holdings[t.id]; else state.holdings[t.id] = h;
      state.trades.unshift(t); state.trades = state.trades.slice(0, 100); this.note((t.side === 'buy' ? 'Куплено ' : 'Продано ') + MB.util.num(t.tokens, 2) + ' ' + t.sym); save(); MB.util.bus.emit('state', state);
    },
  };
})();
