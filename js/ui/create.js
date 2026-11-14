/* Экран «Создать монету» (демо): монета появляется только в этом браузере. */
MB.views = MB.views || {};
MB.views.create = (() => {
  const { esc } = MB.util; let root, icon = '';
  function pick(file) {
    MB.util.squareImage(file, 96).then(url => { icon = url; if (root) root.querySelector('#prev').innerHTML = `<img class="ava" src="${icon}" alt="Картинка монеты" width="72" height="72" style="width:72px;height:72px">`; }, e => MB.ui.toast(e.message, 'err'));
  }
  function submit(e) {
    e.preventDefault(); const f = root.querySelector('form'), name = f.cname.value.trim(), sym = f.csym.value.trim().toUpperCase(), desc = f.cdesc.value.trim(), link = f.clink.value.trim();
    try {
      if (!MB.store.get().wallet.connected) throw new Error('Сначала подключите кошелёк');
      if (name.length < 2 || name.length > 32) throw new Error('Название: от 2 до 32 знаков');
      if (!/^[A-Z0-9]{2,10}$/.test(sym)) throw new Error('Тикер: от 2 до 10 латинских букв или цифр');
      if (MB.providers.demo.has(sym)) throw new Error('Монета с таким тикером уже есть');
      if (link && !MB.ads.safe(link)) throw new Error('Ссылка должна начинаться с https://');
      const c = { sym, name, desc, icon, links: link, seed: Date.now() % 100000, ts: Date.now() };
      MB.store.update(s => { s.coins.push(c); }); MB.providers.demo.add(c); MB.store.note('Монета ' + sym + ' создана'); MB.ui.toast('Монета ' + sym + ' создана'); icon = ''; location.hash = 't-' + sym;
    } catch (err) { MB.ui.toast(err.message, 'err'); }
  }
  /* ---------- Живой режим: настоящий выпуск на pump.fun ---------- */
  function liveMount(el) {
    const back = '<a class="back" href="#profile">← Профиль</a><h1 class="pt">Создать монету</h1>';
    if (!MB.pumpcreate.enabled()) { el.innerHTML = back + MB.ui.empty('Создание монет ещё не настроено', 'Владелец сайта должен подключить загрузку картинок.'); return; }
    let file = null;
    el.innerHTML = back + `<div class="note">Монета выпускается по-настоящему на pump.fun и навсегда появляется в блокчейне Solana. Выпуск стоит около ${MB.config.CREATE_RESERVE_SOL} SOL плюс первая покупка. Данные монеты нельзя изменить после создания.</div>
      <form class="card form" id="lform" novalidate>
        <div class="fld"><span>Картинка (PNG, JPG, GIF или WEBP, до 4 МБ)</span><div class="crow"><span id="prev" class="prev"></span><label class="btn ghost" for="cfile">Выбрать файл</label><input id="cfile" type="file" accept="image/png,image/jpeg,image/gif,image/webp" class="sr"></div></div>
        <label class="fld"><span>Название</span><input id="cname" maxlength="32" placeholder="Например, Tilla" autocomplete="off"></label>
        <label class="fld"><span>Тикер</span><input id="csym" maxlength="10" placeholder="Например, TILLA" autocomplete="off"></label>
        <label class="fld"><span>Описание (необязательно)</span><textarea id="cdesc" maxlength="1000" rows="3" placeholder="Коротко о монете"></textarea></label>
        <label class="fld"><span>X / Twitter (необязательно)</span><input id="ctw" placeholder="https://x.com/..." autocomplete="off"></label>
        <label class="fld"><span>Telegram (необязательно)</span><input id="ctg" placeholder="https://t.me/..." autocomplete="off"></label>
        <label class="fld"><span>Сайт (необязательно)</span><input id="cweb" placeholder="https://..." autocomplete="off"></label>
        <label class="fld"><span>Первая покупка, SOL (можно 0)</span><input id="cbuy" inputmode="decimal" value="0" autocomplete="off"><small>Автор монеты обычно сам покупает немного сразу при выпуске.</small></label>
        <button class="btn big accent" type="submit" id="cgo">Выпустить монету</button>
        <div id="cstat" class="tstatus" role="status" aria-live="polite"></div>
      </form><div id="cdone"></div>`;
    const stat = (t, k = '') => { const s = el.querySelector('#cstat'); if (s) { s.className = 'tstatus' + (k ? ' ' + k : ''); s.textContent = t; } };
    el.querySelector('#cfile').addEventListener('change', e => { file = e.target.files[0] || null; if (!file) return; const url = URL.createObjectURL(file); el.querySelector('#prev').innerHTML = `<img class="ava" src="${url}" alt="Картинка монеты" width="72" height="72" style="width:72px;height:72px">`; });
    el.querySelector('#lform').addEventListener('submit', async e => { e.preventDefault(); const b = el.querySelector('#cgo'); if (b.disabled) return;
      const val = id => el.querySelector('#' + id).value;
      try { if (!MB.store.get().wallet.connected) await MB.wallet.connect(); b.disabled = true;
        const res = await MB.pumpcreate.create({ image: file, name: val('cname'), symbol: val('csym'), description: val('cdesc'), twitter: val('ctw'), telegram: val('ctg'), website: val('cweb'), devBuy: val('cbuy') }, t => stat(t));
        stat('Монета выпущена', 'ok'); MB.ui.toast('Монета ' + res.symbol + ' выпущена');
        el.querySelector('#cdone').innerHTML = `<div class="card stack"><h2 class="h2">Монета ${esc(res.symbol)} выпущена</h2><p class="hint">Адрес монеты: <code class="addr">${esc(res.mint)}</code>В списках Membuy она появится через несколько минут — когда её увидит DexScreener.</p>
          <div class="qgrid"><a class="btn accent" href="https://pump.fun/coin/${esc(res.mint)}" target="_blank" rel="noopener">Открыть на pump.fun</a><a class="btn ghost" href="https://solscan.io/tx/${esc(res.sig)}" target="_blank" rel="noopener">Транзакция</a><a class="btn ghost" href="#t-${esc(res.mint)}">Открыть в Membuy</a></div></div>`;
      } catch (err) { stat(err.message, 'err'); MB.ui.toast(err.message, 'err'); } finally { b.disabled = false; } });
  }
  return {
    mount(el) {
      root = el; if (MB.config.LIVE) return liveMount(el);
      el.innerHTML = `<a class="back" href="#profile">← Профиль</a><h1 class="pt">Создать монету</h1>
        <div class="note">Демо: монета появится только в этом браузере, в блокчейне её не будет. Для настоящего выпуска нужен смарт-контракт с аудитом.</div>
        <form class="card form" novalidate>
          <div class="fld"><span>Картинка</span><div class="crow"><span id="prev" class="prev"></span><label class="btn ghost" for="cfile">Выбрать файл</label><input id="cfile" type="file" accept="image/*" class="sr"></div></div>
          <label class="fld"><span>Название</span><input id="cname" name="cname" maxlength="32" placeholder="Например, Tilla" autocomplete="off"></label>
          <label class="fld"><span>Тикер</span><input id="csym" name="csym" maxlength="10" placeholder="Например, TILLA" autocomplete="off"></label>
          <label class="fld"><span>Описание (необязательно)</span><textarea id="cdesc" name="cdesc" maxlength="300" rows="3" placeholder="Коротко о монете"></textarea></label>
          <label class="fld"><span>Ссылка на соцсеть (необязательно)</span><input id="clink" name="clink" placeholder="https://t.me/..." autocomplete="off"></label>
          <button class="btn big accent" type="submit">Создать монету</button>
          <p class="fine">Данные монеты нельзя изменить после создания.</p>
        </form>`;
      el.querySelector('#cfile').addEventListener('change', e => pick(e.target.files[0])); el.querySelector('form').addEventListener('submit', submit);
    },
    unmount() { root = null; },
  };
})();
