# LabGuide

Biokimyo va klinik laboratoriya bo‘yicha ma’lumotnoma va o‘quv ilovasi (iOS/Android, Flutter).
Interfeys tillari: o‘zbekcha, ruscha, inglizcha. Rollar: shifokor, laboratoriya mutaxassisi,
talaba, ustoz/tadqiqotchi. Bilim bazasi hamma rol uchun bitta; bosh sahifa va tezkor amallar
rolga qarab o‘zgaradi.

> Bu papka NFCSTORE repozitoriysi ichida joylashgan, lekin undan butunlay alohida loyiha.
> NFCSTORE fayllariga tegilmaydi. Sababi: [docs/DECISIONS.md](docs/DECISIONS.md) (D-01).

## Holat

Joriy bosqich va keyingi qadam: **[docs/PROGRESS.md](docs/PROGRESS.md)**. Yangi sessiya ishni
shu fayldan boshlaydi.

- Reja: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- Qarorlar: [docs/DECISIONS.md](docs/DECISIONS.md)
- Domla materiallarini qabul qilish tartibi: [docs/CONTENT_INTAKE.md](docs/CONTENT_INTAKE.md)
- Dastlabki topshiriq (v5 handoff): [docs/handoff_v5/](docs/handoff_v5/)

## Ishga tushirish

```bash
cd labguide
flutter pub get
flutter run                      # debug: demo OTP adapter (kod ekranda ko‘rsatiladi)
flutter test                     # unit + widget + layout matritsa testlari
flutter analyze
flutter build apk --debug
```

Flutter 3.47.6 (stable), Dart 3.13.5 bilan tekshirilgan.

Release build demo OTP kodini qabul qilmaydi: email xizmati ulanmaguncha email orqali kirish
“hali ulanmagan” deb ko‘rsatiladi, kontent esa mehmon sifatida to‘liq ochiq.

## Tuzilma

```
lib/
  app/            — ilova ildizi, router (5 tab, har biri o‘z stacki), sahifa skeleti
  core/storage/   — kalit-qiymat ombori (sirlar emas)
  design/         — tokenlar, mavzu (light/dark), komponentlar, o‘tishlar
  features/
    auth/         — OTP adapterlari (debug demo / release unconfigured), welcome, rol
    content/      — kontent modeli, paket tekshiruvi (sha256), atomar o‘rnatish, qidiruv
    home/ lab/ library/ learn/ profile/ tools/ — ekranlar va domen mantig‘i
  l10n/           — app_uz/ru/en.arb (interfeys matnlari)
assets/content/core/  — tekshiriladigan kontent paketi (pack.json + manifest.json)
tool/build_content_manifest.dart — pack.json o‘zgarganda manifestni yangilash
docs/content_templates/ — yangi adabiyot/test/farq yozuvlari uchun namuna
```

Klinik kontent UI satrlariga qotirilmagan: hammasi `assets/content/core/pack.json` da,
manba, sahifa, review va tarjima holati bilan. Yangi kitob yoki test savollari ilova kodini
o‘zgartirmasdan paketga qo‘shiladi (qarang: CONTENT_INTAKE.md).
