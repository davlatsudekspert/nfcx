import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../l10n/gen/app_localizations.dart';

// ═══════════════════════════════════════════════════════════════════
// ILOVA ICHIDA NIMANI SOTISH MUMKIN
//
// Google Play qoidasi: ilova ichida RAQAMLI tovar sotilsa, to'lov
// Google Play Billing orqali o'tishi kerak. Payme/Click bilan sotish
// ilovaning rad etilishiga yoki olib tashlanishiga olib keladi.
//
// JISMONIY tovar bu qoidadan OZOD. Bizdagi jismoniy NFC karta aynan
// shunday: buyurtmada yetkazib berish ismi, telefoni va MANZILI
// so'raladi (`/api/records/:code/order-physical-card`) va karta
// pochta bilan jo'natiladi.
//
// Shuning uchun ilovada:
//
//   jismoniy karta   -> Payme/Click bemalol
//   NFC ID, Premium,
//   FEATURED         -> xarid tugmasi YO'Q, narx YO'Q va "saytda
//                       oling" yozuvi ham YO'Q (2026-10-08,
//                       `showDigitalPrices` / `showDigitalSiteHints`)
//
// ANTI-STEERING. Xarid o'rnida saytga BOSILADIGAN HAVOLA ham
// qo'yilmaydi — Google buni ham taqiqlaydi ("apps may not lead users
// to a payment method other than Google Play's billing system...
// including web links or buttons"). Manzil MATN sifatida yoziladi:
// odam uni o'qiydi va brauzerda o'zi ochadi.
// ═══════════════════════════════════════════════════════════════════

/// Saytning manzili — MATN sifatida ko'rsatiladi, havola emas.
const kSiteHost = 'nfcstore.uz';

/// SAYT MANZILI UMUMAN KO'RSATILSINMI.
///
/// ## NIMA UCHUN BU KALIT BOR
///
/// "Xarid saytda rasmiylashtiriladi: nfcstore.uz" degan yozuv
/// bosilmaydi — na tugma, na havola. Shunga qaramay Google
/// Play'ning anti-steering qoidasi bo'yicha xavf NOLGA teng
/// emas: qoida foydalanuvchini tashqi to'lovga yo'naltirishni
/// cheklaydi, "yo'naltirish" ning chegarasi esa Google
/// tekshiruvchisining qarorida.
///
/// Egasining qarori (2026-09): yozuv QOLSIN, chunki usiz mijoz
/// NFC ID ni qayerdan olishini umuman bilmay qoladi. Play rad
/// etsa — shu kalit `false` qilinadi va ilova qayta yig'iladi.
///
/// 2026-10-08: RAQAMLI mahsulot (NFC ID, Premium, o'z nomi, FEATURED)
/// yozuvi Android'da ham olib tashlandi (`showDigitalSiteHints`).
/// Kalit endi faqat JISMONIY tovar yozuvini (`physical: true`) va
/// Sozlamalardagi sayt kartasini (jismoniy karta, katalog) boshqaradi.
///
/// ## NIMA UCHUN KALIT, KODNI O'CHIRISH EMAS
///
/// Rad etish kelsa, tuzatish bir necha ekranni qayta yozishni
/// emas, BITTA so'zni almashtirishni talab qilsin. Yozuv besh
/// joyda chiziladi; ularni qo'lda birma-bir olib tashlash
/// bosim ostida qilinadigan ish va bittasi albatta esdan
/// chiqadi.
///
/// `false` bo'lganda `StoreNotice` hech narsa chizmaydi —
/// atrofidagi ekranlarga tegilmaydi.
const kShowSiteNotice = true;

/// APP STORE (iPhone) — RAQAMLI XARIDGA ISHORA YO'Q.
///
/// ## NIMA UCHUN
///
/// Apple 3.1.1: raqamli mahsulot faqat In-App Purchase bilan
/// sotiladi; tashqi xaridga yo'naltiruvchi matn, tugma yoki havola
/// taqiqlangan. 3.1.3(f) IAP'siz ishlashga ruxsat beradi — agar
/// ilovada xarid ham, "saytdan oling" degan chaqiriq ham bo'lmasa.
/// Apple bu borada Google'dan qattiqroq: Play'da qoldirilgan yozuv
/// (`kShowSiteNotice`) iPhone'da rad etish sababi bo'lardi.
///
/// Egasining qarori (2026-09-27): iPhone versiyasida raqamli
/// mahsulot (NFC ID, Premium, o'z nomi, FEATURED) NARXI va SAYT
/// YOZUVI ko'rsatilmaydi. ID bo'sh yoki bandligi, sotib olingan
/// narsaning holati ko'rinaveradi. 2026-10-08 dan Android ham shunday
/// (`showDigitalPrices`, Google Play to'lov qoidasi).
///
/// Jismoniy tovar (NFC karta, katalogdagi mahsulotlar) bu qoidadan
/// tashqarida — Apple 3.1.5(a) ularni tashqi to'lov bilan sotishni
/// o'zi talab qiladi, narxi iPhone'da ham ko'rinadi.
///
/// `Platform.isIOS` emas, `defaultTargetPlatform`: testda
/// `debugDefaultTargetPlatformOverride` bilan iPhone sinaladi.
bool get isAppStoreBuild => defaultTargetPlatform == TargetPlatform.iOS;

/// Raqamli mahsulot narxi ko'rsatilsinmi — IKKALA PLATFORMADA YO'Q.
///
/// Ilgari Android'da narx ko'rinardi (iPhone'da — yo'q). 2026-10-08:
/// Google Play to'lov qoidasi ("Payments" policy) ilova ichidagi
/// raqamli xizmat uchun foydalanuvchini Play Billing'dan boshqa to'lov
/// usuliga YO'NALTIRISHNI taqiqlaydi. Xarid ilovada yo'q, demak narx
/// ham, "saytda rasmiylashtiriladi" yozuvi ham faqat tashqi to'lovga
/// ishora bo'lib qoladi. Android endi iPhone kabi: NFC ID, Premium,
/// o'z nomi va FEATURED (ko'tarish) narxi KO'RSATILMAYDI.
///
/// Jismoniy tovar (NFC karta, stiker, katalog) bu qoidadan tashqarida
/// — uning narxi ikkala platformada ham ko'rinadi.
bool get showDigitalPrices => false;

/// RAQAMLI xaridni saytga yo'naltiruvchi yozuv bo'lsinmi —
/// `StoreNotice` (jismoniy bo'lmasa), "to'lovni yakunlang", sayt
/// chegirmasi, "(sayt orqali)". IKKALA PLATFORMADA YO'Q — sabab
/// `showDigitalPrices` izohida. Jismoniy tovar yozuvi qoladi
/// (`StoreNotice(physical: true)`, `kShowSiteNotice` bilan).
bool get showDigitalSiteHints => false;

/// "LENTADA KO'TARISH" (FEATURED) EKRANIGA KIRISH YO'LI BO'LSINMI.
///
/// Ekran faqat paketlar (muddat + narx) va "reklama saytda
/// rasmiylashtiriladi" yozuvidan iborat edi. Narx va yozuv olib
/// tashlangach (`showDigitalPrices`, `showDigitalSiteHints`) unda
/// foydali narsa qolmaydi — iPhone'dagidek Android'da ham post
/// ostidagi tugma chizilmaydi, `/featured/...` esa bosh sahifaga
/// buriladi (`router.dart`). iPhone'dagi Apple consumable "Ko'tarish"
/// (`boost_controller.dart`) bunga aloqasiz — u ilova ichidagi xarid.
bool get showFeaturedEntry => false;

/// Buyurtma turlari (`web_orders.kind`) — server bilan bir xil nom.
class OrderKind {
  static const nfcId = 'card_purchase';
  static const physicalCard = 'physical_card_order';
  static const premium = 'premium_upgrade';
  static const premiumFollow = 'premium_follow';
  static const auction = 'auction_payment';
  static const featured = 'featured_slot';
}

/// Buyurtma JISMONIY tovar uchunmi.
///
/// Faqat jismoniy NFC karta. Qolganlari — NFC ID, Premium, obuna,
/// auksion, FEATURED — raqamli. Ro'yxat ataylab "jismoniylar"
/// shaklida: serverda yangi tur paydo bo'lsa, u avtomatik RAQAMLI
/// hisoblanadi va iPhone'da narxi chiqib qolmaydi.
bool isPhysicalOrder(String kind) => kind == OrderKind.physicalCard;

/// Buyurtma summasi ko'rsatilsinmi: Android'da — har doim, iPhone'da
/// — faqat jismoniy tovar uchun (Apple 3.1.5(a)).
bool showOrderAmount(String kind) =>
    showDigitalPrices || isPhysicalOrder(kind);

/// "BUYURTMALAR" EKRANIGA KIRISH YO'LI BO'LSINMI.
///
/// Egasining qarori (2026-10-04, iPhone surati): "kerak bo'lmasa —
/// olib tashla, App Store shu sababli rad etmasin". Ro'yxatning
/// deyarli hammasi raqamli xaridlar (NFC ID, Premium) va bekor
/// qilingan buyurtmalar edi; iPhone'da ilova ichida hech narsa
/// sotilmaydi, demak bu ekran u yerda kerak emas.
///
/// iPhone'da Sozlamalar, Do'kon, NFC ID qidiruvi va to'lov natijasi
/// ekranlaridagi "Buyurtmalar" tugmalari chizilmaydi. Ekran baribir
/// ochilib qolsa (`/orders`), unda faqat jismoniy karta buyurtmalari
/// ko'rinadi. ANDROID O'ZGARMAYDI.
bool get showOrdersEntry => !isAppStoreBuild;

/// "YANGILIKLAR" EKRANIGA KIRISH YO'LI BO'LSINMI.
///
/// Yangiliklar serverdan (`GET /api/news`) HECH QANDAY platforma
/// filtrisiz keladi va ilova ularni o'zgartirmay chizadi. 2026-10-04
/// dagi App Store auditida u yerda ikki yozuv bor edi: "NFC ID ni
/// Payme bilan saytda oling" (Apple 3.1.1 — tashqi xaridga chaqiriq)
/// va "Android ilovani yuklab oling, Google Play tez kunda" (2.3.10 —
/// boshqa platforma). Admin keyin nima yozishini ilova oldindan
/// bilolmaydi, shuning uchun iPhone'da bo'limning O'ZI yo'q:
/// Sozlamalar → Ilova haqida'dagi qator chizilmaydi, `/settings/news`
/// esa "Ilova haqida" ga buriladi (`router.dart`). ANDROID O'ZGARMAYDI.
bool get showNewsEntry => !isAppStoreBuild;

/// "NFC ID BOZORI" BO'LSINMI — ID qidiruvi, toifalar katalogi, ID
/// kartasi va buyurtma ekrani (`/nfc/market*`).
///
/// Egasining qarori (2026-10-04, App Store auditi): iPhone'da bozor
/// UMUMAN YO'Q. Qidiruvdagi har bir ID pullik raqamli tovar, IAP esa
/// yo'q (Apple 3.1.1). Narxsiz ham u "bo'sh — oling" degan, lekin
/// olib bo'lmaydigan do'kon vitrinasi bo'lib qolardi. Bosh sahifadagi
/// "ID qidirish" o'rnida "NFC ID'larim", NFC Markazdagi qator va
/// NFC'siz qurilmadagi katak o'rnida stiker faollashtirish turadi;
/// `/nfc/market*` havolalari esa "NFC ID'larim" ga buriladi
/// (`router.dart`). ANDROID O'ZGARMAYDI.
bool get showIdMarket => !isAppStoreBuild;

/// "BILDIRISHNOMALAR" SOZLAMASI BO'LSINMI.
///
/// Ilovada push ham, mahalliy bildirishnoma ham YO'Q: `pubspec.yaml`
/// da paket yo'q, `Runner.entitlements` da `aps-environment` yo'q,
/// iOS ruxsat ham so'ramaydi. Ekrandagi tugmalar faqat qurilmaga
/// yoziladi va hech narsaga ta'sir qilmaydi (`Prefs.notif` boshqa
/// joyda o'qilmaydi). Apple 2.1 / 2.3.1: "ishlamaydigan imkoniyat"
/// rad etish sababi. Faqat haqiqiy ishlaydigan tugmalarni qoldirish
/// mumkin emas edi — bittasi ham ishlamaydi.
///
/// iPhone'da Sozlamalardagi qator chizilmaydi, `/settings/notifications`
/// esa Sozlamalarga buriladi.
///
/// ANDROID'DA HAM YO'Q (audit 2026-10-06): sabab bir xil — push yo'q,
/// tugmalar hech narsaga ta'sir qilmaydi (Play'da ham "ishlamaydigan
/// imkoniyat"). Push (FCM / APNs) qo'shilganda bu kalit qaytariladi.
bool get showNotificationSettings => false;

/// Shu buyurtmani ILOVA ICHIDA to'lash mumkinmi.
///
/// ## HOZIRCHA HECH BIRI
///
/// Uzoq vaqt bu yerda `kind == OrderKind.physicalCard` turgan edi:
/// jismoniy karta Play Billing qoidasidan ozod, demak uni ilovada
/// to'lash mumkin degan mantiq bilan. Mantiq to'g'ri, lekin
/// TEKShIRILMAGAN edi.
///
/// 2026-09 da tekshirilganda ma'lum bo'ldi: ilovadagi jismoniy
/// karta xaridi UCH joyda uzilgan.
///
///   1. Ilova buyurtma YARATMAYDI. `CheckoutScreen._pay()`
///      `repo.orders()` bilan mavjud ro'yxatni o'qib, BIRINCHI
///      buyurtmani oladi. Yangi mijozda ro'yxat bo'sh -> xato.
///      Eski buyurtmasi borida esa BOShQA buyurtma uchun to'lov
///      ochilardi — bu pul masalasi.
///
///   2. Serverda bunday yo'l yo'q. `orderPhysicalCard()`
///      `/api/records/:code/order-physical-card` ga murojaat
///      qiladi, `hosting/worker.js` da esa u MAVJUD EMAS.
///
///   3. Server to'lovni YAKUNLAY olmaydi. `worker.js` dagi izoh
///      o'zi aytadi: `physical_card_order` D1'ga ko'chirilmagan,
///      buyurtma `pending` holatida qoldiriladi.
///
/// Ya'ni tugma bosilsa xato chiqardi. Play tekshiruvchisi uchun bu
/// anti-steering'dan ham og'irroq sabab: "ilova tavsifda aytilganidek
/// ishlamaydi" — bahssiz rad etish.
///
/// Shuning uchun HOZIRCHA hamma tur saytga yo'naltiriladi. Buzuq
/// tugmadan ko'ra ishlaydigan yozuv yaxshi.
///
/// ## QACHON QAYTARILADI
///
/// Yuqoridagi uchala uzilish tuzatilganda va xarid BOShIDAN
/// OXIRIGACHA sinovdan o'tkazilganda, bu yerga yana
/// `kind == OrderKind.physicalCard` qaytariladi. Jismoniy tovar
/// qoidadan ozodligi o'zgargani yo'q — faqat kod tayyor emas edi.
///
/// Ro'yxat ataylab "ruxsat etilganlar" shaklida: yangi tur
/// qo'shilsa, u avtomatik RUXSAT ETILMAGAN bo'ladi.
bool canPayInApp(String kind) => false;

/// Raqamli mahsulot xaridi o'rnidagi yozuv.
///
/// Tugma emas, havola emas — tinch izoh. Ekran "buzuq" ko'rinmasligi
/// uchun u xuddi boshqa kartalar kabi chiziladi.
class StoreNotice extends StatelessWidget {
  const StoreNotice({super.key, required this.text, this.physical = false});

  /// Nima sotib olinayotgani — "NFC ID" yoki "Premium".
  final String text;

  /// JISMONIY tovar (NFC karta) xaridi. Faqat shunday yozuv
  /// iPhone'da ham ko'rinadi — Apple 3.1.5(a) jismoniy tovarni
  /// tashqi to'lov bilan sotishga ruxsat beradi.
  final bool physical;

  @override
  Widget build(BuildContext context) {
    // Kalit o'chirilgan bo'lsa — hech narsa. Ekranning qolgan
    // qismi avvalgidek ishlaydi, chunki bu shunchaki izoh
    // kartasi edi.
    if (!kShowSiteNotice) return const SizedBox.shrink();
    // Raqamli xarid haqida yozuv YO'Q — iPhone'da ham, Android'da ham
    // (`showDigitalSiteHints`, Google Play to'lov qoidasi).
    if (!physical && !showDigitalSiteHints) return const SizedBox.shrink();

    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: t.surface2,
        borderRadius: R.gentle,
        border: Border.all(color: t.border2),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.language_rounded, size: 19, color: t.accent2),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(text,
                    style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 4),
                // Manzil ajralib tursin — lekin bosilmaydi.
                SelectableText(
                  kSiteHost,
                  style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 14.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: .2,
                    color: t.accent1,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// `StoreNotice` uchun matn — mahsulot turiga qarab.
String storeNoticeText(L l, String kind) => switch (kind) {
      OrderKind.premium || OrderKind.premiumFollow => l.storeBuyOnSitePremium,
      _ => l.storeBuyOnSiteId,
    };

/// NFC ID qidiruv ekranining nomi (ekran sarlavhasi va NFC Markazdagi
/// qator). iPhone'da "NFC ID olish" emas, "ID qidirish": ilovada ID
/// olinmaydi — faqat qidiriladi va holati ko'riladi.
String idMarketTitle(L l) =>
    isAppStoreBuild ? l.idSearchShort : l.idMarketTitle;


// ─────────────────────────────────────────── to'lov provayderi rangi
//
// SAYTDAN OLINGAN, o'ylab topilmagan. `src/pages/PaymentsPage.jsx`:
//
//     { id: 'payme', label: 'Payme', color: '#33c8b6' }
//     { id: 'click', label: 'Click', color: '#0d6efd' }
//
// Ikki joyda ikki xil rang bo'lsa, odam saytda bir xil, ilovada
// boshqacha tugma ko'rardi va qaysi biri haqiqiy ekaniga
// ishonmasdi.
//
// Bu ranglar FAQAT jismoniy karta do'konida ishlatiladi — raqamli
// mahsulotlar ilovada sotilmaydi.
const kPaymeBrand = Color(0xFF33C8B6);
const kClickBrand = Color(0xFF0D6EFD);

/// Provayder nomiga qarab brend rangi. Noma'lum provayder uchun
/// `null` — chaqiruvchi mavzu rangiga qaytadi.
Color? brandColor(String label) => switch (label.toLowerCase()) {
      'payme' => kPaymeBrand,
      'click' => kClickBrand,
      _ => null,
    };
