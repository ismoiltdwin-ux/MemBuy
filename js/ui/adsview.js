/* Экран «Реклама»: рекламный кабинет (демо). */
MB.views = MB.views || {};
MB.views.ads = (() => {
  const { esc, usd, num } = MB.util; let root;
  const val = id => root.querySelector('#' + id).value;
  function preview() { const pl = val('apl'), days = Math.max(1, Math.min(30, Math.round(+val('adays') || 1))); root.querySelector('#aprice').textContent = usd(MB.ads.price(pl, days)); root.querySelector('#aprev').innerHTML = `<div class="row ad"><span class="adtag">Реклама</span><span class="nm"><b>${esc(val('atitle') || 'Заголовок объявления')}</b><small>${esc(val('atext') || 'Текст объявления')}</small></span><span class="pr"><b>→</b></span></div>`; }
  function campaigns() {
    const st = MB.store.get(), box = root.querySelector('#camps');
    box.innerHTML = st.campaigns.length ? st.campaigns.map(c => { const s = st.adStats[c.id] || { views: 0, clicks: 0 }, left = Math.max(0, Math.ceil((c.until - Date.now()) / 864e5)); return `<div class="row camp"><span class="nm"><b>${esc(c.title)}</b><small>${MB.ads.PLACEMENTS[c.placement].name} · ${c.status === 'active' ? 'идёт, осталось ' + left + ' дн.' : 'на паузе'} · ${usd(c.total)}</small><small>Показы: ${num(s.views, 0)} · Переходы: ${num(s.clicks, 0)}</small></span><span class="crow"><button class="chip" data-tg="${esc(c.id)}">${c.status === 'active' ? 'Пауза' : 'Запустить'}</button><button class="chip" data-rm="${esc(c.id)}">Удалить</button></span></div>`; }).join('') : MB.ui.empty('Кампаний пока нет', 'Создайте первую кампанию в форме выше.');
    root.querySelector('#income').textContent = usd(MB.ads.income());
  }
  return {
    mount(el) {
      root = el; const P = MB.ads.PLACEMENTS;
      el.innerHTML = `<a class="back" href="#profile">← Профиль</a><h1 class="pt">Реклама</h1>
        <div class="note">Демо: оплата не списывается, объявление видно только в этом браузере. Для настоящей рекламы нужен сервер с приёмом оплаты и проверкой объявлений.</div>
        <dl class="stats"><div><dt>${P.feed.name}</dt><dd>$${P.feed.day} в день</dd></div><div><dt>${P.market.name}</dt><dd>$${P.market.day} в день</dd></div><div><dt>Доход площадки (демо)</dt><dd id="income">$0</dd></div></dl>
        <form class="card form" id="aform" novalidate><h2 class="h2">Новая кампания</h2>
          <label class="fld"><span>Заголовок (до 40 знаков)</span><input id="atitle" maxlength="40" autocomplete="off"></label>
          <label class="fld"><span>Текст (до 90 знаков)</span><input id="atext" maxlength="90" autocomplete="off"></label>
          <label class="fld"><span>Ссылка</span><input id="alink" placeholder="https://..." autocomplete="off"></label>
          <div class="two"><label class="fld"><span>Место показа</span><select id="apl">${Object.entries(P).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join('')}</select></label><label class="fld"><span>Дней (1–30)</span><input id="adays" inputmode="numeric" value="3"></label></div>
          <div class="fld"><span>Так объявление увидят пользователи</span><div id="aprev"></div></div>
          <div class="quote"><div><dt>Стоимость кампании</dt><dd><b id="aprice">$0</b></dd></div></div>
          <button class="btn big accent" type="submit">Запустить кампанию</button>
          <p class="fine">Объявления помечаются словом «Реклама». Запрещены обещания дохода, обман и чужие товарные знаки.</p></form>
        <h2 class="h2">Мои кампании</h2><div class="list" id="camps"></div>`;
      ['atitle', 'atext', 'apl', 'adays'].forEach(id => el.querySelector('#' + id).addEventListener('input', preview));
      el.querySelector('#aform').addEventListener('submit', e => { e.preventDefault(); try { MB.ads.create({ title: val('atitle'), text: val('atext'), link: val('alink'), placement: val('apl'), days: val('adays') }); MB.ui.toast('Кампания запущена'); ['atitle', 'atext', 'alink'].forEach(id => { el.querySelector('#' + id).value = ''; }); preview(); } catch (err) { MB.ui.toast(err.message, 'err'); } });
      el.querySelector('#camps').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.tg) MB.ads.toggle(b.dataset.tg); if (b.dataset.rm) MB.ads.remove(b.dataset.rm); });
      preview(); campaigns();
    },
    unmount() { root = null; }, onState() { if (root) campaigns(); },
  };
})();
