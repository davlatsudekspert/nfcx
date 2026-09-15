# PLAY STORE — BIRINCHI CHIQARISH VA YANGILASH

Bu hujjat bitta savolga javob beradi: **ilova Play Store'ga
qo'yilgandan keyin uni qanday yangilaymiz.** Qisqa javob: `.aab`
faylini qayta qurib, Play Console'ga yuklaysiz — **versiya raqami
o'zi katta bo'ladi**, foydalanuvchining telefoni yangilanishni o'zi
oladi. Pastda tafsilotlar va bitta MUHIM tuzoq bor (havolalar).

---

## 0. Hozirgi holat

| Narsa | Qiymat | Qayerda |
|---|---|---|
| Paket nomi (`applicationId`) | `uz.nfcstore.app` | `mobile/android/app/build.gradle.kts` |
| Ko'rinadigan versiya (`versionName`) | `1.0.0` | `mobile/pubspec.yaml` → `version:` |
| Ichki raqam (`versionCode`) | CI ning `run_number` i | `.github/workflows/android-apk.yml` |
| Imzo kaliti | GitHub secret'da | `ANDROID_KEYSTORE_BASE64`, `..._PASSWORD`, `ANDROID_KEY_ALIAS` |
| `.aab` (Play uchun) | har qurilishda tayyor | Actions → "Android APK" → artifact `nfcstore-apk` |

**`versionCode` ni qo'lda oshirish SHART EMAS.** U `run_number`
dan keladi va hech qachon kamaymaydi. Play Store bir xil raqamli
ikkinchi faylni qabul qilmaydi — shuning uchun bu avtomatlashtirilgan.

**`versionName` ni esa O'ZINGIZ qo'yasiz** — odam ko'radigan
raqam. Har chiqarishda `mobile/pubspec.yaml` dagi `version:` ni
ma'no bilan o'zgartiring:

```
version: 1.0.0+1   →   1.0.1+1   (kichik tuzatish)
                   →   1.1.0+1   (yangi imkoniyat)
```

`+1` qismiga tegmang: u ishlatilmaydi, CI o'z raqamini beradi.

---

## 1. BIRINCHI MARTA QO'YISH

1. **Play Console hisobi** — https://play.google.com/console
   Bir martalik to'lov **$25**. Shaxsiy hisob bo'lsa hujjat bilan
   shaxsni tasdiqlash so'raladi (bir necha kun ketadi).
2. **Create app** → nomi, tili, "App", "Free".
3. **Production → Create new release → Upload** → `app-release.aab`
   (Actions → "Android APK" → oxirgi qurilish → `nfcstore-apk`
   artifact ichida).
4. **Play App Signing** — Google taklif qiladi, **rozi bo'ling**
   (endi majburiy). Bizning `nfcstore.jks` "upload key" bo'lib
   qoladi, Google esa ilovani O'Z kaliti bilan qayta imzolaydi.
   → Shundan keyin **2-bo'limdagi ishni qilish SHART**.
5. To'ldirish kerak bo'lgan bo'limlar (Play talab qiladi):
   - **Store listing** — nom, qisqa va to'liq tavsif, ikonka
     (512×512), feature grafika (1024×500), kamida 2 ta ekran
     surati.
   - **Data safety** — qanday ma'lumot yig'iladi. Bizda: email,
     ism, profil surati, kontakt ma'lumotlari (foydalanuvchi o'zi
     kiritadi), ko'rishlar statistikasi. "Ma'lumot shifrlangan
     holda uzatiladi: HA".
   - **Content rating** — anketa (ilova ijtimoiy element
     ko'rsatadi: post va istorya).
   - **Privacy policy** — URL kerak. Saytda bor-yo'qligini
     tekshiring, bo'lmasa `nfcstore.uz/privacy` sahifasini qo'ying.
   - **Target audience**, **Ads** (reklama yo'q → "No ads").
6. **Review** — birinchi marta odatda **1–7 kun**.

> Maslahat: avval **Internal testing** trekiga chiqaring (review
> deyarli darhol), o'zingiz o'rnatib ko'ring, keyin Production'ga
> ko'chiring. Bu bitta xato bilan "Production'da yiqilgan reliz"
> holatidan saqlaydi.

---

## 2. MUHIM TUZOQ — NFC HAVOLALARI (App Links)

Kartani telefonga tegizganda `nfcstore.uz/aaa111` **brauzerda emas,
ILOVADA** ochilishi kerak. Buni `assetlinks.json` hal qiladi va u
**sertifikat barmoq iziga** bog'langan.

Play App Signing yoqilganda ilova **boshqa kalit** bilan qayta
imzolanadi — ya'ni bizning barmoq izimiz endi yetarli emas.
Qilinmasa: **havolalar jimgina ishlamay qoladi**, hech qanday xato
ko'rinmaydi, faqat brauzer ochilaveradi.

Nima qilish kerak (Play'ga birinchi yuklagandan keyin):

1. Play Console → **Release → Setup → App signing**.
2. **"App signing key certificate"** dagi `SHA-256 certificate
   fingerprint` ni nusxalang.
3. Uni Cloudflare secret'iga qo'shing — eskisini O'CHIRMANG,
   **vergul bilan ikkalasini** yozing (upload key ham kerak,
   Internal testing va to'g'ridan-to'g'ri o'rnatilgan APK uchun):

```bash
npx wrangler secret put ANDROID_APP_FINGERPRINTS --name nfcstore-uz
# so'ralganda:
# AA:BB:... (Play'niki),CC:DD:... (bizniki, Actions summary'da)
```

4. Tekshirish: Actions → **"App Links tekshiruvi"** → Run workflow.
   U serverdagi fayl bilan APK imzosini solishtiradi.

---

## 3. YANGILASH — HAR SAFAR SHU 4 QADAM

1. **Kodni tayyorlang** va `mobile/pubspec.yaml` dagi `version:`
   ni oshiring (masalan `1.0.0` → `1.0.1`).
2. **Qurish**: GitHub → Actions → **"Android APK"** → *Run
   workflow* (yoki `main` ga qo'shilsa o'zi quriladi).
   Qurilish testlardan o'tmasa — fayl umuman chiqmaydi. Bu
   ataylab: buzuq versiya do'konga chiqib ketmasin.
3. **Yuborish** — ikki yo'ldan biri:
   - **Avtomatik:** Actions → **"Play Store'ga yuborish"** → trekni
     tanlang (`internal` yoki `production`) → Run workflow.
     (Buning uchun `PLAY_SERVICE_ACCOUNT_JSON` secret'i kerak —
     4-bo'limga qarang. Sozlanmagan bo'lsa workflow o'zi
     to'xtaydi va nima qilish kerakligini aytadi.)
   - **Qo'lda:** artifact'dagi `app-release.aab` ni Play Console →
     *Production → Create new release → Upload* ga tashlaysiz.
4. **Rollout** — "Staged rollout" bilan avval 10–20% ga chiqaring.
   Crash ko'rinmasa 100% ga ko'taring. Play Console → *Release →
   Production → "Update rollout"*.

Review odatda **bir necha soat**. Tasdiqlangach foydalanuvchilar
yangilanishni o'zi oladi (Play Store sozlamasiga qarab avtomatik
yoki "Update" tugmasi bilan).

**Nimaga tegmaslik kerak:**
- `applicationId` (`uz.nfcstore.app`) — **hech qachon**. O'zgarsa
  bu Play uchun butunlay BOSHQA ilova bo'ladi va eski
  foydalanuvchilar yangilanish olmaydi.
- Imzo kaliti (`nfcstore.jks`). Yo'qolsa Play App Signing bilan
  upload key'ni tiklash mumkin, lekin bu alohida murojaat va vaqt.
  Kalit va parolining zaxira nusxasini xavfsiz joyda saqlang —
  GitHub secret "o'qib bo'lmaydigan" joy, undan qaytarib olib
  bo'lmaydi.

---

## 4. AVTOMATIK YUBORISHNI YOQISH (ixtiyoriy, bir martalik)

"Play Store'ga yuborish" workflow'i ishlashi uchun Google'dan
xizmat hisobi kaliti kerak:

1. Play Console → **Setup → API access** → *Create new service
   account* → Google Cloud Console ochiladi.
2. Google Cloud'da: **Service account** yarating → **Keys → Add key
   → JSON** → fayl yuklab olinadi.
3. Play Console → API access → o'sha hisobga **Grant access** →
   ruxsatlar: *Release to production, exclude devices, and use
   Play App Signing* + *Release apps to testing tracks*.
4. GitHub → repo **Settings → Secrets and variables → Actions →
   New repository secret**:
   - nomi: `PLAY_SERVICE_ACCOUNT_JSON`
   - qiymati: yuklab olingan JSON faylning butun matni.

Shundan keyin yangilash: **Actions → "Play Store'ga yuborish" →
Run workflow**. Boshqa hech narsa kerak emas.

> Birinchi `.aab` ni baribir **qo'lda** yuklash kerak: Play API
> hali do'konda bo'lmagan ilovaga yuklay olmaydi.

---

## 5. TEZ JAVOBLAR

**Foydalanuvchi yangilanishni qanday oladi?**
Play Store o'zi beradi — odatda Wi-Fi'da avtomatik. Majburiy
yangilanish (eski versiyani ishlatishga yo'l qo'ymaslik) hozir
YO'Q; kerak bo'lsa alohida qilinadi (server minimal versiyani
aytadi, ilova ekran ko'rsatadi).

**Ilovadagi versiyani qayerdan ko'raman?**
Sozlamalar ekranining pastida. U `--dart-define=APP_VERSION` orqali
qurilishdan keladi, ya'ni har doim haqiqiy raqam.

**APK va AAB farqi?**
`.aab` — faqat Play Store uchun. `.apk` — to'g'ridan-to'g'ri
o'rnatish uchun (sayt, Telegram, sinov). Ikkalasi ham har
qurilishda tayyor bo'ladi.

**iOS-chi?**
Alohida jarayon: Apple Developer Program yiliga $99, App Store
Connect, TestFlight. Flutter kodi bir xil qoladi.
