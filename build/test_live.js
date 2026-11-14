// Проверка живого режима на ПОДДЕЛЬНЫХ ответах сети: node build/test_live.js
// Настоящие DexScreener, Jupiter, Solana и Phantom здесь не участвуют — проверяется только, что код живого режима выполняется без ошибок.
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'index.html') + '?mode=live';
const SOL = 'So11111111111111111111111111111111111111112', MINT = 'MintAAA1111111111111111111111111111111111111';
const pair = (addr, sym, name, price) => ({ chainId: 'solana', pairAddress: 'Pool' + sym, baseToken: { address: addr, symbol: sym, name }, priceUsd: String(price), marketCap: 2e6, volume: { h24: 5e4 }, priceChange: { h24: 12 }, liquidity: { usd: 8e4 }, pairCreatedAt: Date.now() - 864e5 });
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 844 } }), errs = [], res = [], calls = []; const ok = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.phantom = { solana: { isPhantom: true, on: () => {}, connect: async o => { if (o && o.onlyIfTrusted && !sessionStorage.getItem('mbTrusted')) throw new Error('not trusted'); sessionStorage.setItem('mbTrusted', '1'); return ({ publicKey: { toString: () => 'WalletAAA1111111111111111111111111111111111' } }); }, disconnect: async () => {}, signAndSendTransaction: async () => { window.__signed = (window.__signed || 0) + 1; return { signature: 'SIG123' }; } } }; window.solanaWeb3 = { VersionedTransaction: { deserialize: bytes => ({ bytes }) } }; });
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  await p.route('https://api.dexscreener.com/**', r => { const u = r.request().url(); calls.push(u); if (u.includes('token-boosts')) return json(r, [{ chainId: 'solana', tokenAddress: MINT }]); if (u.includes(SOL)) return json(r, { pairs: [pair(SOL, 'SOL', 'Solana', 150)] }); return json(r, { pairs: [pair(MINT, 'AAA', 'Alpha Coin', 0.002)] }); });
  await p.route('https://api.geckoterminal.com/**', r => json(r, { data: { attributes: { ohlcv_list: Array.from({ length: 24 }, (_, i) => [1e9 - i * 3600, 0.002, 0.0022, 0.0019, 0.002 + i * 1e-5, 100]) } } }));
  await p.route(u => /solana\.com|helius-rpc\.com/.test(String(u)), r => { const m = JSON.parse(r.request().postData()).method; calls.push(m); const out = m === 'getBalance' ? { value: 2e9 } : m === 'getTokenSupply' ? { value: { decimals: 6 } } : { value: m === 'getTokenAccountsByOwner' && JSON.parse(r.request().postData()).params[1].programId.startsWith('Tokenkeg') && global.__bought ? [{ account: { data: { parsed: { info: { mint: MINT, tokenAmount: { uiAmount: 37500 } } } } } }] : [] }; return json(r, { jsonrpc: '2.0', id: 1, result: out }); });
  await p.route('https://lite-api.jup.ag/**', r => { const u = r.request().url(); calls.push(u); if (u.includes('/quote')) return json(r, { outAmount: u.includes('inputMint=' + SOL) ? '37500000000' : '490000000', otherAmountThreshold: u.includes('inputMint=' + SOL) ? '37125000000' : '485100000', priceImpactPct: '0.002' }); global.__bought = true; return json(r, { swapTransaction: 'AAAA' }); });
  await p.goto(URL); await p.waitForTimeout(900);
  ok('демо-плашка скрыта', await p.evaluate(() => document.getElementById('demoBar').hidden && MB.config.MODE === 'live'));
  ok('разделы с выдуманными данными скрыты', await p.evaluate(() => [...document.querySelectorAll('[data-nav=feed],[data-nav=leaders]')].every(a => a.hidden)));
  ok('список монет из DexScreener', await p.locator('#list a.row[data-id]').count() === 1 && (await p.textContent('#list')).includes('Alpha Coin'));
  await p.goto(URL + '#feed'); await p.waitForTimeout(400); ok('прямая ссылка на ленту ведёт на рынок', await p.locator('#list').count() === 1);
  await p.goto(URL + '#t-' + MINT); await p.waitForTimeout(700); ok('страница монеты и график', (await p.textContent('.thead')).includes('Alpha Coin'));
  await p.click('[data-ct=candle]'); await p.waitForTimeout(400);
  await p.fill('#amt', '0.5'); await p.waitForTimeout(500); ok('котировка Jupiter: 37 500 монет за 0.5 SOL', /37[\s,.]?500/.test(await p.textContent('#quote')));
  await p.click('#go'); await p.waitForTimeout(900); ok('покупка: кошелёк подключён, сделка подписана', await p.evaluate(() => MB.store.get().wallet.connected && window.__signed === 1) && (await p.textContent('#tstatus')).includes('Куплено'));
  await p.evaluate(() => MB.wallet.refresh()); await p.waitForTimeout(400); ok('баланс SOL и монет прочитан из сети', await p.evaluate(m => MB.store.get().wallet.sol === 2 && MB.store.get().holdings[m] && MB.store.get().holdings[m].qty === 37500, MINT));
  await p.click('#sellall'); await p.waitForTimeout(500); await p.click('#go'); await p.waitForTimeout(900); ok('продажа всей позиции подписана', await p.evaluate(() => window.__signed === 2));
  await p.goto(URL + '#profile'); await p.waitForTimeout(700); ok('профиль без демо-кнопок', await p.locator('.qgrid a').count() === 1);
  ok('после перезагрузки кошелёк подключился сам', await p.evaluate(() => MB.store.get().wallet.connected));
  ok('в профиле адрес для пополнения', (await p.textContent('.dep .addr')).includes('WalletAAA'));
  await p.goto(URL + '#market'); await p.waitForTimeout(700); await p.click('#walletBtn'); await p.waitForTimeout(500);
  ok('кнопка баланса в шапке не отключает кошелёк, а открывает профиль', await p.evaluate(() => MB.store.get().wallet.connected && location.hash === '#profile'));
  p.once('dialog', d => d.accept()); await p.click('#wdis'); await p.waitForTimeout(400); ok('отключение — только из профиля, с подтверждением', await p.evaluate(() => !MB.store.get().wallet.connected));
  ok('запросы: комиссия площадки не передаётся без FEE_ACCOUNT', !calls.some(u => String(u).includes('platformFeeBps')));
  console.log(res.join('\n')); console.log('\nИтого:', res.filter(r => r.startsWith('PASS')).length, 'из', res.length, '| ошибки:', errs.length ? errs : 'нет'); await b.close(); process.exit(res.some(r => r.startsWith('FAIL')) || errs.length ? 1 : 0);
})();
