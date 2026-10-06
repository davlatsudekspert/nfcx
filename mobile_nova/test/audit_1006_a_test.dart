import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/shop_repository.dart';
import 'package:nfcstore_nova/design/widgets/states.dart';
import 'package:nfcstore_nova/features/nfc/nfc_misc_screens.dart';
import 'package:nfcstore_nova/features/shop/shop_screens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// AUDIT 2026-10-06 (1-qism): parol xatosi sessiyani yopmaydi; do'kon
/// va NFC tarixi server javobining HAQIQIY shaklidan quriladi.

const _pricing = <String, dynamic>{
  'tiers': [
    {'minQty': 50, 'maxQty': null, 'pricePerUnit': 75000},
    {'minQty': 1, 'maxQty': 9, 'pricePerUnit': 120000},
    {'minQty': 10, 'maxQty': 49, 'pricePerUnit': 95000},
  ],
  'delivery': {'minDays': 3, 'maxDays': 5},
  'physicalCardFee': 200000,
};

class _Shop extends ShopRepository {
  _Shop() : super(ApiClient());
  @override
  Future<Result<List<ShopProduct>>> products() async =>
      Ok(ShopRepository.physicalProductsFromPricing(_pricing));
}

Future<L> _uz() => L.delegate.load(const Locale('uz'));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('1. joriy parol xato — sessiya JOYIDA', () {
    ApiClient client() {
      final api = ApiClient();
      addTearDown(() {
        api.online.dispose();
        api.sessionExpired.dispose();
      });
      api.debugSetTokenForTest('tok');
      return api;
    }

    test('401 bad_current_password chiqarib yubormaydi', () async {
      final api = client();
      final before = api.sessionExpired.value;
      final e = api.debugHandleStatus(401, '/api/settings/change-password-direct',
          {'error': 'bad_current_password'});
      expect(api.sessionExpired.value, before);
      expect(api.token, 'tok', reason: 'token o‘chmadi');
      expect(e.code, 'bad_current_password');
      expect(describeError(await _uz(), e), (await _uz()).errBadCurrentPassword);
    });

    test('kod boshqa yo‘lda kelsa ham — sessiya joyida', () {
      final api = client();
      final before = api.sessionExpired.value;
      api.debugHandleStatus(
          401, '/api/settings/other', {'error': 'bad_current_password'});
      expect(api.sessionExpired.value, before);
    });

    test('oddiy 401 esa avvalgidek sessiyani yopadi', () {
      final api = client();
      final before = api.sessionExpired.value;
      api.debugHandleStatus(401, '/api/my/analytics', {'error': 'unauthorized'});
      expect(api.sessionExpired.value, greaterThan(before));
    });

    test('uch tilda matn', () async {
      for (final c in ['uz', 'ru', 'en']) {
        final l = await L.delegate.load(Locale(c));
        expect(
            describeError(
                l,
                const AppError(AppErrorKind.unauthorized,
                    code: 'bad_current_password')),
            l.errBadCurrentPassword);
      }
    });
  });

  group('2. do‘kon — jismoniy karta narx javobidan', () {
    test('mahsulot: narx = physicalCardFee, tiers tartiblangan, muddat', () {
      final list = ShopRepository.physicalProductsFromPricing(_pricing);
      expect(list, hasLength(1));
      final p = list.single;
      expect(p.isPhysicalCard, isTrue);
      expect(p.price, 200000);
      expect(p.priceTiers.map((t) => t.minQty), [1, 10, 50]);
      expect(p.priceTiers.last.maxQty, isNull);
      expect([p.deliveryMinDays, p.deliveryMaxDays], [3, 5]);
    });

    test('fee yo‘q — eng kichik tier narxi; hech narsa yo‘q — bo‘sh', () {
      expect(
          ShopRepository.physicalProductsFromPricing(const {
            'tiers': [
              {'minQty': 1, 'maxQty': 9, 'pricePerUnit': 120000}
            ]
          }).single.price,
          120000);
      expect(ShopRepository.physicalProductsFromPricing(const {}), isEmpty);
    });

    testWidgets('Android: do‘kon BO‘SH EMAS — karta va narx', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          shopRepositoryProvider.overrideWithValue(_Shop()),
        ],
        child: wrapScreen(const ShopScreen()),
      ));
      await settle(tester);
      final l = await _uz();
      expect(find.text(l.shopPhysicalCard), findsOneWidget);
      expect(find.text(l.stateEmpty), findsNothing);
    });

    testWidgets('mahsulot ekrani: ko‘p dona narxlari va muddat', (tester) async {
      tester.view.physicalSize = const Size(390 * 3, 1600 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          shopRepositoryProvider.overrideWithValue(_Shop()),
        ],
        child: wrapScreen(const ShopProductScreen(id: kPhysicalCardId)),
      ));
      await settle(tester);
      final l = await _uz();
      expect(find.text(l.shopPhysicalCard), findsOneWidget);
      expect(find.text(l.shopDelivery(3, 5)), findsOneWidget);
      expect(find.byKey(const ValueKey('shop-tiers')), findsOneWidget);
      expect(find.text(l.shopBulkTier(1, 9)), findsOneWidget);
      expect(find.text(l.shopBulkTierOpen(50)), findsOneWidget);
    });

    testWidgets('16. Android checkout: jismoniy karta matni', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [...await testOverrides()],
        child: wrapScreen(const CheckoutScreen(
            product: ShopProduct(id: kPhysicalCardId, price: 200000))),
      ));
      await settle(tester);
      final l = await _uz();
      expect(find.text(l.storeBuyOnSitePhysical), findsOneWidget);
      expect(find.text(l.storeBuyOnSiteId), findsNothing);
    });
  });

  group('3. NFC ID tarixi — yig‘ma ko‘rsatkichlar', () {
    const json = {
      'advanced': true,
      'days': 30,
      'totalViews': 42,
      'uniqueVisitors': 17,
      'byType': {'profile_view': 42, 'phone_click': 5, 'contact_save': 2},
      'byDay': [
        {'day': '2026-10-05', 'n': 10},
        {'day': '2026-10-06', 'n': 32},
      ],
      'byRef': [
        {'ref': 'instagram', 'n': 4}
      ],
    };

    test('server javobi o‘qiladi', () {
      final a = CardAnalytics.fromJson(json);
      expect([a.totalViews, a.uniqueVisitors, a.days], [42, 17, 30]);
      expect(a.byType['phone_click'], 5);
      expect(a.byDay.map((d) => d.day), ['2026-10-05', '2026-10-06']);
      expect(a.byRef.single.ref, 'instagram');
      expect(a.isEmpty, isFalse);
      expect(CardAnalytics.fromJson(const {'advanced': false}).isEmpty, isTrue);
    });

    testWidgets('ekran: ko‘rishlar, harakatlar, kunlar, manbalar',
        (tester) async {
      tester.view.physicalSize = const Size(390 * 3, 1800 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          nfcHistoryProvider
              .overrideWith((ref) async => CardAnalytics.fromJson(json)),
        ],
        child: wrapScreen(const NfcHistoryScreen()),
      ));
      await settle(tester);
      final l = await _uz();
      expect(find.byKey(const ValueKey('nfc-history-summary')), findsOneWidget);
      expect(find.text('42'), findsWidgets);
      expect(find.text('17'), findsOneWidget);
      expect(find.text(l.nfcEventType('phone_click')), findsOneWidget);
      expect(find.text(l.nfcEventType('contact_save')), findsOneWidget);
      expect(find.text('06.10.2026'), findsOneWidget);
      expect(find.text('instagram'), findsOneWidget);
      expect(find.byType(RefreshIndicator), findsOneWidget);
    });

    testWidgets('ma’lumot yo‘q — bo‘sh holat', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          nfcHistoryProvider.overrideWith(
              (ref) async => CardAnalytics.fromJson(const {})),
        ],
        child: wrapScreen(const NfcHistoryScreen()),
      ));
      await settle(tester);
      expect(find.byKey(const ValueKey('nfc-history-empty')), findsOneWidget);
    });

    test('noma’lum hodisa turi — umumiy yorliq', () async {
      final l = await _uz();
      expect(l.nfcEventType('something_new'), isNotEmpty);
    });
  });
}
