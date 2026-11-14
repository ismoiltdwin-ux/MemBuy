// Проверка живого режима на ПОДДЕЛЬНЫХ ответах сети: node build/test_live.js
// Настоящие DexScreener, Jupiter, Solana и Phantom здесь не участвуют — проверяется только, что код живого режима выполняется без ошибок.
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'index.html') + '?mode=live';
const OWNER = 'OwnerAAA111111111111111111111111111111111111', chain = []; const SOL = 'So11111111111111111111111111111111111111112', MINT = 'MintAAA1111111111111111111111111111111111111';
const pair = (addr, sym, name, price) => ({ chainId: 'solana', pairAddress: 'Pool' + sym, baseToken: { address: addr, symbol: sym, name }, priceUsd: String(price), marketCap: 2e6, volume: { h24: 5e4 }, priceChange: { h24: 12 }, liquidity: { usd: 8e4 }, pairCreatedAt: Date.now() - 864e5 });
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 844 } }), errs = [], res = [], calls = []; const ok = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  p.on('pageerror', e => errs.push(e.message));
  await p.exposeFunction('__recordTx', j => { const t = JSON.parse(j), memo = t.ins.find(i => i.type === 'memo').memo, pay = t.ins.find(i => i.type === 'transfer'); const sig = 'SIG' + (chain.length + 1) + 'X'.repeat(20); chain.push({ sig, memo, payer: t.payer, lamports: pay ? pay.lamports : 0, to: pay && pay.to, time: Math.floor(Date.now() / 1000) }); return sig; });
  await p.addInitScript(() => { try { localStorage.setItem('membuy-onb-live', '1'); } catch (e) {} window.phantom = { solana: { isPhantom: true, on: () => {}, connect: async o => { if (o && o.onlyIfTrusted && !sessionStorage.getItem('mbTrusted')) throw new Error('not trusted'); sessionStorage.setItem('mbTrusted', '1'); return ({ publicKey: { toString: () => 'WalletAAA1111111111111111111111111111111111' } }); }, disconnect: async () => {}, signAndSendTransaction: async tx => { if (tx.ins) { const sig = await window.__recordTx(JSON.stringify({ ins: tx.ins, payer: String(tx.o.feePayer) })); return { signature: sig }; } window.__signed = (window.__signed || 0) + 1; return { signature: 'SIG123' }; } } }; window.solanaWeb3 = { VersionedTransaction: { deserialize: bytes => ({ bytes, message: { staticAccountKeys: [{ toBase58: () => window.__jupFor || 'WalletAAA1111111111111111111111111111111111' }] } }) },
    PublicKey: class { constructor(k) { this.k = k; } toString() { return this.k; } },
    Transaction: class { constructor(o) { this.o = o; this.ins = []; } add(i) { this.ins.push(i); return this; } },
    SystemProgram: { transfer: o => ({ type: 'transfer', from: String(o.fromPubkey), to: String(o.toPubkey), lamports: o.lamports }) },
    TransactionInstruction: class { constructor(o) { this.type = 'memo'; this.memo = new TextDecoder().decode(o.data); } } }; });
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  await p.route('https://api.dexscreener.com/**', r => { const u = r.request().url(); calls.push(u); if (u.includes('token-boosts')) return json(r, [{ chainId: 'solana', tokenAddress: MINT }]); if (u.includes(SOL)) return json(r, { pairs: [pair(SOL, 'SOL', 'Solana', 150)] }); return json(r, { pairs: [pair(MINT, 'AAA', 'Alpha Coin', 0.002)] }); });
  await p.route('https://api.geckoterminal.com/**', r => (calls.push(r.request().url()), json(r, { data: { attributes: { ohlcv_list: Array.from({ length: 24 }, (_, i) => [1e9 - i * 3600, 0.002, 0.0022, 0.0019, 0.002 + i * 1e-5, 100]) } } })));
  await p.route(u => /solana\.com|helius-rpc\.com/.test(String(u)), r => { const body = JSON.parse(r.request().postData()), m = body.method; calls.push(m);
    if (m === 'getLatestBlockhash') return json(r, { jsonrpc: '2.0', id: 1, result: { value: { blockhash: 'BH1' } } });
    if (m === 'getSignaturesForAddress') return json(r, { jsonrpc: '2.0', id: 1, result: chain.map(t => ({ signature: t.sig, err: null, memo: '[' + t.memo.length + '] ' + t.memo })).reverse() });
    if (m === 'getTransaction') { const t = chain.find(x => x.sig === body.params[0]); return json(r, { jsonrpc: '2.0', id: 1, result: t ? { blockTime: t.time, meta: { err: null }, transaction: { message: { accountKeys: [{ pubkey: t.payer, signer: true }, { pubkey: OWNER, signer: false }], instructions: [...(t.lamports ? [{ program: 'system', parsed: { type: 'transfer', info: { source: t.payer, destination: OWNER, lamports: t.lamports } } }] : []), { program: 'spl-memo', parsed: t.memo }] } } } : null }); } const out = m === 'getBalance' ? { value: 2e9 } : m === 'getTokenSupply' ? { value: { decimals: 6 } } : { value: m === 'getTokenAccountsByOwner' && JSON.parse(r.request().postData()).params[1].programId.startsWith('Tokenkeg') && global.__bought ? [{ account: { data: { parsed: { info: { mint: MINT, tokenAmount: { uiAmount: 37500 } } } } } }] : [] }; return json(r, { jsonrpc: '2.0', id: 1, result: out }); });
  await p.route('https://lite-api.jup.ag/**', r => { const u = r.request().url(); calls.push(u); if (u.includes('/quote')) return json(r, { outAmount: u.includes('inputMint=' + SOL) ? '37500000000' : '490000000', otherAmountThreshold: u.includes('inputMint=' + SOL) ? '37125000000' : '485100000', priceImpactPct: '0.002' }); global.__bought = true; return json(r, { swapTransaction: 'AAAA' }); });
  await p.goto(URL); await p.waitForTimeout(900);
  ok('демо-плашка скрыта', await p.evaluate(() => document.getElementById('demoBar').hidden && MB.config.MODE === 'live'));
  ok('разделы с выдуманными данными скрыты', await p.evaluate(() => [...document.querySelectorAll('[data-nav=feed],[data-nav=leaders]')].every(a => a.hidden)));
  ok('список монет из DexScreener', await p.locator('#list a.row[data-id]').count() === 1 && (await p.textContent('#list')).includes('Alpha Coin'));
  await p.goto(URL + '#feed'); await p.waitForTimeout(400); ok('прямая ссылка на ленту ведёт на рынок', await p.locator('#list').count() === 1);
  await p.goto(URL + '#t-' + MINT); await p.waitForTimeout(700); ok('страница монеты и график', (await p.textContent('.thead')).includes('Alpha Coin'));
  await p.click('[data-ct=candle]'); await p.waitForTimeout(400);
  for (const [tf, q] of [['15s', 'ohlcv/second?aggregate=15'], ['1m', 'ohlcv/minute?aggregate=1'], ['4h', 'ohlcv/hour?aggregate=4'], ['1d', 'ohlcv/day?aggregate=1']]) { await p.click(`[data-tf="${tf}"]`); await p.waitForTimeout(250); ok('таймфрейм ' + tf + ' запрашивает ' + q, calls.some(u => String(u).includes(q))); }
  ok('свечи по времени: старые слева, новые справа', await p.evaluate(() => { const m = document.getElementById('cv')._mb; return m && m.N === 24; }));
  await p.fill('#amt', '0.5'); await p.waitForTimeout(500); ok('котировка Jupiter: 37 500 монет за 0.5 SOL', /37[\s,.]?500/.test(await p.textContent('#quote')));
  await p.click('#go'); await p.waitForTimeout(900); ok('покупка: кошелёк подключён, сделка подписана', await p.evaluate(() => MB.store.get().wallet.connected && window.__signed === 1) && (await p.textContent('#tstatus')).includes('Куплено'));
  await p.evaluate(() => MB.wallet.refresh()); await p.waitForTimeout(400); ok('баланс SOL и монет прочитан из сети', await p.evaluate(m => MB.store.get().wallet.sol === 2 && MB.store.get().holdings[m] && MB.store.get().holdings[m].qty === 37500, MINT));
  await p.click('#sellall'); await p.waitForTimeout(500); await p.click('#go'); await p.waitForTimeout(900); ok('продажа всей позиции подписана', await p.evaluate(() => window.__signed === 2));
  await p.goto(URL + '#profile'); await p.waitForTimeout(700); ok('профиль без демо-кнопок', await p.locator('.qgrid a').count() === 2 && !(await p.locator('.qgrid a[href="#create"]').count()));
  ok('после перезагрузки кошелёк подключился сам', await p.evaluate(() => MB.store.get().wallet.connected));
  ok('в профиле адрес для пополнения', (await p.textContent('.dep .addr')).includes('WalletAAA'));
  await p.goto(URL + '#market'); await p.waitForTimeout(700); await p.click('#walletBtn'); await p.waitForTimeout(500);
  ok('кнопка баланса в шапке не отключает кошелёк, а открывает профиль', await p.evaluate(() => MB.store.get().wallet.connected && location.hash === '#profile'));
  p.once('dialog', d => d.accept()); await p.click('#wdis'); await p.waitForTimeout(400); ok('отключение — только из профиля, с подтверждением', await p.evaluate(() => !MB.store.get().wallet.connected));
  // ---- Реклама в блокчейне ----
  const setOwner = () => p.evaluate(o => { MB.config.ADS_WALLET = o; }, OWNER);
  await p.goto(URL + '#ads'); await p.waitForTimeout(600); ok('реклама без кошелька площадки: «не настроена»', (await p.textContent('#view')).includes('не настроена'));
  await setOwner(); await p.evaluate(() => { location.hash = 'profile'; }); await p.waitForTimeout(300); await p.evaluate(() => { location.hash = 'ads'; }); await p.waitForTimeout(700);
  ok('цена рекламы в SOL', (await p.textContent('#aprice')).includes('0,15') || (await p.textContent('#aprice')).includes('0.15'));
  await p.fill('#atitle', 'Мой проект'); await p.fill('#atext', 'Лучший мемкоин недели на Solana'); await p.fill('#alink', 'javascript:alert(1)'); await p.click('#apay'); await p.waitForTimeout(400);
  ok('опасная ссылка не принимается', chain.length === 0);
  await p.fill('#alink', 'https://example.com/coin'); await p.click('#apay'); await p.waitForTimeout(600);
  ok('оплата: перевод 0.15 SOL на кошелёк площадки + текст в заметке', chain.length === 1 && chain[0].lamports === 150000000 && chain[0].to === OWNER && chain[0].memo.startsWith('MB1|') && chain[0].memo.includes('example.com'));
  chain.push({ sig: 'FAKEOK' + 'Y'.repeat(20), memo: 'MBOK|' + chain[0].sig, payer: 'Attacker1111111111111111111111111111111111', lamports: 1, time: Math.floor(Date.now() / 1000) });
  await p.evaluate(() => MB.adchain.load(true)); await p.waitForTimeout(300); await p.evaluate(() => { location.hash = 'profile'; }); await p.waitForTimeout(200); await p.evaluate(() => { location.hash = 'ads'; }); await p.waitForTimeout(700);
  ok('моё объявление «На проверке»', (await p.textContent('#camps')).includes('На проверке'));
  ok('«одобрение» с чужого кошелька не действует', await p.evaluate(() => MB.adchain.active().length === 0));
  ok('раздел модерации скрыт от рекламодателя', await p.locator('#mod').isHidden());
  await p.evaluate(o => MB.store.set({ wallet: { connected: true, address: o, sol: 1 } }), OWNER); await p.waitForTimeout(700);
  ok('владелец видит модерацию и объявление', await p.locator('#mod').isVisible() && (await p.textContent('#mod')).includes('Мой проект'));
  await p.click('[data-ok]'); await p.waitForTimeout(500);
  ok('одобрение — заметка с подписью владельца, без перевода', chain.length === 3 && chain[2].memo === 'MBOK|' + chain[0].sig && chain[2].payer === OWNER && !chain[2].lamports);
  await p.evaluate(() => MB.adchain.load(true)); ok('объявление показывается', await p.evaluate(() => MB.adchain.active().length === 1));
  await p.evaluate(() => { location.hash = 'market'; }); await p.waitForTimeout(700); ok('объявление в списке монет', await p.evaluate(() => { const a = document.querySelector('#list .row.ad'); return !!a && a.textContent.includes('Мой проект') && a.getAttribute('href') === 'https://example.com/coin'; }));
  ok('запросы: комиссия площадки не передаётся без FEE_ACCOUNT', !calls.some(u => String(u).includes('platformFeeBps')));
  console.log(res.join('\n')); console.log('\nИтого:', res.filter(r => r.startsWith('PASS')).length, 'из', res.length, '| ошибки:', errs.length ? errs : 'нет'); await b.close(); process.exit(res.some(r => r.startsWith('FAIL')) || errs.length ? 1 : 0);
})();
