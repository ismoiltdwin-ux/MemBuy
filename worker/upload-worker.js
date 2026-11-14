/* Membuy — сервер-посредник для загрузки картинки и описания монеты в IPFS (Pinata).
   Зачем: pump.fun хранит данные монеты в IPFS, а для загрузки нужен секретный ключ Pinata. В коде сайта его держать нельзя —
   он хранится здесь, в секретной переменной Cloudflare PINATA_JWT, и наружу не попадает.
   Установка: Cloudflare → Workers & Pages → Create → Worker → вставить этот код → Deploy;
   Settings → Variables and Secrets: PINATA_JWT (тип Secret) и ALLOWED_ORIGIN = https://ismoiltdwin-ux.github.io (тип Text). */
const MAX_IMAGE = 4 * 1024 * 1024; // 4 МБ
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const hits = new Map(); // простое ограничение частоты: не больше 5 загрузок в минуту с одного IP (в пределах одного экземпляра)

export default {
  async fetch(req, env) {
    const origin = env.ALLOWED_ORIGIN || 'https://ismoiltdwin-ux.github.io';
    const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Vary': 'Origin' };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return reply(405, { error: 'Только POST' });
    if (req.headers.get('Origin') !== origin) return reply(403, { error: 'Чужой сайт' });
    if (!env.PINATA_JWT) return reply(500, { error: 'Не задан PINATA_JWT' });

    const ip = req.headers.get('CF-Connecting-IP') || '?', now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000);
    if (list.length >= 5) return reply(429, { error: 'Слишком часто. Попробуйте через минуту' });
    list.push(now); hits.set(ip, list);

    let form; try { form = await req.formData(); } catch (e) { return reply(400, { error: 'Неверный запрос' }); }
    const image = form.get('image'), str = k => String(form.get(k) || '').trim();
    const name = str('name'), symbol = str('symbol'), description = str('description'), twitter = str('twitter'), telegram = str('telegram'), website = str('website');
    if (!(image instanceof File) || !IMAGE_TYPES.includes(image.type)) return reply(400, { error: 'Картинка: PNG, JPG, GIF или WEBP' });
    if (image.size > MAX_IMAGE) return reply(400, { error: 'Картинка больше 4 МБ' });
    if (name.length < 1 || name.length > 32) return reply(400, { error: 'Название: от 1 до 32 знаков' });
    if (!/^[A-Za-z0-9]{1,10}$/.test(symbol)) return reply(400, { error: 'Тикер: до 10 латинских букв или цифр' });
    if (description.length > 1000) return reply(400, { error: 'Описание: до 1000 знаков' });
    for (const u of [twitter, telegram, website]) if (u && (!/^https:\/\/[^\s"'<>]+$/.test(u) || u.length > 200)) return reply(400, { error: 'Ссылки должны начинаться с https://' });

    const upload = async (file, fname) => {
      const fd = new FormData(); fd.append('file', file, fname); fd.append('network', 'public');
      const r = await fetch('https://uploads.pinata.cloud/v3/files', { method: 'POST', headers: { Authorization: 'Bearer ' + env.PINATA_JWT }, body: fd });
      const d = await r.json().catch(() => ({})); if (!r.ok || !d.data || !d.data.cid) throw new Error('Pinata ' + r.status + ': ' + String((d.error && (d.error.reason || d.error.details || d.error.message)) || d.error || d.message || '').slice(0, 160));
      return 'https://ipfs.io/ipfs/' + d.data.cid;
    };
    try {
      const img = await upload(image, 'image');
      const meta = { name, symbol, description, image: img, showName: true, createdOn: 'Membuy' };
      if (twitter) meta.twitter = twitter; if (telegram) meta.telegram = telegram; if (website) meta.website = website;
      const uri = await upload(new File([JSON.stringify(meta)], 'metadata.json', { type: 'application/json' }), 'metadata.json');
      return reply(200, { uri, image: img });
    } catch (e) { return reply(502, { error: 'Не удалось загрузить в IPFS', detail: String(e.message || e).slice(0, 200) }); } // detail — код и причина от Pinata, без секретов
  },
};
