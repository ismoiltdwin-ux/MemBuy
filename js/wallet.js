/* Кошелёк. Демо: учебный кошелёк с условными SOL. Live: Phantom (ключи остаются у пользователя). */
MB.wallet = (() => {
  const SRI = { 'https://unpkg.com/@solana/web3.js@1.95.3/lib/index.iife.min.js': 'sha384-xo1g+ODR6i1cxIVZeALc/apXFHeaJHO1j1whMO3dhtdBChWeaihnDs7UnXs9ch78' };
  const C = MB.config, S = MB.store;
  const rpc = async (method, params) => { const r = await fetch(C.RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }); const d = await r.json(); if (d.error) throw new Error(d.error.message); return d.result; };
  const provider = () => (window.phantom && window.phantom.solana) || (window.solana && window.solana.isPhantom ? window.solana : null);
  /** Отказ пользователя в Phantom (код 4001) превращаем в понятное сообщение. */
  const rejected = e => (e && (e.code === 4001 || /reject|denied|cancel/i.test(e.message || ''))) ? new Error('Вы отклонили подпись') : e;
  return {
    rpc, provider, rejected,
    /** Подписать и отправить транзакцию через Phantom. */
    async send(tx) { try { return await provider().signAndSendTransaction(tx); } catch (e) { throw rejected(e); } },
    /** Загружает библиотеку @solana/web3.js (нужна только для подписи сделок). */
    web3: () => window.solanaWeb3 ? Promise.resolve() : new Promise((ok, bad) => { const s = document.createElement('script'); s.src = C.WEB3_CDN; if (SRI[C.WEB3_CDN]) { s.integrity = SRI[C.WEB3_CDN]; s.crossOrigin = 'anonymous'; } /* проверка целостности: подменённый файл браузер не запустит */ s.onload = ok; s.onerror = () => bad(new Error('Не удалось загрузить библиотеку Solana')); document.head.appendChild(s); }),
    async connect() {
      if (C.MODE === 'demo') { const st = S.get(); S.set({ wallet: { connected: true, address: 'Demo' + 'MB7xQ2kLp9aVn3TzR4', sol: st.wallet.sol || C.DEMO_START_SOL } }); return; }
      const p = provider(); if (!p) { MB.ui.noWallet(); const e = new Error(''); e.silent = true; throw e; } // окно с кнопками вместо красной ошибки
      let res; try { res = await p.connect(); } catch (e) { throw rejected(e); } const address = res.publicKey.toString();
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
