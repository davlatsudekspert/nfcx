// hosting/api/showcase-samples.js — NFCSTORE'ning O'Z Ko'rgazma namunalari (BIR MARTA).
//
// ═══ NIMA UCHUN ═══
//
// Egasining qarori (2026-10-08, suhbatda aniq ruxsat: "o'zimizning
// NFCSTORE YouTube, nfcstore.uz, Instagram silkalarini olib qo'ygin,
// senga ruxsat"): Ko'rgazma bo'limi bo'sh ko'rinmasin — NFCSTORE biznes
// akkauntida (NFCSTOREUZ) 3 ta namunaviy ko'rgazma. Rasmlar — shu
// kompaniya katalogida ALLAQACHON turgan (avval yuklangan, tekshirilgan)
// fayllar; havolalar — NFCSTORE'ning o'z kanallari. Narx qo'yilmaydi:
// katalogda narxlar yashirin ("Narxi tez kunda").
//
// ═══ BIR MARTA ═══
//
// `app_migrations` dagi `showcase_samples_v1` belgisi (trial-promo.js
// kabi): avval `INSERT OR IGNORE`, qator haqiqatan qo'shilgandagina
// postlar yoziladi — bir vaqtda ikki chaqiruv kelsa ham bittasi bajaradi.
// Kompaniya yo'q/faol emas yoki katalog mahsuloti topilmasa — belgi
// QO'YILMAYDI (keyinroq qayta urinadi), hech narsa yozilmaydi.
// Egasi postni o'chirsa — qaytib yaratilmaydi (belgi turibdi).
//
// Chaqiriladi: GET /api/showcase (birinchi so'rovda, isolate'da bir marta)
// va kunlik cron.
//
// ═══ 2-TO'PLAM (`showcase_samples_v2`, 2026-10-09) ═══
//
// Egasi yana 2 ta oddiy (rasmli) namuna so'radi: NFC aksessuarlar va avto
// stiker. Alohida belgi — 1-to'plam allaqachon bajarilgan productionda ham
// bir marta qo'shiladi; qoidalar AYNAN bir xil (kompaniya + katalog
// mahsulotlari bo'lmasa — hech narsa, dublikat yo'q, o'chirilsa qaytmaydi).
// Bu reklama joyi EMAS (reklama — api/showcase-ads.js).

import { savePostExtras } from './music.js';

export const SHOWCASE_SAMPLES_MIGRATION = 'showcase_samples_v1';
export const SHOWCASE_SAMPLES_V2_MIGRATION = 'showcase_samples_v2';
export const SAMPLES_COMPANY = 'NFCSTOREUZ';

export const SAMPLES = [
  {
    catalogItemId: '00f90f16-8c8a-46e3-94b2-1e2cfbe18587',
    title: 'NFC ID karta — Shaharlar seriyasi',
    caption: 'Samarqand, Buxoro, Xiva, Toshkent — sevimli shahringiz endi kartangizda.\n'
      + 'Telefonga tekkizing — profilingiz bir zumda ochiladi: aloqa, ijtimoiy tarmoqlar, katalog.\n\n'
      + '📲 Ilova: nfcstore.uz/ilova-yuklash\n🌐 nfcstore.uz',
    mediaUrls: [
      '/uploads/file_30206799de64580b001e1c7c.jpg',
      '/uploads/file_b41fc68447cef0f6252f737c.jpg',
      '/uploads/file_cd6cb6979c42f322a0945374.jpg',
      '/uploads/file_e0233fe11656f471fff9d9ac.jpg',
    ],
    linkUrl: 'https://www.youtube.com/shorts/84wyMmZ7od0',
    musicId: 60,
    imageSeconds: 4,
  },
  {
    catalogItemId: '81f58625-730a-4789-93e6-333bf3823492',
    title: 'Metall NFC ID karta — qora va oltin',
    caption: 'Metall. Salmoqli. Esda qoladigan.\n'
      + 'Bir tegishda — ismingiz, raqamingiz va barcha havolalaringiz suhbatdoshingiz telefonida.\n\n'
      + 'Ko‘proq — Instagram’da: @nfcstore.uz\n🌐 nfcstore.uz',
    mediaUrls: [
      '/uploads/file_3e305e0384424711b71d8134.jpg',
      '/uploads/file_139a1f5c973a60498110d370.jpg',
      '/uploads/file_e826aeca72c2adbbaf404d8a.jpg',
    ],
    linkUrl: 'https://www.instagram.com/nfcstore.uz',
    musicId: 3,
    imageSeconds: 5,
  },
  {
    catalogItemId: '0bbae585-8d1d-4a71-801d-ad8cdaeacf94',
    title: 'Do‘kon va kafe uchun NFC — bir tegishda menyu',
    caption: 'Mijoz telefonini tekkizadi — menyu, Instagram, xarita va sharhlar shu zahoti ochiladi.\n'
      + 'Qog‘oz menyu ham, QR qidirish ham shart emas. Oynaga stiker yoki stolga stend — o‘zingiz tanlang.\n\n'
      + '🌐 nfcstore.uz',
    mediaUrls: [
      '/uploads/file_fa8fcae08f78369d8e432233.jpg',
      '/uploads/file_9de0e138a727ae4ec25ecd9c.jpg',
      '/uploads/file_d788c01812eb2c2f49d8e0c1.jpg',
      '/uploads/file_47c88327e904ff881e14f2bb.jpg',
      '/uploads/file_5eff6dcd4db1be3b79f81bd9.jpg',
    ],
    linkUrl: 'https://www.youtube.com/shorts/DPzWZFj0bxg',
    musicId: 63,
    imageSeconds: 4,
  },
];

export const SAMPLES_V2 = [
  {
    catalogItemId: '5a080c62-4874-463c-a8e2-e07129e24b75',
    title: 'NFC aksessuarlar — uzuk, braslet, brelok',
    caption: 'Uzuk, braslet yoki brelok — profilingiz doim yoningizda. '
      + 'Telefonga tekkizing — kontaktlaringiz, ijtimoiy tarmoqlaringiz va katalogingiz bir zumda ochiladi.\n\n'
      + '🌐 nfcstore.uz',
    mediaUrls: [
      '/uploads/file_0774774b14b747a4fdf0d211.jpg',
      '/uploads/file_a1dec8239a44aba30fcca9f6.jpg',
      '/uploads/file_905db3f524488ec36550b0ee.jpg',
      '/uploads/file_2f32d4b8ba7f925af702fb2c.jpg',
    ],
    linkUrl: 'https://www.instagram.com/nfcstore.uz',
    musicId: 62,
    imageSeconds: 4,
  },
  {
    catalogItemId: '9b5d9b47-6b6d-4116-9803-1af864b869b5',
    title: 'Avto NFC stiker Ø80 — mashinangiz vizitkasi',
    caption: 'Oynaga yopishtiring — kimdir mashinangizga telefonini tekkizsa, raqamingiz va profilingiz ochiladi. '
      + "Ehtiyot qilib qo'yilgan mashina — xabarlashish oson.\n\n"
      + '🌐 nfcstore.uz',
    mediaUrls: [
      '/uploads/file_59ff19e39f75fd9b7751e5bb.jpg',
      '/uploads/file_3b277b89106a8d0a9ccc6077.jpg',
      '/uploads/file_2eaf92bfeaa4148799250c73.jpg',
    ],
    linkUrl: 'https://www.youtube.com/shorts/KEKnJWig840',
    musicId: 58,
    imageSeconds: 4,
  },
];

const BATCHES = [
  [SHOWCASE_SAMPLES_MIGRATION, SAMPLES],
  [SHOWCASE_SAMPLES_V2_MIGRATION, SAMPLES_V2],
];

// Belgi → (env.DB → true). Har to'plam alohida keshlanadi.
const done = new Map(BATCHES.map(([m]) => [m, new WeakMap()]));

/// Hamma to'plamlar, tartib bilan. Natija — 1-to'plamniki kabi shakl:
/// `created` — shu chaqiruvda yaratilgan hamma postlar; `reason` — birinchi
/// bajarilmagan to'plam sababi; `batches` — har to'plam natijasi.
///   → { applied, created?, reason?, batches: { [marker]: natija } }
export async function seedShowcaseSamples(env, opts = {}) {
  const batches = {};
  const created = [];
  let reason;
  let error = false;
  for (const [marker, list] of BATCHES) {
    const r = await seedBatch(env, marker, list, opts);
    batches[marker] = r;
    if (r.created) created.push(...r.created);
    if (r.error) error = true;
    if (!r.applied && r.reason && reason === undefined) reason = r.reason;
  }
  const applied = Object.values(batches).some((r) => r.applied);
  return {
    applied,
    ...(applied ? { created } : {}),
    ...(reason !== undefined && !applied ? { reason } : {}),
    ...(error ? { error } : {}),
    batches,
  };
}

/// → { applied: false, reason? } | { applied: true, created }
async function seedBatch(env, marker, SAMPLES, { now = new Date() } = {}) {
  if (!env?.DB) return { applied: false, reason: 'no_db' };
  const cache = done.get(marker);
  if (cache.get(env.DB)) return { applied: false, reason: 'cached' };
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS "app_migrations" (
    name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL, detail TEXT
  )`).run();
  const seen = await env.DB.prepare(`SELECT 1 AS x FROM app_migrations WHERE name = ?`)
    .bind(marker).first();
  if (seen) { cache.set(env.DB, true); return { applied: false }; }

  // Shartlar — hammasi bo'lmasa, hech narsa yozmaymiz (keyin qayta).
  const company = await env.DB.prepare(`SELECT company_id FROM companies WHERE company_id = ? AND status = 'active'`)
    .bind(SAMPLES_COMPANY).first().catch(() => null);
  if (!company) return { applied: false, reason: 'no_company' };
  for (const s of SAMPLES) {
    const item = await env.DB.prepare(`SELECT id FROM company_catalog_items WHERE id = ? AND company_id = ?`)
      .bind(s.catalogItemId, SAMPLES_COMPANY).first().catch(() => null);
    if (!item) return { applied: false, reason: 'no_catalog_item' };
  }

  const nowIso = now.toISOString();
  const flag = await env.DB.prepare(`INSERT OR IGNORE INTO app_migrations (name, applied_at) VALUES (?, ?)`)
    .bind(marker, nowIso).run();
  cache.set(env.DB, true);
  if (!Number(flag?.meta?.changes || 0)) return { applied: false };

  const created = [];
  try {
    // Teskari tartibda — birinchi namuna eng yangi bo'lib tepada turadi.
    for (let i = SAMPLES.length - 1; i >= 0; i -= 1) {
      const s = SAMPLES[i];
      const ts = new Date(now.getTime() - (i + 1) * 60_000).toISOString();
      const mediaJson = JSON.stringify(s.mediaUrls.map((url) => ({ url, type: 'image' })));
      const row = await env.DB.prepare(
        `INSERT INTO company_posts (company_id, image_url, video_url, caption, created_at, media_json)
         VALUES (?, ?, NULL, ?, ?, ?) RETURNING id`
      ).bind(SAMPLES_COMPANY, s.mediaUrls[0], s.caption, ts, mediaJson).first();
      let musicId = null;
      try {
        const t = await env.DB.prepare(`SELECT id FROM music_tracks WHERE id = ? AND enabled = 1`).bind(s.musicId).first();
        musicId = t ? Number(t.id) : null;
      } catch { musicId = null; }
      await savePostExtras(env, 'company_post', Number(row.id), {
        musicId, musicStart: 0, reel: false, track: null,
        showcase: {
          title: s.title, priceUzs: null, linkUrl: s.linkUrl,
          catalogItemId: s.catalogItemId, imageSeconds: s.imageSeconds,
        },
      });
      created.push(Number(row.id));
    }
  } catch (e) {
    // Yarim yozilgan holatda belgi turadi — qayta yozib dublikat qilmaymiz.
    await env.DB.prepare(`UPDATE app_migrations SET detail = ? WHERE name = ?`)
      .bind(`error: ${String(e?.message || e).slice(0, 160)}; created=${created.join(',')}`, marker)
      .run().catch(() => {});
    return { applied: true, created, error: true };
  }
  await env.DB.prepare(`UPDATE app_migrations SET detail = ? WHERE name = ?`)
    .bind(`created=${created.join(',')}`, marker).run().catch(() => {});
  return { applied: true, created };
}

export function __resetShowcaseSamples() { /* WeakMap — yangi env.DB yangi holat */ }
