# NFCSTORE — Cloudflare D1 migratsiya paketi

Bu paket Railway PostgreSQL backupi va amaldagi Sites D1 ma'lumotlarini bitta Cloudflare D1 bazasiga ko'chirish uchun tayyorlangan.

## Paket tarkibi

- `0001-schema.sql` — D1/SQLite uchun 62 ta jadval, indeks va bog'lanishlar.
- `0002-data.sql` — 744 ta ishlab turgan yozuv. Bu fayl maxfiy: foydalanuvchi va biznes ma'lumotlarini saqlaydi.
- `validation-report.json` — jadval sonlari va tekshiruv natijalari.
- `nfcstore-d1-validation.sqlite3` — mahalliy sinov bazasi; D1'ga bevosita import qilinmaydi.
- `import-d1.cmd` — Windows orqali ikki SQL faylni tartib bilan import qilish yordamchisi.

## Import

Cloudflare hisobiga kirilgan Wrangler muhiti kerak. D1 bazasi yaratilgach, shu papkada CMD ochib:

```cmd
import-d1.cmd D1_BAZA_NOMI
```

Yoki qo'lda:

```cmd
npx wrangler d1 execute D1_BAZA_NOMI --remote --file=0001-schema.sql
npx wrangler d1 execute D1_BAZA_NOMI --remote --file=0002-data.sql
```

Importdan keyin:

```cmd
npx wrangler d1 execute D1_BAZA_NOMI --remote --command="PRAGMA foreign_key_check;"
npx wrangler d1 execute D1_BAZA_NOMI --remote --command="SELECT COUNT(*) AS profiles FROM cards;"
```

`PRAGMA foreign_key_check` natijasi bo'sh bo'lishi, `cards` soni esa `31` chiqishi kerak.

## Muhim

- Railway hozircha o'chirilmasin.
- D1 faqat tuzilmali ma'lumotlarni saqlaydi. `nfcstore-uploads.zip` ichidagi rasm, video va audio fayllar Cloudflare R2'ga alohida ko'chiriladi.
- Eski `/uploads/...` yo'llari D1 ma'lumotlarida o'zgartirilmagan. Worker/R2 yo'naltirishi qo'yilganda NFC profillardagi eski rasmlar o'z joyida ochiladi.
- Sayt API kodi PostgreSQL `pg` so'rovlaridan D1 binding so'rovlariga o'tkazilmaguncha Railway backendini uzmang.
