// Проверка перевода: node build/test_i18n.js — проходит все экраны на en и tg и показывает непереведённые строки.
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'index.html'), SHOT = process.env.SHOT_DIR;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAr7cKUIAAAAASUVORK5CYII=', 'base64');
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const lang of ['en', 'tg']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }), p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    const go = async h => { await p.goto(URL + '#' + h); await p.evaluate(() => { const b = document.querySelector('#obskip'); if (b) b.click(); }); await p.waitForTimeout(400); }, left = new Set();
    // Собирает видимый русский текст (для en) вне пользовательского содержимого
    const scan = async () => { (await p.evaluate(() => { const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = n.nodeValue.trim(), pe = n.parentElement; if (t && /[А-Яа-яЁё]/.test(t) && pe && !/^(SCRIPT|STYLE)$/.test(pe.tagName) && !pe.closest('[data-lang]')) out.push(t); } document.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(e => ['placeholder', 'title', 'aria-label', 'alt'].forEach(a => { const v = e.getAttribute(a); if (v && /[А-Яа-яЁё]/.test(v)) out.push(a + '=' + v); })); return out; })).forEach(x => left.add(x)); };
    await go('market'); await p.click('[data-lang=' + lang + ']'); await p.waitForTimeout(500); await scan(); if (SHOT) await p.screenshot({ path: `${SHOT}/i18n-${lang}-market.png` });
    await p.fill('#q', 'zzzz'); await p.waitForTimeout(250); await scan(); await p.fill('#q', ''); await p.click('[data-f=fav]'); await p.waitForTimeout(250); await scan(); await p.click('[data-f=trend]');
    await go('profile'); await scan(); await go('feed'); await scan(); await go('leaders'); await scan();
    await go('t-PLOV'); await scan(); await p.click('#go'); await p.waitForTimeout(250); await scan(); await p.fill('#amt', '1'); await p.waitForTimeout(300); await scan(); await p.click('#go'); await p.waitForTimeout(500); await scan(); if (SHOT) await p.screenshot({ path: `${SHOT}/i18n-${lang}-token.png`, fullPage: true });
    await p.click('.seg button[data-s=sell]'); await p.fill('#amt', '99999999999'); await p.waitForTimeout(250); await p.click('#go'); await p.waitForTimeout(300); await scan(); await p.click('#panel .chip[data-p="50"]'); await p.waitForTimeout(250); await p.click('#go'); await p.waitForTimeout(400); await scan(); await p.click('#fav'); await scan();
    await go('feed'); await p.click('#psend'); await p.waitForTimeout(200); await scan(); await p.fill('#ptext', 'hello'); await p.selectOption('#pcoin', 'PLOV'); await p.click('#psend'); await p.waitForTimeout(300); await p.click('[data-follow] >> nth=0'); await p.waitForTimeout(200); await scan(); await p.click('[data-tab=following]'); await p.waitForTimeout(200); await scan(); if (SHOT) await p.screenshot({ path: `${SHOT}/i18n-${lang}-feed.png` });
    await go('leaders'); await p.waitForTimeout(300); await scan(); await p.click('[data-tab=squads]'); await p.waitForTimeout(200); await scan(); await p.click('#sqgo'); await p.waitForTimeout(200); await scan(); await p.fill('#sq', 'Alpha'); await p.click('#sqgo'); await p.waitForTimeout(250); await scan(); await p.click('[data-tab=rewards]'); await p.waitForTimeout(200); await scan();
    await go('create'); await scan(); for (const [n, s] of [['', ''], ['Test Coin', 'я'], ['Test Coin', 'PLOV']]) { await p.fill('#cname', n); await p.fill('#csym', s); await p.click('form button[type=submit]'); await p.waitForTimeout(200); await scan(); } await p.fill('#csym', 'TST'); await p.click('form button[type=submit]'); await p.waitForTimeout(500); await scan();
    await go('ads'); await scan(); for (const [t, x, l, d] of [['', '', '', '3'], ['Good title', '', '', '3'], ['Good title', 'Good text here', 'x', '3'], ['Good title', 'Good text here', 'https://example.com', '99'], ['Good title', 'Good text here', 'https://example.com', '3']]) { await p.fill('#atitle', t); await p.fill('#atext', x); await p.fill('#alink', l); await p.fill('#adays', d); await p.click('#aform button[type=submit]'); await p.waitForTimeout(220); await scan(); } await p.click('[data-tg]'); await p.waitForTimeout(200); await scan();
    await go('invite'); await scan(); await p.click('#rcopy'); await p.waitForTimeout(200); await scan();
    await go('prefs'); await scan(); await p.fill('#pname', 'x'); await p.click('#pform button[type=submit]'); await p.waitForTimeout(200); await scan(); await p.fill('#pname', 'tester_1'); await p.click('#pform button[type=submit]'); await p.waitForTimeout(250); await scan();
    await p.setInputFiles('#pfile2', { name: 'me.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(400); await scan(); await p.setInputFiles('#pfile2', { name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }); await p.waitForTimeout(250); await scan(); await p.click('#pdel'); await p.waitForTimeout(250); await scan(); await p.click('#preset'); await scan();
    await go('search'); await scan(); await p.fill('#sq2', 'zzzz'); await p.waitForTimeout(250); await scan(); await go('notes'); await scan(); await go('profile'); await p.waitForTimeout(300); await scan(); await p.click('[data-tab=hist]'); await p.waitForTimeout(250); await scan(); if (SHOT) await p.screenshot({ path: `${SHOT}/i18n-${lang}-profile.png` });
    await go('t-NOPE'); await scan(); await go('market'); await p.click('#walletBtn'); await p.waitForTimeout(250); await scan();
    const misses = await p.evaluate(() => [...MB.i18n.misses]);
    const cyrLeft = lang === 'en' ? [...left].filter(x => !/^(hello|Good)/.test(x)) : [];
    console.log(`\n== ${lang}: без перевода ${misses.length}, русский текст на экране ${cyrLeft.length}, ошибки ${errs.length}`); misses.forEach(m => console.log('  MISS', JSON.stringify(m))); cyrLeft.filter(x => !misses.includes(x)).forEach(m => console.log('  LEFT', JSON.stringify(m))); errs.forEach(e => console.log('  ERR', e));
    bad += misses.length + cyrLeft.length + errs.length;
    await p.click('[data-lang=ru]'); await p.waitForTimeout(400); const back = await p.evaluate(() => document.querySelector('[data-nav=market]').textContent); if (back !== 'Рынок') { console.log('  FAIL возврат на русский:', back); bad++; }
    await ctx.close();
  }
  await b.close(); console.log(bad ? '\nЕсть непереведённое: ' + bad : '\nПеревод полный'); process.exit(bad ? 1 : 0);
})();
