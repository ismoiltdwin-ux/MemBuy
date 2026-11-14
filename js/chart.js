/* Графики: спарклайн (SVG) и большой график цены (canvas): линия или свечи, с линией средней цены покупки. */
MB.chart = {
  spark(series, up) {
    const s = series.slice(-32); if (s.length < 2) return '';
    const lo = Math.min(...s), hi = Math.max(...s), W = 84, H = 30, pts = s.map((v, i) => `${(i / (s.length - 1) * W).toFixed(1)},${(H - 2 - (v - lo) / ((hi - lo) || 1) * (H - 4)).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--${up ? 'up' : 'down'})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  },
  /** opts: { type: 'line' | 'candle', candles: [{o,h,l,c}], avg: число (средняя цена покупки) } */
  draw(canvas, series, opts = {}) {
    const css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue(n).trim();
    const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight; if (!W || !H) return;
    canvas.width = W * dpr; canvas.height = H * dpr; const g = canvas.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
    const cd = opts.type === 'candle' ? (opts.candles || []) : null, vals = cd ? cd.flatMap(c => [c.h, c.l]) : series.slice();
    if ((cd ? cd.length : series.length) < 2) { g.fillStyle = col('--muted'); g.font = '14px Manrope, sans-serif'; g.fillText(MB.t('Нет данных для графика'), 12, 24); return; }
    if (opts.avg > 0) vals.push(opts.avg);
    const lo = Math.min(...vals), hi = Math.max(...vals), padR = 96, padY = 14, plotW = W - padR, y = v => padY + (hi - v) / ((hi - lo) || 1) * (H - padY * 2);
    g.strokeStyle = col('--line'); g.fillStyle = col('--muted'); g.font = '12px Manrope, sans-serif'; g.lineWidth = 1;
    for (let k = 0; k <= 3; k++) { const v = lo + (hi - lo) * k / 3, yy = y(v); g.globalAlpha = .5; g.beginPath(); g.moveTo(0, yy); g.lineTo(plotW, yy); g.stroke(); g.globalAlpha = 1; g.fillText(MB.util.price(v), plotW + 6, yy + 4); }
    let last;
    if (cd) {
      const cw = plotW / cd.length, bw = Math.max(2, cw * 0.62);
      cd.forEach((c, i) => { const x = i * cw + cw / 2, cl = col(c.c >= c.o ? '--up' : '--down'); g.strokeStyle = cl; g.fillStyle = cl; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y(c.h)); g.lineTo(x, y(c.l)); g.stroke(); const top = y(Math.max(c.o, c.c)); g.fillRect(x - bw / 2, top, bw, Math.max(1.5, y(Math.min(c.o, c.c)) - top)); });
      last = cd[cd.length - 1].c;
    } else {
      const x = i => i / (series.length - 1) * plotW, up = series[series.length - 1] >= series[0], line = col(up ? '--up' : '--down');
      const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, line + '55'); grad.addColorStop(1, line + '00');
      g.beginPath(); series.forEach((v, i) => i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v))); g.lineTo(plotW, H); g.lineTo(0, H); g.closePath(); g.fillStyle = grad; g.fill();
      g.beginPath(); series.forEach((v, i) => i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v))); g.strokeStyle = line; g.lineWidth = 2.5; g.lineJoin = 'round'; g.stroke();
      last = series[series.length - 1]; g.beginPath(); g.arc(plotW, y(last), 4.5, 0, 7); g.fillStyle = line; g.fill();
    }
    const tag = (v, text, bg, fg, dash, shift = 0) => { const yy = y(v); g.setLineDash(dash); g.strokeStyle = bg; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, yy); g.lineTo(plotW, yy); g.stroke(); g.setLineDash([]); g.font = 'bold 12px Manrope, sans-serif'; const tw = g.measureText(text).width + 10; const ly = Math.max(10, Math.min(H - 10, yy + shift)); g.fillStyle = bg; g.fillRect(plotW + 2, ly - 10, Math.min(tw, padR - 4), 20); g.fillStyle = fg; g.fillText(text, plotW + 7, ly + 4); };
    if (opts.avg > 0) { const d = y(opts.avg) - y(last); tag(opts.avg, MB.t('вход') + ' ' + MB.util.price(opts.avg).slice(1), col('--accent'), col('--accent-ink'), [6, 5], Math.abs(d) < 22 ? (d >= 0 ? 22 - d : -22 - d) : 0); }
    tag(last, MB.util.price(last), col('--text'), col('--bg'), [2, 4]);
  },
};
