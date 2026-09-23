import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/discover_repository.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/discover/catalog_view.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// Tanlov → Katalog.
class _Repo extends FakeDiscoverRepository {
  _Repo({this.fail});

  final AppError? fail;
  final calls = <({NfcProductType? category, CatalogSort sort, int page})>[];

  static final _all = [
    for (var i = 0; i < 25; i++)
      CatalogProduct(
        id: 'u$i',
        companyId: i.isEven ? 'KARTAUZ' : 'TECHSHOP',
        companyName: i.isEven ? 'Karta Uz' : 'Tech Shop',
        name: 'Tovar $i',
        price: 100000 + i * 1000,
        promotionPrice: i == 0 ? 85000 : null,
        category: i % 3 == 0 ? 'card' : 'sticker',
      ),
  ];

  @override
  Future<Result<CatalogFeedPage>> catalogFeed({
    int page = 1,
    int limit = 20,
    String q = '',
    NfcProductType? category,
    CatalogSort sort = CatalogSort.newest,
  }) async {
    calls.add((category: category, sort: sort, page: page));
    if (fail != null) return Err(fail!);
    final list =
        category == null ? _all : _all.where((p) => p.nfcType == category).toList();
    final start = (page - 1) * limit;
    final items = list.skip(start).take(limit).toList();
    return Ok(CatalogFeedPage(
      items: items,
      total: list.length,
      hasMore: start + items.length < list.length,
      counts: const {'all': 25, 'card': 9, 'sticker': 16},
    ));
  }
}

Future<ProviderContainer> _pump(WidgetTester tester, _Repo repo,
    {Size size = const Size(390, 844)}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final base = await testOverrides();
  final container = ProviderContainer(overrides: [
    ...base.where((o) => !identical(o, base[3])),
    discoverRepositoryProvider.overrideWithValue(repo),
  ]);
  addTearDown(container.dispose);
  await tester.pumpWidget(UncontrolledProviderScope(
    container: container,
    child: wrapScreen(
      const Scaffold(body: CatalogView(query: '')),
      tokens: NfcTokens.ivory,
    ),
  ));
  await settle(tester, frames: 10);
  return container;
}

void main() {
  for (final w in const [360.0, 390.0, 430.0]) {
    testWidgets('${w.toInt()}: to‘r, chiplar sonlari, sotuvchi va Business ID',
        (tester) async {
      final repo = _Repo();
      await _pump(tester, repo, size: Size(w, 800));
      final l = await L.delegate.load(const Locale('uz'));

      expect(tester.takeException(), isNull);
      expect(find.text('${l.catalogAll} · 25'), findsOneWidget);
      expect(find.text('${l.catalogCards} · 9'), findsOneWidget);
      expect(find.text(l.catalogCount(25)), findsOneWidget);
      expect(find.byType(ProductCard), findsWidgets);
      expect(find.text('Karta Uz'), findsWidgets);
      expect(find.text('KARTAUZ'), findsWidgets);
      // Chegirma: foiz belgisi va eski narx.
      expect(find.text('−15%'), findsOneWidget);
    });
  }

  testWidgets('tur chipi va saralash varag‘i serverga to‘g‘ri so‘rov yuboradi',
      (tester) async {
    final repo = _Repo();
    await _pump(tester, repo);
    final l = await L.delegate.load(const Locale('uz'));

    await tester.tap(find.byKey(const ValueKey('catalog-chip-card')));
    await settle(tester, frames: 6);
    expect(repo.calls.last.category, NfcProductType.card);
    expect(repo.calls.last.page, 1);

    await tester.tap(find.byKey(const ValueKey('catalog-sort')));
    await settle(tester, frames: 8);
    await tester.tap(find.byKey(const ValueKey('sort-price_asc')));
    await settle(tester, frames: 8);
    expect(repo.calls.last.sort, CatalogSort.priceAsc);
    expect(repo.calls.last.category, NfcProductType.card,
        reason: 'saralash tanlangan turni tashlab yubormasin');
    expect(find.textContaining(l.catalogSortPriceAsc), findsOneWidget);
  });

  testWidgets('oxiriga yaqinlashganda keyingi sahifa yuklanadi', (tester) async {
    final repo = _Repo();
    await _pump(tester, repo);
    for (var i = 0; i < 8; i++) {
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -900));
      await settle(tester, frames: 3);
    }
    expect(repo.calls.map((c) => c.page), contains(2));
    expect(find.text('Tovar 24'), findsOneWidget);
  });

  testWidgets('sevimli belgisi shu qurilmada saqlanadi', (tester) async {
    final repo = _Repo();
    final c = await _pump(tester, repo);
    final l = await L.delegate.load(const Locale('uz'));

    await tester.tap(find.bySemanticsLabel(l.catalogFavorite).first);
    await settle(tester, frames: 4);
    expect(c.read(catalogFavoritesProvider), contains('KARTAUZ/u0'));
    expect(c.read(prefsProvider).catalogFavorites, contains('KARTAUZ/u0'));
  });

  testWidgets('endpoint hali deploy qilinmagan — "tez orada", xato emas',
      (tester) async {
    await _pump(tester, _Repo(fail: const AppError(AppErrorKind.notFound)));
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.text(l.catalogSoon), findsOneWidget);
    expect(find.text(l.stateErrorTitle), findsNothing);
  });

  test('ilovada to‘lov yo‘q: katalog to‘lov ekraniga olib bormaydi', () {
    final src =
        File('lib/features/discover/catalog_view.dart').readAsStringSync();
    expect(src, isNot(contains('Routes.checkout')));
    expect(src, isNot(contains('payLink')));
    expect(src, contains('Routes.storefront(p.companyId)'));
  });
}
