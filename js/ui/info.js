/* Справка, условия, приватность и знакомство при первом входе. Тексты зависят от режима (демо / настоящие деньги). */
MB.views = MB.views || {};
(() => {
  const C = MB.config, back = '<a class="back" href="#profile">← Профиль</a>';
  const q = (title, text) => `<details><summary>${title}</summary><p>${text}</p></details>`;
  MB.views.help = {
    mount(el) {
      el.innerHTML = `${back}<h1 class="pt">Помощь</h1><div class="faq">
        ${q('Как это работает?', 'Вы подключаете Phantom, выбираете монету, вводите сумму и нажимаете «Купить» или «Продать». Membuy получает расчёт у Jupiter и готовит сделку, а подписываете её вы в Phantom.')}
        ${q('Что такое проскальзывание?', 'Это разница между ценой, которую вы видите, и ценой, по которой сделка исполнится. У мемкоинов с малой ликвидностью она бывает большой. По умолчанию Membuy ставит 1%.')}
        ${q('Почему сделка не проходит?', 'Причины: не хватает SOL на сделку и сетевой сбор, слишком сильное влияние на цену, цена успела измениться, или вы отклонили подпись в Phantom. Попробуйте сумму меньше или проскальзывание больше.')}
        ${q('Где мои монеты?', 'В вашем кошельке Phantom. Membuy не хранит ваши средства и не имеет к ним доступа.')}
        ${q('Это безопасно?', 'Ключи не покидают ваш кошелёк. Но мемкоины — крайне рискованный актив: цена может упасть до нуля. Никогда не вкладывайте больше, чем готовы потерять. Никому не сообщайте 12 секретных слов от кошелька.')}
        ${q('Есть ли комиссия?', 'Комиссия площадки — не больше 0,5% от суммы сделки. Её точный размер показывается в расчёте перед каждой сделкой. Сеть Solana дополнительно берёт небольшой сетевой сбор.')}
        ${q('Как пополнить и вывести деньги?', 'Пополнить: Профиль → «Скопировать адрес» и отправьте SOL в сети Solana с биржи или другого кошелька. Вывести: отправьте SOL из Phantom на биржу.')}
        ${q('Где новости Membuy?', `Telegram: <a class="lnk" href="${C.SOCIAL_TG}" target="_blank" rel="noopener">t.me/Membuy_market</a> · X: <a class="lnk" href="${C.SOCIAL_X}" target="_blank" rel="noopener">@golod_mem</a>`)}
        ${q('Как разместить рекламу?', 'Профиль → «Реклама». Оплата в SOL уходит владельцу площадки, объявление показывается всем после проверки.')}
      </div>`;
    },
  };
  MB.views.terms = {
    mount(el) {
      el.innerHTML = `${back}<h1 class="pt">Условия использования</h1><div class="card stack">
        <p>Membuy — интерфейс для обмена мемкоинов. Мы не храним ваши средства и не даём инвестиционных рекомендаций.</p>
        <p>Мемкоины крайне рискованны: цена может упасть до нуля. Вы пользуетесь сервисом на свой риск.</p>
        <p>Демо-режим: все монеты и сделки учебные, настоящие деньги не используются.</p>
        <p>Режим с настоящими деньгами: сделки проходят в блокчейне Solana и не отменяются. Комиссия площадки — не больше 0,5%, точная сумма видна перед сделкой.</p>
        <p>Реклама: объявления проверяет владелец площадки. Запрещены обещания дохода, обман, чужие товарные знаки и ссылки на сбор ключей.</p></div>`;
    },
  };
  MB.views.privacy = {
    mount(el) {
      el.innerHTML = `${back}<h1 class="pt">Приватность</h1><div class="card stack">
        <p>Профиль, сделки, фото и настройки хранятся только в вашем браузере. У Membuy нет своего сервера, и мы их не получаем.</p>
        <p>В режиме с настоящими деньгами сайт обращается к DexScreener и GeckoTerminal (цены и графики), Jupiter (расчёт и подготовка сделки) и узлу сети Solana (балансы). Им передаются ваш IP-адрес, а Jupiter и узлу Solana — ещё и адрес кошелька, без него нельзя посчитать сделку и баланс.</p>
        <p>Сделки и рекламные объявления записываются в блокчейн Solana и видны всем.</p></div>`;
    },
  };

  /** Пополнение: адрес кошелька и пошаговая инструкция. */
  MB.views.deposit = {
    mount(el) {
      const st = MB.store.get(), { esc } = MB.util;
      if (!st.wallet.connected) { el.innerHTML = `${back}<h1 class="pt">Депозит</h1>` + MB.ui.empty('Кошелёк не подключён', 'Подключите кошелёк, чтобы увидеть адрес для пополнения.', '<button class="btn accent" id="dcw">Подключить кошелёк</button>'); el.querySelector('#dcw').onclick = () => MB.wallet.connect().then(() => MB.views.deposit.mount(el), e => MB.ui.toast(e.message, 'err')); return; }
      if (!C.LIVE) { el.innerHTML = `${back}<h1 class="pt">Депозит</h1><div class="note">В демо пополнять не нужно: на учебном кошельке ${C.DEMO_START_SOL} условных SOL.</div>`; return; }
      el.innerHTML = `${back}<h1 class="pt">Депозит</h1>
        <div class="card dep"><h2 class="h2">Ваш адрес в сети Solana</h2><code class="addr">${esc(st.wallet.address)}</code><div class="qgrid"><button class="btn accent" id="dcopy">Скопировать адрес</button><button class="btn ghost" id="dref">Обновить баланс</button></div></div>
        <div class="note">Отправляйте только SOL и только в сети Solana. Монеты из другой сети (например, BEP20 или ERC20) на этот адрес пропадут.</div>
        <div class="card"><h2 class="h2">Как пополнить с биржи</h2><ol class="ol"><li>Купите SOL на бирже (Bybit, Binance и др.).</li><li>Откройте «Вывод», выберите монету SOL и сеть Solana.</li><li>Вставьте адрес выше и подтвердите вывод.</li><li>Через 1–2 минуты нажмите «Обновить баланс».</li></ol></div>`;
      el.querySelector('#dcopy').onclick = () => navigator.clipboard.writeText(st.wallet.address).then(() => MB.ui.toast('Адрес скопирован'), () => MB.ui.toast('Не удалось скопировать — выделите адрес вручную', 'err'));
      el.querySelector('#dref').onclick = () => MB.wallet.refresh().then(() => MB.ui.toast('Баланс обновлён'), e => MB.ui.toast(e.message, 'err'));
    },
  };

  /** Знакомство при первом входе: три шага, показывается один раз для каждого режима. */
  const KEY = 'membuy-onb-' + C.MODE;
  const STEPS = () => C.LIVE ? [
    ['Настоящие деньги', 'Сделки реальные и подписываются в вашем кошельке. Мемкоины могут упасть до нуля — начинайте с малых сумм.'],
    ['Подключите Phantom', 'Откройте сайт во встроенном браузере Phantom и нажмите «Подключить». Ключи остаются у вас.'],
    ['Пополните и купите', 'Профиль → «Скопировать адрес», отправьте SOL в сети Solana, затем выберите монету на рынке.'],
  ] : [
    ['Это демо', 'Монеты и сделки учебные, настоящие деньги не используются. Пробуйте смело, чтобы понять, как всё работает.'],
    ['Подключите кошелёк', 'В демо кошелёк учебный: на нём 5 условных SOL.'],
    ['Купите первую монету', 'Выберите монету на рынке, введите сумму и нажмите «Купить».'],
  ];
  MB.views.onboarding = {
    maybeShow() {
      try { if (localStorage.getItem(KEY)) return; } catch (e) { return; }
      const box = document.getElementById('onb'); if (!box) return; let step = 0;
      const done = () => { try { localStorage.setItem(KEY, '1'); } catch (e) { /* нет хранилища */ } box.hidden = true; box.innerHTML = ''; };
      const draw = () => { const s = STEPS(), last = step === s.length - 1;
        box.hidden = false;
        box.innerHTML = `<div class="onb" role="dialog" aria-modal="true" aria-labelledby="onbt"><div class="card"><h2 id="onbt">${s[step][0]}</h2><p class="hint">${s[step][1]}</p>
          <ol>${s.map((x, i) => `<li class="${i === step ? 'cur' : ''}">${x[0]}</li>`).join('')}</ol>
          <div class="crow">${step ? '<button class="btn ghost" id="obprev">Назад</button>' : ''}<button class="btn ghost" id="obskip">Пропустить</button><button class="btn accent" id="obnext">${last ? 'Готово' : 'Далее'}</button></div></div></div>`;
        box.querySelector('#obnext').onclick = () => { if (last) done(); else { step++; draw(); } };
        box.querySelector('#obskip').onclick = done;
        const p = box.querySelector('#obprev'); if (p) p.onclick = () => { step--; draw(); };
        box.querySelector('#obnext').focus(); };
      draw();
    },
  };
})();
