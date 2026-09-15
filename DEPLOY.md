# Deploy: sayt qanday chiqadi

Bu hujjat 2026-09-15 da yozildi, chunki sayt ishdan chiqqanda sabab
topishga ikki marta soatlab vaqt ketdi. Chalkashlikning ildizi bitta:
**bitta domenni ikkita Worker bo'lishib xizmat qiladi** va buni hech
qayerda yozilmagan edi.

## Ikkita Worker

| Worker | Nimani beradi | Qanday biriktirilgan |
|---|---|---|
| `nfcstore-uz` | `nfcstore.uz`, `www.nfcstore.uz` — saytning o'zi: HTML, CSS, JS, rasm | **Custom Domain** |
| `nfcstore-api` | `nfcstore.uz/api/*`, `nfcstore.uz/uploads/*` | **Route** |

Marshrut (Route) domendan ko'ra aniqroq, shuning uchun `/api/*` va
`/uploads/*` `nfcstore-api` ga tushadi, qolgan hamma narsa esa
`nfcstore-uz` ga.

Ikkalasining o'z manzili ham bor va ular marshrutlarni chetlab o'tadi —
nosozlikni ajratishda eng tez usul shu:

- https://nfcstore-uz.davlatsudekspert.workers.dev
- https://nfcstore-api.davlatsudekspert.workers.dev

## Ikkita deploy yo'li

1. **GitHub Actions** — `.github/workflows/deploy.yml`, `main` ga har
   push'da. `npx wrangler deploy` ni chaqiradi.
2. **Cloudflare Git integratsiyasi** — `nfcstore-uz` Worker'ining
   Settings -> Build bo'limida sozlangan. U ham `npx wrangler deploy`
   ni chaqiradi.

## ⚠️ Nomuvofiqlik — buni bilib turing

`wrangler.jsonc` da `"name": "nfcstore-api"` yozilgan va `wrangler`
DOIM shu nomga deploy qiladi. Ya'ni **ikkala yo'l ham `nfcstore-api`
ga chiqadi**, hech biri `nfcstore-uz` ga tegmaydi — garchi ikkinchi
yo'l aynan `nfcstore-uz` Worker'i ostida sozlangan bo'lsa ham.

Cloudflare buni build sahifasida sariq banner bilan aytadi:

> Update `wrangler.jsonc` in your repo to keep settings consistent
> `"name": "nfcstore-uz"`

Banner **haqiqiy** nomuvofiqlikni ko'rsatadi. Lekin uni ko'r-ko'rona
qabul qilib bo'lmaydi: nom `nfcstore-uz` ga o'zgartirilsa,
`nfcstore-api` ga deploy to'xtaydi va `/api/*` eski kodda qotib
qoladi. To'g'ri tuzatish ikki qadam va ular SHU TARTIBDA bo'lishi
kerak:

1. `wrangler.jsonc` da nomni `nfcstore-uz` ga o'zgartirib deploy qilish
   — sayt yangilanadi, `/api/*` esa hamon eski `nfcstore-api` dan
   ishlab turaveradi, ya'ni hech narsa buzilmaydi.
2. Keyin `nfcstore-api` dagi 4 ta Route'ni o'chirish, shunda `/api/*`
   ham `nfcstore-uz` ga o'tadi.

**2-qadamdan oldin SECRETLARNI ko'chirish shart.** Secretlar Worker'ga
biriktirilgan va `wrangler.jsonc` da yozilmaydi (ataylab), ya'ni ular
deploy bilan ko'chmaydi. `nfcstore-uz` da bular bo'lmasa to'lov darhol
ishdan chiqadi:

- `PAYME_MERCHANT_ID`, `PAYME_KEY`
- `CLICK_SERVICE_ID`, `CLICK_SECRET_KEY`, `CLICK_MERCHANT_ID`
- `GEMINI_API_KEY` (AI yordamchi; bo'lmasa vidjet o'zini ko'rsatmaydi)

D1 va R2 bog'lanishlari esa `wrangler.jsonc` da yozilgan, shuning uchun
ular deploy bilan o'zi o'rnatiladi.

## Build token

Cloudflare Git integratsiyasi alohida "build token" ga bog'liq. U
o'chirilsa yoki almashtirilsa build muhiti umuman ishga tushmaydi va
build ~1 soniyada yiqiladi, log'da esa hech qanday kod xatosi
ko'rinmaydi:

```
Initializing build environment...
Failed: The build token selected for this build has been deleted or
rolled and cannot be used for this build
```

2026-09-15 da aynan shunday bo'ldi. Tuzatish: Workers & Pages ->
`nfcstore-uz` -> Settings -> Build -> **Disconnect**, so'ng **Connect**
-> GitHub -> `davlatsudekspert/nfcx` -> branch `main`. Cloudflare yangi
token'ni o'zi yaratadi, repoda hech narsa o'zgarmaydi.

Qayta ulaganda build sozlamalari so'raladi:

| Maydon | Qiymat |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Version command | `npx wrangler versions upload` |
| Root directory | `/` |
| Production branch | `main` |

## Nosozlikni qanday ajratish

| Belgi | Qayerga qarash |
|---|---|
| Sahifa ochiladi, lekin CSS/JS uchun 404 yoki 500 | `nfcstore-uz` eski build'da qolgan |
| Sahifa ochiladi, lekin ma'lumot kelmaydi ("Topilmadi.") | `nfcstore-api` — `/api/*` |
| Rasm ko'rinmaydi | `nfcstore-api` — `/uploads/*` (R2) |
| Ilovada kirish ishlamaydi | `nfcstore-api` — `/api/auth/*` |

Brauzerda eski fayl qolib ketishi ham mumkin: `index.html` service
worker keshida turgan bo'lsa, u endi mavjud bo'lmagan `assets/*.css`
ni so'raydi. Shuning uchun ikonka yoki qobiq o'zgarganda
`public/sw.js` dagi `VERSION` va `index.html` dagi `?v=` BIRGA
oshiriladi.
