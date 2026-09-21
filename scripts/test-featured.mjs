// NFCSTORE FEATURED — pullik ko'tarilgan slotlar.
//
// Haqiqiy `hosting/worker.js` + xotiradagi SQLite (d1-harness).
// Production D1/R2 ga TEGMAYDI.
//
//   node scripts/test-featured.mjs
//
// BU TESTNING ASOSIY SAVOLI BITTA: SLOT TO'LOVSIZ YONA OLADIMI?
//
// Javob "yo'q" bo'lishi kerak va u TAXMIN qilinmaydi — to'lov
// HAQIQIY Payme JSON-RPC yo'li bilan (`/api/pay/payme`, Basic
// auth, CreateTransaction + PerformTransaction) o'tkaziladi.
// Soxta "to'landi" bayrog'i qo'yilmaydi.

import worker from '../hosting/worker.js';
import { makeEnv, seedBasic, req, cookie, makeChecker } from './lib/d1-harness.mjs';

// To'lovlar YOQILGAN muhit — aks holda sotib olish 503 bo'lardi.
// Kalit SINOV uchun, faqat shu jarayonda yashaydi.
const { env } = makeEnv({
  PAYMENTS_ENABLED: 'true',
  PAYME_MERCHANT_ID: 'test_merchant_local_only',
  PAYME_KEY: 'test_payme_key_local_only',
});
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();

// user#1 — VIP001 egasi, user#2 — OTH222 egasi.
await env.DB.prepare(
  `INSERT INTO posts (id, code, user_id, caption, created_at)
   VALUES (10, 'VIP001', 1, 'A ning posti', '2026-01-01 00:00:00')`
).run();
await env.DB.prepare(
  `INSERT INTO posts (id, code, user_id, caption, created_at)
   VALUES (20, 'OTH222', 2, 'B ning posti', '2026-01-01 00:00:00')`
).run();

const call = async (path, init = {}) => {
  const res = await worker.fetch(req(path, init), env);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const asA = { cookie: cookie.user };
const asB = { cookie: cookie.other };
const asAdmin = { cookie: cookie.admin };

/// HAQIQIY PAYME TO'LOVI — soxta emas.
///
/// Basic auth: login "Paycom", parol `env.PAYME_KEY`. Aynan
/// production'dagi tartib; kalit faqat shu sinov muhitida.
const payme = async (body) => {
  const auth = 'Basic ' + Buffer.from(`Paycom:${env.PAYME_KEY}`).toString('base64');
  const res = await worker.fetch(
    req('/api/pay/payme', { method: 'POST', json: body, headers: { authorization: auth } }),
    env,
  );
  return res.json();
};

const payOrder = async (orderId, priceSom, ptxId) => {
  const created = await payme({
    method: 'CreateTransaction', id: 1,
    params: { id: ptxId, account: { order_id: orderId }, amount: priceSom * 100 },
  });
  const performed = await payme({ method: 'PerformTransaction', id: 2, params: { id: ptxId } });
  return { created, performed };
};

const slotRow = async (id) =>
  env.DB.prepare(`SELECT * FROM featured_slots WHERE id = ?`).bind(id).first().catch(() => null);

// ── 1) NARXLAR SERVERDAN KELADI ──────────────────────────────────
const packs = await call('/api/featured/packages');
check('1) narxlar ochiq', packs.status, 200);
check('1) uchta paket', (packs.body?.packages || []).length, 3);
check('1) kunlar 1/3/6', (packs.body?.packages || []).map((p) => p.days).join(','), '1,3,6');
checkTrue('1) har birida narx bor', (packs.body?.packages || []).every((p) => p.price > 0));
checkTrue('1) to‘lovlar yoqilgan', packs.body?.enabled === true);

const price3 = (packs.body?.packages || []).find((p) => p.days === 3)?.price;

// ── 2) KIRMASDAN SOTIB BO'LMAYDI ─────────────────────────────────
check('2) auth shart',
  (await call('/api/featured', { method: 'POST', json: { targetKind: 'post', targetId: 10, days: 3 } })).status,
  401);

// ── 3) BEGONA KONTENTNI KO'TARIB BO'LMAYDI ───────────────────────
const stolen = await call('/api/featured', {
  method: 'POST', ...asA, json: { targetKind: 'post', targetId: 20, days: 3 },
});
check('3) begona post rad etildi', stolen.status, 403);

// ── 4) NARXNI MIJOZ BELGILAY OLMAYDI ─────────────────────────────
//
// So'rovda `price: 1` yuboriladi. Server uni BUTUNLAY e'tiborsiz
// qoldirishi kerak — aks holda 6 kunlik slot 1 so'mga ketardi.
const buy = await call('/api/featured', {
  method: 'POST', ...asA,
  json: { targetKind: 'post', targetId: 10, days: 3, price: 1 },
});
check('4) sotib olish ochildi', buy.status, 201);
check('4) narx SERVERNIKI', Number(buy.body?.price), price3);
check('4) slot narxi ham serverniki', Number(buy.body?.slot?.price), price3);

const slotId = Number(buy.body?.slot?.id);
const orderId = Number(buy.body?.orderId);
checkTrue('4) buyurtma ochildi', orderId > 0);
checkTrue('4) to‘lov havolasi berildi', !!buy.body?.payLinks?.payme);

// ── 5) TO'LOVGACHA SLOT YONMAYDI ─────────────────────────────────
check('5) holat "kutilmoqda"', String(buy.body?.slot?.status), 'pending');
check('5) ommaviy ro‘yxat BO‘SH', ((await call('/api/featured')).body?.slots || []).length, 0);
checkTrue('5) boshlanish vaqti yo‘q', (await slotRow(slotId))?.starts_at == null);

// ── 6) BUYURTMA "featured_slot" TURIDA ───────────────────────────
const order = await env.DB.prepare(`SELECT * FROM web_orders WHERE id = ?`).bind(orderId).first();
check('6) buyurtma turi', String(order?.kind), 'featured_slot');
check('6) buyurtma narxi', Number(order?.price), price3);
check('6) buyurtma kutilmoqda', String(order?.status), 'pending');

// ── 7) NOTO'G'RI SUMMA BILAN TO'LAB BO'LMAYDI ────────────────────
const wrongAmount = await payme({
  method: 'CheckPerformTransaction', id: 9,
  params: { account: { order_id: orderId }, amount: 100 },
});
checkTrue('7) noto‘g‘ri summa rad etildi', !!wrongAmount.error);
check('7) slot hamon kutilmoqda', String((await slotRow(slotId))?.status), 'pending');

// ── 8) HAQIQIY TO'LOV SLOTNI YOQADI ──────────────────────────────
const paid = await payOrder(orderId, price3, 'ptx-featured-1');
check('8) CreateTransaction o‘tdi', paid.created.result?.state, 1);
check('8) PerformTransaction o‘tdi', paid.performed.result?.state, 2);

const active = await slotRow(slotId);
check('8) slot YONDI', String(active?.status), 'active');
checkTrue('8) boshlanish vaqti qo‘yildi', !!active?.starts_at);
checkTrue('8) tugash vaqti qo‘yildi', !!active?.ends_at);

const pub = await call('/api/featured');
check('8) ommaviy ro‘yxatda ko‘rindi', (pub.body?.slots || []).length, 1);
check('8) to‘g‘ri kontent', Number(pub.body?.slots?.[0]?.targetId), 10);

// Muddat AYNAN 3 kun bo'lishi kerak — ko'proq emas.
const durationDays = (Date.parse(String(active.ends_at).replace(' ', 'T').replace('+00', 'Z'))
  - Date.parse(String(active.starts_at).replace(' ', 'T').replace('+00', 'Z'))) / 86400000;
check('8) muddat aynan 3 kun', Math.round(durationDays), 3);

// ── 9) TAKRORIY PerformTransaction MUDDATNI UZAYTIRMAYDI ─────────
//
// Payme tarmoq uzilganda so'rovni qayta yuboradi. Agar har safar
// `ends_at` qayta hisoblansa, bitta to'lov bilan slot cheksiz
// uzayardi.
const endsBefore = String(active.ends_at);
await payme({ method: 'PerformTransaction', id: 3, params: { id: 'ptx-featured-1' } });
check('9) tugash vaqti O‘ZGARMADI', String((await slotRow(slotId))?.ends_at), endsBefore);
check('9) ommaviy ro‘yxatda hamon bitta',
  ((await call('/api/featured')).body?.slots || []).length, 1);

// ── 10) BIR KONTENT IKKI MARTA KO'TARILMAYDI ─────────────────────
const again = await call('/api/featured', {
  method: 'POST', ...asA, json: { targetKind: 'post', targetId: 10, days: 1 },
});
check('10) takror rad etildi', again.status, 409);
check('10) sababi aytildi', String(again.body?.error || ''), 'already_featured');

// ── 11) NOTO'G'RI PAKET RAD ETILADI ──────────────────────────────
await env.DB.prepare(
  `INSERT INTO posts (id, code, user_id, caption, created_at)
   VALUES (11, 'VIP001', 1, 'ikkinchi post', '2026-01-01 00:00:00')`
).run();
check('11) jadvalda yo‘q kun soni rad etildi',
  (await call('/api/featured', { method: 'POST', ...asA, json: { targetKind: 'post', targetId: 11, days: 99 } })).status,
  422);
check('11) noma‘lum tur rad etildi',
  (await call('/api/featured', { method: 'POST', ...asA, json: { targetKind: 'hack', targetId: 11, days: 1 } })).status,
  422);
check('11) mavjud bo‘lmagan kontent 404',
  (await call('/api/featured', { method: 'POST', ...asA, json: { targetKind: 'post', targetId: 9999, days: 1 } })).status,
  404);

// ── 12) BEKOR QILISH — FAQAT TO'LANMAGANINI ──────────────────────
const pending2 = await call('/api/featured', {
  method: 'POST', ...asA, json: { targetKind: 'post', targetId: 11, days: 1 },
});
check('12) ikkinchi slot ochildi', pending2.status, 201);
const slot2 = Number(pending2.body?.slot?.id);

check('12) begona odam bekor qila olmadi',
  (await call(`/api/featured/${slot2}/cancel`, { method: 'POST', ...asB })).status, 403);
check('12) egasi bekor qildi',
  (await call(`/api/featured/${slot2}/cancel`, { method: 'POST', ...asA })).status, 200);
check('12) buyurtma ham bekor bo‘ldi',
  String((await env.DB.prepare(`SELECT status FROM web_orders WHERE id = ?`)
    .bind(Number(pending2.body?.orderId)).first())?.status), 'cancelled');
check('12) TO‘LANGAN slotni bekor qilib bo‘lmaydi',
  (await call(`/api/featured/${slotId}/cancel`, { method: 'POST', ...asA })).status, 409);

// ── 13) BIR ODAM CHEKSIZ SLOT OLA OLMAYDI ────────────────────────
// Bittasi allaqachon faol. Yana ikkitasini faollashtiramiz,
// keyin to'rtinchisi rad etilishi kerak.
let ptx = 100;
for (const pid of [11, 12]) {
  if (pid !== 11) {
    await env.DB.prepare(
      `INSERT INTO posts (id, code, user_id, caption, created_at)
       VALUES (?, 'VIP001', 1, 'post', '2026-01-01 00:00:00')`
    ).bind(pid).run();
  }
  const b = await call('/api/featured', {
    method: 'POST', ...asA, json: { targetKind: 'post', targetId: pid, days: 1 },
  });
  await payOrder(Number(b.body?.orderId), Number(b.body?.price), `ptx-f-${ptx++}`);
}
await env.DB.prepare(
  `INSERT INTO posts (id, code, user_id, caption, created_at)
   VALUES (13, 'VIP001', 1, 'post', '2026-01-01 00:00:00')`
).run();
const tooMany = await call('/api/featured', {
  method: 'POST', ...asA, json: { targetKind: 'post', targetId: 13, days: 1 },
});
check('13) to‘rtinchi faol slot rad etildi', tooMany.status, 409);
check('13) sababi aytildi', String(tooMany.body?.error || ''), 'too_many_active');

// ── 14) MUDDATI O'TGAN SLOT LENTADAN YO'QOLADI ───────────────────
const beforeExpire = ((await call('/api/featured')).body?.slots || []).length;
checkTrue('14) hozir faol slotlar bor', beforeExpire === 3);
await env.DB.prepare(
  `UPDATE featured_slots SET ends_at = '2020-01-01 00:00:00+00' WHERE id = ?`
).bind(slotId).run();
check('14) eskirgan slot chiqmadi',
  ((await call('/api/featured')).body?.slots || []).length, beforeExpire - 1);
check('14) holati "expired" ga o‘tdi', String((await slotRow(slotId))?.status), 'expired');

// ── 15) MENING SLOTLARIM ─────────────────────────────────────────
check('15) auth shart', (await call('/api/featured/mine')).status, 401);
const mine = await call('/api/featured/mine', asA);
checkTrue('15) o‘z slotlari ko‘rinadi', (mine.body?.slots || []).length >= 4);
check('15) begona odamda bo‘sh', ((await call('/api/featured/mine', asB)).body?.slots || []).length, 0);

// ── 16) ADMIN ────────────────────────────────────────────────────
check('16) cookie‘siz admin ro‘yxati yo‘q', (await call('/api/admin/featured')).status, 401);
check('16) oddiy foydalanuvchi admin emas', (await call('/api/admin/featured', asA)).status, 401);

const adminList = await call('/api/admin/featured', asAdmin);
check('16) admin ro‘yxati ochildi', adminList.status, 200);
checkTrue('16) buyurtma raqami ko‘rinadi',
  (adminList.body?.slots || []).every((s) => 'orderId' in s));

const activeOnly = await call('/api/admin/featured?state=active', asAdmin);
checkTrue('16) filtr ishladi',
  (activeOnly.body?.slots || []).every((s) => s.status === 'active'));

// ── 17) ADMIN SABABSIZ TO'XTATA OLMAYDI ──────────────────────────
const liveSlot = (activeOnly.body?.slots || [])[0];
checkTrue('17) to‘xtatish uchun faol slot bor', !!liveSlot);
check('17) sababsiz rad etildi',
  (await call(`/api/admin/featured/${liveSlot.id}/stop`, { method: 'POST', ...asAdmin, json: {} })).status,
  422);
check('17) sabab bilan to‘xtatildi',
  (await call(`/api/admin/featured/${liveSlot.id}/stop`, { method: 'POST', ...asAdmin, json: { reason: 'Qoidabuzar e‘lon' } })).status,
  200);
const stopped = await slotRow(liveSlot.id);
check('17) holati "stopped"', String(stopped?.status), 'stopped');
checkTrue('17) qaysi admin ekani yozildi', /^admin#\d+:/.test(String(stopped?.stopped_reason || '')));
checkTrue('17) sabab saqlandi', String(stopped?.stopped_reason || '').includes('Qoidabuzar'));

// ── 18) TO'XTATILGAN SLOT LENTADAN CHIQDI ────────────────────────
checkTrue('18) to‘xtatilgani ko‘rinmaydi',
  !((await call('/api/featured')).body?.slots || []).some((s) => s.id === liveSlot.id));

// ── 19) MAVJUD MARKETPLACE TIZIMI BUZILMADI ──────────────────────
//
// FEATURED `web_orders` ni ULASHADI. Agar `finalizePaidWebOrderD1`
// dagi yangi tarmoq noto'g'ri joyga qo'yilgan bo'lsa, oddiy karta
// xaridi ham shu tarmoqqa tushib ketardi.
// `payload` da `name` BO'LISHI SHART: `createRecordD1` kartani
// aynan shundan yasaydi va `cards.name` NOT NULL.
const cardOrder = await env.DB.prepare(
  `INSERT INTO web_orders (user_id, code, kind, price, payload, status)
   VALUES (1, 'NEWCODE1', 'card_purchase', 49000, '{"name":"Sinov kartasi"}', 'pending')
   RETURNING id`
).first();
await payOrder(Number(cardOrder.id), 49000, 'ptx-card-1');
const cardOrderAfter = await env.DB.prepare(`SELECT status FROM web_orders WHERE id = ?`)
  .bind(Number(cardOrder.id)).first();
check('19) oddiy karta xaridi hamon ishlaydi', String(cardOrderAfter?.status), 'paid');
const newCard = await env.DB.prepare(`SELECT user_id FROM cards WHERE code = 'NEWCODE1'`).first();
check('19) karta HAQIQATDAN yaratildi', Number(newCard?.user_id), 1);
check('19) unga FEATURED slot yaratilmadi',
  (await env.DB.prepare(`SELECT COUNT(*) AS n FROM featured_slots WHERE order_id = ?`)
    .bind(Number(cardOrder.id)).first())?.n, 0);

// ═══════════════════════════════════════════════════════════════════
// 20) KO'TARILGAN KONTENT LENTADA — ALOHIDA ENDPOINTSIZ
// ═══════════════════════════════════════════════════════════════════
//
// Ilova lentani `/api/feed` dan oladi. Ko'tarilgan kontent uchun
// ikkinchi manba ochilmagan: u SHU lentaning boshida, `featured:
// true` belgisi bilan keladi.

// Toza holat: hamma slotni o'chirib, bittasini qaytadan yoqamiz.
await env.DB.prepare(`UPDATE featured_slots SET status = 'expired'`).run();
await env.DB.prepare(
  `INSERT INTO posts (id, code, user_id, caption, created_at)
   VALUES (30, 'VIP001', 1, 'KO‘TARILGAN post', '2020-01-01 00:00:00')`
).run();
const promo = await call('/api/featured', {
  method: 'POST', ...asA, json: { targetKind: 'post', targetId: 30, days: 1 },
});
check('20) slot ochildi', promo.status, 201);
await payOrder(Number(promo.body?.orderId), Number(promo.body?.price), 'ptx-feed-1');

const feed = await call('/api/feed', asB);
const items = feed.body?.feed || [];
checkTrue('20) lenta bo‘sh emas', items.length > 0);
check('20) BIRINCHI qator — ko‘tarilgan kontent', Number(items[0]?.id), 30);
check('20) unga "featured" belgisi qo‘yilgan', items[0]?.featured, true);

// Eng muhimi: u lentadagi eng ESKI post (2020-yil). Ko'tarilmaganda
// u oxirida turardi — ya'ni yuqoriga chiqishi to'lov tufayli.
checkTrue('20) oddiy qatorlarda "featured" belgisi YO‘Q',
  items.slice(1).every((f) => !f.featured));

// IKKI MARTA chiqmasligi kerak.
check('20) lentada bir marta',
  items.filter((f) => Number(f.id) === 30 && f.commentKind === 'post').length, 1);

// Shakli oddiy qator bilan AYNAN bir xil — ilova ikkalasini ham
// bitta `Post.fromJson` bilan o'qiydi.
for (const key of ['kind', 'code', 'authorKind', 'name', 'imageUrl',
                   'caption', 'createdAt', 'likeCount', 'commentKind']) {
  checkTrue(`20) "${key}" maydoni bor`, key in (items[0] || {}));
}

// ── 21) IKKINCHI SAHIFADA TAKRORLANMAYDI ─────────────────────────
const page2 = await call('/api/feed?page=2', asB);
checkTrue('21) 2-sahifada ko‘tarilgan kontent YO‘Q',
  !(page2.body?.feed || []).some((f) => f.featured));

// ── 22) PUL MAXFIYLIKNI OCHIB BERMAYDI ───────────────────────────
//
// Eng nozik joy: ko'tarilgan kontent UNIONDAN o'tadi, ya'ni
// katalogdan yashiringan profil pul to'lagani uchun ham lentaga
// chiqmasligi kerak.
await env.DB.prepare(`UPDATE cards SET hidden_from_directory = 1 WHERE code = 'VIP001'`).run();
const hiddenFeed = await call('/api/feed', asB);
checkTrue('22) yashiringan profil pulga ham CHIQMADI',
  !(hiddenFeed.body?.feed || []).some((f) => Number(f.id) === 30));
await env.DB.prepare(`UPDATE cards SET hidden_from_directory = 0 WHERE code = 'VIP001'`).run();

// ── 23) BLOKLANGAN MUALLIF KO'TARILGAN BO'LSA HAM CHIQMAYDI ──────
// Blok turi `record` (`card` emas) — `moderation.js` dagi
// `BLOCK_KINDS` shunday. `feedApi` uni `card:` kalitiga
// o'giradi.
const blockRes = await call('/api/blocks', {
  method: 'POST', ...asB, json: { kind: 'record', id: 'VIP001' },
});
check('23) blok qo‘yildi', blockRes.status, 200);
checkTrue('23) bloklangan muallifning KO‘TARILGAN posti ham chiqmadi',
  !((await call('/api/feed', asB)).body?.feed || []).some((f) => Number(f.id) === 30));

// Blok olinsa — qaytadi.
await call('/api/blocks/record/VIP001', { method: 'DELETE', ...asB });
checkTrue('23) blok olingach qaytdi',
  ((await call('/api/feed', asB)).body?.feed || []).some((f) => Number(f.id) === 30));

done('NFCSTORE FEATURED');
