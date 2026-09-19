# API GAPS — backend’da YETISHMAYDIGAN narsalar

Bu ro‘yxat **audit natijasi**, taxmin emas: har bir qator
`server/index.js`, `server/db.js` va `server/auth.js` bo‘yicha
tekshirilgan.

Ilova bu joylarda **soxta muvaffaqiyat ko‘rsatmaydi**. Endpoint javob
bermasa, ekranda aniq holat chiqadi (`AppErrorKind.endpointMissing` →
«Bu imkoniyat serverda hali yoqilmagan»).

---

## 1. BACKEND ENDPOINT REQUIRED — email orqali tasdiqlash

**Eng katta farq. Texnik topshiriq bilan backend bir-biriga mos emas.**

Topshiriq talabi:

> SMS OTP YO‘Q. 6 xonali kod **EMAILGA** yuboriladi.

Backend’dagi haqiqat:

| Endpoint | Nima qiladi |
|---|---|
| `POST /api/auth/login` | email + **parol**. Hech qanday kod yo‘q. |
| `POST /api/auth/request-register-code` | kodni **Telegram boti** orqali **telefonga** yuboradi (`sendTelegramOtp`). |
| `POST /api/auth/register` | telefon Telegram bilan tasdiqlangan bo‘lishini va o‘sha kodni talab qiladi. |

Serverda **umuman email yuborish infratuzilmasi yo‘q** — na
`nodemailer`, na SMTP sozlamasi, na email shabloni.

### Ilova nima qiladi

`AuthRepository` ikkala yo‘lni ham beradi:

* `loginWithPassword`, `register` — **BUGUN ISHLAYDI**, real endpointlar;
* `requestEmailCode`, `verifyEmailCode` — quyidagi shartnoma bo‘yicha
  chaqiriladi. Backend’da yo‘q, shuning uchun UI ochiq holat ko‘rsatadi.

Kirish ekranida ikkala yo‘l ham ko‘rinadi: «Kirish» (parol, ishlaydi) va
«Kod bilan kirish» (email kodi, backend kutilmoqda).

### Kerakli shartnoma

```http
POST /api/auth/request-email-code
{ "email": "user@example.com", "phone": "+998901234567" }
→ 200 { "ok": true }
→ 422 { "error": "bad_email" }
→ 429 { "error": "rate_limited" }

POST /api/auth/verify-email-code
{ "email": "user@example.com", "code": "123456" }
→ 200 { "user": {...} }  + Set-Cookie: nfc_session=<token>
→ 422 { "error": "bad_code" }
→ 410 { "error": "code_expired" }
```

Shuningdek serverga kerak: SMTP/email provayderi, kod jadvali (hozirgi
`phone_otp_codes` ga o‘xshash) va tezlik cheklovi.

---

## 2. BACKEND ENDPOINT REQUIRED — postlarga izohlar

`POST /api/posts/:id/like` bor, lekin **izohlar uchun endpoint yo‘q**.

~~`Post.comments` maydoni SONni beradi, ro'yxatni emas.~~

**HAL QILINDI.** Bu yozuv XATO taxminga asoslangan edi: endpointlar
`/api/posts/:id/comments` deb o'ylangan. Haqiqiy backend boshqa
joyda va allaqachon tayyor: `hosting/api/comments.js`,
`GET/POST /api/comments/:kind/:id`, `DELETE /api/comments/:id`.
Ilova to'liq ulandi — `FINAL_GAPS.md` ga qarang.


## 3. BACKEND ENDPOINT REQUIRED — push bildirishnomalar

Serverda FCM/qurilma ro‘yxati **yo‘q** (`fcm`, `push_token`,
`device_token` bo‘yicha hech nima topilmadi).

Ilovadagi bildirishnomalar **so‘rab olinadi** (pull):
`ActivityRepository.feed()` har bir NFC ID uchun
`/api/records/:code/analytics` ni o‘qib, natijani sana bo‘yicha
birlashtiradi.

Sozlamalardagi bildirishnoma kalitlari **qurilmada** saqlanadi va
ekranda `BACKEND ENDPOINT REQUIRED` yozuvi turadi — ular serverga
yuborilmaydi, chunki yuboradigan joy yo‘q.

Kerak:

```http
POST   /api/me/devices   { "token": "...", "platform": "android" }
DELETE /api/me/devices/:id
GET    /api/activity     → birlashtirilgan lenta
```

Oxirgisi ixtiyoriy, lekin foydali: hozir ilova N ta so‘rov yuboradi.

---

## 4. BACKEND ENDPOINT REQUIRED — hisobni o‘chirish

Foydalanuvchi o‘zi o‘chira oladigan endpoint yo‘q (`adminDeleteUser`
faqat admin panelidan chaqiriladi).

Ilova «o‘chirildi» deb **yolg‘on aytmaydi**: so‘rov
`POST /api/support` orqali `ACCOUNT_DELETE_REQUEST` matni bilan
yuboriladi va foydalanuvchiga murojaat qabul qilingani aytiladi.

Kerak: `DELETE /api/auth/me` (parol yoki kod bilan tasdiqlash).

---

## 5. CONFIG REQUIRED — to‘lov provayderlari

Kod tomonida hammasi tayyor: `/api/pay/payme`, `/api/pay/click/prepare`,
`/api/pay/paynet/webhook` mavjud va ilova ularga ulangan.

Lekin **ishlaydimi — server sozlamasiga bog‘liq**. Ilova buni
`/api/settings/payments-enabled` dan so‘raydi:

* birorta provayder yoqilmagan bo‘lsa → `CONFIG REQUIRED` holati;
* to‘lov havolasi bo‘sh qaytsa → `payment_not_configured` xatosi.

**Hech qanday holatda soxta «to‘lov muvaffaqiyatli» ko‘rsatilmaydi.**

Kerak: Payme merchant ID va kaliti, Click service/merchant ID, Paynet
sozlamalari — server muhit o‘zgaruvchilarida.

---

## 6. PARTIAL — qidiruv

`/api/records/search` bor va odamlar/NFC ID bo‘yicha ishlaydi;
`/api/companies/search` bizneslar uchun ishlaydi.

**Mahsulot va kontent bo‘yicha alohida qidiruv endpointi yo‘q.**
Ilovada «Postlar» yorlig‘i `/api/news` natijasini mijoz tomonida
filtrlaydi — bu kichik hajmda ishlaydi, lekin sahifalash bilan emas.

Kerak: `GET /api/search?q=...&type=posts|products`.

---

## 7. PARTIAL — story ko‘rilganligi

Story’lar `/api/records/:code/gallery` dan keladi, lekin «ko‘rildi»
belgisini saqlaydigan endpoint yo‘q. Shuning uchun halqa rangi har
seansda qayta to‘liq bo‘ladi.

Kerak: `POST /api/records/:code/gallery/:id/seen`.

---

## Ilovada YOQ QILINGAN imkoniyatlar

Bular backend’da **bor**, lekin texnik topshiriq bo‘yicha Nova’ga
ATAYLAB kiritilmadi:

| Backend’da bor | Nova’da |
|---|---|
| `/api/conversations` (ichki yozishmalar) | YO‘Q — topshiriqning 44-bo‘limi |
| `/api/auctions` (auksion) | YO‘Q — topshiriqning 44-bo‘limi |
| SMS/Telegram OTP kirish uchun | Faqat ro‘yxatdan o‘tishda, backend talabi sifatida |

Biznes bilan bog‘lanish yozishma emas, **tashqi kanallar** orqali:
telefon, Telegram, WhatsApp, veb-sayt.
