import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/discover_repository.dart';
import 'package:nfcstore_nova/features/business/store_catalog.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// BIZNES VITRINASI VA KATALOG (premium redizayn, 2026-09-24).
///
/// Toifalar HAQIQIY ma'lumotdan (bo'lim yoki nom), soxta toifa yo'q;
/// profilda faqat 4 ta tovar; buyurtma mavjud server oqimiga boradi.

CatalogItem _item(
  int id,
  String name, {
  String cat = '',
  int price = 100,
  int? sale,
  String img = 'x.jpg',
  bool on = true,
}) => CatalogItem(
  id: id,
  ref: 'i$id',
  name: name,
  category: cat,
  price: price,
  salePrice: sale,
  imageUrl: img,
  available: on,
);

final _nfc = [
  _item(1, 'NFC ID Karta', sale: 90),
  _item(2, 'NFC Uzuk'),
  _item(3, 'NFC Brelok'),
  _item(4, 'NFC Sticker'),
  _item(5, 'NFC Stend'),
  _item(6, 'Korporativ NFC sovg‘a'),
  _item(7, 'NFC ID Sovg‘a Konverti'),
];

class _Biz extends BusinessRepository {
  _Biz({this.ordersOff = false}) : super(ApiClient());
  final bool ordersOff;
  final orders = <Map<String, Object>>[];

  @override
  Future<Result<Business>> byId(String companyId) async => Ok(
    Business(
      companyId: companyId,
      displayName: 'NFCSTORE',
      ordersEnabled: true,
    ),
  );

  @override
  Future<Result<List<CatalogItem>>> catalog(String companyId) async => Ok(_nfc);

  @override
  Future<Result<List<Post>>> posts(String companyId) async => const Ok([]);

  @override
  Future<Result<void>> order(
    String companyId, {
    String itemId = '',
    required String name,
    required String phone,
    int qty = 1,
    String note = '',
  }) async {
    if (ordersOff) {
      return const Err(
        AppError(AppErrorKind.conflict, code: 'orders_disabled'),
      );
    }
    orders.add({
      'id': companyId,
      'item': itemId,
      'name': name,
      'phone': phone,
      'qty': qty,
    });
    return const Ok(null);
  }
}

void main() {
  final L l = LUz();

  group('toifalar', () {
    test(
      'bo‘lim yo‘q — nomdan aniqlanadi, bo‘sh toifa yo‘q, Aksiyalar bor',
      () {
        final cats = storeCategories(l, _nfc);
        final ids = cats.map((c) => c.id).toList();
        expect(ids.first, 'all');
        expect(cats.first.items, hasLength(_nfc.length));
        expect(
          ids,
          containsAll([
            'kw:cards',
            'kw:rings',
            'kw:keychains',
            'kw:stickers',
            'kw:stands',
            'kw:gifts',
            'kw:business',
            'promo',
          ]),
        );
        expect(cats.every((c) => c.items.isNotEmpty), isTrue);
        // "Korporativ ... sovg'a" — biznes uchun, "Sovg'a konverti" — sovg'a.
        expect(
          cats.firstWhere((c) => c.id == 'kw:business').items.single.id,
          6,
        );
        expect(cats.firstWhere((c) => c.id == 'kw:gifts').items.single.id, 7);
        expect(cats.firstWhere((c) => c.id == 'promo').items.single.id, 1);
        // Toifa rasmi — o'z tovarining rasmi (demo emas).
        expect(cats.firstWhere((c) => c.id == 'kw:cards').image, 'x.jpg');
      },
    );

    test('biznes o‘z bo‘limlarini yozgan bo‘lsa — aynan o‘shalar', () {
      final items = [
        _item(1, 'Latte', cat: 'Ichimliklar'),
        _item(2, 'Espresso', cat: 'Ichimliklar'),
        _item(3, 'Tort', cat: 'Shirinliklar'),
      ];
      final cats = storeCategories(l, items);
      expect(cats.map((c) => c.label), [
        'Hammasi',
        'Ichimliklar',
        'Shirinliklar',
      ]);
      expect(cats[1].items, hasLength(2));
    });

    test('ajratib bo‘lmasa faqat "Hammasi"', () {
      final cats = storeCategories(l, [_item(1, 'Somsa'), _item(2, 'Palov')]);
      expect(cats.map((c) => c.id), ['all']);
    });

    test('profilda 4 ta: mavjud va rasmli tovarlar birinchi', () {
      final items = [
        _item(1, 'A', on: false),
        _item(2, 'B', img: ''),
        _item(3, 'C'),
        _item(4, 'D'),
        _item(5, 'E'),
        _item(6, 'F'),
      ];
      expect(featuredItems(items).map((i) => i.id), [3, 4, 5, 6]);
    });
  });

  test('Business: ish vaqti, hozir ochiq, buyurtma, daraja serverdan', () {
    final b = Business.fromJson({
      'companyId': 'ACME',
      'tier': 'gold',
      'ordersEnabled': true,
      'createdAt': '2026-09-20T10:00:00Z',
      'hours': [
        {'closed': true, 'open': '', 'close': ''},
        {'closed': false, 'open': '09:00', 'close': '18:00'},
      ],
      'openNow': {
        'open': true,
        'today': {'open': '09:00', 'close': '18:00'},
      },
    });
    expect(b.tier, 'gold');
    expect(b.ordersEnabled, isTrue);
    expect(b.openNow, isTrue);
    expect(b.todayOpen, '09:00');
    expect(b.todayClose, '18:00');
    expect(b.hasHours, isTrue);
    expect(b.createdAt, isNotNull);
    // Ish vaqti kiritilmagan — holat umuman ko'rsatilmaydi.
    expect(
      Business.fromJson({'companyId': 'X', 'openNow': null}).openNow,
      isNull,
    );
  });

  test(
    'biznes qidiruvi ommaviy ro‘yxat ichidan (ilgari doim bo‘sh edi)',
    () async {
      final repo = _Disc();
      final res = await repo.searchBusinesses('nfc');
      expect(res.valueOrNull!.map((b) => b.companyId), ['NFCSTOREUZ']);
      final byCity = await repo.searchBusinesses('andijon');
      expect(byCity.valueOrNull!.map((b) => b.companyId), ['CAFE']);
    },
  );

  group('to‘liq katalog sahifasi', () {
    Future<_Biz> pump(WidgetTester tester, {String cat = 'all'}) async {
      tester.view.physicalSize = const Size(390 * 3, 1400 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final biz = _Biz();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            ...await testOverrides(),
            businessRepositoryProvider.overrideWithValue(biz),
          ],
          child: wrapScreen(
            StoreCatalogScreen(companyId: 'NFCSTOREUZ', initialCategory: cat),
          ),
        ),
      );
      await settle(tester);
      return biz;
    }

    testWidgets('qidiruv, toifa va 2 ustunli to‘r', (tester) async {
      await pump(tester);
      expect(tester.takeException(), isNull);
      expect(find.byKey(const ValueKey('store-categories')), findsOneWidget);
      expect(find.byKey(const ValueKey('store-product-i1')), findsWidgets);

      await tester.enterText(
        find.byKey(const ValueKey('store-search')),
        'uzuk',
      );
      await settle(tester);
      expect(find.byKey(const ValueKey('store-product-i2')), findsOneWidget);
      expect(find.byKey(const ValueKey('store-product-i1')), findsNothing);
    });

    testWidgets('Aksiyalar toifasi — faqat chegirmali', (tester) async {
      await pump(tester, cat: 'promo');
      expect(find.byKey(const ValueKey('store-product-i1')), findsOneWidget);
      expect(find.byKey(const ValueKey('store-product-i3')), findsNothing);
      expect(find.text('−10%'), findsOneWidget);
    });
  });

  group('buyurtma', () {
    Future<void> open(WidgetTester tester, _Biz biz) async {
      tester.view.physicalSize = const Size(390 * 3, 900 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            ...await testOverrides(),
            businessRepositoryProvider.overrideWithValue(biz),
          ],
          child: wrapScreen(
            Scaffold(
              body: Builder(
                builder: (context) => Center(
                  child: TextButton(
                    onPressed: () => showOrderSheet(
                      context,
                      companyId: 'NFCSTOREUZ',
                      itemId: 'i1',
                      itemName: 'NFC ID Karta',
                    ),
                    child: const Text('open'),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await settle(tester);
    }

    testWidgets('yuboriladi: tovar, soni, ism va telefon', (tester) async {
      final biz = _Biz();
      await open(tester, biz);
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), 'Aziz');
      await tester.enterText(fields.at(1), '+998 90 123 45 67');
      await tester.tap(find.byKey(const ValueKey('order-plus')));
      await settle(tester);
      expect(find.text('2'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('order-send')));
      await settle(tester);
      expect(biz.orders.single, {
        'id': 'NFCSTOREUZ',
        'item': 'i1',
        'name': 'Aziz',
        'phone': '+998 90 123 45 67',
        'qty': 2,
      });
      expect(find.byKey(const ValueKey('order-sheet')), findsNothing);
      expect(find.text(l.orderSent), findsOneWidget);
    });

    testWidgets('telefon bo‘sh — yuborilmaydi', (tester) async {
      final biz = _Biz();
      await open(tester, biz);
      await tester.enterText(find.byType(TextField).at(1), '');
      await tester.tap(find.byKey(const ValueKey('order-send')));
      await settle(tester);
      expect(biz.orders, isEmpty);
      expect(find.byKey(const ValueKey('order-error')), findsOneWidget);
    });

    testWidgets('egasi o‘chirgan — sababi aytiladi, soxta muvaffaqiyat yo‘q', (
      tester,
    ) async {
      final biz = _Biz(ordersOff: true);
      await open(tester, biz);
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), 'Aziz');
      await tester.enterText(fields.at(1), '901234567');
      await tester.tap(find.byKey(const ValueKey('order-send')));
      await settle(tester);
      expect(find.text(l.orderDisabled), findsOneWidget);
      expect(find.text(l.orderSent), findsNothing);
    });
  });
}

class _Disc extends DiscoverRepository {
  _Disc() : super(ApiClient());

  @override
  Future<Result<List<Business>>> companies() async => const Ok([
    Business(
      companyId: 'NFCSTOREUZ',
      displayName: 'NFCSTORE',
      city: 'Toshkent',
    ),
    Business(companyId: 'CAFE', displayName: 'Bellissimo', city: 'Andijon'),
  ]);
}
