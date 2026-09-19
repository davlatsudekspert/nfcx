# NFCSTORE Nova — vizual audit paketi

**Maqsad:** ushbu paketni `nfcstore_concept_b_final.html`
(Concept B Final) bilan yonma-yon solishtirish.

Paket **muzlatilgan build** holatiga tegishli:

| | |
|---|---|
| Commit | `8d09964c05dd8ea3603970174a54654c16590810` |
| Branch | `claude/vibrant-einstein-p5lo1i` |
| CI run | [#35430822764](https://github.com/davlatsudekspert/nfcx/actions/runs/35430822764) — 17/17 muvaffaqiyatli |
| Paket | `uz.nfcstore.nova` · `1.0.0 (2)` |

Ushbu paketdan keyin **kodga o'zgarish kiritilmagan**. Suratlar va
kod aynan shu commitdan olingan.

---

## 1. Ekran suratlari — `screens/`

Hammasi Chromium'da, `devicePixelRatio: 2` bilan olingan, keyin 0.72
ga kichraytirilgan.

### Asosiy ekranlar (Midnight Navy + Soft Gold)

| Fayl | Concept B'dagi mos ekran |
|---|---|
| `home-midnight.png` | `home` |
| `nfc-center-midnight.png` | `nfc` |
| `nfc-scan-midnight.png` | `nfcScan` |
| `profile-midnight.png` | `profile` |
| `discover-midnight.png` | `discover` + `search` |
| `business-storefront-list.png` | `biz` |
| `business-dashboard-midnight.png` | `bizDash` |
| `business-catalog-midnight.png` | `bizCatalog` |
| `settings-midnight-uz.png` | `settings` |
| `settings-theme-picker.png` | mavzu tanlash |

### Beshta mavzu

Ikkita asosiy ekran beshala mavzuda — solishtirish uchun eng muhim
to'plam:

* `home-{pearl,graphite,ocean,aurora,midnight}.png`
* `nfc-center-{pearl,graphite,ocean,aurora,midnight}.png`
* `profile-{pearl,graphite,ocean,aurora,midnight}.png`

Mavzu ranglari HTML'dagi `html[data-theme="..."]` bloklaridan
**bir-bir ko'chirilgan** — `code/nfc_tokens.dart` ga qarang.

### Responsivlik — 360 / 390 / 430

Ataylab **rus tilida**: eng uzun yozuvlar shu tilda.

* `responsive-home-{360,390,430}.png`
* `responsive-nfc-{360,390,430}.png`
* `responsive-profile-{360,430}.png`

### Uch til

`settings-midnight-{uz,ru,en}.png`

---

## 2. Kod — `code/`

### Dizayn tokenlari va mavzu

| Fayl | Nima |
|---|---|
| `nfc_tokens.dart` | **Beshala mavzu**, `ThemeExtension`, `lerp` |
| `palette.dart` | `hex()` / `rgba()` — CSS qiymatlarini o'girish |
| `shapes.dart` | Radius shkalasi (`pill`, `blob`, `soft`, `gentle`, `organic`) |
| `motion.dart` | `--ease-*` va `--dur-*` ning Dart ko'rinishi |
| `app_theme.dart` | `ThemeData`, Material komponentlarini moslash |
| `typography.dart` | Serif sarlavha + sans matn + mono raqam, kirill zaxirasi |

### NFC

| Fayl | Nima |
|---|---|
| `nfc_orb.dart` | **Orb**: nafas, halo, 3 ta pulse halqasi, organik yadro, `OrbitActions` |
| `nfc_center_screen.dart` | NFC markazi ekrani |

Orb butunligicha **bitta `CustomPainter`** ichida chiziladi — har
halqa alohida widget bo'lganda 4 ta kontroller va 4 ta layout o'tishi
kerak bo'lardi.

### Home va Profile

| Fayl | Nima |
|---|---|
| `home_screen.dart` | Home kompozitsiyasi |
| `identity_card.dart` | **Identity obyekti** — organik nosimmetrik shakl |
| `mode_switch.dart` | Shaxsiy ↔ Biznes almashtirgich (morph) |
| `avatar.dart` | Story halqasi bilan avatar |
| `profile_screen.dart` | Digital Identity Canvas |

### Umumiy dizayn widgetlari

| Fayl | Nima |
|---|---|
| `brand_logo.dart` | **Logotip qoidalari** — cho'zilmaydi, doira qilinmaydi |
| `surfaces.dart` | `FloatingSurface`, `Capsule`, `PressableScale`, `SectionHeader` |
| `buttons.dart` | `NovaButton`, `NovaIconButton` |
| `backdrop.dart` | Ambient fon — sekin suzuvchi dog'lar |
| `bottom_nav.dart` | Suzuvchi nav, markazda ko'tarilgan NFC tugmasi |
| `states.dart` | Yuklanish / bo'sh / xato / skeleton |
| `fields.dart` | `NovaField`, `CodeField`, `PhoneField` |
| `nova_scaffold.dart` | Har ekranning karkasi |

### Discover va Reels

| Fayl | Nima |
|---|---|
| `discover_screen.dart` | Qidiruv (debounce), yorliqlar, natijalar |
| `reels_screen.dart` | Vertikal lenta, video hayot sikli |

---

## Reels surati nima uchun yo'q

Reels **haqiqiy videoni** backend'dan oladi. Surat oluvchi brauzer
`nfcstore.uz` ga chiqa olmaydi, shuning uchun u yerda faqat bo'sh
holat ko'rinardi — bu maketni baholashga yordam bermaydi.

Buning o'rniga `code/reels_screen.dart` to'liq berilgan. E'tibor
berish kerak bo'lgan joylar:

* `_ReelPageState._open` / `_close` — faqat **ko'rinayotgan** video
  yaratiladi, ko'rinmagani butunlay yo'q qilinadi (pauza EMAS);
* NFC ID kapsulasi — Reels ham identity tizimining bir qismi;
* pastdagi gradient — matn video rangidan qat'i nazar o'qiladi.

---

## Solishtirishda e'tibor berish kerak bo'lgan farqlar

Bular **ataylab** qilingan, xato emas:

1. **Logotip.** HTML'dagi SVG o'rniga haqiqiy brend aktivi
   (`assets/brand/nfcstore_logo.jpg`, o'zgarmagan). Belgi keng
   lokap bo'lgani uchun doira qilib kesilmaydi. Oltin sirt ustida
   (identity karta, orb) logotip o'zining qorong'i plastinasi bilan
   turadi — oltin oltinda yo'qolmasligi uchun.

2. **Rus tilidagi sarlavhalar** Playfair Display bilan chiziladi:
   Instrument Serif'da kirill alifbosi yo'q.

3. **Demo ma'lumot yo'q.** HTML'dagi «Aziz Karimov», «Silk Route
   Digital» kabi qiymatlar ilovada YO'Q — hammasi backend'dan keladi.
   Suratlardagi «Nodira Rahimova» faqat surat oluvchi vositada
   (`tool/gallery.dart`) yashaydi va relizga tushmaydi (buni
   `test/no_demo_data_test.dart` doimiy tekshiradi).

4. **Biznes paneli** shaxsiy profildan boshqacha tuzilgan:
   ko'rsatkichlar birinchi, keyin boshqaruv. Concept B'da ikkalasi
   o'xshashroq edi.
