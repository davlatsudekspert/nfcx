# Domla materiallarini qabul qilish tartibi

**Holat (2026-10-08): fayllar hali kelmagan.** Quyidagi ro‘yxat bo‘sh. Hech bir material
o‘qilgan, kataloglangan yoki import qilingan deb belgilanmagan. Material kelganda shu fayl va
`assets/content/core/pack.json` birga yangilanadi.

Maqsad: yangi kitob, qo‘llanma, metodika va test savollarini **ilova kodini o‘zgartirmasdan**
qo‘shish. Hammasi kontent paketidagi ma’lumot; ekranlar (Kutubxona → Kitob va qo‘llanmalar,
Tekshiruv navbati, analit kartasi, test) uni avtomatik ko‘rsatadi.

## 1. Kelgan materiallar ro‘yxati

| # | id | Nomi | Muallif(lar) | Yil / nashr | Til | Turi | Kategoriya | Mavzular | Tarqatish huquqi | Holat |
|---|----|------|--------------|-------------|-----|------|-----------|----------|------------------|-------|
| — | — | *(hali material kelmagan)* | | | | | | | | |

Holat qiymatlari (`import_state`): `not_received` → `received` (fayl keldi) → `cataloged`
(bibliografik ma’lumot tekshirildi) → `linked` (kartalar/darslarga sahifa bilan bog‘landi) →
`reviewed` (domla tasdiqladi). Faqat `cataloged` va undan keyingi holatdagi materialdan iqtibos
keltirish mumkin — validator boshqasini rad etadi.

## 2. Saralash (kategoriyalar)

`biochemistry` (biokimyo) · `clinical_lab` (klinik laboratoriya) · `instruments` (apparatlar) ·
`methods` (metodikalar) · `tests` (test savollari). Bitta material bir nechta kategoriyada
bo‘lishi mumkin. Turi (`kind`): `book`, `manual`, `method`, `ifu`, `article`, `question_set`.

## 3. Kartalar va darslarga bog‘lash (manba + sahifa)

Har bir da’vo — `claims[]` elementi, `refs` bilan:

```json
{"section": "high_result",
 "refs": [{"source_id": "src-<kitob-id>", "pages": "112–114"}],
 "text": {"uz": "...", "ru": "...", "en": "..."}}
```

- `sources[]` ga kitob uchun yozuv: `"kind": "book"`, `"library_item_id": "<kitob-id>"`.
- Sahifa raqami asl nashrdagi bo‘yicha; tarjima qilingan matn bo‘lsa ham manba asl nashr.
- Diagnostik chegara (`decision_limits`) va referens interval (`reference_intervals`) alohida;
  har birida populyatsiya, metod va manba sahifasi.
- Dars mavzusi: `lessons[]` (`analyte_ids`, `quiz_ids`, `refs`). Karta yoki dars
  “reviewed”/“published” bo‘lishi uchun tekshiruvchi id si va sanasi shart.

## 4. Eski va yangi manba farqlari

Farq topilsa, hech bir variant kartaga “fakt” sifatida yozilmaydi. `discrepancies[]` ga:

```json
{"id": "glucose-fpg-threshold-2012-vs-2023",
 "subject_id": "glucose-plasma-fasting", "field": "decision_limits", "status": "open",
 "positions": [
   {"source_id": "src-<eski>", "pages": "87",  "statement": "<manbadagi aynan qiymat>"},
   {"source_id": "src-<yangi>", "pages": "115", "statement": "<manbadagi aynan qiymat>"}],
 "resolution": null}
```

Ilovada: Kutubxona → **Tekshiruv navbati**. Domla qaror qilgach: `status: resolved`,
`resolution: {note, reviewer_id, resolved_at}` — izoh va tekshiruvchisiz “resolved” rad etiladi.
Yangi nashr eskisini almashtirsa, `library[]` da `"supersedes": "<eski-id>"`.

## 5. Test savollari

Har savol: `prompt`, `options[]` (har variantda `explanation` — nega to‘g‘ri/noto‘g‘ri),
`correct_index`, `basis`, `refs` (manba + sahifa), `topic_ids`, `review_state`.
Domla tasdiqlamagan savol `review_state: pending` — ilovada “Qoralama · tekshirilmagan”.
`approved` savol manbasiz bo‘lsa paket rad etiladi. Savol matnini o‘zgartirmasdan kiritish;
izohlarni domla bilan kelishish.

## 6. Tarqatish huquqi va kitob paketlari

- Domla bergan PDF — **avtomatik ravishda umumiy tarqatish huquqi emas**. Standart:
  `rights.distribution: unknown` yoki `personal_only`.
- To‘liq kitobni umumiy kutubxonaga (hammaga yuklanadigan paket) qo‘yish uchun:
  `distribution: permitted` + `recorded_at` + `recorded_by` + `evidence` (nashriyot/muallif
  ruxsat xati yoki litsenziya havolasi). Busiz `file_pack` bo‘lgan yozuv rad etiladi.
- Kitob alohida oflayn paket: `pack_id: book-<id>`, o‘z `manifest.json` (version, size,
  sha256, til, litsenziya, min_schema), `PackInstaller` atomar o‘rnatadi; yuklashdan oldin
  haqiqiy hajm ko‘rsatiladi. Yuklash serveri — C bosqich.

## Ish tartibi (har material kelganda)

1. Faylni qabul qilish → ro‘yxatga qator (`import_state: received`, `received_at`).
2. Bibliografik ma’lumotni tekshirish → `library[]` yozuvi (`cataloged`), `sources[]` yozuvi.
3. Kerakli bo‘limlarni o‘qib, kartalar/darslarga sahifa bilan bog‘lash (`linked`).
4. Farqlarni `discrepancies[]` ga; testlarni `quiz[]` ga `pending` holatda.
5. `dart run tool/build_content_manifest.dart` → `flutter test` (validator xatosiz bo‘lishi shart).
6. Domlaga: Tekshiruv navbati + draft savollar ro‘yxati. Tasdiqdan keyin review maydonlari.

Namuna (sxema testida tekshiriladi): [content_templates/teacher_material_example.json](content_templates/teacher_material_example.json).

## Qilinmaydigan ishlar

- Kelmagan yoki o‘qilmagan materialni “import qilindi” deb belgilash.
- Sahifa raqamini taxmin qilish yoki manbada yo‘q da’voni yozish.
- Domla ko‘rmagan kontentni `reviewed`/`approved` deb belgilash.
- Tarqatish ruxsati qayd etilmagan to‘liq kitobni umumiy paketga qo‘yish.
- Apparat parametrlari, servis kodlari, kalibrlash qiymatlarini aniq IFU siz kiritish.
