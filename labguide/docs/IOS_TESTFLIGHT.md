# iOS: Mac'siz build va TestFlight (GitHub Actions, nfcx)

Workflow: nfcx ildizidagi `.github/workflows/labguide-ios.yml` (“LabGuide iOS”). Faqat
`labguide/` ilovasiga tegadi — NFCSTORE workflow’lariga ta’sir qilmaydi.

**Holat (2026-10-08):** nfcx hisobida GitHub Actions to‘lov sababli to‘xtagan — har qanday
ishga tushirish `startup_failure` bilan tugaydi. To‘lov tiklangach quyidagi tartib ishlaydi.
Workflow hali bir marta ham haqiqiy runner’da ishlamagan — birinchi ishga tushirishda xato
chiqsa, log bo‘yicha tuzatiladi.

## 1. Imzosiz tekshiruv (secret kerak emas)

**Actions → LabGuide iOS → Run workflow** — branch `claude/new-session-xqozot`, **mode: build**.
Linux’da `flutter analyze` + testlar, Android sinov APK’lari (artefakt) va macOS’da imzosiz iOS
release build.

## 2. TestFlight uchun bir martalik sozlash

### Secretlar
Yangi secret shart emas: workflow avval `LABGUIDE_*`, bo‘lmasa NFCSTORE’ning mavjud `NOVA_*`
secretlaridan foydalanadi (bir Apple jamoasi): `IOS_CERTIFICATE_BASE64`,
`IOS_CERTIFICATE_PASSWORD`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_PRIVATE_KEY`.

### Bundle ID va profil
**Run workflow → mode: testflight, apple_setup: ✓**. Workflow App Store Connect API orqali
`uz.labguide.app` bundle ID ni ro‘yxatdan o‘tkazadi va “LabGuide AppStore CI” profilini
yaratadi. Ilova yozuvi hali yo‘q bo‘lsa, shu yerda aniq xabar bilan to‘xtaydi — bu kutilgan.

### Ilova yozuvi (faqat qo‘lda — API buni qila olmaydi)
App Store Connect → **Apps → + → New App**: platforma iOS, nomi **LabGuide** (band bo‘lsa,
masalan “LabGuide UZ” — qurilmadagi nom baribir LabGuide), asosiy til, Bundle ID
**uz.labguide.app**, SKU (masalan `labguide-ios`).

## 3. TestFlight’ga yuklash

**Run workflow → mode: testflight**. Imzolangan IPA yasaladi, tekshiriladi (bundle ID,
versiya, SDK, entitlements), `altool` bilan TestFlight’ga yuklanadi va processing holati
kutiladi. Build raqami App Store Connect’dagi oxirgisidan bittaga katta (avtomatik).
App Store review’ga **yuborilmaydi**, reliz **qilinmaydi**.
