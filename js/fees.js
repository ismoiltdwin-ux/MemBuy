/* Доход площадки (живой режим).
   • Сделки: Jupiter берёт PLATFORM_FEE_BPS (0,5%) и кладёт на FEE_ACCOUNT — wSOL-счёт кошелька FEE_WALLET.
     Пока этот счёт не создан, комиссия не включается (иначе Jupiter отклонил бы сделку).
   • Выпуск монеты: в транзакцию выпуска добавляется перевод CREATE_FEE_SOL на FEE_WALLET (см. pumpcreate.js).
   • Реклама: оплата сразу идёт на ADS_WALLET (см. adchain.js).
   Владелец (кошелёк FEE_WALLET) видит в профиле доход, может создать счёт для комиссии и вывести накопленное. */
MB.fees = (() => {
  const C = MB.config, WSOL = 'So11111111111111111111111111111111111111112';
  const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', ATA = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
  let known = null, checkedAt = 0;

  /** Существует ли счёт для комиссии. «Да» запоминаем навсегда, «нет» — перепроверяем раз в минуту. */
  async function ready() {
    if (!C.LIVE || !C.FEE_ACCOUNT || !(C.PLATFORM_FEE_BPS > 0)) return false;
    if (known === true || (known === false && Date.now() - checkedAt < 60000)) return known;
    try { const r = await MB.wallet.rpc('getAccountInfo', [C.FEE_ACCOUNT, { encoding: 'base64' }]); known = !!(r && r.value); } catch (e) { known = false; }
    checkedAt = Date.now(); return known;
  }
  const isOwner = () => C.LIVE && !!C.FEE_WALLET && MB.store.get().wallet.connected && MB.store.get().wallet.address === C.FEE_WALLET;

  /** Отправить простую транзакцию из инструкций (подписывает и отправляет Phantom). */
  async function send(build) {
    await MB.wallet.web3(); const W = window.solanaWeb3, me = new W.PublicKey(MB.store.get().wallet.address);
    const { blockhash } = (await MB.wallet.rpc('getLatestBlockhash', [{ commitment: 'confirmed' }])).value;
    const tx = new W.Transaction({ feePayer: me, recentBlockhash: blockhash }); build(W, me).forEach(i => tx.add(i));
    const r = await MB.wallet.send(tx); known = null; return r.signature;
  }
  const createIx = (W, me) => new W.TransactionInstruction({ programId: new W.PublicKey(ATA), data: Uint8Array.of(1), keys: [ // создать счёт, если его ещё нет
    { pubkey: me, isSigner: true, isWritable: true }, { pubkey: new W.PublicKey(C.FEE_ACCOUNT), isSigner: false, isWritable: true },
    { pubkey: me, isSigner: false, isWritable: false }, { pubkey: new W.PublicKey(WSOL), isSigner: false, isWritable: false },
    { pubkey: W.SystemProgram.programId, isSigner: false, isWritable: false }, { pubkey: new W.PublicKey(TOKEN), isSigner: false, isWritable: false }] });

  return {
    ready, isOwner,
    /** Накопленная комиссия в SOL (сумма на wSOL-счёте). */
    async balance() { const r = await MB.wallet.rpc('getTokenAccountBalance', [C.FEE_ACCOUNT]).catch(() => null); return r && r.value ? +r.value.uiAmount || 0 : 0; },
    /** Владелец: создать счёт для комиссии (около 0,002 SOL — залог сети, возвращается при закрытии счёта). */
    enable() { if (!isOwner()) throw new Error('Это может сделать только владелец площадки'); return send((W, me) => [createIx(W, me)]); },
    /** Владелец: вывести накопленное — счёт закрывается, всё (комиссия + залог) приходит обычными SOL. Потом комиссию нужно включить снова. */
    withdraw() { if (!isOwner()) throw new Error('Это может сделать только владелец площадки');
      return send((W, me) => [new W.TransactionInstruction({ programId: new W.PublicKey(TOKEN), data: Uint8Array.of(9), keys: [
        { pubkey: new W.PublicKey(C.FEE_ACCOUNT), isSigner: false, isWritable: true }, { pubkey: me, isSigner: false, isWritable: true }, { pubkey: me, isSigner: true, isWritable: false }] })]); },
  };
})();
