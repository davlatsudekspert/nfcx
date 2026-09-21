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
//   FEATURED         -> xarid tugmasi YO'Q
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

/// Buyurtma turlari (`web_orders.kind`) — server bilan bir xil nom.
class OrderKind {
  static const nfcId = 'card_purchase';
  static const physicalCard = 'physical_card_order';
  static const premium = 'premium_upgrade';
  static const premiumFollow = 'premium_follow';
  static const auction = 'auction_payment';
}

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
  const StoreNotice({super.key, required this.text});

  /// Nima sotib olinayotgani — "NFC ID" yoki "Premium".
  final String text;

  @override
  Widget build(BuildContext context) {
    // Kalit o'chirilgan bo'lsa — hech narsa. Ekranning qolgan
    // qismi avvalgidek ishlaydi, chunki bu shunchaki izoh
    // kartasi edi.
    if (!kShowSiteNotice) return const SizedBox.shrink();

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
