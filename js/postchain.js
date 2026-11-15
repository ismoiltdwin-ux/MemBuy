/* Посты в живом режиме — без сервера, в блокчейне Solana (как реклама в adchain.js).
   Пост = транзакция автора: перевод POST_FEE_SOL на FEED_WALLET (защита от спама) + заметка MBP1|{x: текст, c: монета, n: имя}.
   Скрыть пост может только владелец площадки: заметка MBHIDE|подпись с его кошелька.
   Позиция автора в прикреплённой монете считается из его настоящего баланса в сети, подделать её нельзя. */
MB.postchain = (() => {
  const C = MB.config, MEMO = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', CKEY = 'membuy-posts-v1';
  const BAD = /(airdrop|free\s*sol|claim|seed|private\s*key|secret\s*(phrase|words)|connect\s*wallet|раздач|бесплатн|подключите\s*кошел)/i;
  let cache = {}; try { cache = JSON.parse(localStorage.getItem(CKEY) || '{}'); } catch (e) { cache = {}; }
  const save = () => { try { localStorage.setItem(CKEY, JSON.stringify(cache)); } catch (e) { /* нет хранилища */ } };
  let posts = [], loadedAt = 0, loading = null; const posCache = new Map();
  const feed = () => C.FEED_WALLET || C.FEE_WALLET;
  const enabled = () => C.LIVE && !!feed();
  const memos = s => String(s || '').split('; ').map(m => m.replace(/^\[\d+\]\s*/, ''));

  function validate({ text, coin, name }) {
    text = String(text || '').trim(); coin = String(coin || '').trim(); name = String(name || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 20);
    if (!text) throw new Error('Напишите текст поста');
    if (text.length > 280) throw new Error('Пост длиннее 280 знаков');
    if (coin && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(coin)) throw new Error('Неверный адрес монеты');
    if (BAD.test(text)) throw new Error('Такие слова в постах запрещены: так часто выманивают кошельки');
    if (/https?:\/\/|www\./i.test(text)) throw new Error('Ссылки в постах запрещены');
    return { text, coin, name };
  }

  async function send(memo, lamports) {
    const st = MB.store.get(); if (!st.wallet.connected) throw new Error('Сначала подключите кошелёк');
    await MB.wallet.web3(); const W = window.solanaWeb3, from = new W.PublicKey(st.wallet.address);
    const { blockhash } = (await MB.wallet.rpc('getLatestBlockhash', [{ commitment: 'confirmed' }])).value;
    const tx = new W.Transaction({ feePayer: from, recentBlockhash: blockhash });
    tx.add(W.SystemProgram.transfer({ fromPubkey: from, toPubkey: new W.PublicKey(feed()), lamports })); // адрес ленты должен быть в транзакции, иначе пост не найти
    tx.add(new W.TransactionInstruction({ programId: new W.PublicKey(MEMO), keys: [{ pubkey: from, isSigner: true, isWritable: false }], data: new TextEncoder().encode(memo) }));
    const r = await MB.wallet.send(tx); loadedAt = 0; return r.signature;
  }

  /** Проверка транзакции в сети: автор = подписант, заметка нужного формата, для MBHIDE — подпись владельца. */
  async function verify(sig, kind) {
    if (cache[sig]) return cache[sig];
    const tx = await MB.wallet.rpc('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
    if (!tx || !tx.meta || tx.meta.err) return null;
    const keys = tx.transaction.message.accountKeys.map(k => ({ key: typeof k === 'string' ? k : k.pubkey, signer: typeof k === 'string' ? false : !!k.signer }));
    const memo = tx.transaction.message.instructions.map(i => i.parsed).find(p => typeof p === 'string' && /^MB(P1|HIDE)\|/.test(p)) || '';
    const author = (keys.find(k => k.signer) || {}).key || '';
    let out = { kind: 'bad' };
    if (kind === 'post' && memo.startsWith('MBP1|')) { try { const d = JSON.parse(memo.slice(5)), v = validate({ text: d.x, coin: d.c, name: d.n }); out = { kind: 'post', sig, author, ts: tx.blockTime, text: v.text, coin: v.coin, name: v.name }; } catch (e) { /* не наш формат */ } }
    else if (kind === 'hide' && memo.startsWith('MBHIDE|') && keys.some(k => k.signer && k.key === C.FEE_WALLET)) out = { kind: 'hide', target: memo.slice(7), ts: tx.blockTime };
    cache[sig] = out; save(); return out;
  }

  async function load(force) {
    if (!enabled()) return [];
    if (!force && Date.now() - loadedAt < 30000) return posts;
    if (loading) return loading;
    loading = (async () => {
      const list = await MB.wallet.rpc('getSignaturesForAddress', [feed(), { limit: 1000, commitment: 'confirmed' }]), found = [];
      for (const s of list || []) { if (s.err) continue; for (const m of memos(s.memo)) { const k = m.startsWith('MBP1|') ? 'post' : m.startsWith('MBHIDE|') ? 'hide' : null; if (k) { found.push([s.signature, k]); break; } } }
      const recs = []; for (const [sig, k] of found.slice(0, 200)) { const r = await verify(sig, k).catch(() => null); if (r && r.kind !== 'bad') recs.push(r); }
      const hidden = new Set(recs.filter(r => r.kind === 'hide').map(r => r.target));
      posts = recs.filter(r => r.kind === 'post' && !hidden.has(r.sig)).sort((a, b) => b.ts - a.ts);
      loadedAt = Date.now(); return posts;
    })().finally(() => { loading = null; });
    return loading;
  }

  /** Текущая позиция автора в монете: его настоящий баланс × цена. Запоминается на минуту. */
  async function position(author, mint) {
    const k = author + mint, hit = posCache.get(k); if (hit && Date.now() - hit.at < 60000) return hit.v;
    const r = await MB.wallet.rpc('getTokenAccountsByOwner', [author, { mint }, { encoding: 'jsonParsed' }]).catch(() => null);
    const qty = ((r && r.value) || []).reduce((t, a) => t + (+a.account.data.parsed.info.tokenAmount.uiAmount || 0), 0);
    const v = { qty }; posCache.set(k, { at: Date.now(), v }); return v;
  }

  return {
    enabled, validate, load, position,
    publish(form) { if (!enabled()) throw new Error('Посты ещё не настроены'); const v = validate(form);
      return send('MBP1|' + JSON.stringify({ x: v.text, c: v.coin || undefined, n: v.name || undefined }), Math.round((C.POST_FEE_SOL || 0) * 1e9)); },
    hide(sig) { if (!MB.fees.isOwner()) throw new Error('Скрывать посты может только владелец площадки'); return send('MBHIDE|' + sig, 0); },
  };
})();
