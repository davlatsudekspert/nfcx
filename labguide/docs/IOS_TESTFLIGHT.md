# iOS: Mac'siz build va TestFlight

Hammasi GitHub Actions'da (`.github/workflows/build.yml`). Repo public bo‘lgani uchun
standart runnerlar (macOS ham) bepul.

## 1. Imzosiz tekshiruv (secret kerak emas)

`main` ga har push avtomatik ishga tushadi: Linux’da `flutter analyze` + testlar, Android
sinov APK’lari (artefakt sifatida yuklab olinadi) va macOS’da imzosiz iOS release build.
Qo‘lda: **Actions → LabGuide build → Run workflow → mode: build**.

## 2. TestFlight uchun bir martalik sozlash

### Secretlar
Repo **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Nima |
|---|---|
| `IOS_CERTIFICATE_BASE64` | Apple Distribution sertifikati (.p12) — base64 ko‘rinishida |
| `IOS_CERTIFICATE_PASSWORD` | .p12 paroli |
| `APPSTORE_KEY_ID` | App Store Connect API kaliti ID si |
| `APPSTORE_ISSUER_ID` | App Store Connect Issuer ID |
| `APPSTORE_PRIVATE_KEY` | API kaliti (.p8) matni |

NFCSTORE uchun ishlatilgan qiymatlarning o‘zi bo‘ladi (bir Apple jamoasi). GitHub secretni
qayta o‘qib bo‘lmaydi — asl fayllardan qo‘yiladi. .p8 yo‘qolgan bo‘lsa: App Store Connect →
Users and Access → Integrations → App Store Connect API → yangi kalit (Admin yoki App Manager).

macOS/Linux’da base64: `base64 -i distribution.p12 | pbcopy` (Linux: `base64 -w0 distribution.p12`).

### Bundle ID va profil
**Run workflow → mode: testflight, apple_setup: ✓**. Workflow `uz.labguide.app` bundle ID ni
ro‘yxatdan o‘tkazadi va “LabGuide AppStore CI” profilini yaratadi. Ilova yozuvi hali yo‘q
bo‘lsa, shu yerda aniq xabar bilan to‘xtaydi — bu kutilgan.

### Ilova yozuvi (faqat qo‘lda — API buni qila olmaydi)
App Store Connect → **Apps → + → New App**: platforma iOS, nomi **LabGuide**, asosiy til,
Bundle ID **uz.labguide.app**, SKU (masalan `labguide-ios`).

## 3. TestFlight’ga yuklash

**Run workflow → mode: testflight** (apple_setup endi shart emas). Workflow imzolangan IPA
yasaydi, tekshiradi (bundle ID, versiya, SDK, entitlements), `altool` bilan TestFlight’ga
yuklaydi va processing holatini kutadi. App Store review’ga **yuborilmaydi**, reliz
**qilinmaydi** — bu qo‘lda, ataylab qilinadi.

Build raqami App Store Connect’dagi oxirgisidan bittaga katta bo‘ladi (avtomatik).
