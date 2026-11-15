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
  /** Автопроверка объявления. Ссылки и слова, типичные для ловушек (поддельные кошельки, «раздачи»), не включаются сами — их смотрит владелец. */
  const SAFE_HOSTS = ['x.com', 'twitter.com', 't.me', 'pump.fun', 'dexscreener.com', 'youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com', 'discord.gg', 'ismoiltdwin-ux.github.io'];
  const BAD_HOST = /(phantom|solana|solflare|jup(iter)?|raydium|pump|metamask|binance|bybit|okx|coinbase|wallet|airdrop|claim|drop|reward|bonus|free|gift|connect|verify|support|recover)/i;
  const BAD_TEXT = /(airdrop|free\s*sol|claim|seed|private\s*key|secret\s*(phrase|words)|guarantee|гарант|x\s*100|100\s*x|1000\s*x|double|giveaway|раздач|бесплатн|connect\s*wallet|подключите\s*кошел)/i;
  function autoOk(a) {
    let host = ''; try { host = new URL(a.link).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return false; }
    const safe = SAFE_HOSTS.some(h => host === h || host.endsWith('.' + h));
    return (safe || !BAD_HOST.test(host)) && !BAD_TEXT.test(a.title + ' ' + a.text) && !/xn--/.test(host); // xn-- — домены с похожими буквами
  }
  const planOf = id => (C.ADS_PLANS || []).find(p => p.id === id) || null;
  /** Цена тарифа в SOL: фиксированная (sol) или пересчёт долларов по курсу SOL, с округлением вверх до 0,001. */
  const priceSol = (plan, solUsd) => plan.sol ? plan.sol : Math.ceil(plan.usd / (solUsd || 1) * 1000) / 1000;
  const memos = s => String(s || '').split('; ').map(m => m.replace(/^\[\d+\]\s*/, ''));

  function validate({ title, text, link, plan }) {
    title = String(title).trim(); text = String(text).trim(); link = String(link).trim();
    if (title.length < 3 || title.length > 40) throw new Error('Заголовок: от 3 до 40 знаков');
    if (text.length < 5 || text.length > 90) throw new Error('Текст: от 5 до 90 знаков');
    if (!MB.ads.safe(link) || link.length > 120) throw new Error('Ссылка должна начинаться с https:// (до 120 знаков)');
    const p = typeof plan === 'object' ? plan : planOf(plan); if (!p) throw new Error('Выберите срок показа');
    return { title, text, link, plan: p };
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
      if (pay && ad) {
        // Новый формат: тариф p и заявленная сумма s (лампорты). Старый: d дней по ADS_SOL_PER_DAY.
        const legacy = !ad.p && ad.d >= 1 && ad.d <= 30, plan = legacy ? { id: ad.d + 'd', hours: ad.d * 24, sol: ad.d * C.ADS_SOL_PER_DAY } : planOf(ad.p);
        const v = (() => { try { return plan && validate({ title: ad.t, text: ad.x, link: ad.l, plan }); } catch (e) { return null; } })();
        // Для тарифа в $ сумма s не может быть ниже цены при курсе SOL $1000 — отсекает заявки «на 1 лампорт».
        const need = plan && (plan.sol ? Math.round(plan.sol * 1e9) : Math.max(Math.round(plan.usd / 1000 * 1e9), Math.round(+ad.s || 0)));
        if (v) out = Object.assign(v, { kind: 'ad', sig, payer: pay.parsed.info.source, lamports: pay.parsed.info.lamports, ts: tx.blockTime, hours: plan.hours, need }); }
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
      ads = recs.filter(r => r.kind === 'ad').map(a => {
        const paid = a.need > 0 && a.lamports >= a.need * 0.999, auto = !decide[a.sig] && C.ADS_AUTO_APPROVE && paid && autoOk(a);
        // Решение владельца главнее; без решения оплаченное и чистое объявление включается само с момента оплаты.
        const d = decide[a.sig] || (auto ? { kind: 'ok', ts: a.ts, auto: true } : null), end = d ? d.ts + a.hours * 3600 : 0;
        const status = !d ? 'pending' : d.kind === 'no' ? 'rejected' : !paid ? 'underpaid' : end > now ? 'active' : 'ended';
        return Object.assign({}, a, { id: 'ch-' + a.sig.slice(0, 12), status, auto: !!(d && d.auto), flagged: !autoOk(a), until: d && d.kind === 'ok' ? end * 1000 : 0 }); })
        .sort((x, y) => y.ts - x.ts);
      loadedAt = Date.now(); return ads;
    })().finally(() => { loading = null; });
    return loading;
  }

  return {
    enabled, priceSol, planOf, validate, load,
    active: () => ads.filter(a => a.status === 'active'),
    /** Рекламодатель: оплатить и отправить объявление на проверку. */
    async buy(form) { if (!enabled()) throw new Error('Рекламная площадка ещё не настроена'); const v = validate(form); const lamports = Math.round(priceSol(v.plan, await MB.data.solUsd()) * 1e9);
      const memo = 'MB1|' + JSON.stringify({ t: v.title, x: v.text, l: v.link, p: v.plan.id, s: lamports });
      return send(memo, lamports); },
    /** Владелец: одобрить или отклонить объявление (запись в блокчейне с его подписью). */
    async decide(sig, ok) { if (MB.store.get().wallet.address !== C.ADS_WALLET) throw new Error('Одобрять может только владелец площадки'); return send((ok ? 'MBOK|' : 'MBNO|') + sig, 0); },
    isOwner: () => enabled() && MB.store.get().wallet.connected && MB.store.get().wallet.address === C.ADS_WALLET,
  };
})();
