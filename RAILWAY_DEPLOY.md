# NFCSTORE — Railway deployment

## GitHub repository ko‘rinmasa yoki “not repo” chiqsa

Loyiha Git repository hisoblanadi va quyidagi remote’ga ulangan:

`https://github.com/davlatsudekspert/nfcx.git`

Railway’da repository ko‘rinishi uchun:

1. Railway → **Account Settings → Integrations → GitHub** bo‘limini oching.
2. **Edit Scope** orqali Railway GitHub App’ga `davlatsudekspert/nfcx` repositorysi uchun ruxsat bering.
3. GitHub’da Railway App uchun kutilayotgan permission update bo‘lsa, tasdiqlang.
4. Railway’ga qayting, **Add → GitHub Repository → Refresh** ni bosing.
5. Repository nomi o‘zgargan yoki boshqa account/organization’ga ko‘chirilgan bo‘lsa, eski ulanishni uzib qayta ulang.

## Service sozlamalari

- Root Directory: `/`
- Build Command: `npm run build`
- Start Command: `npm start`
- Healthcheck Path: `/api/health`
- Node.js: `>=18`

`PORT` qiymatini qo‘lda kiritmang — Railway uni avtomatik beradi.

## PostgreSQL

Railway project ichida PostgreSQL service yarating. App service Variables bo‘limida reference variable qo‘shing:

`DATABASE_URL=${{Postgres.DATABASE_URL}}`

Qo‘shimcha xavfsiz production qiymatlari:

- `NODE_ENV=production`
- `PAYMENTS_ENABLED=false`

Admin, Telegram va to‘lov provayderi maxfiy qiymatlarini repositoryga commit qilmang. Ularni faqat Railway Variables bo‘limida saqlang.

## Upload fayllari (avatar, musiqa, yangilik rasmlari)

Railway container fayl tizimi doimiy emas — har deploy’da `server/uploads/`
tozalanadi. Fayllar doimiy saqlanishi uchun **Railway Volume** qo‘shing:

1. Railway’da servisni oching → **Settings → Volumes → New Volume**.
2. Mount path: istalgan yo‘l — masalan `/data` (aynan `/app/server/uploads`
   bo‘lishi shart emas).
3. Saqlang va servisni qayta deploy qiling.

Volume ulanganda Railway `RAILWAY_VOLUME_MOUNT_PATH` env’ini avtomatik
beradi; kod (`server/paths.js`) yuklamalarni o‘sha doimiy diskdagi
`<mount>/uploads` papkasiga yozadi. Server ishga tushganda logда
`Yuklamalar papkasi: … (DOIMIY | VAQTINCHALIK)` ko‘rinadi.

Volume’gacha yuklangan rasmlar tiklanmaydi — ularni qayta yuklash kerak.
Bepul/Trial plan: 0.5 GB, Hobby: 5 GB gacha.
