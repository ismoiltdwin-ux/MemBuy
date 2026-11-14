/* Выпуск настоящей монеты на pump.fun (живой режим).
   1. Картинка и описание уходят на наш сервер-посредник (config.UPLOAD_URL), он кладёт их в IPFS и возвращает адрес описания.
   2. PumpPortal собирает транзакцию выпуска (+ первая покупка автором).
   3. Подписывают двое: пользователь в Phantom и одноразовый ключ адреса новой монеты (создаётся в браузере и сразу забывается).
   4. Транзакция отправляется в сеть через узел Solana (config.RPC_URL). */
MB.pumpcreate = (() => {
  const C = MB.config, b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const enabled = () => C.LIVE && !!C.UPLOAD_URL;
  function validate(f) {
    const v = { name: String(f.name || '').trim(), symbol: String(f.symbol || '').trim().toUpperCase(), description: String(f.description || '').trim(), twitter: String(f.twitter || '').trim(), telegram: String(f.telegram || '').trim(), website: String(f.website || '').trim(), devBuy: +String(f.devBuy || '0').replace(',', '.'), image: f.image };
    if (!v.image || !/^image\/(png|jpeg|gif|webp)$/.test(v.image.type)) throw new Error('Картинка: PNG, JPG, GIF или WEBP');
    if (v.image.size > 4 * 1024 * 1024) throw new Error('Картинка больше 4 МБ');
    if (v.name.length < 1 || v.name.length > 32) throw new Error('Название: от 1 до 32 знаков');
    if (!/^[A-Z0-9]{1,10}$/.test(v.symbol)) throw new Error('Тикер: до 10 латинских букв или цифр');
    if (v.description.length > 1000) throw new Error('Описание: до 1000 знаков');
    for (const u of [v.twitter, v.telegram, v.website]) if (u && !MB.ads.safe(u)) throw new Error('Ссылки должны начинаться с https://');
    if (!(v.devBuy >= 0 && v.devBuy <= 10)) throw new Error('Первая покупка: от 0 до 10 SOL');
    return v;
  }
  /** step(text) сообщает этап, чтобы показать его на экране. Возвращает { mint, sig }. */
  async function create(form, step = () => {}) {
    if (!enabled()) throw new Error('Создание монет ещё не настроено');
    const st = MB.store.get(); if (!st.wallet.connected) throw new Error('Сначала подключите кошелёк');
    const v = validate(form);
    if (st.wallet.sol < v.devBuy + C.CREATE_RESERVE_SOL) throw new Error(`Нужно не меньше ${MB.util.num(v.devBuy + C.CREATE_RESERVE_SOL, 3)} SOL: первая покупка и ~${C.CREATE_RESERVE_SOL} SOL на выпуск и сборы сети`);
    step('Загружаем картинку и описание…');
    const fd = new FormData(); fd.append('image', v.image); ['name', 'symbol', 'description', 'twitter', 'telegram', 'website'].forEach(k => fd.append(k, v[k]));
    const up = await fetch(C.UPLOAD_URL, { method: 'POST', body: fd }).catch(() => null), upd = up ? await up.json().catch(() => ({})) : {};
    if (!up || !up.ok || !/^https:\/\//.test(upd.uri || '')) throw new Error(upd.error || 'Не удалось загрузить картинку');
    step('Готовим выпуск…'); await MB.wallet.web3(); const W = window.solanaWeb3, mint = W.Keypair.generate(), mintAddr = mint.publicKey.toBase58();
    const r = await fetch(C.PUMP_API + '/trade-local', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ publicKey: st.wallet.address, action: 'create',
      tokenMetadata: { name: v.name, symbol: v.symbol, uri: upd.uri }, mint: mintAddr, denominatedInSol: 'true', amount: v.devBuy, slippage: 10, priorityFee: 0.00005, pool: 'pump' }) }).catch(() => null);
    if (!r || !r.ok) throw new Error('pump.fun не подготовил выпуск' + (r ? ' (' + r.status + ')' : ''));
    const tx = W.VersionedTransaction.deserialize(new Uint8Array(await r.arrayBuffer()));
    // Проверка: в транзакции должны быть именно ваш кошелёк и адрес новой монеты — иначе не подписываем.
    const keys = tx.message.staticAccountKeys.map(k => k.toBase58 ? k.toBase58() : String(k));
    if (!keys.includes(st.wallet.address) || !keys.includes(mintAddr)) throw new Error('Транзакция выпуска не совпадает с вашим кошельком — подпись отменена');
    step('Подтвердите выпуск в Phantom…');
    let signed; try { signed = await MB.wallet.provider().signTransaction(tx); } catch (e) { throw MB.wallet.rejected(e); }
    signed.sign([mint]); // вторая подпись — ключ адреса монеты (Phantom подписал первым, поэтому его изменения не ломают подпись)
    step('Отправляем в сеть…');
    const sig = await MB.wallet.rpc('sendTransaction', [b64(signed.serialize()), { encoding: 'base64', maxRetries: 3 }]);
    MB.store.note('Монета ' + v.symbol + ' выпущена на pump.fun'); setTimeout(() => MB.wallet.refresh().catch(() => {}), 6000);
    return { mint: mintAddr, sig, symbol: v.symbol };
  }
  return { enabled, validate, create };
})();
