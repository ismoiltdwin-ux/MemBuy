/* Обмен. quote() считает, сколько получит пользователь; execute() исполняет сделку.
   Демо: простая модель цены с влиянием на цену. Live: Jupiter (не проверено в боевом режиме). */
MB.swap = (() => {
  const C = MB.config, S = MB.store;
  const feeRate = () => C.PLATFORM_FEE_BPS / 1e4;
  async function quote({ side, token, amount, slippageBps }) {
    if (!(amount > 0)) return null;
    const solUsd = await MB.data.solUsd();
    if (C.MODE === 'demo') {
      const usdIn = side === 'buy' ? amount * solUsd : amount * token.price;
      const impact = Math.min(0.5, usdIn / (token.liquidityUsd * 2)), fee = usdIn * feeRate(), net = (usdIn - fee) * (1 - impact);
      const out = side === 'buy' ? net / token.price : net / solUsd;
      return { side, token, amountIn: amount, out, minOut: out * (1 - slippageBps / 1e4), impactPct: impact * 100, feeUsd: fee, usd: usdIn, solUsd, slippageBps };
    }
    const dec = await decimals(token.mint), inMint = side === 'buy' ? C.SOL_MINT : token.mint, outMint = side === 'buy' ? token.mint : C.SOL_MINT;
    const raw = Math.round(amount * 10 ** (side === 'buy' ? 9 : dec));
    const fee = C.FEE_ACCOUNT ? `&platformFeeBps=${C.PLATFORM_FEE_BPS}` : '';
    const r = await fetch(`${C.JUP_API}/quote?inputMint=${inMint}&outputMint=${outMint}&amount=${raw}&slippageBps=${slippageBps}${fee}`);
    if (!r.ok) throw new Error('Не удалось получить котировку');
    const q = await r.json(), outDec = side === 'buy' ? dec : 9, out = q.outAmount / 10 ** outDec, usdIn = side === 'buy' ? amount * solUsd : amount * token.price;
    return { side, token, amountIn: amount, out, minOut: q.otherAmountThreshold / 10 ** outDec, impactPct: (+q.priceImpactPct || 0) * 100, feeUsd: C.FEE_ACCOUNT ? usdIn * feeRate() : 0, usd: usdIn, solUsd, slippageBps, raw: q };
  }
  const decCache = {};
  async function decimals(mint) { if (decCache[mint] != null) return decCache[mint]; const res = await MB.wallet.rpc('getTokenSupply', [mint]); return (decCache[mint] = res.value.decimals); }
  async function execute(q) {
    const st = S.get(); if (!st.wallet.connected) throw new Error('Сначала подключите кошелёк');
    const sol = q.side === 'buy' ? q.amountIn : q.out, tokens = q.side === 'buy' ? q.out : q.amountIn;
    if (q.side === 'buy' && q.amountIn > st.wallet.sol) throw new Error('Недостаточно SOL');
    let sig = 'demo';
    if (C.MODE === 'demo') {
      const h = st.holdings[q.token.id]; if (q.side === 'sell' && (!h || h.qty + 1e-9 < q.amountIn)) throw new Error('Недостаточно монет');
    } else {
      await MB.wallet.web3();
      // Скорость сделки: приоритетный сбор сети (Jupiter сам подбирает сумму, не выше потолка).
      const PR = { medium: 200000, high: 1000000, veryHigh: 3000000 }, pl = PR[st.priority] ? st.priority : 'high';
      const body = { quoteResponse: q.raw, userPublicKey: st.wallet.address, dynamicComputeUnitLimit: true, prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: PR[pl], priorityLevel: pl } } }; if (C.FEE_ACCOUNT) body.feeAccount = C.FEE_ACCOUNT;
      const r = await fetch(`${C.JUP_API}/swap`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error('Не удалось подготовить сделку');
      const { swapTransaction } = await r.json(), bytes = Uint8Array.from(atob(swapTransaction), c => c.charCodeAt(0));
      const tx = window.solanaWeb3.VersionedTransaction.deserialize(bytes);
      // Проверка: сделка Jupiter должна касаться именно вашего кошелька — иначе не подписываем.
      const keys = tx.message && tx.message.staticAccountKeys ? tx.message.staticAccountKeys.map(k => k.toBase58 ? k.toBase58() : String(k)) : [];
      if (!keys.includes(st.wallet.address)) throw new Error('Сделка не адресована вашему кошельку — подпись отменена');
      const res = await MB.wallet.send(tx); sig = res.signature;
    }
    S.applyTrade({ id: q.token.id, sym: q.token.sym, name: q.token.name, side: q.side, sol, tokens, usd: q.usd, price: q.token.price, feeUsd: q.feeUsd, ts: Date.now(), sig });
    if (C.MODE !== 'demo') [4000, 15000].forEach(ms => setTimeout(() => MB.wallet.refresh().catch(() => {}), ms));
    return sig;
  }
  return { quote, execute };
})();
