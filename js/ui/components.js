/* Общие элементы интерфейса. */
MB.ui = MB.ui || {};
(() => {
  const { esc } = MB.util;
  MB.ui.avatar = (t, size = 44) => t.icon
    ? `<img class="ava" src="${esc(t.icon)}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px" loading="lazy">`
    : `<span class="ava" aria-hidden="true" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.34)}px;background:linear-gradient(135deg,hsl(${t.hue} 80% 62%),hsl(${(t.hue + 50) % 360} 75% 42%))">${esc(t.sym.slice(0, 2))}</span>`;
  /** Аватар пользователя: своё фото, если загружено; иначе буквы на цветном круге. */
  MB.ui.userAva = (name, hue, size = 44) => {
    const p = MB.store.get().profile, photo = name === p.name ? p.avatar : (MB.social.user(name).avatar || '');
    return MB.ui.avatar({ sym: String(name).replace(/[^a-zа-я0-9]/gi, '').slice(0, 2).toUpperCase() || 'U', hue, icon: photo || undefined }, size);
  };
  MB.ui.chg = v => `<span class="chg ${v >= 0 ? 'up' : 'down'}">${MB.util.pct(v)}</span>`;
  /** Нет кошелька в этом браузере (Telegram, Instagram, обычный Safari): предлагаем открыть сайт прямо в приложении Phantom. */
  MB.ui.noWallet = () => {
    const box = document.getElementById('onb'); if (!box) return;
    const url = new URL(location.href); url.searchParams.set('mode', 'live');
    const open = 'https://phantom.app/ul/browse/' + encodeURIComponent(url.toString()) + '?ref=' + encodeURIComponent(location.origin);
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent), inApp = /Telegram|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent);
    box.hidden = false;
    box.innerHTML = `<div class="onb" role="dialog" aria-modal="true" aria-labelledby="nwt"><div class="card"><h2 id="nwt">Откройте Membuy в Phantom</h2>
      <p class="hint">${mobile ? (inApp ? 'Этот браузер (например, внутри Telegram) не видит кошелёк.' : 'В обычном браузере телефона кошелёк не подключается.') + ' Нажмите кнопку — Membuy откроется прямо в приложении Phantom, там можно подключить кошелёк и торговать.' : 'Установите расширение Phantom для браузера и обновите страницу.'}</p>
      <div class="stack">${mobile ? `<a class="btn big accent" href="${MB.util.esc(open)}">Открыть в Phantom</a>` : ''}<a class="btn ghost" href="https://phantom.com/download" target="_blank" rel="noopener">Установить Phantom</a>${mobile ? '<button class="btn ghost" id="nwcopy">Скопировать ссылку</button>' : ''}<button class="btn ghost" id="nwx">Позже</button></div>
      ${mobile ? '<p class="hint">Если Phantom не открылся: скопируйте ссылку, откройте приложение Phantom → внизу значок 🔍 (браузер) → вставьте ссылку.</p>' : ''}
      <p class="fine">Phantom — бесплатный кошелёк Solana. Ключи хранятся только у вас.</p></div></div>`;
    const close = () => { box.hidden = true; box.innerHTML = ''; };
    const cp = box.querySelector('#nwcopy'); if (cp) cp.onclick = () => { const link = url.toString(); (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => MB.ui.toast('Ссылка скопирована'), () => prompt('Скопируйте ссылку', link)); };
    box.querySelector('#nwx').onclick = close; box.querySelector('.onb').addEventListener('click', e => { if (e.target.classList.contains('onb')) close(); });
  };
  MB.ui.toast = (msg, kind = 'ok') => {
    if (!msg) return; // пустое сообщение (например, уже показано окно) — не показываем
    const box = document.getElementById('toasts'), el = document.createElement('div'); el.className = 'toast ' + kind; el.setAttribute('role', 'status'); el.textContent = msg; box.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  };
  MB.ui.empty = (title, text, action = '') => `<div class="empty"><b>${title}</b><p>${text}</p>${action}</div>`;
  MB.ui.walletBtn = () => {
    const w = MB.store.get().wallet;
    return w.connected ? `<button class="btn ghost" id="walletBtn" title="Баланс и кошелёк"><i class="dot"></i>${MB.util.num(w.sol, 3)} SOL</button>` : `<button class="btn accent" id="walletBtn">Подключить<span class="lg">&nbsp;кошелёк</span></button>`;
  };
})();
