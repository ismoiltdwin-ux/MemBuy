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
  MB.ui.toast = (msg, kind = 'ok') => {
    const box = document.getElementById('toasts'), el = document.createElement('div'); el.className = 'toast ' + kind; el.setAttribute('role', 'status'); el.textContent = msg; box.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  };
  MB.ui.empty = (title, text, action = '') => `<div class="empty"><b>${title}</b><p>${text}</p>${action}</div>`;
  MB.ui.walletBtn = () => {
    const w = MB.store.get().wallet;
    return w.connected ? `<button class="btn ghost" id="walletBtn" title="Баланс и кошелёк"><i class="dot"></i>${MB.util.num(w.sol, 3)} SOL</button>` : `<button class="btn accent" id="walletBtn">Подключить<span class="lg">&nbsp;кошелёк</span></button>`;
  };
})();
