# NFCSTORE (nfcstore.uz) — raqamli vizitka xizmati

React (Vite) + Express + PostgreSQL (Railway). `AAA00` formatidagi (3 harf + 2 raqam) shaxsiy vizitka xizmati.

## Dinamik narxlash

- Boshlang'ich minimal narx: **200 000 so'm**
- Har bir band qilingan vizitka barcha narxlarni **+1%**ga oshiradi
- Shift (maximum): **×4 = 800 000 so'm**
- Narxni **server hisoblaydi** (`INSERT` paytida) — client ko'rsatgan raqamga ishonilmaydi
- Formula: `src/lib/pricing.js -> currentBase(sold)`

## Ishga tushirish (lokal)

```bash
npm install
cp .env.example .env   # DATABASE_URL ni to'ldiring
npm run dev
```

`npm run dev` serverni (`:3001`) va Vite'ni (`:5173`) bir vaqtda ishga tushiradi.
Brauzerda `http://localhost:5173` ochiladi, `/api` so'rovlar proxy orqali serverga boradi.

> `DATABASE_URL` kiritilmasa yoki DB ulanmasa ham sayt ishlaydi — ma'lumotlar
> vaqtincha localStorage'da saqlanadi (fallback rejim).

## Railway bilan deploy

1. **PostgreSQL qo'shish:** Railway loyihada `New -> Database -> PostgreSQL`.
2. **Backend service qo'shish:** `New -> GitHub Repo` — shu repoga ulang.
3. **DATABASE_URL ulash:** backend service -> Variables -> `New Variable` ->
   **Add Reference** -> Postgres servisdagi `DATABASE_URL`. Shu o'zgaruvchi
   orqali server avtomatik ulanadi va `cards` jadvalini o'zi yaratadi
   (`CREATE TABLE IF NOT EXISTS`) — migratsiya kerak emas.
4. Deploy sozlamalari `railway.json`da tayyor:
   - build: Nixpacks (`npm run build`)
   - start: `npm start`
   - healthcheck: `/api/health`

Server productionda `dist/` dagi frontendni ham o'zi beradi — bitta servis yetarli.

## API

| Metod | Yo'l                     | Tavsif |
|-------|--------------------------|--------|
| GET   | `/api/health`            | `{ ok, db }` |
| GET   | `/api/records`           | Band qilingan vizitkalar ro'yxati |
| GET   | `/api/records/:code`     | Bitta vizitka (yo'q bo'lsa 404) |
| POST  | `/api/records/:code`     | Vizitkani band qilish (band bo'lsa 409) |
| POST  | `/api/records/:code/view`| Ko'rishlar hisoblagichini oshirish |

## Tuzilma

```
server/
  index.js                 — Express API + statik dist serve
  db.js                    — pg Pool, schema init, so'rovlar
src/
  App.jsx                  — hash-routing: "" -> HomePage, "#/AAA00" -> ProfilePage
  main.jsx                 — React entry point
  index.css                — barcha stillar (dark marketing sayt + och "vizitka" temasi)
  lib/
    router.js              — useHashRoute() / navigate()
    pricing.js             — kod validatsiyasi va narx hisoblash
    format.js              — raqam/sana formatlash
    db.js                  — REST API client (localStorage fallback)
  components/
    Header.jsx, Footer.jsx
    ReserveModal.jsx       — band qilish formasi
    Icons.jsx              — inline SVG ikonalar
  pages/
    HomePage.jsx           — tekshirish, narx kalkulyatori, live katalog, FAQ
    ProfilePage.jsx        — har bir vizitkaning shaxsiy sahifasi
```

## Xavfsizlik

- Barcha SQL so'rovlar parametrlangan (SQL injection yo'q)
- Server tomonda validatsiya: kod formati, maydon uzunliklari, URL protokoli (faqat http/https)
- `INSERT ... ON CONFLICT DO NOTHING` — ikki kishi bir vaqtda band qilsa, faqat bittasiga o'tadi

## Keyingi qadamlar

- To'lov integratsiyasi (Payme/Click)
- Admin panel — vizitkalarni boshqarish/o'chirish
- Rasm yuklash (hozircha avatar faqat URL orqali)
"# nfcx" 
