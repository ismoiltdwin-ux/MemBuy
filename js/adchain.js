/* Настоящая реклама без сервера (живой режим). Всё хранится в блокчейне Solana:
   1. Рекламодатель одной транзакцией платит SOL на кошелёк площадки (config.ADS_WALLET) и пишет в заметку (Memo) текст объявления: MB1|{json}.
   2. Владелец площадки со своего кошелька одобряет (MBOK|подпись) или отклоняет (MBNO|подпись) объявление — это тоже заметка в блокчейне.
   3. Любой посетитель читает историю кошелька площадки и показывает одобренные объявления, у которых не кончился оплаченный срок.
   Каждая запись проверяется по самой транзакции: сумма и получатель перевода, подпись владельца на одобрении. */
MB.adchain = (() => {
  const C = MB.config, MEMO = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', CKEY = 'membuy-adchain-v1';
  let cache = {}; try { cache = JSON.parse(localStorage.getItem(CKEY) || '{}'); } catch (e) { cache = {}; }
  const save = () => { try { localStorage.setItem(CKEY, JSON.stringify(cache)); } catch (e) { /* нет хранилища */ } };
  let ads = [], loadedAt = 0, loading = null;
  const enabled = () => C.LIVE && !!C.ADS_WALLET;
  const priceSol = days => Math.round(days * C.ADS_SOL_PER_DAY * 1e9) / 1e9;
  const memos = s => String(s || '').split('; ').map(m => m.replace(/^\[\d+\]\s*/, ''));

  function validate({ title, text, link, days }) {
    title = String(title).trim(); text = String(text).trim(); link = String(link).trim(); days = Math.round(+days);
    if (title.length < 3 || title.length > 40) throw new Error('Заголовок: от 3 до 40 знаков');
    if (text.length < 5 || text.length > 90) throw new Error('Текст: от 5 до 90 знаков');
    if (!MB.ads.safe(link) || link.length > 120) throw new Error('Ссылка должна начинаться с https:// (до 120 знаков)');
    if (!(days >= 1 && days <= 30)) throw new Error('Срок: от 1 до 30 дней');
    return { title, text, link, days };
  }

  /** Отправляет транзакцию с переводом (если lamports > 0) и заметкой. Подписывает Phantom. */
  async function send(memo, lamports) {
    const st = MB.store.get(); if (!st.wallet.connected) throw new Error('Сначала подключите кошелёк');
    await MB.wallet.web3(); const W = window.solanaWeb3, from = new W.PublicKey(st.wallet.address);
    const { blockhash } = await MB.wallet.rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]).then(r => r.value);
    const tx = new W.Transaction({ feePayer: from, recentBlockhash: blockhash });
    if (lamports > 0) tx.add(W.SystemProgram.transfer({ fromPubkey: from, toPubkey: new W.PublicKey(C.ADS_WALLET), lamports }));
    tx.add(new W.TransactionInstruction({ programId: new W.PublicKey(MEMO), keys: [{ pubkey: from, isSigner: true, isWritable: false }], data: new TextEncoder().encode(memo) }));
    const res = await MB.wallet.send(tx); loadedAt = 0; return res.signature;
  }

  /** Проверяет транзакцию в сети и запоминает результат (подтверждённая транзакция не меняется). */
  async function verify(sig, kind) {
    if (cache[sig]) return cache[sig];
    const tx = await MB.wallet.rpc('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
    if (!tx || !tx.meta || tx.meta.err) return null;
    const keys = tx.transaction.message.accountKeys.map(k => ({ key: typeof k === 'string' ? k : k.pubkey, signer: typeof k === 'string' ? false : !!k.signer }));
    const ins = tx.transaction.message.instructions, memo = ins.map(i => i.parsed).find(p => typeof p === 'string' && /^MB(1|OK|NO)\|/.test(p)) || '';
    let out = null;
    if (kind === 'ad' && memo.startsWith('MB1|')) {
      const pay = ins.find(i => i.program === 'system' && i.parsed && i.parsed.type === 'transfer' && i.parsed.info.destination === C.ADS_WALLET);
      let ad = null; try { ad = JSON.parse(memo.slice(4)); } catch (e) { ad = null; }
      if (pay && ad) { const v = (() => { try { return validate({ title: ad.t, text: ad.x, link: ad.l, days: ad.d }); } catch (e) { return null; } })();
        if (v) out = Object.assign(v, { kind: 'ad', sig, payer: pay.parsed.info.source, lamports: pay.parsed.info.lamports, ts: tx.blockTime }); }
    } else if ((kind === 'ok' || kind === 'no') && keys.some(k => k.signer && k.key === C.ADS_WALLET)) {
      out = { kind, target: memo.slice(5), ts: tx.blockTime };
    }
    cache[sig] = out || { kind: 'bad' }; save(); return cache[sig];
  }

  /** Читает историю кошелька площадки (последние 1000 транзакций) и собирает объявления со статусами. */
  async function load(force) {
    if (!enabled()) return [];
    if (!force && Date.now() - loadedAt < 60000) return ads;
    if (loading) return loading;
    loading = (async () => {
      const list = await MB.wallet.rpc('getSignaturesForAddress', [C.ADS_WALLET, { limit: 1000, commitment: 'confirmed' }]);
      const found = [];
      for (const s of list || []) { if (s.err) continue; for (const m of memos(s.memo)) { const k = m.startsWith('MB1|') ? 'ad' : m.startsWith('MBOK|') ? 'ok' : m.startsWith('MBNO|') ? 'no' : null; if (k) { found.push([s.signature, k]); break; } } }
      const recs = []; for (const [sig, k] of found) { const r = await verify(sig, k).catch(() => null); if (r && r.kind !== 'bad') recs.push(r); }
      const decide = {}; recs.filter(r => r.kind !== 'ad').sort((a, b) => a.ts - b.ts).forEach(r => { decide[r.target] = r; });
      const now = Date.now() / 1000;
      ads = recs.filter(r => r.kind === 'ad').map(a => { const d = decide[a.sig], paidDays = Math.min(a.days, Math.floor(a.lamports / 1e9 / C.ADS_SOL_PER_DAY + 1e-6));
        const status = !d ? 'pending' : d.kind === 'no' ? 'rejected' : paidDays < 1 ? 'underpaid' : d.ts + paidDays * 86400 > now ? 'active' : 'ended';
        return Object.assign({}, a, { id: 'ch-' + a.sig.slice(0, 12), status, until: d && d.kind === 'ok' ? (d.ts + paidDays * 86400) * 1000 : 0, paidDays }); })
        .sort((x, y) => y.ts - x.ts);
      loadedAt = Date.now(); return ads;
    })().finally(() => { loading = null; });
    return loading;
  }

  return {
    enabled, priceSol, validate, load,
    active: () => ads.filter(a => a.status === 'active'),
    /** Рекламодатель: оплатить и отправить объявление на проверку. */
    async buy(form) { if (!enabled()) throw new Error('Рекламная площадка ещё не настроена'); const v = validate(form); const memo = 'MB1|' + JSON.stringify({ t: v.title, x: v.text, l: v.link, d: v.days });
      return send(memo, Math.round(priceSol(v.days) * 1e9)); },
    /** Владелец: одобрить или отклонить объявление (запись в блокчейне с его подписью). */
    async decide(sig, ok) { if (MB.store.get().wallet.address !== C.ADS_WALLET) throw new Error('Одобрять может только владелец площадки'); return send((ok ? 'MBOK|' : 'MBNO|') + sig, 0); },
    isOwner: () => enabled() && MB.store.get().wallet.connected && MB.store.get().wallet.address === C.ADS_WALLET,
  };
})();
