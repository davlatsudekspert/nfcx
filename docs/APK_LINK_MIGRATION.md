# APK havolasi migratsiyasi

Branch: apk-link-migration. Boshlang‘ich commit: 1a59b7bb.
Haqiqiy yangi APK manzili berilmagan: so‘rovdagi [APK_HAVOLASI] placeholder.

## Dastlabki topilmalar

| Fayl | Qator | Topilma |
|---|---:|---|
| `src/lib/appDownload.js` | 11 | eski release havolasi |
| `mobile/RELEASE-READINESS.md` | 42 | APK fayl/bild eslatmasi |
| `mobile/RELEASE-READINESS.md` | 43 | APK fayl/bild eslatmasi |
| `mobile/RELEASE-READINESS.md` | 44 | APK fayl/bild eslatmasi |
| `mobile/RELEASE.md` | 96 | eski release havolasi |
| `mobile/RELEASE.md` | 97 | APK fayl/bild eslatmasi |
| `mobile/RELEASE.md` | 99 | APK fayl/bild eslatmasi |
| `mobile/README.md` | 18 | APK fayl/bild eslatmasi |
| `.github/workflows/applinks-check.yml` | 59 | APK fayl/bild eslatmasi |
| `.github/workflows/applinks-check.yml` | 70 | APK fayl/bild eslatmasi |
| `.github/workflows/applinks-check.yml` | 80 | APK fayl/bild eslatmasi |
| `.github/workflows/android-apk.yml` | 189 | APK fayl/bild eslatmasi |
| `.github/workflows/android-apk.yml` | 234 | APK fayl/bild eslatmasi |
| `.github/workflows/android-apk.yml` | 258 | APK fayl/bild eslatmasi |
| `.github/workflows/android-apk.yml` | 264 | APK fayl/bild eslatmasi |
| `.github/workflows/android-apk.yml` | 315 | APK fayl/bild eslatmasi |
| `.github/workflows/android-apk.yml` | 316 | APK fayl/bild eslatmasi |
| `.github/workflows/android-apk.yml` | 345 | APK fayl/bild eslatmasi |
| `.github/workflows/android-apk.yml` | 348 | APK fayl/bild eslatmasi |

Ko‘rsatilgan kataloglarda nfcx repoga bog‘langan githubusercontent havolasi topilmadi.
README eskirgan bo‘lishi mumkin; quyidagi xulosalar haqiqiy kodga asoslangan.

## O‘zgarishlar

- src/lib/appDownload.js: eski GitHub APK havolasi /app bilan almashtirildi. Play tugmasi uchun ham shu doimiy manzil ishlatiladi.
- hosting/worker.js: GET/HEAD /app va /app/ uchun 302, no-store. Maqsad bitta sozlamadan: APP_DOWNLOAD_URL. Manzil yo‘q yoki noto‘g‘ri bo‘lsa 503; soxta havolaga yubormaydi.
- src/components/AppDownloadCard.jsx: profil yuklab olish tugmasi /app ni oddiy havola sifatida ochadi.
- src/components/AppWelcomeModal.jsx: ro‘yxatdan o‘tgandan keyingi yuklab olish tugmasi /app ni ochadi.
- src/pages/StickersPage.jsx: yuklab olish tugmasi /app ni ochadi.
- src/pages/AppDownloadPage.jsx: mavjud APP_APK_URL orqali /app ga o‘tadi (markaziy almashtirish, sahifa kodi o‘zgarmadi).
- src/pages/NfcStickerHelpPage.jsx: mavjud APP_APK_URL orqali /app ga o‘tadi (markaziy almashtirish, sahifa kodi o‘zgarmadi).
- mobile/RELEASE.md: ommaviy yuklash havolasi https://nfcstore.uz/app.
- Ilova haqida axborot beruvchi /ilova-yuklash sahifasi saqlanadi; uning yuklash tugmasi /app ga o‘tadi.
- CI artefakt nomlari va release yaratish workflow’lari o‘zgartirilmadi.

## GitHub runtime bog‘liqligi

mobile/ va hosting/ ichida GitHub API/Releases orqali yangilanish tekshiruvi topilmadi.
mobile/lib/app_version.dart:7–24: versiya build vaqtida APP_VERSION orqali olinadi.
mobile/lib/data/api_client.dart:101: API domeni https://nfcstore.uz.
.github/workflows/android-apk.yml va applinks-check.yml GitHub Releases bilan CI vaqtida ishlaydi; ular ilovaning runtime yangilash mexanizmi emas.
Kelajakdagi tekshiruv kerak bo‘lsa: o‘z domenida /api/app/version (versiya, build, /app havolasi).

## Yakunlash uchun

1. Haqiqiy yangi, ommaga ochiq HTTPS APK manzilini olish.
2. Cloudflare Worker Settings → Variables’da APP_DOWNLOAD_URL ni shu manzilga sozlash (maxfiy kalit emas).
3. Deploydan keyin /app 302 Location va Cache-Control: no-store ni, profil/stiker/qo‘llanma tugmalarini tekshirish.
4. Play Market ochilgach faqat APP_DOWNLOAD_URL ni Play sahifasiga almashtirish.

Push/deploy bajarilmadi. D1 sxemasi o‘zgarmadi.
