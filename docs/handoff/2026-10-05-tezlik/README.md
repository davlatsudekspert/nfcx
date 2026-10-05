# Tezlik ishi — holat (2026-10-05, Toshkent 10:50)

## Bajarildi va jonli

- **Server (main, deploy qilingan):** d8b8687, deb61a1.
  - Bazaga ketma-ket so'rovlar qisqardi: profil 1 marta, postlar 1–2, istoriyalar 1, obunachilar 2.
  - Rasm keshda bo'lmasa, omborga bitta murojaat ketadi.
  - /tezlik sahifasi tez natijada yashil "Tez — muammo yo'q" ko'rsatadi.
- **iOS:** 1.1.0 (317), patch 0030–0031. TestFlight'da, "NFCSTORE Internal" guruhida.
- **Android:** 1.1.0 (297). Play'da ichki va NFCSTORE yopiq trekida.
- **App Store:** 1.1.0 (313) "Waiting for Review" holatida, chiqarish MANUAL.
  - Tasdiqlangach egasi "Release" bosadi.
  - Keyin 317 ni 1.1.1 sifatida yuborish kerak.
- **Egasining o'lchovi (iPhone va kompyuter, Varshava nuqtasi):**
  - Internet: 76–83 ms.
  - Server ↔ baza: 73–77 ms.
  - Hamma so'rov 0.3 s dan tez.

## Qolgan ish (egasi "Ikki yaxshilashni qil" degan)

### 1. Lentani 3 to'lqindan 2 taga tushirish

Faqat kirgan (login qilgan) foydalanuvchi uchun.

- Tayyor patch: `server-feed-2-waves.patch`, worker.js uchun.
- Agent tekshiruvi: main'ga toza qo'llanadi, feed gate'lari D1 va sqld rejimida o'tadi.
- Batafsil: `scout-feed-waves.md`.
- **Hali deploy qilinmagan.** Limit tugayotgan paytda kuzatuvsiz jonli serverga qo'yilmadi.
- Keyingi qadamlar:
  1. Patchni qo'llash.
  2. `run-gates` (83 gate) ni ishlatish.
  3. Push qilish, deploy'dan keyin `x-nfc-timing: 1` bilan o'lchash.

### 2. Postlar to'ri uchun kichik rasmlar (thumbnail)

Tahlil: `scout-thumbnails.md`.

- **(A) Cloudflare Image Transformations** zonada o'chiq (/cdn-cgi/image 404 beradi). Yoqish pullik bo'lishi mumkin. Egasidan so'ralmasdan yoqilmaydi.
- **(D) imgproxy Toshkent serverida** — agent tavsiyasi.
  - Eski postlar ham kichik rasm oladi, ishlov O'zbekistonda qoladi.
  - 8 ta rasmdagi o'lchov: 2111 KB → 318 KB.
  - `setup.sh` ni qayta ishga tushirish **xavfli**: Docker'ni qayta ishga tushiradi va sqld'ni `latest` ga yangilaydi.
  - O'rnatish faqat alohida, tor workflow action orqali va **egasining ruxsati bilan**.
- **(B) Ilova kichik nusxa yuklaydi + GitHub'da eski rasmlarni to'ldirish.** Serverga dastur qo'yilmaydi, lekin 12–15 fayl o'zgaradi.
- **Ilova tomoni tayyor:** `app-thumbnail-grid.patch`, batafsil `scout-app-images.md`.
  - Server `thumbUrl` bersa — to'r shuni ishlatadi.
  - Bermasa yoki xato bo'lsa — asl rasm ishlatiladi.
  - Agent nusxada sinadi: 1257 test o'tdi.
- **Ochiq qaror:** A, B yoki D — egasi tanlaydi.

## Boshqa

- `/api/companies/:id/posts` sovuq holatda 9 to'lqin oladi (ALTER/PRAGMA ketma-ket). Alohida tuzatish kerak.
- Soatlik UZ audit routine'i (trig_019HvaGhLUJrptKbZkSVAqHn) ishlayapti.
  - Oxirgi audit TOZA, toza oraliq 12+ soat.
  - finalize-media sharti hali bajarilmagan (24 soat kerak).
