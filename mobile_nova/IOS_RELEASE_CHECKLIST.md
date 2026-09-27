# iOS relizi — nima tayyor, nima yo'q

**Holat (2026-09-27): ilova iOS'da QURILADI va iPhone
simulyatorida OCHILADI.** Haqiqiy iPhone'da hali sinalmagan —
buning uchun Apple Developer hisobi va TestFlight kerak.

Mac yo'q — hamma narsa GitHub'ning macOS runner'ida:
`.github/workflows/nova-ios.yml`.

---

## 1. Tayyor va CI'da tekshiriladigan

| Narsa | Holat | Qayerda |
|---|---|---|
| Imzosiz release build (`flutter build ios --release --no-codesign`) | ✅ | `nova-ios.yml` → `build` |
| iPhone 16 Pro Max simulyatorida ochilish, 35 soniya yiqilmaslik | ✅ | `nova-ios.yml` → `simulator`, suratlar artefaktda |
| Ilova nomi `NFCSTORE` | ✅ | `Info.plist` `CFBundleDisplayName` |
| NFC matni | ✅ | `NFCReaderUsageDescription` |
| Kamera / galereya / mikrofon / galereyaga saqlash matnlari | ✅ | `Info.plist` — bo'lmasa iOS ilovani yopadi |
| NFC entitlement — **faqat `TAG`** | ✅ | `ios/Runner/Runner.entitlements` |
| Entitlement loyihaga ulangan | ✅ | `CODE_SIGN_ENTITLEMENTS` — Debug/Release/Profile |
| Faqat iPhone (`TARGETED_DEVICE_FAMILY = 1`) | ✅ | iPad'da NFC yo'q |
| Faqat vertikal (iPhone) | ✅ | `UISupportedInterfaceOrientations` |
| Shifrlash e'lon qilingan (`ITSAppUsesNonExemptEncryption = false`) | ✅ | faqat HTTPS |

CI qo'riqchisi (`Info.plist qo'riqchisi` qadami) yuqoridagilardan
biri yo'qolsa build'ni QIZIL qiladi.

### Nima uchun `TAG`, `NDEF` emas

`nfc_manager` iOS'da faqat `NFCTagReaderSession` ishlatadi — u
`TAG` formatini talab qiladi. `NDEF` qiymatini esa Apple
taqiqlagan: yuklashda **ITMS-90778 "NDEF is disallowed"**. Fayl
avval faqat `NDEF` bilan turgan edi — TestFlight'ga yuklab
bo'lmasdi va telefonda NFC umuman ishlamasdi.

### Nima uchun faqat iPhone

- iPad'da NFC o'qigich yo'q — ilovaning asosiy vazifasi ishlamaydi;
- iPad yoqilsa App Store 13" iPad suratlarini ham talab qiladi va
  tekshiruvchi iPad'da ham sinaydi — iPad uchun dizayn qilinmagan.

iPad'da ilova baribir o'rnatiladi — iPhone ko'rinishida.

---

## 2. Apple hisobi ochilgach

1. **Bundle ID.** Hozir `uz.nfcstore.nfcstoreNova` (Flutter
   yaratgan). Android'da `uz.nfcstore.nova`. App Store Connect'da
   ilova yaratilgach bundle ID **o'zgartirib bo'lmaydi** — egasi
   qarori bilan oldindan hal qilinadi.
2. **API kalit** — App Store Connect → Users and Access →
   Integrations → App Store Connect API → yangi kalit (Admin).
   `.p8` fayl, Key ID va Issuer ID **faqat GitHub Secrets'ga**
   qo'yiladi — chatga, kodga, logga EMAS.
3. **TestFlight job** `nova-ios.yml` ga qo'shiladi: imzo, build
   raqami (`github.run_number`), yuklash.
4. **App Store Connect sozlamalari:** narx — bepul; "Make this app
   available on Mac" — O'CHIRILADI (Mac'da NFC yo'q); maxfiylik
   siyosati `https://nfcstore.uz/privacy`; App Privacy so'rovnomasi.
5. **Tekshiruvchi uchun:** sinov akkaunti (App Store Connect'dagi
   maxsus maydonga egasi o'zi kiritadi) va NFC videosi — telefon
   stikerga tekkiziladi → profil ochiladi.

---

## 3. Haqiqiy iPhone'da sinaladigan (TestFlight)

- [ ] Karta o'qish (`NfcScanScreen`) — tizim oynasi ochiladimi;
- [ ] Kartaga yozish (`NfcWriteScreen`) — ikki bosqichli oqim;
- [ ] Qulflangan kartada aniq sabab chiqadimi;
- [ ] Yozgandan keyin qayta o'qib tasdiqlash ishlaydimi;
- [ ] Kirish / ro'yxatdan o'tish (email kodi keladimi);
- [ ] Post, istoriya, reels — media yuklanadi va o'ynaydi;
- [ ] Video ilova fonga ketganda to'xtaydimi;
- [ ] Ulashish (`share_plus`) tizim oynasini ochadimi;
- [ ] Xavfsiz zona (Dynamic Island) — yuqori va pastki panel.

**Android'dan farqi kodda hisobga olingan:** `NdefFormatable` —
faqat Android. iOS'da formatlanmagan teg `notNdef` sababini beradi —
iOS'da uni formatlash imkoniyati yo'q. Zavoddan keladigan NTAG213
stikerlar odatda allaqachon NDEF formatida bo'ladi.

---

## 4. App Review xavflari

| Xavf | Holat |
|---|---|
| Shikoyat va bloklash (1.2 — foydalanuvchi kontenti) | ✅ bor (`lib/features/social/moderation.dart`) |
| Hisobni ilova ichida o'chirish (5.1.1(v)) | ✅ bor |
| Ilova ichida raqamli xarid yo'q (`canPayInApp` → `false`) | ✅ |
| Pullik NFC ID narxlari va "nfcstore.uz" yozuvi (3.1.1 anti-steering) | ⚠️ Apple Google'dan qattiqroq — egasining qarori kutilmoqda |
| Tekshiruvchida NFC stiker yo'q | ⚠️ review notes'ga video havolasi |

---

## 5. Ataylab QILINMAGAN narsalar

**Universal Links sozlanmadi.** `apple-app-site-association`
faylida App ID (Team ID + bundle ID) bo'lishi kerak — Team ID esa
Apple hisobidan olinadi. Taxmin qilib yozilgan fayl havolalarni
**jimgina** ishlamaydigan qiladi.

**`PrivacyInfo.xcprivacy` qo'shilmadi.** Runner kodi "sababi
talab qilinadigan" API'larni to'g'ridan-to'g'ri chaqirmaydi;
plaginlar o'z manifestlari bilan keladi. Yuklashda ITMS-91053
ogohlantirishi chiqsa — o'shanda qo'shiladi.

**ISO 7816 AID ro'yxati qo'shilmadi**
(`com.apple.developer.nfc.readersession.iso7816.select-identifiers`).
Hozirgi stikerlar NTAG213 (Type 2) — unga kerak emas. NTAG424 DNA
(ROSTAP) boshlanganda qaytiladi.
