# Deploy: sayt qanday chiqadi

Bu hujjat 2026-09-15 da yozildi. O'sha kuni sayt ham, ilova ham
ishlamay qoldi va sabab topishga soatlab vaqt ketdi. Ildizi bitta
edi: **hisobda ikkita Worker bor va ular ikki xil yo'l bilan
yangilanadi** — buni hech qayerda yozilmagan edi.

## Nima bo'lgan edi

| Worker | Kim yangilaydi | Holati |
|---|---|---|
| `nfcstore-uz` | Cloudflare Git integratsiyasi | domen SHU YERDA edi, ya'ni odamlar shuni ko'rardi |
| `nfcstore-api` | GitHub Actions (`wrangler deploy`) | domen unga faqat `/api/*` va `/uploads/*` marshrutlari bilan ulangan edi |

**Nomlar chalkashtirgan joyi:** `wrangler.jsonc` dagi `name` faqat
`wrangler deploy` uchun kuchga ega. Cloudflare Workers Builds esa
skript nomini O'ZI biriktirilgan Worker'ga **majburan** o'zgartiradi
va fayldagi nomni e'tiborga olmaydi. Shuning uchun fayldagi nomga
qarab "deploy qayerga boradi" deb xulosa chiqarish **xato** — bu
adashtirgan asosiy narsa bo'ldi.

Natijada GitHub Actions'ning 213 ta muvaffaqiyatli deploy'i hech kim
ochmaydigan `nfcstore-api` ga tushardi. Git integratsiyasi build
token bilan ishdan chiqqach `nfcstore-uz` qotib qoldi va:

- saytda `assets/index-*.css` uchun 404/500 chiqdi;
- ilovada lenta "Topilmadi. `not_found` HTTP 404" berdi — chunki
  `/api/*` marshrut orqali ESKI `nfcstore-api` ga tushardi va u
  yerda `/api/feed` umuman yo'q edi.

Marshrut (Route) Custom Domain'dan **aniqroq**, shuning uchun domen
to'g'ri Worker'da turganda ham `/api/*` eskisiga ketaverardi.

## Hozirgi holat (tuzatilgandan keyin)

- `nfcstore.uz` va `www.nfcstore.uz` → **`nfcstore-uz`** (Custom Domain)
- `nfcstore-api` dagi eski Route'lar **o'chirildi**
- `wrangler.jsonc` dagi `name` → **`nfcstore-uz`**, ya'ni GitHub
  Actions ham endi ishlab turgan Worker'ni yangilaydi va sayt buzuq
  Git integratsiyasiga bog'liq emas

Tekshirilgan:

```
nfcstore.uz/                                200  haqiqiy sahifa
nfcstore.uz/api/feed                        200  lenta ma'lumoti bilan
nfcstore.uz/api/settings/payments-enabled   200  payme va click: true
nfcstore.uz/uploads/....jpg                 200  haqiqiy JPEG
```

## Qoidalar

**1. Fayldagi nomga ishonmang — so'rab ko'ring.** Qaysi Worker'da
qanday kod turganini bilishning yagona ishonchli yo'li — ikkala
manzilni yonma-yon so'roq qilish. Ular marshrutlarni chetlab o'tadi:

- https://nfcstore-uz.davlatsudekspert.workers.dev/api/feed
- https://nfcstore-api.davlatsudekspert.workers.dev/api/feed

**2. Secretlar deploy bilan KO'CHMAYDI.** Ular Worker'ga biriktirilgan
va `wrangler.jsonc` da ataylab yozilmaydi. Worker almashtirilsa bular
qo'lda ko'chirilishi shart, aks holda to'lov darhol to'xtaydi:
`PAYME_MERCHANT_ID`, `PAYME_KEY`, `CLICK_SERVICE_ID`,
`CLICK_SECRET_KEY`, `CLICK_MERCHANT_ID`, `GEMINI_API_KEY`.
D1 va R2 esa `wrangler.jsonc` da yozilgan, ular o'zi o'rnatiladi.

**3. `/uploads/*` — R2.** Marshrut yoki Worker o'zgarsa rasmlarni
ALOHIDA tekshiring: API 200 qaytaraverib, faqat rasmlar yo'qolishi
mumkin va buni sezmay qolish oson.

## Avtomatlashtirish

`.github/workflows/cf-domains.yml` — domenlarni ko'rish va ko'chirish
(Cloudflare API orqali, `CLOUDFLARE_API_TOKEN` bilan). Standart rejim
`read`: hech narsa o'zgarmaydi, faqat qaysi domen qaysi Worker'da
ekani chiqariladi va uchala manzil so'roq qilinadi.

`apply` uchun `confirm: KO'CHIR`, `target` (nishon Worker) va
ixtiyoriy `drop_routes` kerak.

**Eslatma — bir marta zarar yetkazgan xato:** Cloudflare `DELETE`
uchun `204 No Content` va BO'SH tana qaytaradi. Uni "xato" deb
o'qigan skript amal bajarilgani holda "hech narsa o'zgarmadi" deb
yozdi va domen bir muddat umuman uzilib qoldi. Skriptda bu tuzatilgan
(bo'sh tana = muvaffaqiyat), lekin Cloudflare API bilan ishlaganda
buni doim yodda tuting.

## Build token

Git integratsiyasi alohida "build token" ga bog'liq. U o'chirilsa
build muhiti ko'tarilmaydi va build ~1 soniyada yiqiladi, log'da esa
kod xatosi ko'rinmaydi:

```
Initializing build environment...
Failed: The build token selected for this build has been deleted or
rolled and cannot be used for this build
```

Tuzatish: Workers & Pages → `nfcstore-uz` → Settings → Build →
**Disconnect**, so'ng **Connect** → GitHub → `davlatsudekspert/nfcx`
→ branch `main`. Cloudflare yangi token'ni o'zi yaratadi.

Qayta ulaganda build sozlamalari:

| Maydon | Qiymat |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Version command | `npx wrangler versions upload` |
| Root directory | `/` |
| Production branch | `main` |

Endi bu **zaxira yo'l**: asosiy deploy GitHub Actions orqali boradi.

## Nosozlikni qanday ajratish

| Belgi | Qayerga qarash |
|---|---|
| Sahifa ochiladi, CSS/JS uchun 404 yoki 500 | Worker eski build'da qolgan |
| "Topilmadi." / `not_found` | `/api/*` boshqa Worker'ga ketyapti — Route'larni tekshiring |
| Rasm ko'rinmaydi | `/uploads/*` va R2 bog'lanishi |
| Ilovada kirish ishlamaydi | `/api/auth/*` |

Brauzerda eski fayl qolib ketishi ham mumkin: `index.html` service
worker keshida tursa, u endi mavjud bo'lmagan `assets/*.css` ni
so'raydi. Shuning uchun ikonka yoki qobiq o'zgarganda `public/sw.js`
dagi `VERSION` va `index.html` dagi `?v=` BIRGA oshiriladi.
