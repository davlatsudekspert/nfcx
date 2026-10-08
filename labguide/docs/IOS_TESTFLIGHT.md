# iOS: Mac'siz build va TestFlight (GitHub Actions, nfcx)

Workflow: nfcx ildizidagi `.github/workflows/labguide-ios.yml` (“LabGuide iOS”). Faqat
`labguide/` ilovasiga tegadi — NFCSTORE workflow’lariga ta’sir qilmaydi.

**Holat (2026-10-08, kechqurun):** GitHub Actions ishlayapti.
- Run #2 (mode: build): testlar, Android sinov APK va imzosiz iOS release build — **o‘tdi**.
- Run #3 (mode: testflight, apple_setup): mavjud NOVA_* secretlari bilan sertifikat va API kalit
  o‘qildi (Team 5Z9CT2W378), bundle ID / App Store profili bosqichi o‘tdi. **To‘xtagan joy:**
  App Store Connect’da `uz.labguide.app` uchun ilova yozuvi yo‘q — uni faqat egasi qo‘lda
  yaratadi (pastda, 2-bo‘lim). Yozuv yaratilgach `mode: testflight` qayta ishga tushiriladi.

## 1. Imzosiz tekshiruv (secret kerak emas)

**Actions → LabGuide iOS → Run workflow** — branch `claude/new-session-xqozot`, **mode: build**.
Linux’da `flutter analyze` + testlar, Android sinov APK’lari (artefakt) va macOS’da imzosiz iOS
release build.

## 2. TestFlight uchun bir martalik sozlash

### Secretlar
Yangi secret shart emas: workflow avval `LABGUIDE_*`, bo‘lmasa NFCSTORE’ning mavjud `NOVA_*`
secretlaridan foydalanadi (bir Apple jamoasi): `IOS_CERTIFICATE_BASE64`,
`IOS_CERTIFICATE_PASSWORD`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_PRIVATE_KEY`.
API kalit uchun `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64` (`.p8` fayl base64 yoki
matn) nomlari ham qabul qilinadi (zaxira); `IOS_TEAM_ID` berilsa, sertifikat jamoasi bilan
solishtiriladi. Distribution sertifikati (`*_IOS_CERTIFICATE_*`) baribir kerak — hozir NOVA_*.

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
