/* Отправка SOL и монет любому адресу Solana (живой режим). Сервер не нужен: перевод собирается в браузере и подписывается в Phantom.
   Монеты: если у получателя ещё нет счёта для этой монеты, он создаётся в той же транзакции (залог ~0,002 SOL платит отправитель). */
MB.send = (() => {
  const C = MB.config, ATA = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', SOL_RESERVE = 0.002;
  const isAddr = a => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(a || '').trim());

  /** Что можно отправить: SOL и монеты кошелька (с ценой в $, если известна). */
  async function assets() {
    const st = MB.store.get(), su = await MB.data.solUsd().catch(() => 0), ids = Object.keys(st.holdings);
    const ts = ids.length && MB.data.many ? await MB.data.many(ids).catch(() => []) : [], by = {}; ts.forEach(t => { by[t.id] = t; });
    return [{ id: 'SOL', sym: 'SOL', name: 'Solana', qty: st.wallet.sol, max: Math.max(0, st.wallet.sol - SOL_RESERVE), usd: st.wallet.sol * su, price: su, hue: 270 },
      ...ids.map(id => { const h = st.holdings[id], t = by[id]; return { id, sym: (t && t.sym) || h.sym, name: (t && t.name) || h.name, qty: h.qty, max: h.qty, usd: t ? h.qty * t.price : 0, price: t ? t.price : 0, icon: t && t.icon, hue: t ? t.hue : 200 }; })]
      .filter(a => a.qty > 0);
  }

  /** Сводка перед отправкой: сколько уйдёт сборов. */
  async function preview(to, asset) {
    if (asset.id === 'SOL') return { network: 0.000005, rent: 0 };
    await MB.wallet.web3(); const W = window.solanaWeb3, mint = await mintInfo(asset.id);
    const dest = ata(W, to, asset.id, mint.program), info = await MB.wallet.rpc('getAccountInfo', [dest.toBase58(), { encoding: 'base64' }]).catch(() => null);
    return { network: 0.000005, rent: info && info.value ? 0 : 0.00204 };
  }
  async function mintInfo(mint) {
    const r = await MB.wallet.rpc('getAccountInfo', [mint, { encoding: 'jsonParsed' }]); const v = r && r.value;
    if (!v || !v.data || !v.data.parsed) throw new Error('Не удалось прочитать монету');
    return { program: v.owner, decimals: v.data.parsed.info.decimals };
  }
  const ata = (W, owner, mint, program) => W.PublicKey.findProgramAddressSync([new W.PublicKey(owner).toBuffer(), new W.PublicKey(program).toBuffer(), new W.PublicKey(mint).toBuffer()], new W.PublicKey(ATA))[0];

  async function transfer(to, asset, amount) {
    const st = MB.store.get(); if (!st.wallet.connected) throw new Error('Сначала подключите кошелёк');
    to = String(to || '').trim(); amount = +String(amount).replace(',', '.');
    if (!isAddr(to)) throw new Error('Неверный адрес получателя');
    if (to === st.wallet.address) throw new Error('Нельзя отправить самому себе');
    if (!(amount > 0)) throw new Error('Введите сумму');
    if (amount > asset.max + 1e-12) throw new Error(asset.id === 'SOL' ? 'Недостаточно SOL (оставьте немного на сборы сети)' : 'Недостаточно монет');
    await MB.wallet.web3(); const W = window.solanaWeb3, me = new W.PublicKey(st.wallet.address), dest = new W.PublicKey(to);
    if (!W.PublicKey.isOnCurve(dest.toBytes())) throw new Error('Этот адрес не похож на кошелёк — отправка отменена');
    const { blockhash } = (await MB.wallet.rpc('getLatestBlockhash', [{ commitment: 'confirmed' }])).value;
    const tx = new W.Transaction({ feePayer: me, recentBlockhash: blockhash });
    if (asset.id === 'SOL') tx.add(W.SystemProgram.transfer({ fromPubkey: me, toPubkey: dest, lamports: Math.round(amount * 1e9) }));
    else {
      const mint = await mintInfo(asset.id), prog = new W.PublicKey(mint.program), mintPk = new W.PublicKey(asset.id);
      const accs = await MB.wallet.rpc('getTokenAccountsByOwner', [st.wallet.address, { mint: asset.id }, { encoding: 'jsonParsed' }]);
      const src = ((accs && accs.value) || []).sort((a, b) => (+b.account.data.parsed.info.tokenAmount.uiAmount || 0) - (+a.account.data.parsed.info.tokenAmount.uiAmount || 0))[0];
      if (!src) throw new Error('Недостаточно монет');
      const destAta = ata(W, to, asset.id, mint.program), raw = BigInt(Math.floor(amount * 10 ** mint.decimals + 1e-6));
      if (raw <= 0n) throw new Error('Слишком маленькая сумма');
      const data = new Uint8Array(10); data[0] = 12; new DataView(data.buffer).setBigUint64(1, raw, true); data[9] = mint.decimals; // TransferChecked
      tx.add(new W.TransactionInstruction({ programId: new W.PublicKey(ATA), data: Uint8Array.of(1), keys: [ // счёт получателя, если его нет
        { pubkey: me, isSigner: true, isWritable: true }, { pubkey: destAta, isSigner: false, isWritable: true }, { pubkey: dest, isSigner: false, isWritable: false },
        { pubkey: mintPk, isSigner: false, isWritable: false }, { pubkey: W.SystemProgram.programId, isSigner: false, isWritable: false }, { pubkey: prog, isSigner: false, isWritable: false }] }));
      tx.add(new W.TransactionInstruction({ programId: prog, data, keys: [
        { pubkey: new W.PublicKey(src.pubkey), isSigner: false, isWritable: true }, { pubkey: mintPk, isSigner: false, isWritable: false },
        { pubkey: destAta, isSigner: false, isWritable: true }, { pubkey: me, isSigner: true, isWritable: false }] }));
    }
    const { signature } = await MB.wallet.send(tx);
    MB.store.note('Отправлено ' + MB.util.num(amount, 4) + ' ' + asset.sym); setTimeout(() => MB.wallet.refresh().catch(() => {}), 5000); return signature;
  }
  return { isAddr, assets, preview, transfer };
})();
