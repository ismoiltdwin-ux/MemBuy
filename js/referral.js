/* Приглашения (живой режим): 10% комиссии площадки со сделок приглашённых друзей.
   Ссылка: ...?mode=live&ref=<кошелёк пригласившего>. Пригласивший запоминается в браузере друга (первый — навсегда).
   Учёт без сервера, прямо в блокчейне: в сделку друга добавляется заметка «MBR|<кошелёк пригласившего>».
   Площадка получает комиссию на FEE_ACCOUNT; REF_SHARE_BPS (10%) от неё — награда пригласившего.
   Выплачивает владелец площадки (кнопка «Выплатить»: перевод SOL с заметкой «MBRPAY|<кошелёк>»). Всё видно в Solscan. */
MB.ref = (() => {
  const C = MB.config, KEY = 'membuy-ref', CACHE = 'membuy-refscan-v1';
  const MEMO = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', CB = 'ComputeBudget111111111111111111111111111111';
  const isAddr = a => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(a || '').trim());
  const share = () => (C.REF_SHARE_BPS == null ? 1000 : C.REF_SHARE_BPS) / 1e4;
  const me = () => MB.store.get().wallet.address;
  const enabled = () => C.LIVE && !!C.FEE_ACCOUNT && !!C.FEE_WALLET && share() > 0;

  // Запоминаем пригласившего из ссылки (только первого — чужая ссылка позже его не заменит).
  try { const r = new URLSearchParams(location.search).get('ref'); if (r && isAddr(r) && !localStorage.getItem(KEY)) localStorage.setItem(KEY, r.trim()); } catch (e) { /* нет хранилища */ }
  /** Кто пригласил этот кошелёк (не сам себя). */
  const inviter = () => { let r = ''; try { r = localStorage.getItem(KEY) || ''; } catch (e) { /* нет хранилища */ } return isAddr(r) && r !== me() ? r : ''; };
  const link = addr => location.origin + location.pathname + '?mode=live&ref=' + encodeURIComponent(addr);

  /** Добавляет заметку пригласившего в сделку Jupiter. Если что-то не так (размер, сеть) — сделка уходит без заметки. */
  async function tag(tx) {
    const r = inviter(); if (!enabled() || !r) return tx;
    try {
      const W = window.solanaWeb3, conn = new W.Connection(C.RPC_URL, 'confirmed');
      const luts = await Promise.all(tx.message.addressTableLookups.map(l => conn.getAddressLookupTable(l.accountKey).then(x => x.value)));
      if (luts.some(x => !x)) return tx;
      const msg = W.TransactionMessage.decompile(tx.message, { addressLookupTableAccounts: luts });
      // Заметка тратит немного вычислений — поднимаем лимит, который выставил Jupiter, с запасом.
      msg.instructions.forEach(ix => { if (ix.programId.toBase58() === CB && ix.data[0] === 2 && ix.data.length >= 5) { const d = new Uint8Array(ix.data), v = new DataView(d.buffer); v.setUint32(1, Math.min(1400000, v.getUint32(1, true) + 30000), true); ix.data = d; } });
      msg.instructions.push(new W.TransactionInstruction({ programId: new W.PublicKey(MEMO), keys: [], data: new TextEncoder().encode('MBR|' + r) }));
      const out = new W.VersionedTransaction(msg.compileToV0Message(luts));
      return out.serialize().length <= 1232 ? out : tx;
    } catch (e) { return tx; }
  }

  // ---- Подсчёт по блокчейну ----
  const load = () => { try { return JSON.parse(localStorage.getItem(CACHE) || '{}'); } catch (e) { return {}; } };
  const save = c => { try { localStorage.setItem(CACHE, JSON.stringify(c)); } catch (e) { /* переполнено — посчитаем заново */ } };
  const rpc = (m, p) => MB.wallet.rpc(m, p);
  async function pool(items, n, fn) { const q = items.slice(); await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); })); }
  const memoOf = (s, tag) => { const m = String(s || '').match(new RegExp(tag + '\\|([1-9A-HJ-NP-Za-km-z]{32,44})')); return m ? m[1] : ''; };
  let last = null, lastAt = 0;

  /** Все награды: { [пригласивший]: { traders:Set, trades, feeLam, earnedLam, paidLam } }. Кэш в браузере, обновление раз в минуту. */
  async function stats(force) {
    if (!enabled()) return {};
    if (last && !force && Date.now() - lastAt < 60000) return last;
    const c = load(); c.t = c.t || {}; c.p = c.p || {};
    // 1) Сделки с заметкой MBR, прошедшие через счёт комиссии.
    const sigs = (await rpc('getSignaturesForAddress', [C.FEE_ACCOUNT, { limit: 1000 }]).catch(() => [])) || [];
    const need = sigs.filter(s => !s.err && memoOf(s.memo, 'MBR') && !(s.signature in c.t)).map(s => s.signature);
    await pool(need, 4, async sig => {
      const tx = await rpc('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]).catch(() => null);
      if (!tx || !tx.meta || tx.meta.err) { c.t[sig] = 0; return; }
      const ref = memoOf((tx.meta.logMessages || []).join('\n'), 'MBR'), trader = tx.transaction.message.accountKeys[0].pubkey || tx.transaction.message.accountKeys[0];
      const bal = arr => (arr || []).filter(b => b.owner === C.FEE_WALLET && b.mint === C.SOL_MINT).reduce((s, b) => s + +b.uiTokenAmount.amount, 0);
      const fee = bal(tx.meta.postTokenBalances) - bal(tx.meta.preTokenBalances);
      c.t[sig] = ref && fee > 0 && trader !== ref ? [ref, trader, fee] : 0;
    });
    // 2) Выплаты: перевод SOL от владельца пригласившему с заметкой MBRPAY.
    const pays = (await rpc('getSignaturesForAddress', [C.FEE_WALLET, { limit: 1000 }]).catch(() => [])) || [];
    const needP = pays.filter(s => !s.err && memoOf(s.memo, 'MBRPAY') && !(s.signature in c.p)).map(s => s.signature);
    await pool(needP, 4, async sig => {
      const tx = await rpc('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]).catch(() => null);
      if (!tx || !tx.meta || tx.meta.err) { c.p[sig] = 0; return; }
      const ref = memoOf((tx.meta.logMessages || []).join('\n'), 'MBRPAY'), payer = tx.transaction.message.accountKeys[0].pubkey;
      const lam = tx.transaction.message.instructions.filter(i => i.program === 'system' && i.parsed && i.parsed.type === 'transfer' && i.parsed.info.source === C.FEE_WALLET && i.parsed.info.destination === ref).reduce((s, i) => s + +i.parsed.info.lamports, 0);
      c.p[sig] = payer === C.FEE_WALLET && ref && lam > 0 ? [ref, lam] : 0;
    });
    save(c);
    const out = {}, get = r => (out[r] = out[r] || { traders: new Set(), trades: 0, feeLam: 0, earnedLam: 0, paidLam: 0 });
    Object.values(c.t).forEach(v => { if (!v) return; const o = get(v[0]); o.traders.add(v[1]); o.trades++; o.feeLam += v[2]; });
    Object.values(out).forEach(o => { o.earnedLam = Math.floor(o.feeLam * share()); });
    Object.values(c.p).forEach(v => { if (v) get(v[0]).paidLam += v[1]; });
    last = out; lastAt = Date.now(); return out;
  }
  const owed = o => Math.max(0, o.earnedLam - o.paidLam);

  /** Владелец: выплатить пригласившему его награду в SOL (одна транзакция с заметкой для учёта). */
  async function pay(ref, lamports) {
    if (!MB.fees.isOwner()) throw new Error('Это может сделать только владелец площадки');
    if (!isAddr(ref) || !(lamports > 0)) throw new Error('Нечего выплачивать');
    await MB.wallet.web3(); const W = window.solanaWeb3, from = new W.PublicKey(me());
    const { blockhash } = (await rpc('getLatestBlockhash', [{ commitment: 'confirmed' }])).value;
    const tx = new W.Transaction({ feePayer: from, recentBlockhash: blockhash });
    tx.add(W.SystemProgram.transfer({ fromPubkey: from, toPubkey: new W.PublicKey(ref), lamports: Math.floor(lamports) }));
    tx.add(new W.TransactionInstruction({ programId: new W.PublicKey(MEMO), keys: [{ pubkey: from, isSigner: true, isWritable: false }], data: new TextEncoder().encode('MBRPAY|' + ref) }));
    const r = await MB.wallet.send(tx); lastAt = 0; setTimeout(() => MB.wallet.refresh().catch(() => {}), 5000); return r.signature;
  }
  return { enabled, share, inviter, link, tag, stats, owed, pay, isAddr };
})();
