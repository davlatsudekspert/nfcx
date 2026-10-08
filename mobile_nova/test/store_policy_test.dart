import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/featured_repository.dart';
import 'package:nfcstore_nova/features/business/business_screens.dart'
    show formatMoney;
import 'package:nfcstore_nova/features/settings/settings_subscreens.dart'
    show PremiumScreen;
import 'package:nfcstore_nova/features/shop/nfc_id_market.dart';
import 'package:nfcstore_nova/features/shop/store_policy.dart';
import 'package:nfcstore_nova/features/social/featured_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// Android va iPhone — raqamli xarid qoidasi ikkalasida bir xil.
final _both = TargetPlatformVariant(
    const {TargetPlatform.android, TargetPlatform.iOS});

/// Ekranni ochadi va o'zbekcha matnlarni qaytaradi.
Future<L> _pump(WidgetTester tester, Widget screen,
    {List<Override> overrides = const []}) async {
  tester.view.physicalSize = const Size(393 * 3, 1600 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [...await testOverrides(), ...overrides],
    child: wrapScreen(screen),
  ));
  await settle(tester);
  return L.delegate.load(const Locale('uz'));
}

/// Raqamli xaridni saytga yo'naltiruvchi har qanday yozuv yo'qligi.
void _expectNoSiteCta(L l) {
  for (final s in [
    l.storeBuyOnSiteId,
    l.storeBuyOnSiteAd,
    l.storeBuyOnSitePremium,
    l.storeBuyOnSiteBizName,
    l.bizPlanStoreNotice,
    kSiteHost,
  ]) {
    expect(find.text(s), findsNothing, reason: s);
  }
  expect(find.textContaining('sayt'), findsNothing);
}

/// ILOVA ICHIDA RAQAMLI TOVAR SOTILMAYDI.
///
/// ## NIMA UCHUN BU SINOV BOR
///
/// Google Play qoidasi: ilova ichida raqamli tovar sotilsa, to'lov
/// Google Play Billing orqali o'tishi kerak. Payme/Click bilan
/// sotish ilovaning rad etilishiga yoki keyinchalik olib
/// tashlanishiga olib keladi.
///
/// Jismoniy tovar bu qoidadan OZOD. Bizdagi jismoniy NFC karta
/// aynan shunday: buyurtmada yetkazib berish MANZILI so'raladi va
/// karta pochta bilan jo'natiladi.
///
/// Ilgari ilovada uchta raqamli xarid bor edi: NFC ID, Premium va
/// FEATURED. Ular olib tashlandi. Bu sinov ularning QAYTIB
/// KELMASLIGINI qo'riqlaydi — yangi tugma qo'shilsa CI yiqiladi.
void main() {
  group('qaysi buyurtmani ilovada to\'lash mumkin', () {
    test('HOZIRCHA hech biri — jismoniy karta ham', () {
      // Jismoniy karta Play Billing qoidasidan OZOD va uzoq vaqt
      // bu yerda `isTrue` turgan edi. Qoida o'zgargani yo'q —
      // KOD tayyor emasligi ma'lum bo'ldi.
      //
      // Ilovadagi xarid uch joyda uzilgan edi: ilova buyurtma
      // yaratmasdi, serverda bunday yo'l yo'q edi va server
      // to'lovni yakunlay olmasdi. Ya'ni tugma bosilsa XATO
      // chiqardi.
      //
      // To'liq tahlil `store_policy.dart` dagi `canPayInApp()`
      // izohida. Uchala uzilish tuzatilib, xarid boshidan
      // oxirigacha sinovdan o'tkazilgandan KEYIN bu yerga
      // `isTrue` qaytariladi.
      expect(canPayInApp(OrderKind.physicalCard), isFalse);
    });

    test('raqamli mahsulotlar — yo\'q', () {
      for (final kind in [
        OrderKind.nfcId,
        OrderKind.premium,
        OrderKind.premiumFollow,
        OrderKind.auction,
      ]) {
        expect(canPayInApp(kind), isFalse, reason: kind);
      }
    });

    /// RO'YXAT "RUXSAT ETILGANLAR" SHAKLIDA.
    ///
    /// Kelajakda yangi tur qo'shilsa u AVTOMATIK ruxsat etilmagan
    /// bo'ladi. Teskarisi ("taqiqlanganlar ro'yxati") bo'lsa, yangi
    /// raqamli mahsulot jimgina to'lanadigan bo'lib qolardi.
    test('noma\'lum tur — yo\'q', () {
      expect(canPayInApp('yangi_mahsulot'), isFalse);
      expect(canPayInApp(''), isFalse);
    });
  });

  /// RAQAMLI MAHSULOT: NARX YO'Q, TASHQI XARIDGA CHAQIRIQ YO'Q —
  /// iPhone'da HAM, Android'da HAM.
  ///
  /// Google Play to'lov qoidasi (2026-10-08): ilova ichidagi raqamli
  /// xizmat uchun foydalanuvchini Play Billing'dan boshqa to'lov
  /// usuliga yo'naltirish taqiqlangan — "saytda rasmiylashtiriladi"
  /// yozuvi va narx ham shunga kiradi. Apple 3.1.1 iPhone'da buni
  /// avvaldan talab qiladi. Jismoniy tovar (NFC karta) yozuvi QOLADI.
  group('raqamli xarid — Android va iPhone', () {
    testWidgets('kalitlar: narx va sayt yozuvi yo‘q', (tester) async {
      expect(showDigitalPrices, isFalse);
      expect(showDigitalSiteHints, isFalse);
      for (final kind in [
        OrderKind.nfcId,
        OrderKind.premium,
        OrderKind.premiumFollow,
        OrderKind.auction,
        OrderKind.featured,
        'yangi_mahsulot',
      ]) {
        expect(showOrderAmount(kind), isFalse, reason: kind);
      }
      // Jismoniy karta — narxi ko'rinadi.
      expect(showOrderAmount(OrderKind.physicalCard), isTrue);
    }, variant: _both);

    testWidgets('StoreNotice: raqamli — hech narsa, jismoniy — matn',
        (tester) async {
      final l0 = LUz();
      final l = await _pump(
        tester,
        Column(children: [
          StoreNotice(text: l0.storeBuyOnSiteId),
          StoreNotice(text: l0.storeBuyOnSiteAd),
          StoreNotice(text: l0.storeBuyOnSitePremium),
          StoreNotice(text: l0.storeBuyOnSitePhysical, physical: true),
        ]),
      );
      expect(find.text(l.storeBuyOnSiteId), findsNothing);
      expect(find.text(l.storeBuyOnSiteAd), findsNothing);
      expect(find.text(l.storeBuyOnSitePremium), findsNothing);
      expect(find.text(l.storeBuyOnSitePhysical), findsOneWidget);
      expect(find.text(kSiteHost), findsOneWidget, reason: 'faqat jismoniy');
    }, variant: _both);

    testWidgets('FEATURED (Ko‘tarish): paket narxi va sayt yozuvi yo‘q',
        (tester) async {
      final l = await _pump(
        tester,
        const FeaturedScreen(targetKind: 'post', targetId: 5),
        overrides: [
          featuredPackagesProvider.overrideWith((ref) async =>
              const FeaturedOffer(enabled: true, packages: [
                FeaturedPackage(days: 3, price: 30000),
                FeaturedPackage(days: 7, price: 60000),
              ])),
        ],
      );
      expect(tester.takeException(), isNull);
      // Ekran haqiqatan yuklangan — paketlar (muddat) chizilgan.
      expect(find.text(l.featuredDays(3)), findsOneWidget);
      expect(find.text(formatMoney(30000, 'UZS')), findsNothing);
      expect(find.text(formatMoney(60000, 'UZS')), findsNothing);
      _expectNoSiteCta(l);
    }, variant: _both);

    testWidgets('NFC ID: narx va sayt yozuvi yo‘q', (tester) async {
      final l = await _pump(
        tester,
        const NfcIdBuyScreen(code: 'VIP777'),
        overrides: [
          idQuoteProvider('VIP777').overrideWith((ref) async => const IdQuote(
              code: 'VIP777', purchasable: true, tier: 'gold', amount: 490000)),
        ],
      );
      expect(tester.takeException(), isNull);
      // Holat ko'rinadi (savdo so'zisiz) — narx esa yo'q.
      expect(find.text(l.idStateAvailableIos), findsOneWidget);
      expect(find.text(formatMoney(490000, 'UZS')), findsNothing);
      expect(find.text(l.idStateAvailable), findsNothing);
      _expectNoSiteCta(l);
    }, variant: _both);

    testWidgets('NFC ID buyurtmasi (kutilmoqda): summa va "to‘lovni yakunlang" yo‘q',
        (tester) async {
      final l = await _pump(
        tester,
        const NfcIdOrderScreen(orderId: 9),
        overrides: [
          idOrderProvider(9).overrideWith((ref) async => const Order(
              id: 9,
              status: 'pending',
              total: 490000,
              kind: OrderKind.nfcId,
              code: 'VIP777')),
        ],
      );
      expect(tester.takeException(), isNull);
      expect(find.text(l.idOrderPending), findsOneWidget);
      expect(find.text(formatMoney(490000, 'UZS')), findsNothing);
      expect(find.text(l.idPendingHint), findsNothing);
      _expectNoSiteCta(l);
    }, variant: _both);

    testWidgets('Premium: narx va sayt yozuvi yo‘q', (tester) async {
      final l = await _pump(tester, const PremiumScreen());
      expect(tester.takeException(), isNull);
      expect(find.text(l.premiumCheck), findsOneWidget);
      expect(find.textContaining(l.premiumPerMonth), findsNothing);
      _expectNoSiteCta(l);
    }, variant: _both);
  });

  group('ekranlarda xarid tugmasi yo\'q', () {
    final files = {
      'NFC ID': 'lib/features/shop/nfc_id_market.dart',
      'Premium': 'lib/features/settings/settings_subscreens.dart',
      'FEATURED': 'lib/features/social/featured_screen.dart',
    };

    /// TO'LOVGA OLIB BORADIGAN HAVOLA OCHILMAYDI.
    ///
    /// Google "anti-steering" deb ataydigan narsa: ilova ichidan
    /// tashqi to'lov sahifasiga yo'naltirish. Shuning uchun bu uch
    /// ekranda `openLink` umuman bo'lmasligi kerak.
    for (final entry in files.entries) {
      test('${entry.key} ekranida tashqi to\'lov havolasi yo\'q', () {
        // IZOHLAR HISOBGA OLINMAYDI: hujjatda "payLinks" deb
        // yozilgani qoidabuzarlik emas, u shunchaki tushuntirish.
        final src = File(entry.value)
            .readAsStringSync()
            .replaceAll(RegExp(r'^\s*///?.*$', multiLine: true), '');
        // `openLink` NING O'ZI EMAS, U QAYERGA OCHILISHI muhim.
        //
        // Avval bu yerda `openLink(` umuman bo'lmasin deb
        // yozilgandi. Keyin "Ilova haqida" ekraniga maxfiylik
        // siyosati havolasi qo'shilganda sinov qizardi — holbuki
        // huquqiy hujjat to'lov sahifasi emas, uni Google
        // aksincha TALAB qiladi.
        //
        // Shuning uchun endi har bir `openLink` chaqiruvining
        // manzili tekshiriladi: faqat huquqiy hujjatlarga ruxsat.
        final calls = RegExp(r'openLink\(([^)]*)\)')
            .allMatches(src)
            .map((m) => m.group(1) ?? '')
            .toList();
        for (final arg in calls) {
          // `openLink(url)` — huquqiy qator vidjetining o'zi.
          // Manzil u yerda maydon orqali keladi, shuning uchun
          // chaqiruv joyida ko'rinmaydi. Bu TEShIK emas: quyida
          // o'sha maydonga nima berilishi alohida tekshiriladi.
          final wrapper = arg.trim() == 'url';
          // Apple'ning o'z obunalarni boshqarish sahifasi (hisob
          // o'chirishda, iPhone) — to'lov emas, bekor qilish yo'li.
          final legal = arg.contains('/maxfiylik') ||
              arg.contains('/shartlar') ||
              arg.trim() == 'kAppleManageSubscriptionsUrl';
          expect(wrapper || legal, isTrue,
              reason: '${entry.key}: huquqiy hujjat emas — `$arg`');
        }

        // IKKINCHI BOSQICH — vidjetga BERILGAN manzillar.
        //
        // Busiz kimdir `_LegalRow(url: 'https://checkout...')`
        // deb yozib, yuqoridagi tekshiruvdan o'tib ketardi.
        final urls = RegExp("url:\\s*'([^']*)'")
            .allMatches(src)
            .map((m) => m.group(1) ?? '')
            .toList();
        for (final u in urls) {
          expect(u.contains('/maxfiylik') || u.contains('/shartlar'), isTrue,
              reason: '${entry.key}: ruxsatsiz manzil — `$u`');
        }
        // NAQSH ANIQ BO'LISHI KERAK. Oddiy `payme|click` "Payment"
        // va "PaymentHistory" so'zlarini ham ushlab, sinovni yolg'on
        // qizartirardi. Shuning uchun HAQIQIY to'lov havolalari
        // qidiriladi.
        for (final marker in [
          'paymeLink',
          'clickLink',
          'payLink',
          'launchUrl(',
          'checkout.paycom',
          'my.click.uz',
        ]) {
          expect(src.contains(marker), isFalse,
              reason: '${entry.key}: `$marker` qolgan');
        }
      });
    }

    /// SAYT MANZILI — MATN, HAVOLA EMAS.
    test('sayt manzili bosiladigan havola emas', () {
      final src = File('lib/features/shop/store_policy.dart').readAsStringSync();
      expect(src, contains("const kSiteHost = 'nfcstore.uz'"));
      // Bosish, ochish yoki brauzerga yuborish — hech biri yo'q.
      for (final banned in ['openLink', 'launchUrl', 'onTap:', 'GestureDetector']) {
        expect(src.contains(banned), isFalse,
            reason: 'manzil bosiladigan bo\'lib qolgan: $banned');
      }
    });
  });

  /// RAD ETILSA — BITTA KALIT.
  ///
  /// Play anti-steering bo'yicha rad etsa, tuzatish besh ekranni
  /// qayta yozishni emas, bitta so'zni almashtirishni talab
  /// qilishi kerak. Bosim ostida qo'lda o'chirishda bitta joy
  /// albatta esdan chiqadi.
  group('sayt yozuvi kaliti', () {
    final src =
        File('lib/features/shop/store_policy.dart').readAsStringSync();

    test('kalit mavjud', () {
      expect(src, contains('const kShowSiteNotice'),
          reason: 'kalit o\'chirib yuborilgan');
    });

    test('kalit `StoreNotice` ni HAQIQATAN o\'chiradi', () {
      // Kalit bor, lekin hech qayerda tekshirilmasa — u bezak.
      expect(src, contains('if (!kShowSiteNotice) return'),
          reason: 'kalit tekshirilmayapti');
    });

    test('XARIDGA yo\'naltiruvchi matn faqat `StoreNotice` orqali', () {
      // MUHIMI QAYSI MATN EKANI.
      //
      // `nfcstore.uz` ilovada ko'p joyda uchraydi va ularning
      // aksariyati anti-steering'ga umuman aloqasiz: ulashish
      // havolasi (`nfcstore.uz/c/...`), API manzili, Sozlamalardagi
      // "bizning saytimiz" kartasi. Bularni o'chirish ilovani
      // buzardi va Play'ning talabi ham bu emas.
      //
      // Xavfli narsa bitta: "buni saytdan sotib olasiz" degan
      // matn, ya'ni `storeBuyOnSite*` satrlari. Ular FAQAT
      // `StoreNotice` ichidan chiqishi kerak — aks holda kalit
      // ularni o'chira olmaydi va rad etishdan keyin yozuv
      // ilovada qolib ketadi.
      final leaks = <String>[];
      for (final f in Directory('lib').listSync(recursive: true)
          .whereType<File>()) {
        if (!f.path.endsWith('.dart')) continue;
        if (f.path.contains('/l10n/')) continue; // tarjima manbalari
        if (f.path.endsWith('store_policy.dart')) continue;
        final body = f.readAsStringSync();
        if (body.contains('storeBuyOnSite') && !body.contains('StoreNotice')) {
          leaks.add(f.path);
        }
      }
      expect(leaks, isEmpty,
          reason: 'xarid matni `StoreNotice` dan tashqarida ishlatilgan');
    });
  });

  /// DO'KON EKRANIDA BUZUQ TUGMA QOLMAGAN.
  ///
  /// Bu sinov ilgari teskarisini talab qilardi — "do'kon hamon
  /// to'lay oladi". O'shanda mantiq shunday edi: jismoniy tovar
  /// Play qoidasidan ozod, demak tugma qolsin.
  ///
  /// Mantiq to'g'ri, lekin tugmaning ISHLASHI tekshirilmagan edi.
  /// Tekshirilganda ma'lum bo'ldi: u buyurtma yaratmaydi, server
  /// tomonda esa bunday yo'l umuman yo'q. Ya'ni sinov ishlamaydigan
  /// narsani "bor" deb qo'riqlab turgan ekan.
  ///
  /// Endi teskarisi qo'riqlanadi: ekranda to'lov chaqiruvi
  /// QOLMASIN. Kimdir uni tuzatmasdan qaytarsa, CI yiqiladi va
  /// `canPayInApp()` izohidagi uchta shartni o'qishga majbur
  /// bo'ladi.
  test('do\'kon ekranida to\'lov chaqiruvi qolmagan', () {
    final src = File('lib/features/shop/shop_screens.dart').readAsStringSync();
    for (final marker in ['startPayment', 'PayProvider.payme', 'checkoutPayWith']) {
      expect(src.contains(marker), isFalse,
          reason: 'buzuq to\'lov yo\'li qaytib kelgan: `$marker`');
    }
  });
}
