# NFCSTORE Company System v2

## URL va NFC qarori

- Personal NFC ID o‘z yo‘lida qoladi: `/ali777` kabi profil `cards` jadvalidan ishlaydi.
- Company ID faqat `A–Z`, 3–15 harf, case-insensitive va `companies_v2` jadvalida saqlanadi.
- Kompaniya NFC kartasiga `/c/COMPANYID` yoziladi. Bu mobil Quick Profile ochadi.
- To‘liq kompaniya sayti `/company/COMPANYID` orqali ochiladi.
- Egasi `/workspace/COMPANYID` orqali boshqaradi.
- Eski `/business/:personalId` endi personal IDni tahrirlamaydi; migratsiya/onboardingga yo‘naltiradi.

## Holatlar

`draft → pending_review → approved → payment_pending → paid → active`

Qo‘shimcha holatlar: `rejected`, `suspended`. Public endpoint faqat `active` kompaniyani ochadi; egasi tekshiruv davrida preview ko‘ra oladi.

## Narx

| Company ID uzunligi | Tarif | Narx |
|---|---|---:|
| 8–15 | SILVER | 349 000 so‘m |
| 6–7 | GOLD | 549 000 so‘m |
| 4–5 | PREMIUM | 749 000 so‘m |
| 3 | EXCLUSIVE | 990 000 so‘m |

Admin `company_id_rules_v2` orqali rezerv, sotuvdan olish, blok, tier va narx override beradi. Narx frontenddan olinmaydi.

## To‘lov

Payme uchun mavjud `web_orders` va callback qayta ishlatiladi. Yangi `kind = company_purchase`; webhook yakunida `cards` emas, faqat `companies_v2` faollashadi. Sites preview D1 modulida credential saqlanmaydi; real Payme oqimi PostgreSQL backend deploy qilingach ishlaydi.

## Ma’lumotlar xavfsizligi

- Personal `cards`, personal narx, sovg‘a, auksion va fizik karta bog‘lamlariga migratsiya yozuvi kiritilmaydi.
- Eski biznes profilidan import faqat owner so‘ragan xavfsiz public maydonlarni **nusxalaydi**.
- Bir account bir nechta kompaniya yarata oladi.
- Kompaniyaning Quick Profile va public page bir xil company/catalog manbasidan o‘qiydi.

