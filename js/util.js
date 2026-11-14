/* Общие помощники: форматирование, события, экранирование. */
MB.util = (() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const price = p => {
    if (!isFinite(p) || p <= 0) return '$0';
    if (p >= 1) return '$' + p.toLocaleString(MB.i18n.locale(), { maximumFractionDigits: 2 });
    const d = Math.min(10, Math.max(4, 3 - Math.floor(Math.log10(p))));
    return '$' + p.toFixed(d);
  };
  const usd = v => {
    const a = Math.abs(v), s = v < 0 ? '−' : '';
    const [k, mn, b] = MB.i18n.units();
    if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(2) + b;
    if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + mn;
    if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(1) + k;
    return s + '$' + a.toFixed(2);
  };
  const num = (v, d = 2) => Number(v).toLocaleString(MB.i18n.locale(), { maximumFractionDigits: d });
  const pct = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + '%';
  const short = a => a.length > 10 ? a.slice(0, 4) + '…' + a.slice(-4) : a;
  const bus = { h: {}, on(e, f) { (this.h[e] = this.h[e] || []).push(f); }, off(e, f) { this.h[e] = (this.h[e] || []).filter(x => x !== f); }, emit(e, d) { (this.h[e] || []).forEach(f => f(d)); } };
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  /** Читает файл-картинку, обрезает до квадрата size×size и возвращает data-URL (JPEG). */
  const squareImage = (file, size = 96) => new Promise((ok, bad) => {
    if (!file || !/^image\//.test(file.type)) return bad(new Error('Выберите картинку'));
    if (file.size > 15 * 1024 * 1024) return bad(new Error('Файл больше 15 МБ'));
    const fr = new FileReader(); fr.onerror = () => bad(new Error('Не удалось прочитать файл'));
    fr.onload = () => { const img = new Image(); img.onerror = () => bad(new Error('Этот файл не открывается как картинка'));
      img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), s = Math.min(img.width, img.height); g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size); ok(c.toDataURL('image/jpeg', 0.82)); };
      img.src = fr.result; };
    fr.readAsDataURL(file);
  });
  return { esc, price, usd, num, pct, short, bus, rng, squareImage };
})();
