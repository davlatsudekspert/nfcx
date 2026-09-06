// Egasi sovg'a deb belgilagan ID'lar (src/lib/giftCodes.js) + ekslyuziv tarif.
//   node scripts/test-gift-codes.mjs
import worker from '../hosting/worker.js';
import { GIFT_CODES, isGiftCode } from '../src/lib/giftCodes.js';
import { tierForCode } from '../src/lib/pricing.js';
import { makeEnv, seedBasic, req, makeChecker } from './lib/d1-harness.mjs';
import { readFileSync } from 'node:fs';

const { env } = makeEnv();
await seedBasic(env);
const { check, checkTrue, done } = makeChecker();
const j = async (pathname, init) => {
  const r = await worker.fetch(req(pathname, init), env);
  let body = null; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};

// ═══ 1. FRONTEND va WORKER ro'yxati AYNAN bir xil ═══
{
  const src = readFileSync(new URL('../hosting/worker.js', import.meta.url), 'utf8');
  const m = src.match(/const GIFT_CODES_D1 = \[([^\]]*)\]/);
  checkTrue('worker ichida GIFT_CODES_D1 bor', !!m);
  const d1 = m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
  check('frontend va worker ro\'yxati bir xil', d1, GIFT_CODES);
  checkTrue('kalitlar katta harfda', GIFT_CODES.every((c) => c === c.toUpperCase()));
  check('katta-kichik harf farq qilmaydi', [isGiftCode('sav571'), isGiftCode('SAV571')], [true, true]);
  check('ro\'yxatda yo\'q kod sovg\'a emas', isGiftCode('OTH222'), false);
}

// ═══ 2. SAV571 — ekslyuziv tarif ═══
{
  check('SAV571 tarifi ekslyuziv (frontend)', tierForCode('SAV571'), 'exclusive');
}

// ═══ 3. KATALOGDA: narx o'rniga "Sovg'a" ═══
{
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('SAV571','Muhammad', 49000, 6000, 1, 'personal')`).run();
  const r = await j('/api/records');
  const by = Object.fromEntries((r.body || []).map((x) => [x.code, x]));
  check('SAV571 katalogda sovg\'a deb belgilangan', by.SAV571?.isGift, true);
  check('SAV571 tarifi ekslyuziv (API)', by.SAV571?.tierOverride || tierForCode('SAV571'), 'exclusive');
  check('ro\'yxatda yo\'q oddiy karta sovg\'a EMAS', by.OTH222?.isGift, false);
  // Qidiruvda ham bir xil
  const s = await j('/api/records/search?q=SAV');
  check('qidiruvda ham sovg\'a', (s.body?.records || []).find((x) => x.code === 'SAV571')?.isGift, true);
}

// ═══ 4. HAQIQIY sovg'a yozuvlari avvalgidek ishlaydi ═══
{
  await env.DB.prepare(`INSERT INTO cards (code, name, price, ts, user_id, profile_type) VALUES ('GFT100','Sovga', 0, 5900, 1, 'personal')`).run();
  await env.DB.prepare(
    `INSERT INTO nfc_gifts (code, recipient_name, note, value, activation_code, status, created_at)
     VALUES ('GFT100','Sovga','',0,'ACT999','activated', ?)`
  ).bind(new Date().toISOString()).run();
  const r = await j('/api/records');
  const by = Object.fromEntries((r.body || []).map((x) => [x.code, x]));
  check('haqiqiy nfc_gifts yozuvi hamon ishlaydi', by.GFT100?.isGift, true);
}

// ═══ 5. HECH QANDAY SOXTA YOZUV YARATILMAGAN ═══
// Eng muhim tekshiruv: ro'yxat faqat KO'RSATISHGA ta'sir qiladi.
{
  const g = await env.DB.prepare(`SELECT COUNT(*) AS n FROM nfc_gifts WHERE code = 'SAV571'`).first();
  check('SAV571 uchun nfc_gifts yozuvi YARATILMAGAN', Number(g.n), 0);
  const a = await env.DB.prepare(`SELECT COUNT(*) AS n FROM auctions`).first();
  const b = await env.DB.prepare(`SELECT COUNT(*) AS n FROM bids`).first();
  const w = await env.DB.prepare(`SELECT COUNT(*) AS n FROM web_orders`).first();
  check('auksion / taklif / buyurtma yozuvlari yaratilmagan', [Number(a.n), Number(b.n), Number(w.n)], [0, 0, 0]);
  // Kartaning saqlangan narxi ham o'zgarmagan
  const c = await env.DB.prepare(`SELECT price FROM cards WHERE code = 'SAV571'`).first();
  check('kartaning bazadagi narxi O\'ZGARTIRILMAGAN', Number(c.price), 49000);
}

done();
