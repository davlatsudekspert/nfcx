# iOS relizi — nima tayyor, nima yo'q

**Holat: iOS SINALMAGAN.** Bu hujjat "tayyor" demaydi — u
**nimani hali qilib bo'lmasligini** va Mac kelganda **aniq nima
qilish kerakligini** yozib qo'yadi.

Sabab oddiy: iOS ilovasini qurish, imzolash va qurilmada sinash
**faqat macOS + Xcode** bilan bo'ladi. Ular bu muhitda yo'q.
Shuning uchun quyidagi hech bir qator "PASS" deb belgilanmagan.

---

## 1. Kodda nima tayyor

| Narsa | Holat | Izoh |
|---|---|---|
| Flutter kodi platformaga bog'liq emas | ✅ | `dart:io` ning platformaga xos yo'llari yo'q |
| Ilova nomi | ✅ | `CFBundleDisplayName` = `NFCSTORE` |
| NFC matni | ✅ | `NFCReaderUsageDescription` qo'shildi |
| NFC entitlement fayli | ✅ | `ios/Runner/Runner.entitlements`, faqat `NDEF` |
| Kamera / galereya matnlari | ⚠️ | Quyida, 3-bo'limga qarang |

`scripts/test-app-identity.mjs` iOS nomini har bir qurilishda
tekshiradi.

---

## 2. NFC — YETARLI EMAS, Mac kerak

`Info.plist` va `Runner.entitlements` qo'shildi, **lekin ular
o'zlaricha ishlamaydi**. Yana ikkita narsa kerak va ikkalasi ham
Mac talab qiladi:

1. **Xcode'da imkoniyatni yoqish.**
   `Runner` target → *Signing & Capabilities* → **+ Capability** →
   *Near Field Communication Tag Reading*.
   Bu `Runner.entitlements` ni loyihaga ulaydi
   (`CODE_SIGN_ENTITLEMENTS` sozlamasi). Fayl hozir bor, lekin
   `project.pbxproj` ga **ulanmagan** — uni qo'lda tahrirlash
   xavfli va bu yerdan tekshirib bo'lmaydi.

2. **Apple Developer hisobida imkoniyat yoqilgan provisioning
   profil.** Aks holda imzo bosqichida yiqiladi.

Shundan keyin qurilmada sinaladigan narsalar:

- [ ] Karta o'qish (`NfcScanScreen`) — tizim oynasi ochiladimi;
- [ ] Kartaga yozish (`NfcWriteScreen`) — ikki bosqichli oqim;
- [ ] Qulflangan kartada aniq sabab chiqadimi;
- [ ] Yozgandan keyin qayta o'qib tasdiqlash ishlaydimi.

**Android'dan farqi bor va u kodda hisobga olingan:**
`NdefFormatable` — faqat Android. iOS'da formatlanmagan teg
`notNdef` sababini beradi. Bu **to'g'ri xulq**: iOS'da bo'sh,
formatlanmagan tegni formatlash imkoniyati yo'q va uni bor deb
ko'rsatish yolg'on bo'lardi.

---

## 3. Mac kelganda birinchi yuriladigan yo'l

```bash
cd mobile_nova
flutter pub get
flutter build ios --release --no-codesign   # avval imzosiz: kod qurilyaptimi
open ios/Runner.xcworkspace                 # keyin Xcode'da imzo va imkoniyat
```

Xcode'da:

1. *Signing & Capabilities* → jamoa (Team) tanlanadi;
2. **Near Field Communication Tag Reading** qo'shiladi;
3. Bundle ID tekshiriladi — u Android'dagi `uz.nfcstore.nova`
   bilan bir xil bo'lishi SHART EMAS, lekin App Store Connect'da
   ro'yxatdan o'tgan bo'lishi kerak.

Keyin quyidagilar qurilmada sinaladi (hech biri hozir
tekshirilmagan):

- [ ] Ilova ochiladi va bosh sahifa yuklanadi;
- [ ] Kirish / ro'yxatdan o'tish (email kodi keladimi);
- [ ] Post, istorya, reels — media yuklanadi va o'ynaydi;
- [ ] **Video ilova fonga ketganda to'xtaydimi** — Android'da bu
      `WidgetsBindingObserver` bilan hal qilingan, iOS'da xulq
      boshqacha bo'lishi mumkin;
- [ ] Ulashish (`share_plus`) tizim oynasini ochadimi;
- [ ] `nfcstore.uz/KOD` havolasi ilovada ochiladimi
      (Universal Links — bu **alohida sozlash**, Android App
      Links bilan bir xil emas: `apple-app-site-association`
      fayli saytga qo'yilishi kerak);
- [ ] To'lov havolasi tashqi brauzerda ochiladimi;
- [ ] Xavfsiz zona (notch / Dynamic Island) — pastki menyu va
      yuqori panel to'g'ri joylashadimi.

---

## 4. Ataylab QILINMAGAN narsalar

**`project.pbxproj` qo'lda tahrirlanmadi.** Entitlement faylini
loyihaga ulash uchun uni o'zgartirish mumkin edi, lekin:

- natijani bu yerda tekshirib bo'lmaydi (Xcode yo'q);
- buzilgan `pbxproj` butun iOS qurilishini yiqitadi va sababi
  juda tushunarsiz bo'ladi.

Xcode buni bir bosishda, to'g'ri qiladi.

**Universal Links sozlanmadi.** `apple-app-site-association`
faylida App ID (Team ID + bundle ID) bo'lishi kerak — Team ID esa
Apple hisobidan olinadi va u hozir yo'q. Taxmin qilib yozilgan
fayl havolalarni **jimgina** ishlamaydigan qiladi, ya'ni eng
yomon holat.

**`CFBundleVersion` / build raqami avtomatlashtirilmadi.** Android
tomonda bu `nova-apk.yml` da bor; iOS uchun u App Store Connect
oqimiga bog'liq va u hali tanlanmagan.

---

## 5. Qisqa javob

Agar kimdir "iOS tayyormi?" deb so'rasa:

> Kod tayyor, sozlamalar qo'yilgan. Lekin **hech kim iPhone'da
> ochib ko'rmagan** — shuning uchun "ishlaydi" deb aytish
> mumkin emas. Mac kelganda yuqoridagi ro'yxat bo'yicha
> yuriladi va shundan keyin javob beriladi.
