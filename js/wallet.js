/* Кошелёк. Демо: учебный кошелёк с условными SOL. Live: Phantom (ключи остаются у пользователя). */
MB.wallet = (() => {
  const C = MB.config, S = MB.store;
  const rpc = async (method, params) => { const r = await fetch(C.RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }); const d = await r.json(); if (d.error) throw new Error(d.error.message); return d.result; };
  const provider = () => (window.phantom && window.phantom.solana) || (window.solana && window.solana.isPhantom ? window.solana : null);
  return {
    rpc, provider,
    async connect() {
      if (C.MODE === 'demo') { const st = S.get(); S.set({ wallet: { connected: true, address: 'Demo' + 'MB7xQ2kLp9aVn3TzR4', sol: st.wallet.sol || C.DEMO_START_SOL } }); return; }
      const p = provider(); if (!p) throw new Error('Кошелёк Phantom не найден. Установите Phantom и откройте сайт в его браузере.');
      const res = await p.connect(); const address = res.publicKey.toString();
      S.set({ wallet: { connected: true, address, sol: 0 } }); await this.refresh();
    },
    /** Живой режим: читает из сети баланс SOL и монет кошелька (обе программы токенов Solana). */
    async refresh() {
      if (C.MODE === 'demo') return; const w = S.get().wallet; if (!w.connected) return;
      const res = await rpc('getBalance', [w.address]), found = {};
      for (const programId of ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']) {
        const r = await rpc('getTokenAccountsByOwner', [w.address, { programId }, { encoding: 'jsonParsed' }]).catch(() => ({ value: [] }));
        for (const a of r.value || []) { const info = a.account.data.parsed.info, qty = info.tokenAmount.uiAmount || 0; if (qty > 0) found[info.mint] = (found[info.mint] || 0) + qty; }
      }
      S.update(s => { s.wallet = Object.assign({}, s.wallet, { sol: res.value / 1e9 });
        const next = {}; for (const [mint, qty] of Object.entries(found)) { const old = s.holdings[mint]; next[mint] = { qty, costUsd: old && old.qty > 0 ? old.costUsd * Math.min(1, qty / old.qty) : 0, sym: old ? old.sym : mint.slice(0, 4), name: old ? old.name : MB.util.short(mint) }; }
        s.holdings = next; });
    },
    /** Живой режим: после перезагрузки страницы тихо подключает кошелёк, который пользователь уже разрешил, и следит за сменой аккаунта в Phantom. */
    async restore() {
      if (C.MODE === 'demo') return; const p = provider(); if (!p) return;
      if (p.on && !p._mbListen) { p._mbListen = true;
        p.on('accountChanged', pk => { if (pk) { S.set({ wallet: { connected: true, address: pk.toString(), sol: 0 } }); this.refresh().catch(() => {}); } else this.restore().catch(() => {}); });
        p.on('disconnect', () => S.set({ wallet: { connected: false, address: '', sol: 0 } })); }
      try { const res = await p.connect({ onlyIfTrusted: true }); S.set({ wallet: { connected: true, address: res.publicKey.toString(), sol: 0 } }); await this.refresh(); } catch (e) { /* не разрешал раньше — ждём нажатия «Подключить» */ }
    },
    async disconnect() { if (C.MODE !== 'demo') { const p = provider(); if (p) await p.disconnect(); } const w = S.get().wallet; S.set({ wallet: { connected: false, address: '', sol: C.MODE === 'demo' ? w.sol : 0 } }); },
  };
})();
