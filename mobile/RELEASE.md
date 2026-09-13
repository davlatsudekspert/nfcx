# RELIZ — Android

Bu hujjat **bir marta** bajariladigan sozlashni va **har reliz**
takrorlanadigan qadamlarni ajratadi. Kod tomonidagi hamma narsa
tayyor; quyida faqat kalit va do'kon hisobiga bog'liq qismlar qoldi.

---

## 1. Imzo kaliti — BIR MARTA

Kalitni **siz** yaratasiz va **siz** saqlaysiz. Uni men ham, CI ham
yarata olmaydi: kalit yo'qolsa, Play Store'dagi ilovaga boshqa
hech qachon yangilanish chiqara olmaysiz — faqat yangi ilova
sifatida, nolinchi o'rnatishlar bilan boshlashga to'g'ri keladi.

```bash
keytool -genkey -v \
  -keystore nfcstore-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias nfcstore
```

Savollarga javob berasiz (ism, tashkilot, shahar) va **parol**
qo'yasiz. Shu paroldan keyin:

```bash
base64 -w0 nfcstore-upload.jks > nfcstore-upload.jks.b64
```

GitHub → Settings → Secrets and variables → **Actions** → New
repository secret:

| Secret nomi | Qiymati |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `nfcstore-upload.jks.b64` faylining ICHIDAGI matn |
| `ANDROID_KEYSTORE_PASSWORD` | yuqorida qo'ygan parol |
| `ANDROID_KEY_ALIAS` | `nfcstore` |

**`.jks` faylini uch joyda saqlang** (masalan: kompyuter, tashqi
disk, parol menejeri). Repozitoriyaga **qo'ymang** — `.gitignore`
uni to'sib turadi, lekin ataylab qo'shib yuborish mumkin.

Keyingi qurilishdan boshlab APK/AAB haqiqiy kalit bilan imzolanadi.
Buni CI o'zi **tekshiradi** (`apksigner verify`) va qurilish
xulosasida sertifikat egasi hamda SHA-256 barmoq izi chiqadi.

---

## 2. App Links barmoq izi — BIR MARTA (kalit almashsa — qayta)

Karta tegizilganda brauzer emas, **ilova** ochilishi uchun server
ilovani taniydigan fayl berishi kerak. Barmoq izi qurilish
xulosasida yozilgan (yoki `apk-latest` reliz izohida).

```bash
npx wrangler secret put ANDROID_APP_FINGERPRINTS --name nfcstore-api
# So'ralganda: AA:BB:CC:...  (vergul bilan bir nechta bo'lishi mumkin)
```

Play App Signing yoqilgan bo'lsa Play Console o'z kalitini ham
beradi (**Setup → App integrity**) — u holda **ikkalasi** yoziladi,
vergul bilan: yuklash kaliti va Play kaliti.

Tekshirish: Actions → **App Links tekshiruvi** → Run workflow. U
serverdagi faylni oxirgi APK bilan solishtiradi va mos kelmasa
aniq aytadi. Haftada bir marta o'zi ham ishlaydi.

> Sozlanmaguncha hech narsa buzilmaydi: havola avvalgidek brauzerda
> ochiladi.

---

## 3. Versiya — o'zi ishlaydi

| Nima | Qayerdan | Qoida |
|---|---|---|
| `versionName` (odam ko'radi) | `pubspec.yaml` dagi `version:` | **Siz** qo'yasiz: `1.0.0` → `1.1.0` |
| `versionCode` (do'kon ko'radi) | CI ning qurilish raqami | Avtomatik, hech qachon kamaymaydi |

`pubspec.yaml` dagi `+1` ni qo'lda oshirish **shart emas** —
qurilishda u baribir CI raqamiga almashtiriladi. Bu ataylab:
qo'lda oshirish unutiladi, Play Store esa bir xil `versionCode`
li ikkinchi faylni qabul qilmaydi.

Yangi funksiya chiqarsangiz `pubspec.yaml` dagi `version: 1.0.0+1`
ni `1.1.0+1` qiling — faqat birinchi qismi muhim.

---

## 4. Har reliz — qadamlar

1. Kod `main` ga ketadi → CI o'zi quradi (`flutter analyze`,
   `flutter test`, so'ng APK + AAB).
2. Qurilish xulosasida tekshiring: imzo **haqiqiy kalit** deb
   yozilganmi, ruxsatlar ro'yxatida kutilmagan narsa bormi.
3. Fayllar: <https://github.com/davlatsudekspert/nfcx/releases/tag/apk-latest>
   - `app-release.apk` — telefonga to'g'ridan-to'g'ri o'rnatish
     (sayt, Telegram, sinov).
   - `app-arm64-v8a-release.apk` — kichikroq, zamonaviy telefonlar.
   - `app-release.aab` — **faqat Play Console'ga yuklash uchun**.
     Telefonga o'rnatilmaydi.
4. Play Console → Production → Create new release → `.aab` ni
   yuklang.

---

## 5. Play Console — birinchi marta uchun ro'yxat

Bular kodga bog'liq emas, lekin ularsiz ilova chiqmaydi:

- [ ] Dasturchi hisobi (bir martalik to'lov)
- [ ] Ilova nomi, qisqa va to'liq tavsif (UZ/RU/EN — matnlar
      ilovadagi tarjimalardan olinadi)
- [ ] Belgi 512×512, muqova 1024×500
- [ ] Kamida 2 ta ekran surati (telefon)
- [ ] **Maxfiylik siyosati havolasi** — `https://nfcstore.uz/maxfiylik`
- [ ] Data safety anketasi. Ilova yig'adigan ma'lumot: hisob
      (email/telefon), foydalanuvchi yuklagan rasmlar, to'lov
      buyurtmalari tarixi. Ma'lumot uchinchi tomonga sotilmaydi.
- [ ] Content rating anketasi
- [ ] Maqsadli mamlakat: O'zbekiston

---

## 6. Nima qilmang

- **`.jks` yoki `key.properties` ni commit qilmang.** Kalit ochiq
  bo'lsa, istalgan odam sizning nomingizdan ilova imzolay oladi.
- **`applicationId` (`uz.nfcstore.app`) ni o'zgartirmang.** Play
  Store uni boshqa ilova deb hisoblaydi va yangilanish
  o'rnatilmaydi.
- **`versionCode` ni kamaytirmang.** Do'kon rad etadi.
- **Debug kaliti bilan imzolangan APK ni Play Store'ga
  yubormang** — rad etiladi.
