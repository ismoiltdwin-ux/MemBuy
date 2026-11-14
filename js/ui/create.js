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
  return {
    mount(el) {
      root = el;
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
