import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/business/business_intro.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:nfcstore_nova/features/business/business_screens.dart'
    show formatMoney;
import 'package:nfcstore_nova/features/business/sample_businesses.dart';
import 'package:nfcstore_nova/features/nfc/nfc_ids_screen.dart';
import 'package:nfcstore_nova/features/settings/settings_screen.dart';
import 'package:nfcstore_nova/features/settings/settings_subscreens.dart';
import 'package:nfcstore_nova/features/shop/nfc_id_market.dart';
import 'package:nfcstore_nova/features/shop/shop_screens.dart';
import 'package:nfcstore_nova/features/shop/store_policy.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// BUYURTMALAR VA iPHONE (egasi, 2026-10-04, iPhone surati).
///
/// Surat: "Buyurtma №61 / cancelled / 149 000 so'm / [cancelled]" —
/// xom inglizcha holat ikki marta, ro'yxatning ko'pi bekor qilingan,
/// iPhone'da raqamli xarid narxi. Egasining qarori: "kerak bo'lmasa —
/// olib tashla, App Store shu sababli rad etmasin".
///
/// Har tekshiruv ikki tomonlama (`app_store_policy_test.dart` kabi):
/// Android'da BOR, iPhone'da YO'Q.
final _orders = [
  Order(
    id: 61,
    status: 'cancelled',
    total: 149000,
    kind: OrderKind.nfcId,
    code: 'ALI1',
    createdAt: DateTime(2026, 9, 20, 12),
  ),
  Order(
    id: 62,
    status: 'paid',
    total: 500000,
    kind: OrderKind.nfcId,
    code: 'VIP001',
    createdAt: DateTime(2026, 9, 28, 12),
  ),
  Order(
    id: 63,
    status: 'pending',
    total: 120000,
    kind: OrderKind.physicalCard,
    code: 'VIP001',
    createdAt: DateTime(2026, 10, 1, 12),
  ),
  const Order(
    id: 64,
    status: 'cancelled',
    total: 99000,
    kind: OrderKind.premium,
    code: 'PREMIUM',
  ),
];

Finder _order(int id) => find.byKey(ValueKey('order-$id'));

Future<L> _pumpOrders(WidgetTester tester, List<Order> orders) async {
  tester.view.physicalSize = const Size(393 * 3, 1400 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...await testOverrides(),
      ordersProvider.overrideWith((ref) async => orders),
    ],
    child: wrapScreen(const OrdersScreen()),
  ));
  await settle(tester);
  return L.delegate.load(const Locale('uz'));
}

/// Ekranni uzun "telefon"da ochadi — ro'yxat dangasa quriladi, pastdagi
/// bandlar ham chizilsin.
Future<L> _pumpTall(WidgetTester tester, Widget child,
    {List<Override> overrides = const []}) async {
  tester.view.physicalSize = const Size(393 * 3, 4000 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [...await testOverrides(), ...overrides],
    child: wrapScreen(child),
  ));
  await settle(tester, frames: 14);
  return L.delegate.load(const Locale('uz'));
}

final _ios = TargetPlatformVariant.only(TargetPlatform.iOS);

void main() {
  group('summa qoidasi (`showOrderAmount`)', () {
    test('Android: hamma turda summa bor', () {
      for (final k in [
        OrderKind.nfcId,
        OrderKind.premium,
        OrderKind.premiumFollow,
        OrderKind.auction,
        OrderKind.featured,
        OrderKind.physicalCard,
        'yangi_tur',
      ]) {
        expect(showOrderAmount(k), isTrue, reason: k);
      }
      expect(showOrdersEntry, isTrue);
    });

    group('iPhone', () {
      setUp(() => debugDefaultTargetPlatformOverride = TargetPlatform.iOS);
      tearDown(() => debugDefaultTargetPlatformOverride = null);

      test('raqamli va noma’lum tur — summa yo‘q; jismoniy karta — bor', () {
        for (final k in [
          OrderKind.nfcId,
          OrderKind.premium,
          OrderKind.premiumFollow,
          OrderKind.auction,
          OrderKind.featured,
          'yangi_tur',
        ]) {
          expect(showOrderAmount(k), isFalse, reason: k);
        }
        expect(showOrderAmount(OrderKind.physicalCard), isTrue);
        expect(showOrdersEntry, isFalse);
      });
    });
  });

  group('holat tarjimasi', () {
    final l = LUz();
    final t = NfcTokens.ivory;

    test('server lug‘ati: pending / paid / cancelled / failed_code_taken',
        () {
      expect(orderStatusView(l, t, 'paid'),
          (text: l.payStatusPaid, tone: t.success));
      expect(orderStatusView(l, t, 'pending'),
          (text: l.payStatusPending, tone: t.warn));
      expect(orderStatusView(l, t, 'cancelled'),
          (text: l.payStatusCancelled, tone: t.text3));
      expect(orderStatusView(l, t, 'failed_code_taken'),
          (text: l.payStatusFailed, tone: t.error));
      expect(orderStatusView(l, t, 'new').text, l.orderStatusNew);
      expect(orderStatusView(l, t, 'expired').text, l.orderStatusExpired);
    });

    test('noma’lum holat — o‘zicha', () {
      expect(orderStatusView(l, t, 'refund_review').text, 'refund_review');
    });

    test('yig‘iladiganlar: cancelled, expired; pul to‘langan xato — yo‘q', () {
      expect(isInactiveOrder('cancelled'), isTrue);
      expect(isInactiveOrder('expired'), isTrue);
      expect(isInactiveOrder('failed_code_taken'), isFalse);
      expect(isInactiveOrder('pending'), isFalse);
      expect(isInactiveOrder('paid'), isFalse);
    });
  });

  group('Buyurtmalar ekrani', () {
    testWidgets('Android: summa va tarjima; bekor qilinganlar tugma ortida',
        (tester) async {
      final l = await _pumpOrders(tester, _orders);
      expect(tester.takeException(), isNull);

      // Faollar — summasi va tarjima qilingan holati bilan.
      expect(_order(62), findsOneWidget);
      expect(_order(63), findsOneWidget);
      expect(find.text(formatMoney(500000, 'UZS')), findsOneWidget);
      expect(find.text(formatMoney(120000, 'UZS')), findsOneWidget);
      expect(find.text(l.payStatusPaid), findsOneWidget);
      expect(find.text(l.payStatusPending), findsOneWidget);
      for (final raw in ['paid', 'pending', 'cancelled']) {
        expect(find.text(raw), findsNothing, reason: 'xom holat: $raw');
      }

      // Izoh — NIMA olingani va sana, holat emas.
      expect(find.text('NFC ID VIP001 · 28.09.2026'), findsOneWidget);
      expect(find.text('${l.payKindPhysical} · VIP001 · 01.10.2026'),
          findsOneWidget);

      // Bekor qilinganlar — yashirin, pastda tugma.
      expect(_order(61), findsNothing);
      expect(_order(64), findsNothing);
      expect(find.text(formatMoney(149000, 'UZS')), findsNothing);
      expect(find.text(l.ordersInactiveShow(2)), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('orders-inactive-toggle')));
      await settle(tester);
      expect(_order(61), findsOneWidget);
      expect(_order(64), findsOneWidget);
      expect(find.text(l.payStatusCancelled), findsNWidgets(2));
      expect(find.text(formatMoney(149000, 'UZS')), findsOneWidget);
      expect(find.text(l.payKindPremium), findsOneWidget);
      // Faollar tepada qoladi.
      expect(tester.getTopLeft(_order(63)).dy,
          lessThan(tester.getTopLeft(_order(61)).dy));

      await tester.tap(find.text(l.ordersInactiveHide));
      await settle(tester);
      expect(_order(61), findsNothing);
      expect(find.text(l.ordersInactiveShow(2)), findsOneWidget);
    });

    testWidgets('Android: hammasi bekor qilingan — "Faol buyurtmalar yo‘q"',
        (tester) async {
      final l = await _pumpOrders(tester, [_orders[0], _orders[3]]);
      expect(find.byKey(const ValueKey('orders-no-active')), findsOneWidget);
      expect(find.text(l.ordersNoActive), findsOneWidget);
      expect(_order(61), findsNothing);

      await tester.tap(find.text(l.ordersInactiveShow(2)));
      await settle(tester);
      expect(_order(61), findsOneWidget);
      expect(_order(64), findsOneWidget);
    });

    testWidgets('Android: pul to‘langan xato yig‘ilmaydi, noma’lum holat o‘zicha',
        (tester) async {
      final l = await _pumpOrders(tester, const [
        Order(
            id: 70,
            status: 'failed_code_taken',
            total: 300000,
            kind: OrderKind.nfcId,
            code: 'GOLD7'),
        Order(id: 71, status: 'refund_review', kind: OrderKind.physicalCard),
      ]);
      expect(_order(70), findsOneWidget);
      expect(find.text(l.payStatusFailed), findsOneWidget);
      expect(find.text('refund_review'), findsOneWidget);
      expect(find.byKey(const ValueKey('orders-inactive-toggle')), findsNothing);
    });

    testWidgets('iPhone: faqat jismoniy karta, summasi bilan; raqamli yo‘q',
        (tester) async {
      final l = await _pumpOrders(tester, _orders);
      expect(tester.takeException(), isNull);
      expect(_order(63), findsOneWidget);
      expect(find.text(formatMoney(120000, 'UZS')), findsOneWidget);
      expect(find.text(l.payStatusPending), findsOneWidget);

      // Raqamli xarid — na o'zi, na narxi.
      expect(_order(62), findsNothing);
      expect(find.text(formatMoney(500000, 'UZS')), findsNothing);
      expect(find.textContaining('NFC ID VIP001'), findsNothing);
      // Bekor qilinganlar ham raqamli edi — tugma ham yo'q.
      expect(find.byKey(const ValueKey('orders-inactive-toggle')), findsNothing);
      expect(find.text(formatMoney(149000, 'UZS')), findsNothing);
    }, variant: _ios);
  });

  group('Sozlamalar', () {
    testWidgets('Android: Buyurtmalar, Referal va sayt kartasi bor',
        (tester) async {
      final l = await _pumpTall(tester, const SettingsScreen());
      expect(find.text(l.settingsShopSection.toUpperCase()), findsOneWidget);
      expect(find.text(l.orders), findsOneWidget);
      expect(find.text(l.settingsReferral), findsOneWidget);
      expect(find.text(l.siteCardBody), findsOneWidget);
    });

    testWidgets('iPhone: Buyurtmalar, Referal, bo‘sh sarlavha, sayt kartasi yo‘q',
        (tester) async {
      final l = await _pumpTall(tester, const SettingsScreen());
      expect(tester.takeException(), isNull);
      expect(find.text(l.orders), findsNothing);
      expect(find.text(l.settingsReferral), findsNothing);
      expect(find.text(l.settingsShopSection.toUpperCase()), findsNothing,
          reason: 'bandsiz sarlavha qolmasin');
      expect(find.text(l.siteCardTitle), findsNothing);
      expect(find.text(l.siteCardBody), findsNothing);
      // Qolgan menyu joyida.
      expect(find.text(l.settingsSupport.toUpperCase()), findsOneWidget);
      expect(find.text(l.settingsAbout), findsOneWidget);
      expect(find.text(l.logout), findsOneWidget);
    }, variant: _ios);

    // iPhone'da bu ekranga yo'l yo'q (`showNotificationSettings`,
    // `app_store_ios_fixes_test.dart`). Baribir ochilsa — iPhone'da
    // yo'q bo'limlar (Buyurtmalar, Yangiliklar) uchun tanlov ham yo'q.
    testWidgets('Bildirishnomalar (iPhone): "Buyurtmalar" va "Yangiliklar" yo‘q',
        (tester) async {
      final l = await _pumpTall(tester, const NotificationsSettingsScreen());
      expect(find.text(l.orders), findsNothing);
      expect(find.text(l.settingsNews), findsNothing);
      expect(find.text(l.nfcScans), findsOneWidget);
    }, variant: _ios);

    testWidgets('Bildirishnomalar (Android): "Buyurtmalar" tanlovi bor',
        (tester) async {
      final l = await _pumpTall(tester, const NotificationsSettingsScreen());
      expect(find.text(l.orders), findsOneWidget);
      expect(find.text(l.settingsNews), findsOneWidget);
    });

    testWidgets('NFC ID’larim bo‘sh — iPhone’da bo‘sh Do‘konga tugma yo‘q',
        (tester) async {
      final l = await _pumpTall(tester, const NfcIdsScreen(),
          overrides: [myIdsProvider.overrideWithValue(const [])]);
      expect(find.text(l.homeNoId), findsOneWidget);
      expect(find.text(l.homeShop), findsNothing);
      expect(find.text(l.homeNoIdHint), findsNothing);
    }, variant: _ios);

    testWidgets('NFC ID’larim bo‘sh — Android’da Do‘kon tugmasi bor',
        (tester) async {
      final l = await _pumpTall(tester, const NfcIdsScreen(),
          overrides: [myIdsProvider.overrideWithValue(const [])]);
      expect(find.text(l.homeShop), findsOneWidget);
    });

    for (final ios in [false, true]) {
      testWidgets(
          'Biznes ochish: Premium ID varianti ${ios ? 'iPhone’da yo‘q' : 'Android’da bor'}',
          (tester) async {
        await _pumpTall(tester, const Scaffold(body: BusinessIntroBody()),
            overrides: [
              sampleBusinessesProvider.overrideWith((ref) async => const []),
              myBusinessesProvider.overrideWith((ref) async => const []),
            ]);
        expect(find.byKey(const ValueKey('biz-option-free')), findsOneWidget);
        expect(find.byKey(const ValueKey('biz-option-premium')),
            ios ? findsNothing : findsOneWidget);
      }, variant: ios ? _ios : TargetPlatformVariant.only(TargetPlatform.android));
    }
  });

  group('Do‘kon va NFC ID qidiruvi: "Buyurtmalar" tugmasi', () {
    for (final ios in [false, true]) {
      testWidgets('Do‘kon — ${ios ? 'iPhone’da yo‘q' : 'Android’da bor'}',
          (tester) async {
        await _pumpTall(tester, const ShopScreen(), overrides: [
          shopProductsProvider.overrideWith((ref) async => const []),
        ]);
        expect(find.byKey(const ValueKey('shop-orders')),
            ios ? findsNothing : findsOneWidget);
      }, variant: ios ? _ios : TargetPlatformVariant.only(TargetPlatform.android));

      testWidgets(
          'NFC ID qidiruvi — ${ios ? 'iPhone’da tugma yo‘q, nomi "ID qidirish"' : 'Android’da bor'}',
          (tester) async {
        final l = await _pumpTall(tester, const NfcIdMarketScreen(),
            overrides: [
              idPricingProvider.overrideWith((ref) async => const [
                    IdTier(tier: 'gold', price: 500000),
                  ]),
            ]);
        expect(find.byKey(const ValueKey('id-market-orders')),
            ios ? findsNothing : findsOneWidget);
        expect(find.text(ios ? l.idSearchShort : l.idMarketTitle),
            findsOneWidget);
        expect(find.text(ios ? l.idMarketTitle : l.idSearchShort),
            findsNothing);
      }, variant: ios ? _ios : TargetPlatformVariant.only(TargetPlatform.android));
    }

    test('ID holati: iPhone’da savdo so‘zi yo‘q', () {
      final l = LUz();
      final t = NfcTokens.ivory;
      const free = IdQuote(code: 'VIP777', purchasable: true);
      const taken = IdQuote(code: 'VIP001', taken: true);
      expect(quoteState(l, t, free).text, l.idStateAvailable);
      expect(quoteState(l, t, taken).text, l.idStateTaken);
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      try {
        expect(quoteState(l, t, free).text, l.idStateAvailableIos);
        expect(quoteState(l, t, taken).text, l.idStateTakenIos);
      } finally {
        debugDefaultTargetPlatformOverride = null;
      }
    });
  });

  /// Widget testi har yo'lni qamrab olmaydi — "Buyurtmalar"ga olib
  /// boradigan HAR BIR tugma `showOrdersEntry` bilan o'ralgani manbadan
  /// tekshiriladi. Yangi tugma kalitsiz qo'shilsa — iPhone'da ekran
  /// qaytib chiqadi.
  test('manba: Routes.orders ga har bir o‘tish `showOrdersEntry` ortida', () {
    final files = Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'));
    final pushes = RegExp(r'(push|pushReplacement|go)\(Routes\.orders\)');
    var seen = 0;
    for (final f in files) {
      final src = f.readAsStringSync();
      for (final m in pushes.allMatches(src)) {
        seen++;
        // Tugma bloki — o'tishdan oldingi 400 belgi ichida kalit bor.
        final before = src.substring((m.start - 400).clamp(0, m.start), m.start);
        expect(before, contains('showOrdersEntry'),
            reason: '${f.path}: Routes.orders kalitsiz');
      }
    }
    expect(seen, greaterThanOrEqualTo(4));
  });
}
