/* Анонимная статистика (живой режим): счётчики событий на нашем сервере SOCIAL_API — без адресов кошельков, IP и cookies.
   Владелец видит итоги по дням в разделе «Статистика» (#stats). */
MB.track = (() => {
  const C = MB.config, once = new Set();
  return (ev, oncePerSession) => {
    if (!C.LIVE || !C.SOCIAL_API) return;
    if (oncePerSession) { if (once.has(ev)) return; try { if (sessionStorage.getItem('mbt-' + ev)) return; sessionStorage.setItem('mbt-' + ev, '1'); } catch (e) { /* без хранилища — считаем один раз за загрузку */ } once.add(ev); }
    try { fetch(C.SOCIAL_API.replace(/\/$/, '') + '/hit', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ev }) }).catch(() => {}); } catch (e) { /* статистика не должна мешать сайту */ }
  };
})();
