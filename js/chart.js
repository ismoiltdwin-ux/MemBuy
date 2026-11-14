/* Графики: спарклайн (SVG) и большой график цены (canvas): линия или свечи, с линией средней цены покупки. */
MB.chart = {
  spark(series, up) {
    const s = series.slice(-32); if (s.length < 2) return '';
    const lo = Math.min(...s), hi = Math.max(...s), W = 84, H = 30, pts = s.map((v, i) => `${(i / (s.length - 1) * W).toFixed(1)},${(H - 2 - (v - lo) / ((hi - lo) || 1) * (H - 4)).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--${up ? 'up' : 'down'})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  },
  /** opts: { type: 'line' | 'candle', candles: [{o,h,l,c,t}], avg: средняя цена покупки, view: окно просмотра (см. attach) }.
      Без view показывается весь ряд (график в профиле). С view — часть свечей, которую пользователь двигает пальцем. */
  draw(canvas, series, opts = {}) {
    const css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue(n).trim(), F = opts.fmt || MB.util.price;
    const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight; if (!W || !H) return;
    canvas.width = W * dpr; canvas.height = H * dpr; const g = canvas.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
    const cd = opts.type === 'candle' ? (opts.candles || []) : null, pts = cd || series, N = pts.length;
    if (N < 2) { g.fillStyle = col('--muted'); g.font = '14px Manrope, sans-serif'; g.fillText(MB.t('Нет данных для графика'), 12, 24); canvas._mb = null; return; }
    const v = opts.view, times = opts.times || (cd ? cd.map(c => c.t) : null), padR = 96, padY = 14, padB = v && times ? 20 : 0, plotW = W - padR, plotH = H - padB;
    // Окно по времени: n видимых точек, правый край end (N — самая свежая точка).
    const n = v ? Math.max(2, Math.min(v.n, N * 1.5)) : N - (cd ? 0 : 1), end = v ? (isFinite(v.end) ? v.end : N) : N - (cd ? 0 : 1), first = end - n, cw = plotW / n;
    const X = cd ? i => (i - first) * cw - cw / 2 : i => (i - first) / n * plotW;
    const i0 = Math.max(0, Math.floor(first) - 1), i1 = Math.min(N, Math.ceil(end) + 1), vis = pts.slice(i0, i1);
    let lo, hi;
    if (v && v.py) { lo = v.py.lo; hi = v.py.hi; }
    else { const vals = cd ? vis.flatMap(c => [c.h, c.l]) : vis.slice(); if (!vals.length) vals.push(cd ? pts[N - 1].c : pts[N - 1]); if (opts.avg > 0 && !v) vals.push(opts.avg); lo = Math.min(...vals); hi = Math.max(...vals); const m = (hi - lo) * 0.06 || hi * 0.02; lo -= m; hi += m; }
    const y = val => padY + (hi - val) / ((hi - lo) || 1) * (plotH - padY * 2);
    canvas._mb = { cw, n, N, lo, hi, plotW, plotH: plotH - padY * 2 };
    g.strokeStyle = col('--line'); g.fillStyle = col('--muted'); g.font = '12px Manrope, sans-serif'; g.lineWidth = 1;
    for (let k = 0; k <= 3; k++) { const val = lo + (hi - lo) * (k + 0.5) / 4, yy = y(val); g.globalAlpha = .5; g.beginPath(); g.moveTo(0, yy); g.lineTo(plotW, yy); g.stroke(); g.globalAlpha = 1; g.fillText(F(val), plotW + 6, yy + 4); }
    if (padB) { const step = Math.max(1, Math.round(n / 4)); g.fillStyle = col('--muted'); for (let i = Math.ceil(first / step) * step; i < end; i += step) { const tt = times[i]; if (tt == null || i < 0) continue; const d = new Date(tt * 1000), span = N > 1 && times[1] && times[0] ? Math.abs(times[1] - times[0]) : 3600, lbl = span >= 86400 ? d.toLocaleDateString(MB.i18n.locale(), { day: '2-digit', month: '2-digit' }) : d.toLocaleTimeString(MB.i18n.locale(), { hour: '2-digit', minute: '2-digit', second: span < 60 ? '2-digit' : undefined }); const xx = X(i); if (xx > 20 && xx < plotW - 20) { g.textAlign = 'center'; g.fillText(lbl, xx, H - 5); g.textAlign = 'left'; } } }
    g.save(); g.beginPath(); g.rect(0, 0, plotW, plotH); g.clip();
    const last = cd ? cd[N - 1].c : series[N - 1];
    if (cd) {
      const bw = Math.max(1.5, cw * 0.62);
      for (let i = i0; i < i1; i++) { const c = cd[i], x = X(i + 1), cl = col(c.c >= c.o ? '--up' : '--down'); g.strokeStyle = cl; g.fillStyle = cl; g.lineWidth = Math.min(1.5, Math.max(1, cw * 0.15)); g.beginPath(); g.moveTo(x, y(c.h)); g.lineTo(x, y(c.l)); g.stroke(); const top = y(Math.max(c.o, c.c)); g.fillRect(x - bw / 2, top, bw, Math.max(1.5, y(Math.min(c.o, c.c)) - top)); }
    } else {
      const up = series[N - 1] >= series[Math.max(0, i0)], line = col(up ? '--up' : '--down');
      const grad = g.createLinearGradient(0, 0, 0, plotH); grad.addColorStop(0, line + '55'); grad.addColorStop(1, line + '00');
      const path = () => { for (let i = i0; i < i1; i++) i === i0 ? g.moveTo(X(i), y(series[i])) : g.lineTo(X(i), y(series[i])); };
      g.beginPath(); path(); g.lineTo(X(i1 - 1), plotH); g.lineTo(X(i0), plotH); g.closePath(); g.fillStyle = grad; g.fill();
      g.beginPath(); path(); g.strokeStyle = line; g.lineWidth = 2.5; g.lineJoin = 'round'; g.stroke();
      if (i1 === N) { g.beginPath(); g.arc(X(N - 1), y(last), 4.5, 0, 7); g.fillStyle = line; g.fill(); }
    }
    g.restore();
    const tag = (val, text, bg, fg, dash, shift = 0) => { const yy = y(val); if (yy >= 0 && yy <= plotH) { g.setLineDash(dash); g.strokeStyle = bg; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, yy); g.lineTo(plotW, yy); g.stroke(); g.setLineDash([]); } g.font = 'bold 12px Manrope, sans-serif'; const tw = g.measureText(text).width + 10; const ly = Math.max(10, Math.min(plotH - 10, yy + shift)); g.fillStyle = bg; g.fillRect(plotW + 2, ly - 10, Math.min(tw, padR - 4), 20); g.fillStyle = fg; g.fillText(text, plotW + 7, ly + 4); };
    if (opts.avg > 0) { const d = y(opts.avg) - y(last); tag(opts.avg, MB.t('вход') + ' ' + F(opts.avg).replace(/^\$/, ''), col('--accent'), col('--accent-ink'), [6, 5], Math.abs(d) < 22 ? (d >= 0 ? 22 - d : -22 - d) : 0); }
    tag(last, F(last), col('--text'), col('--bg'), [2, 4]);
  },
  /** Новое окно просмотра: последние 60 свечей, цена подбирается сама. */
  view: () => ({ n: 60, end: Infinity, py: null, moved: false }),
  /** Жесты: один палец — двигать по времени и цене, два пальца — масштаб, колесо мыши — масштаб, двойное касание — сброс.
      redraw() перерисовывает без загрузки данных, onMove(moved) сообщает, сдвинут ли график. */
  attach(canvas, view, redraw, onMove) {
    const ptr = new Map(); let last = null, lastTap = 0;
    const st = () => canvas._mb, clampN = m => Math.max(8, Math.min(m.N * 1.2, view.n)), touched = () => { if (!view.moved) { view.moved = true; onMove && onMove(true); } };
    const fixEnd = m => { view.n = clampN(m); view.end = Math.max(view.n * 0.3, Math.min(m.N + view.n * 0.4, view.end)); if (Math.abs(view.end - m.N) < 0.5) view.end = Infinity; /* у правого края — следим за новыми свечами */ };
    const panY = (m, dy) => { const span = m.hi - m.lo, d = dy / (m.plotH || 1) * span; view.py = { lo: m.lo + d, hi: m.hi + d }; };
    const zoomY = (m, k) => { const mid = (m.hi + m.lo) / 2, half = (m.hi - m.lo) / 2 * k; view.py = { lo: mid - half, hi: mid + half }; };
    const geo = () => { const a = [...ptr.values()]; return a.length < 2 ? null : { dx: Math.abs(a[0].x - a[1].x), dy: Math.abs(a[0].y - a[1].y), cx: (a[0].x + a[1].x) / 2 }; };
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = geo();
      if (ptr.size === 1) { const now = Date.now(); if (now - lastTap < 300) { Object.assign(view, MB.chart.view()); onMove && onMove(false); redraw(); } lastTap = now; } });
    canvas.addEventListener('pointermove', e => { const p = ptr.get(e.pointerId), m = st(); if (!p || !m) return; const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (ptr.size === 1) { if (!isFinite(view.end)) view.end = m.N; view.end -= dx / m.cw; panY(m, dy); fixEnd(m); touched(); }
      p.x = e.clientX; p.y = e.clientY;
      if (ptr.size === 2) { const gnow = geo(); if (last && gnow) { if (!isFinite(view.end)) view.end = m.N; if (last.dx > 20 && gnow.dx > 20) view.n *= last.dx / gnow.dx; if (last.dy > 20 && gnow.dy > 20) zoomY(m, last.dy / gnow.dy); fixEnd(m); touched(); } last = gnow; }
      redraw(); });
    const up = e => { ptr.delete(e.pointerId); last = geo(); };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { const m = st(); if (!m) return; e.preventDefault(); if (!isFinite(view.end)) view.end = m.N; view.n *= e.deltaY > 0 ? 1.12 : 1 / 1.12; fixEnd(m); touched(); redraw(); }, { passive: false });
  },
};
