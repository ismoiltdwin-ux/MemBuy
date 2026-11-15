/* Membuy — сервер подписок и личных сообщений (Cloudflare Worker + база D1).
   Вход: пользователь подписывает в Phantom текст с одноразовым кодом (не транзакция, бесплатно) — сервер проверяет подпись Ed25519.
   Писать можно только при ВЗАИМНОЙ подписке — это проверяет сервер. Таблицы создаются сами при первом запросе.
   Установка: Worker → вставить код → Deploy; Settings → Bindings → Add → D1 database → создать «membuy-social», имя переменной DB.
   Необязательно: переменная ALLOWED_ORIGIN (по умолчанию https://ismoiltdwin-ux.github.io). */
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const b58decode = s => { let n = 0n; for (const c of s) { const i = B58.indexOf(c); if (i < 0) throw new Error('b58'); n = n * 58n + BigInt(i); }
  const out = []; while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n; } for (const c of s) { if (c === '1') out.unshift(0); else break; } return new Uint8Array(out); };
const b64 = u8 => btoa(String.fromCharCode(...u8)), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const isAddr = a => typeof a === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
const loginText = (addr, nonce) => `Membuy: вход в сообщения\nКошелёк: ${addr}\nКод: ${nonce}\nЭто не транзакция и ничего не стоит.`;
let ready = false;
// Анонимная статистика: только счётчики событий по дням — без адресов, IP и других личных данных.
const EVENTS = ['visit', 'visit_ref', 'connect', 'buy', 'sell', 'create', 'ad_paid', 'send', 'invite', 'follow', 'msg'];
const OWNER = '7gGoEh28GwkDLS8ABbGRpdJkQz78kpRBy3HrzRmBQ8PV'; // кошелёк владельца Membuy: только он видит статистику

async function init(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS follows (a TEXT NOT NULL, b TEXT NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (a, b))'),
    db.prepare('CREATE INDEX IF NOT EXISTS follows_b ON follows (b)'),
    db.prepare('CREATE TABLE IF NOT EXISTS msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, a TEXT NOT NULL, b TEXT NOT NULL, text TEXT NOT NULL, ts INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE INDEX IF NOT EXISTS msgs_pair ON msgs (a, b, id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS msgs_b ON msgs (b, seen)'),
    db.prepare('CREATE TABLE IF NOT EXISTS nonces (n TEXT PRIMARY KEY, addr TEXT NOT NULL, exp INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS stats (day TEXT NOT NULL, ev TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, ev))'),
  ]);
  ready = true;
}
/** Секрет для подписи сессий: создаётся один раз и хранится в базе. */
async function secret(db) {
  let r = await db.prepare('SELECT v FROM kv WHERE k = ?').bind('secret').first();
  if (!r) { const v = b64(crypto.getRandomValues(new Uint8Array(32))); await db.prepare('INSERT OR IGNORE INTO kv (k, v) VALUES (?, ?)').bind('secret', v).run(); r = await db.prepare('SELECT v FROM kv WHERE k = ?').bind('secret').first(); }
  return crypto.subtle.importKey('raw', unb64(r.v), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function makeToken(db, addr) { const exp = Math.floor(Date.now() / 1000) + 30 * 86400, body = addr + '.' + exp;
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await secret(db), new TextEncoder().encode(body))); return body + '.' + b64(sig).replace(/=+$/, ''); }
async function readToken(db, req) {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''), [addr, exp, sig] = t.split('.');
  if (!isAddr(addr) || !(+exp > Date.now() / 1000) || !sig) return null;
  const pad = sig + '='.repeat((4 - sig.length % 4) % 4);
  try { return await crypto.subtle.verify('HMAC', await secret(db), unb64(pad), new TextEncoder().encode(addr + '.' + exp)) ? addr : null; } catch (e) { return null; }
}
const mutual = async (db, x, y) => (await db.prepare('SELECT COUNT(*) AS c FROM follows WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)').bind(x, y, y, x).first()).c === 2;

export default {
  async fetch(req, env) {
    const origin = env.ALLOWED_ORIGIN || 'https://ismoiltdwin-ux.github.io';
    const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, authorization', 'Vary': 'Origin' };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    // Если адрес сервера открыли прямо в браузере — короткая понятная страница вместо ошибки.
    if (req.method === 'GET' && new URL(req.url).pathname === '/' && !req.headers.get('Origin'))
      return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Membuy</title><body style="background:#120f24;color:#f4f1ff;font:17px system-ui;display:grid;place-items:center;min-height:90vh;text-align:center;padding:16px"><div><h1 style="color:#ffb224">Membuy</h1><p>Это служебный сервер сообщений Membuy. Он работает только внутри сайта.</p><p><a style="color:#ffb224" href="https://ismoiltdwin-ux.github.io/MemBuy/?mode=live">Открыть Membuy →</a></p></div></body>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
    if (req.headers.get('Origin') !== origin) return reply(403, { error: 'Wrong site' });
    if (!env.DB) return reply(500, { error: 'D1 database binding DB is not set' });
    const db = env.DB; await init(db);
    const url = new URL(req.url), path = url.pathname, q = k => url.searchParams.get(k) || '', now = Math.floor(Date.now() / 1000);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    try {
      // ---- вход ----
      if (path === '/nonce') { const addr = q('addr'); if (!isAddr(addr)) return reply(400, { error: 'Bad address' });
        const n = b64(crypto.getRandomValues(new Uint8Array(12))).replace(/[^A-Za-z0-9]/g, '');
        await db.prepare('DELETE FROM nonces WHERE exp < ?').bind(now).run();
        await db.prepare('INSERT INTO nonces (n, addr, exp) VALUES (?, ?, ?)').bind(n, addr, now + 300).run();
        return reply(200, { nonce: n, text: loginText(addr, n) }); }
      if (path === '/login') { const { addr, nonce, sig } = body; if (!isAddr(addr) || typeof nonce !== 'string' || typeof sig !== 'string') return reply(400, { error: 'Bad request' });
        const row = await db.prepare('SELECT addr, exp FROM nonces WHERE n = ?').bind(nonce).first();
        if (!row || row.addr !== addr || row.exp < now) return reply(401, { error: 'Code expired, try again' });
        await db.prepare('DELETE FROM nonces WHERE n = ?').bind(nonce).run(); // одноразовый
        const key = await crypto.subtle.importKey('raw', b58decode(addr), { name: 'Ed25519' }, false, ['verify']);
        const ok = await crypto.subtle.verify({ name: 'Ed25519' }, key, unb64(sig), new TextEncoder().encode(loginText(addr, nonce)));
        if (!ok) return reply(401, { error: 'Bad signature' });
        return reply(200, { token: await makeToken(db, addr) }); }

      // ---- статистика (без входа: счётчик +1, никаких личных данных) ----
      if (path === '/hit') { const ev = String(body.ev || ''); if (!EVENTS.includes(ev)) return reply(400, { error: 'Bad event' });
        const day = new Date().toISOString().slice(0, 10);
        await db.prepare('INSERT INTO stats (day, ev, n) VALUES (?, ?, 1) ON CONFLICT (day, ev) DO UPDATE SET n = n + 1').bind(day, ev).run();
        return reply(200, { ok: true }); }

      const me = await readToken(db, req); if (!me) return reply(401, { error: 'Login required' });
      if (path === '/stats') { if (me !== (env.OWNER || OWNER)) return reply(403, { error: 'Owner only' });
        const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
        const r = await db.prepare('SELECT day, ev, n FROM stats WHERE day >= ? ORDER BY day DESC').bind(since).all();
        const users = (await db.prepare('SELECT COUNT(DISTINCT a) AS c FROM follows').first()).c, msgs = (await db.prepare('SELECT COUNT(*) AS c FROM msgs').first()).c;
        return reply(200, { rows: r.results, followers: users, messages: msgs }); }
      // ---- подписки ----
      if (path === '/follow') { const { to, on } = body; if (!isAddr(to) || to === me) return reply(400, { error: 'Bad address' });
        if (on) await db.prepare('INSERT OR IGNORE INTO follows (a, b, ts) VALUES (?, ?, ?)').bind(me, to, now).run();
        else await db.prepare('DELETE FROM follows WHERE a = ? AND b = ?').bind(me, to).run();
        return reply(200, { ok: true, mutual: await mutual(db, me, to) }); }
      if (path === '/relation') { const w = q('with'); if (!isAddr(w)) return reply(400, { error: 'Bad address' });
        const r = await db.prepare('SELECT a FROM follows WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)').bind(me, w, w, me).all(), s = new Set(r.results.map(x => x.a));
        const c = await db.prepare('SELECT (SELECT COUNT(*) FROM follows WHERE b = ?) AS followers, (SELECT COUNT(*) FROM follows WHERE a = ?) AS following').bind(w, w).first();
        return reply(200, { iFollow: s.has(me), followsMe: s.has(w), followers: c.followers, following: c.following }); }
      if (path === '/me') { const f = await db.prepare('SELECT b FROM follows WHERE a = ?').bind(me).all(), g = await db.prepare('SELECT a FROM follows WHERE b = ?').bind(me).all();
        return reply(200, { following: f.results.map(x => x.b), followers: g.results.map(x => x.a) }); }
      if (path === '/activity') { const r = await db.prepare('SELECT f.a AS who, f.ts, EXISTS (SELECT 1 FROM follows g WHERE g.a = ? AND g.b = f.a) AS back FROM follows f WHERE f.b = ? ORDER BY f.ts DESC LIMIT 50').bind(me, me).all();
        return reply(200, { items: r.results }); }
      // ---- сообщения ----
      if (path === '/send') { const { to } = body, text = String(body.text || '').trim();
        if (!isAddr(to) || to === me) return reply(400, { error: 'Bad address' });
        if (!text || text.length > 1000) return reply(400, { error: 'Message: 1 to 1000 characters' });
        if (!(await mutual(db, me, to))) return reply(403, { error: 'You can only message people who follow you back' });
        const cnt = (await db.prepare('SELECT COUNT(*) AS c FROM msgs WHERE a = ? AND ts > ?').bind(me, now - 60).first()).c;
        if (cnt >= 20) return reply(429, { error: 'Too many messages, wait a minute' });
        const r = await db.prepare('INSERT INTO msgs (a, b, text, ts) VALUES (?, ?, ?, ?)').bind(me, to, text, now).run();
        return reply(200, { id: r.meta.last_row_id, ts: now }); }
      if (path === '/msgs') { const w = q('with'), after = +q('after') || 0; if (!isAddr(w)) return reply(400, { error: 'Bad address' });
        const r = await db.prepare('SELECT id, a, text, ts FROM msgs WHERE ((a = ? AND b = ?) OR (a = ? AND b = ?)) AND id > ? ORDER BY id DESC LIMIT 100').bind(me, w, w, me, after).all();
        await db.prepare('UPDATE msgs SET seen = 1 WHERE a = ? AND b = ? AND seen = 0').bind(w, me).run();
        return reply(200, { items: r.results.reverse().map(m => ({ id: m.id, mine: m.a === me, text: m.text, ts: m.ts })), mutual: await mutual(db, me, w) }); }
      if (path === '/threads') {
        const r = await db.prepare(`SELECT CASE WHEN a = ?1 THEN b ELSE a END AS other, MAX(id) AS last FROM msgs WHERE a = ?1 OR b = ?1 GROUP BY other ORDER BY last DESC LIMIT 50`).bind(me).all();
        const items = [];
        for (const t of r.results) { const m = await db.prepare('SELECT a, text, ts FROM msgs WHERE id = ?').bind(t.last).first();
          const u = (await db.prepare('SELECT COUNT(*) AS c FROM msgs WHERE a = ? AND b = ? AND seen = 0').bind(t.other, me).first()).c;
          items.push({ other: t.other, text: m.text, mine: m.a === me, ts: m.ts, unread: u }); }
        return reply(200, { items }); }
      if (path === '/unread') { const c = (await db.prepare('SELECT COUNT(*) AS c FROM msgs WHERE b = ? AND seen = 0').bind(me).first()).c; return reply(200, { unread: c }); }
      return reply(404, { error: 'Not found' });
    } catch (e) { return reply(500, { error: 'Server error' }); }
  },
};
