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

### To'liq ilova qobig'i bilan — `shell-*`

**Bular eng ishonchli manba.** Qolgan suratlar ekranni SHELLSIZ
ko'rsatadi, ya'ni ularda pastki `NovaBottomNav` yo'q. `shell-*`
suratlari esa haqiqiy `NovaApp` -> `routerProvider` -> `HomeShell`
orqali olingan: navigatsiya taqlid emas, ishlab chiqarish kodining
o'zi.

| Fayl | Tab |
|---|---|
| `shell-home-390.png` | Asosiy |
| `shell-discover-390.png` | Kashfiyot |
| `shell-nfc-390.png` | NFC (markazdagi ko'tarilgan tugma) |
| `shell-reels-390.png` | Reels |
| `shell-profile-390.png` | Profil |
| `shell-tabs-390-midnight.png` | beshalasi yonma-yon, yorliqli |
| `shell-home-{360,390,430}.png` | responsiv, qobiq bilan |
| `shell-responsive-home.png` | uchtasi yonma-yon, yorliqli |

### Beshta mavzu

Ikkita asosiy ekran beshala mavzuda — solishtirish uchun eng muhim
to'plam:

* `home-{pearl,graphite,ocean,aurora,midnight}.png`
* `nfc-center-{pearl,graphite,ocean,aurora,midnight}.png`
* `profile-{pearl,graphite,ocean,aurora,midnight}.png`

Mavzu ranglari HTML'dagi `html[data-theme="..."]` bloklaridan
**bir-bir ko'chirilgan** — `DEEPSEEK_UI_AUDIT_SOURCE.md` dagi `nfc_tokens.dart` ga qarang.

### Responsivlik — 360 / 390 / 430

Ataylab **rus tilida**: eng uzun yozuvlar shu tilda.

* `responsive-home-{360,390,430}.png`
* `responsive-nfc-{360,390,430}.png`
* `responsive-profile-{360,430}.png`

### Uch til

`settings-midnight-{uz,ru,en}.png`

---

## 2. Kod — `DEEPSEEK_UI_AUDIT_SOURCE.md`

Manba kod **bitta faylga** birlashtirilgan:
[`DEEPSEEK_UI_AUDIT_SOURCE.md`](DEEPSEEK_UI_AUDIT_SOURCE.md) — 19 ta
Dart fayli to'liq matni, har birining boshida
`===== FILE: lib/.../filename.dart =====`.

**NIMA UCHUN NUSXA EMAS, BITTA .md:** avval bu yerda
`docs/audit/code/` papkasi bor edi — 23 ta `.dart` nusxasi.
`flutter analyze` butun paketni tekshiradi, shuning uchun o'sha
nusxalardagi nisbiy importlar (`import '../tokens/...'`) hal bo'lmay,
CI **777 ta xato** bilan yiqildi
([run #35431593771](https://github.com/davlatsudekspert/nfcx/actions/runs/35431593771)).
Markdown ichidagi kod bloklari Dart tahlilchisiga ko'rinmaydi.

Qamrab olingan: dizayn tokenlari va mavzu (`nfc_tokens`, `app_theme`,
`typography`, `shapes`, `motion`, `palette`), NFC (`nfc_orb`,
`nfc_center_screen`), Home (`home_screen`, `identity_card`,
`mode_switch`), `profile_screen`, umumiy widgetlar (`surfaces`,
`buttons`, `backdrop`, `brand_logo`, `bottom_nav`), `discover_screen`
va `reels_screen`.

Concept B tomondagi mos qoidalar:
[`DEEPSEEK_CONCEPT_B_REFERENCE.md`](DEEPSEEK_CONCEPT_B_REFERENCE.md) —
original HTML qator raqamlari bilan.

---

## Reels surati nima uchun yo'q

Reels **haqiqiy videoni** backend'dan oladi. Surat oluvchi brauzer
`nfcstore.uz` ga chiqa olmaydi, shuning uchun u yerda faqat bo'sh
holat ko'rinardi — bu maketni baholashga yordam bermaydi.

Buning o'rniga `DEEPSEEK_UI_AUDIT_SOURCE.md` ichida
`reels_screen.dart` to'liq berilgan. E'tibor
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
