# hasharchilar.uz

Mahalladagi hasharlarni (tozalash / ko'kalamzorlashtirish) xaritada topish, bir bosishda qo'shilish,
yangisini e'lon qilish va **Oldin / Keyin** natijalarni ko'rish platformasi.

**Stek:** React (Vite) · Tailwind CSS v4 · Leaflet · Hono (Cloudflare Workers) · Cloudflare D1 · Cloudflare R2

```
hasharchilar/
├── schema.sql            # D1 sxemasi: users, hashars, hashar_media, volunteers
├── seed.sql              # lokal namuna ma'lumotlar
├── wrangler.jsonc        # Worker + D1 + R2 + statik fayllar sozlamasi
├── worker/               # Backend (Hono)
│   ├── index.js          #   API marshrutlari
│   ├── photos.js         #   R2 ga rasm yuklash (tur/hajm tekshiruvi)
│   └── validate.js       #   kiruvchi ma'lumotlarni tekshirish
├── src/                  # Frontend (React)
│   ├── App.jsx           #   holat, tablar, qatnashish/yaratish oqimi
│   ├── lib/              #   api.js, utils.js
│   └── components/       #   Header, Tabs, MapView, HasharCard, BeforeAfterSlider,
│                         #   CompletedGallery, CreateHasharModal (4 bosqich), JoinDialog …
└── public/demo/          # seed uchun namunaviy oldin/keyin rasmlar
```

## Lokal ishga tushirish

```bash
npm install
npm run db:local     # lokal D1 ga sxema + namuna ma'lumot
npm run dev          # API: http://localhost:8787, sayt: http://localhost:5173
```

## Cloudflare ga joylash

```bash
npx wrangler login
npx wrangler d1 create hasharchilar          # chiqqan database_id ni wrangler.jsonc ga yozing
npx wrangler r2 bucket create hasharchilar-photos
npm run db:remote                            # production bazaga sxema
npm run deploy                               # build + wrangler deploy
```

Domen: Cloudflare Dashboard → Workers → hasharchilar → Settings → Domains → `hasharchilar.uz`.

> **Cloudflare Pages haqida:** Cloudflare endi yangi loyihalar uchun Workers + Static Assets ni tavsiya qiladi —
> frontend va API bitta joyda, bitta `wrangler deploy` bilan chiqadi. Shu sababli loyiha shu usulda tuzilgan.

## API

| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/hashars` | Barcha hasharlar (qatnashuvchilar soni, oldin/keyin rasmlar bilan) |
| POST | `/api/hashars` | Yangi hashar (multipart: title, description, address, lat, lng, date_time, items, name, phone, photo) |
| POST | `/api/hashars/:id/join` | Qatnashish `{name, phone}` (takroriy bosish xavfsiz) |
| POST | `/api/hashars/:id/complete` | Yakunlash: tashkilotchi telefoni + "keyin" rasmi (multipart: phone, photo) |
| GET | `/api/media/:folder/:file` | R2 dagi rasmni berish |

## Ma'lum cheklovlar (keyingi qadamlar)

- **Autentifikatsiya yo'q:** foydalanuvchi telefon raqami bo'yicha aniqlanadi, SMS tasdiqlash yo'q. "Yakunlash" faqat
  tashkilotchi telefonini bilgan odamga ruxsat beradi — bu haqiqiy himoya emas. Production uchun SMS OTP (masalan Eskiz.uz)
  va sessiya/JWT qo'shing.
- **Rate limiting yo'q:** Cloudflare Dashboard'da WAF Rate Limiting qoidasini `/api/*` ga yoqing.
- "Yakunlash" tugmasi hozircha API da bor, lekin frontendda UI yo'q (keyingi qadam).
- Xarita OpenStreetMap plitkalaridan foydalanadi; katta yuklamada Mapbox/MapTiler ga o'ting.
