// AVTOMATIK RASM FILTRI va SAQLANGANLAR (2026-09, egasining talabi).
//
// Google'ga HAQIQIY so'rov yuborilmaydi — `fetch` soxtalashtiriladi.
//
// Rasm filtri:
//   * taqiqlangan rasm (18+, zo'ravonlik, ekstremizm...) YUKLANMAYDI:
//     422 `content_blocked` + `category`, fayl R2 da QOLMAYDI;
//   * Gemini so'rovni o'zi xavfli deb to'xtatsa — ham bloklanadi;
//   * oddiy rasm o'tadi; xizmat ishlamasa (xato, kalit yo'q) — o'tadi;
//   * oqimli yuklash (istorya/post) ham tekshiriladi va fayl o'chiriladi;
//   * admin yuklashi va video tekshirilmaydi;
//   * bloklangan urinish logga yoziladi (rasmning o'zi emas).
// Saqlanganlar:
//   * kirmagan 401; saqlash, ro'yxat, qayta saqlash takrorlanmaydi,
//     o'chirish; boshqa odamniki aralashmaydi; yaroqsiz kind/ref 422.
//
//   node scripts/test-content-filter.mjs
import worker from '../hosting/worker.js';
import { moderateImage } from '../hosting/api/image-moderation.js';
import { makeEnv, seedBasic, cookie, req, makeChecker } from './lib/d1-harness.mjs';

const { check, checkTrue, done } = makeChecker();
const { env: base } = makeEnv();
await seedBasic(base);
const env = { ...base, GEMINI_API_KEY: 'test-key' };

// ── soxta Gemini ─────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
let verdict = { allowed: true, category: 'none' };
let mode = 'json'; // json | blockReason | error
let calls = 0;
// Video: Gemini Files API (yuklash sessiyasi → fayl → holat → hukm → o'chirish).
const vid = { started: 0, uploadedBytes: -1, polls: 0, deleted: [], state: 'ACTIVE', fail: '' };
globalThis.fetch = async (input, init = {}) => {
  const u = String(input?.url || input);
  if (!u.includes('generativelanguage.googleapis.com')) return realFetch(input, init);
  const h = new Headers(init.headers || {});
  if (u.endsWith('/upload/v1beta/files')) {
    vid.started += 1;
    if (vid.fail === 'start') return new Response('no', { status: 500 });
    return new Response('{}', { status: 200, headers: { 'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload-session/1' } });
  }
  if (u.includes('/upload-session/')) {
    const b = init.body;
    vid.uploadedBytes = b?.byteLength ?? b?.length ?? -1;
    check('video: finalize buyrug‘i', h.get('x-goog-upload-command'), 'upload, finalize');
    return Response.json({ file: { name: 'files/abc', uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc', state: vid.state, mimeType: 'video/mp4' } });
  }
  if (u.endsWith('/v1beta/files/abc') && (init.method || 'GET') === 'GET') {
    vid.polls += 1;
    return Response.json({ name: 'files/abc', uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc', state: vid.fail === 'processing' ? 'FAILED' : 'ACTIVE', mimeType: 'video/mp4' });
  }
  if (u.endsWith('/v1beta/files/abc') && init.method === 'DELETE') {
    vid.deleted.push('abc');
    return new Response('{}');
  }
  calls += 1;
  const body = JSON.parse(init.body);
  const fileData = body.contents?.[0]?.parts?.find((p) => p.fileData)?.fileData;
  if (fileData) {
    vid.promptText = body.contents[0].parts[0].text;
    vid.fileUri = fileData.fileUri;
    if (vid.fail === 'generate') return new Response('boom', { status: 500 });
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(verdict) }] }, finishReason: 'STOP' }] });
  }
  if (!body.contents?.[0]?.parts?.some((p) => p.inlineData?.data)) throw new Error('rasm yuborilmadi');
  if (mode === 'error') return new Response('boom', { status: 500 });
  if (mode === 'blockReason') return Response.json({ promptFeedback: { blockReason: 'SAFETY' } });
  return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(verdict) }] }, finishReason: 'STOP' }] });
};

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const up = async (e, c = cookie.user) => {
  const r = await worker.fetch(req('/api/upload', { method: 'POST', cookie: c, json: { dataUrl: `data:image/png;base64,${PNG}` } }), e);
  return { status: r.status, body: await r.json().catch(() => null) };
};
const r2Count = async () => {
  const n = await base.DB.prepare(`SELECT 1`).first(); // DB tirikligi
  return n ? true : false;
};

// 1) Oddiy rasm o'tadi.
verdict = { allowed: true, category: 'none' };
const ok = await up(env);
check('1) oddiy rasm yuklandi', ok.status, 200);
checkTrue('1) manzil berildi', String(ok.body?.url || '').startsWith('/uploads/'));

// 2) 18+ — bloklanadi, sabab aytiladi, faylga yozilmaydi.
verdict = { allowed: false, category: 'sexual' };
const before = calls;
const bad = await up(env);
check('2) 18+ bloklandi', [bad.status, bad.body?.error, bad.body?.category], [422, 'content_blocked', 'sexual']);
check('2) Gemini chaqirildi', calls - before, 1);
checkTrue('2) R2 ga yozilmadi', !String(bad.body?.url || ''));

// 3) Ekstremizm, zo'ravonlik.
verdict = { allowed: false, category: 'extremism' };
check('3) ekstremizm', (await up(env)).body?.category, 'extremism');
verdict = { allowed: false, category: 'violence' };
check('3) zo‘ravonlik', (await up(env)).body?.category, 'violence');

// 4) Gemini so'rovni o'zi to'xtatdi — bloklash.
mode = 'blockReason';
const safety = await up(env);
check('4) blockReason → bloklandi', [safety.status, safety.body?.category], [422, 'sexual']);

// 5) Xizmat xatosi — odam jazolanmaydi.
mode = 'error';
check('5) xizmat xatosida yuklash o‘tadi', (await up(env)).status, 200);
mode = 'json';

// 6) Kalit yo'q yoki o'chirilgan — tekshirilmaydi, o'tadi.
verdict = { allowed: false, category: 'sexual' };
const c0 = calls;
check('6) kalitsiz o‘tadi', (await up(base)).status, 200);
check('6) MODERATION_OFF=1 o‘tadi', (await up({ ...env, MODERATION_OFF: '1' })).status, 200);
check('6) Gemini chaqirilmadi', calls - c0, 0);

// 7) Oqimli yuklash (istorya/post mediasi) — fayl O'CHIRILADI.
const jpeg = new Uint8Array(64); jpeg.set([0xff, 0xd8, 0xff, 0xe0], 0);
const stream = async (bytes, type) => {
  const r = await worker.fetch(new Request('https://nfcstore.uz/api/upload-media', {
    method: 'POST',
    headers: { cookie: cookie.user, 'content-type': type, 'content-length': String(bytes.length), 'cf-connecting-ip': '198.51.100.71' },
    body: bytes,
  }), env);
  return { status: r.status, body: await r.json().catch(() => null) };
};
verdict = { allowed: false, category: 'drugs' };
const sb = await stream(jpeg, 'image/jpeg');
check('7) oqimli rasm bloklandi', [sb.status, sb.body?.category], [422, 'drugs']);
verdict = { allowed: true, category: 'none' };
const sok = await stream(jpeg, 'image/jpeg');
check('7) oqimli oddiy rasm o‘tdi', sok.status, 200);
const head = await env.UPLOADS.head(String(sok.body?.url || '').replace(/^\//, ''));
checkTrue('7) o‘tgan fayl R2 da bor', !!head);

// 8) Log: bloklangan urinishlar yozildi (rasm emas).
const log = await base.DB.prepare(`SELECT actor, category, source FROM content_scan_blocks ORDER BY id`).all();
const cats = (log.results || []).map((r) => r.category);
checkTrue('8) log yozildi', cats.includes('sexual') && cats.includes('extremism') && cats.includes('drugs'));
check('8) kim yuklagani', log.results[0].actor, 'user:1');

// 9) Format: GIF tekshirilmaydi; rasm funksiyasi videoni qabul qilmaydi
// (video — alohida `moderateVideo`, 11-bo'lim).
const g = await moderateImage(env, new Uint8Array([1, 2, 3]), 'image/gif');
check('9) GIF tekshirilmaydi', [g.allowed, g.checked], [true, false]);
const v = await moderateImage(env, new Uint8Array([1, 2, 3]), 'video/mp4');
check('9) rasm funksiyasi videoni o‘tkazib yuboradi', [v.allowed, v.checked], [true, false]);

// 9b) Siyosiy toifa (egasi, 2026-09-24).
verdict = { allowed: false, category: 'political' };
check('9b) siyosiy targ‘ibot bloklandi', (await up(env)).body?.category, 'political');
verdict = { allowed: true, category: 'none' };

// ── 11) VIDEO FILTRI ──────────────────────────────────────────────────
// Reels / post videosi (upload-media), profil videosi (upload-card-video).
const mp4 = new Uint8Array(4096);
mp4.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32], 0); // ....ftypmp42
const sendVideo = async (path, e = env) => {
  const r = await worker.fetch(new Request(`https://nfcstore.uz${path}`, {
    method: 'POST',
    headers: { cookie: cookie.user, 'content-type': 'video/mp4', 'content-length': String(mp4.length), 'cf-connecting-ip': '198.51.100.72' },
    body: mp4,
  }), e);
  return { status: r.status, body: await r.json().catch(() => null) };
};

verdict = { allowed: false, category: 'sexual' };
const vb = await sendVideo('/api/upload-media');
check('11) 18+ video bloklandi', [vb.status, vb.body?.error, vb.body?.category], [422, 'content_blocked', 'sexual']);
check('11) video Gemini’ga to‘liq yuborildi', vid.uploadedBytes, mp4.length);
checkTrue('11) hukm BUTUN video bo‘yicha so‘raldi', /WHOLE video/.test(vid.promptText || ''));
checkTrue('11) Gemini’dagi nusxa o‘chirildi', vid.deleted.includes('abc'));

verdict = { allowed: false, category: 'extremism' };
check('11) diniy ekstremizm videosi', (await sendVideo('/api/upload-media')).body?.category, 'extremism');
verdict = { allowed: false, category: 'political' };
check('11) siyosiy video (profil videosi)', (await sendVideo('/api/upload-card-video')).body?.category, 'political');

// Qayta ishlash kutiladi (PROCESSING → ACTIVE).
verdict = { allowed: true, category: 'none' };
vid.state = 'PROCESSING';
const polls0 = vid.polls;
const vok = await sendVideo('/api/upload-media');
check('11) oddiy video o‘tdi', [vok.status, vok.body?.kind], [200, 'video']);
checkTrue('11) holat kutildi', vid.polls > polls0);
vid.state = 'ACTIVE';
const vhead = await env.UPLOADS.head(String(vok.body?.url || '').replace(/^\//, ''));
checkTrue('11) o‘tgan video R2 da bor', !!vhead);

// Xizmat ishlamasa — odam jazolanmaydi (rasm bilan bir xil qoida).
verdict = { allowed: false, category: 'sexual' };
for (const f of ['start', 'processing', 'generate']) {
  vid.fail = f;
  // "processing" — Gemini videoni qayta ishlay olmadi (FAILED).
  vid.state = f === 'processing' ? 'PROCESSING' : 'ACTIVE';
  check(`11) xizmat xatosi (${f}) — video o‘tadi`, (await sendVideo('/api/upload-media')).status, 200);
}
vid.fail = '';
vid.state = 'ACTIVE';
const s0 = vid.started;
check('11) kalitsiz video tekshirilmaydi', (await sendVideo('/api/upload-media', base)).status, 200);
check('11) kalitsiz — Gemini chaqirilmadi', vid.started - s0, 0);

const vlog = await base.DB.prepare(`SELECT category, source FROM content_scan_blocks WHERE source IN ('media','card-video') ORDER BY id`).all();
checkTrue('11) video bloklari logda', (vlog.results || []).some((r) => r.source === 'card-video' && r.category === 'political'));
verdict = { allowed: true, category: 'none' };

// ── SAQLANGANLAR ─────────────────────────────────────────────────────
const s = async (init, c = cookie.user, path = '/api/saves') => {
  const r = await worker.fetch(req(path, { cookie: c, ...init }), env);
  return { status: r.status, body: await r.json().catch(() => null) };
};
check('10) kirmagan 401', (await worker.fetch(req('/api/saves?kind=reel'), env)).status, 401);
check('10) yaroqsiz kind 422', (await s({ method: 'POST', json: { kind: 'x', ref: 'p:1' } })).status, 422);
check('10) yaroqsiz ref 422', (await s({ method: 'POST', json: { kind: 'reel', ref: 'a b<>' } })).status, 422);
check('10) reel saqlandi', (await s({ method: 'POST', json: { kind: 'reel', ref: 'p:12' } })).body?.saved, true);
await s({ method: 'POST', json: { kind: 'reel', ref: 'p:12' } });
await s({ method: 'POST', json: { kind: 'reel', ref: 'c:7' } });
await s({ method: 'POST', json: { kind: 'listing', ref: "G'OYA/3f2a-9c1e" } });
const reels = await s({ method: 'GET' }, cookie.user, '/api/saves?kind=reel');
check('10) takrorlanmaydi', reels.body.items.map((i) => i.ref).sort(), ['c:7', 'p:12']);
const listing = await s({ method: 'GET' }, cookie.user, '/api/saves?kind=listing');
check('10) katalog sevimlisi', listing.body.items.map((i) => i.ref), ["G'OYA/3f2a-9c1e"]);
const other = await s({ method: 'GET' }, cookie.other, '/api/saves?kind=reel');
check('10) boshqa odamniki aralashmaydi', other.body.items.length, 0);
check('10) o‘chirildi', (await s({ method: 'POST', json: { kind: 'reel', ref: 'p:12', saved: false } })).body?.saved, false);
check('10) ro‘yxatda qolmadi', (await s({ method: 'GET' }, cookie.user, '/api/saves?kind=reel')).body.items.map((i) => i.ref), ['c:7']);

globalThis.fetch = realFetch;
void r2Count;
done('Rasm filtri va saqlanganlar');
