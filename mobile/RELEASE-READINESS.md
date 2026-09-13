# RELIZGA TAYYORLIK — HISOBOT

**Sana:** 2026-09-13 · **Commit:** `6bdf7f3` · **Qurilish:** `1.0.0+20`

## Xulosa

**Kod tomondan tayyor.** Qolgan to'siqlarning hammasi sizning
hisoblaringizga bog'liq (imzo kaliti, Cloudflare secret, Play
Console) — ularni men bajara olmayman, lekin har biri uchun aniq
buyruq `RELEASE.md` da yozilgan.

| Holat | Nima |
|---|---|
| ✅ | Qurilish quvuri, imzo tekshiruvi, AAB, versiya, testlar |
| ⛔ | Imzo kaliti — **siz** yaratasiz (Play Store'ga chiqish shu yerda to'xtagan) |
| ⛔ | `ANDROID_APP_FINGERPRINTS` — kalitdan keyin (App Links shusiz ishlamaydi) |
| ⛔ | `PAYME_KEY` almashtirilishi kerak — kalit ilgari suhbatga qo'yilgan |
| ⚠️ | Quyidagi «Ataylab qoldirilgan» bo'limiga qarang |

---

## 1. Imzo (release signing)

| Tekshirildi | Natija |
|---|---|
| Gradle kalitni o'qiydimi | ✅ `key.properties` bo'lsa — release, bo'lmasa debug |
| Kalit repozitoriyada yo'qmi | ✅ `.gitignore` da; git tarixida ham topilmadi |
| Fayl HAQIQATAN o'sha kalit bilan imzolanganmi | ✅ `apksigner verify` har qurilishda |

Ilgari "`key.properties` bor" degan tekshiruv yetarli deb
hisoblanardi. U yetarli emas: Gradle sozlamasi noto'g'ri bo'lsa
fayl jimgina debug kaliti bilan chiqib ketardi va buni faqat Play
Store rad etganda bilardik. Endi tayyor fayl ochib ko'riladi.

**Hozirgi holat:** debug kaliti (`RELEASE_KEY: 0`), chunki
secret'lar hali qo'yilmagan. Bu kutilgan.

## 2. Quvur (APK / AAB)

| Fayl | Hajmi | Kimga |
|---|---|---|
| `app-arm64-v8a-release.apk` | 25.6 MB | zamonaviy telefonlar |
| `app-armeabi-v7a-release.apk` | 23.2 MB | eski 32-bit |
| `app-release.apk` | 62.5 MB | universal (hamma ABI) |
| `app-release.aab` | 60.1 MB | **Play Store** — foydalanuvchi ~25 MB yuklaydi |

AAB **yangi qo'shildi**: Play Store 2021-yildan beri yangi
ilovadan faqat shuni oladi. Ilgari quvurda u umuman yo'q edi va
bu reliz kuni ma'lum bo'lardi.

## 3. App Links

| Tekshirildi | Natija |
|---|---|
| Manifest hostlari | `nfcstore.uz`, `www.nfcstore.uz` |
| Server tomoni | Worker `assetlinks.json` ni `ANDROID_APP_FINGERPRINTS` dan beradi |
| Sozlanmagan holat | 404 — havola brauzerda ochiladi, hech narsa buzilmaydi |
| Mosligini kim tekshiradi | Yangi workflow: «App Links tekshiruvi» |

**Shu audit BLOKER topdi.** Batafsil quyida.

> Eslatma: `www` uchun `assetlinks.json` **yo'naltirish orqali
> emas**, o'sha hostning o'zida 200 bo'lib berilishi kerak —
> Android yo'naltirishga ergashmaydi. Workflow buni tekshiradi.

## 4. Versiya

| Nima | Qayerdan |
|---|---|
| `versionName` = `1.0.0` | `pubspec.yaml` — siz qo'yasiz |
| `versionCode` = `20` | CI qurilish raqami — avtomatik, kamaymaydi |

Ilgari ikkalasi ham `pubspec.yaml` dan olinardi va `+1` bo'lib
qotib qolgan edi: ikkinchi faylni Play Store qabul qilmasdi.

## 5. Xavfsizlik

| Tekshirildi | Natija |
|---|---|
| Repozitoriyada kalit/token | ✅ Yo'q (ishchi daraxt ham, git tarixi ham) |
| Server manzili | ✅ Faqat `https://nfcstore.uz`, bitta joyda |
| Sessiya | ✅ `Authorization: Bearer`, Keystore'da shifrlangan |
| Log'da maxfiy ma'lumot | ✅ Ilovada `print`/`debugPrint` umuman yo'q |
| Ochiq HTTP | ✅ Yo'q; Android targetSdk bo'yicha baribir bloklangan |
| Zaxira nusxa | ✅ **O'chirildi** — quyida sabab |

`allowBackup` o'chirildi. Sessiya tokeni va PIN Keystore kaliti
bilan shifrlangan, kalit esa telefonni tark etmaydi: bulutga
ko'chirilgan nusxa yangi telefonda ochilmaydi va faqat "nega
kirolmayapman" holatini yaratardi.

## 6. Ruxsatlar

Tayyor APK dan o'qilgan (manifestdan emas — plaginlar o'zinikini
qo'shadi):

```
android.permission.INTERNET          — API so'rovlari
android.permission.NFC               — karta o'qish/yozish
android.permission.USE_BIOMETRIC     — ilova qulfi
android.permission.USE_FINGERPRINT   — ilova qulfi (eski Android)
```

Kamera, joylashuv, kontakt, mikrofon, SMS — **yo'q**. Rasm tizim
tanlagichi orqali keladi, shuning uchun ruxsat kerak emas.

Endi bu har qurilishda tekshiriladi: xavfli ruxsat paydo bo'lsa
qurilish to'xtaydi.

## 7. Unumdorlik

| Tekshirildi | Natija |
|---|---|
| Chegarasiz rasm dekodlash | ✅ Yo'q — hammasida `cacheWidth` |
| Ro'yxatlar | ✅ Uzun ro'yxatlar `builder` bilan, `RepaintBoundary` joyida |
| Aktivlar | 1.9 MB (1.2 MB shrift, 0.7 MB logo) |
| Release bayroqlari | `--release`, debug banner o'chiq, AOT |

Bitta o'lchangan kamchilik qoldi — «Ataylab qoldirilgan» ga
qarang.

## 8. Dud sinovi (smoke)

`test/smoke_test.dart` — **yangi**. Shu paytgacha barcha testlar
ekranlarni ALOHIDA ochardi; ilovaning o'zi (`NfcstoreApp`) hech
qayerda ishga tushirilmagan edi. Holbuki eng ko'p narsa o'sha
qatlamda: sozlamalarni o'qish, qulf, havolalar oqimi, sessiyani
tiklash, to'rt tabli qobiq.

Sinov haqiqiy ildiz widgetni ishga tushiradi, to'rt tabni aylanib
chiqadi va hech qanday istisno chiqmasligini tekshiradi. **U
darhol haqiqiy xato topdi** (quyida).

Telefonda qo'lda tekshirish ro'yxati oxirida.

## 9. Test darvozasi

| Nima | Holat |
|---|---|
| `flutter analyze` | ✅ Toza |
| Testlar | ✅ **182 ta**, hammasi yashil |
| Golden kadrlar | 61 ta |
| CI da tartib | `analyze` → `test` → **keyin** qurilish |
| Golden yiqilsa | Farq rasmlari artifact bo'lib yuklanadi (**yangi**) |
| Bog'liqliklar | `--enforce-lockfile` — bir xil commit, bir xil APK (**yangi**) |

---

## Audit topgan xatolar

### ⛔ BLOKER — App Links ilovani noto'g'ri ochardi

App Links tasdiqlangan zahoti `nfcstore.uz` ning **har qanday**
havolasi ilovaga keladi — saytning o'z sahifalari ham. Ilovadagi
taqiq ro'yxati esa faqat inglizcha nomlardan iborat edi (`api`,
`admin`, `login`…).

Natijada `/narxlar`, `/maxfiylik`, `/savollar`, `/katalog`,
`/aloqa`, `/yangiliklar`, `/tolovlar`, `/reyting`, `/gifts` va
boshqalar profil kodi shabloniga (`^[A-Z0-9]{3,16}$`) tushib,
**ID kodi deb o'qilardi**: odam «Narxlar» havolasini bosib
«profil topilmadi» ekraniga tushardi.

Brauzerda hammasi joyida ishlagani uchun buni faqat telefonda,
imzo kaliti sozlanib App Links tasdiqlangandan **keyin** sezish
mumkin edi — ya'ni reliz kunidan keyin.

**Tuzatildi:** ro'yxat saytning o'z ro'yxatiga (`src/App.jsx` →
`RESERVED`) moslandi. Test har bir bo'limni ikkala registrda
tekshiradi va bo'limga o'xshash haqiqiy kod (`admin1`,
`/id/narxlar`) ochilishini ham qo'riqlaydi.

### Til yarim almashardi

Tarjimalangan ro'yxatlar `static final` bo'lib yozilgan edi. Dart
bunday qiymatni **bir marta** hisoblaydi, `tr()` esa o'sha ondagi
tilni oladi. Rus tiliga o'tilganda o'zbekcha qolardi:

- pastki panel (Home / Discover / Profile) — ilovaning eng ko'p
  ko'rinadigan joyi;
- Discover filtrlari, buyurtma tablari, biznes turkumlari,
  premium imkoniyatlari.

**Tuzatildi:** getter/funksiyaga o'tkazildi, mantiq o'zgarmadi.
Dud sinovi buni ushlaydi.

### Auditning o'z ko'rligi

Dud sinovi avval "maket toshib ketdi" deb ogohlantirdi. Tekshirib
ko'rilganda **telefonda bunday xato yo'q** edi: shrift
yuklanmagan test "Ahem" shrifti bilan chizadi va o'lchamlar
boshqacha bo'ladi. Sinov haqiqiy shrift va telefon o'lchamiga
o'tkazildi — aks holda u yolg'on ogohlantirish berib turardi.

---

## Ataylab qoldirilgan (sabab bilan)

**1. Logotip 1024×1024 (726 KB).** Ekranda 46–104pt ko'rinadi,
ya'ni to'liq dekodlash ~4 MB xotira oladi — ilovaning birinchi
kadrida. `ResizeImage` bilan chegaralab ko'rildi: **logo umuman
chizilmay qoldi**, shuning uchun qaytarildi. Xarajat bitta
qisqa muddatli ajratma, kadr tushishi kuzatilmadi.
*Tavsiya:* manba PNG ni 384×384 ga kichraytirish — kod
o'zgarmaydi, xatar yo'q, APK ~0.6 MB kichrayadi.

**2. `flutter_secure_storage` eski rejimda.** v9 da
`encryptedSharedPreferences: true` yoqilmagan; qiymatlar baribir
Keystore kaliti bilan shifrlangan. Yoqish saqlangan
ma'lumotni ko'chirishni talab qiladi — relizdan oldin sessiya
qatlamiga tegish foydadan ko'ra xatarli.

**3. `flutter analyze --no-fatal-infos`.** Xato va ogohlantirish
qurilishni to'xtatadi, "info" darajasi esa yo'q. Qat'iyroq
qilsak, Flutter yangilanishi relizni kutilmaganda bloklardi.

**4. Worker uchun test darvozasi yo'q.** Loyihada JS testlari
umuman yo'q; ularni shu bosqichda o'ylab topish reliz ishi emas.

---

## Sizdan kutilayotgan ish

1. **Imzo kaliti** — `RELEASE.md` §1. Bu Play Store'ga chiqishni
   to'sib turgan yagona narsa.
2. **`ANDROID_APP_FINGERPRINTS`** — §2, kalitdan keyin. So'ng
   Actions → «App Links tekshiruvi» ni bir marta qo'lda ishga
   tushiring.
3. **`PAYME_KEY` ni almashtiring.** Kalit ilgari suhbatga
   qo'yilgan, ya'ni uni ishlatilgan deb hisoblash kerak.
4. **Play Console** — §5 dagi ro'yxat.

## Telefonda qo'lda tekshirish

Kod testlari qurilma xulqini tekshira olmaydi:

- [ ] Kartani tegizish — ilova ochiladimi (App Links sozlangandan keyin)
- [ ] Bo'sh kartaga yozish
- [ ] Barmoq izi bilan qulfni ochish
- [ ] Rasm yuklash (galereya va kamera)
- [ ] To'lov sahifasi tashqi ilovada ochiladimi
- [ ] Telefon/Telegram tugmalari
- [ ] Internetni o'chirib ilovani ochish — offline holat
- [ ] Mavzuni va tilni almashtirish
