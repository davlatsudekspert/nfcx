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
  final calls = <({
    ListingKind? kind,
    MarketCategory? category,
    NfcProductType? sub,
    CatalogSort sort,
    int page
  })>[];

  // Umumiy katalog: ovqat, xizmatlar, elektronika (ichida NFC), kiyim.
  static final _all = [
    for (var i = 0; i < 25; i++)
      CatalogProduct(
        id: 'u$i',
        companyId: i.isEven ? 'KARTAUZ' : 'TECHSHOP',
        companyName: i.isEven ? 'Karta Uz' : 'Tech Shop',
        name: 'Tovar $i',
        price: i == 3 ? 0 : 100000 + i * 1000,
        priceOnRequest: i == 3,
        available: i != 5,
        promotionPrice: i == 0 ? 85000 : null,
        kind: i % 4 == 3 ? ListingKind.service : ListingKind.product,
        marketCategory: switch (i % 4) {
          0 => MarketCategory.electronics,
          1 => MarketCategory.food,
          2 => MarketCategory.fashion,
          _ => MarketCategory.beauty,
        },
        sub: i % 8 == 0 ? NfcProductType.card : null,
      ),
  ];

  @override
  Future<Result<CatalogFeedPage>> catalogFeed({
    int page = 1,
    int limit = 20,
    String q = '',
    ListingKind? kind,
    MarketCategory? category,
    NfcProductType? sub,
    CatalogSort sort = CatalogSort.newest,
  }) async {
    calls.add((kind: kind, category: category, sub: sub, sort: sort, page: page));
    if (fail != null) return Err(fail!);
    final list = _all
        .where((p) =>
            (kind == null || p.kind == kind) &&
            (category == null || p.marketCategory == category) &&
            (sub == null || p.sub == sub))
        .toList();
    final start = (page - 1) * limit;
    final items = list.skip(start).take(limit).toList();
    final counts = <String, int>{'all': _all.length};
    for (final p in _all) {
      counts[p.kind.name] = (counts[p.kind.name] ?? 0) + 1;
      counts[p.marketCategory.name] = (counts[p.marketCategory.name] ?? 0) + 1;
      if (p.sub != null) counts[p.sub!.name] = (counts[p.sub!.name] ?? 0) + 1;
    }
    return Ok(CatalogFeedPage(
      items: items,
      total: list.length,
      hasMore: start + items.length < list.length,
      counts: counts,
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
      // Umumiy: tovar/xizmat va global kategoriyalar, NFC emas.
      expect(find.text('${l.catalogKindProduct} · 19'), findsOneWidget);
      expect(find.text('${l.catalogKindService} · 6'), findsOneWidget);
      expect(find.text('${l.marketElectronics} · 7'), findsOneWidget);
      expect(find.text('${l.catalogCards} · 4'), findsNothing,
          reason: 'NFC turlari yuqori qatorda emas');
      expect(find.text(l.catalogCount(25)), findsOneWidget);
      expect(find.byType(ProductCard), findsWidgets);
      expect(find.text('Karta Uz'), findsWidgets);
      expect(find.text('KARTAUZ'), findsWidgets);
      // Chegirma: foiz belgisi va eski narx.
      expect(find.text('−15%'), findsOneWidget);
    });
  }

  testWidgets('kategoriya/tur chiplari va saralash varag‘i to‘g‘ri so‘rov yuboradi',
      (tester) async {
    final repo = _Repo();
    await _pump(tester, repo);
    final l = await L.delegate.load(const Locale('uz'));

    await tester.ensureVisible(find.byKey(const ValueKey('catalog-chip-service')));
    await tester.tap(find.byKey(const ValueKey('catalog-chip-service')));
    await settle(tester, frames: 6);
    expect(repo.calls.last.kind, ListingKind.service);
    expect(repo.calls.last.category, isNull);

    await tester.ensureVisible(find.byKey(const ValueKey('catalog-chip-food')));
    await tester.tap(find.byKey(const ValueKey('catalog-chip-food')));
    await settle(tester, frames: 6);
    expect(repo.calls.last.category, MarketCategory.food);
    expect(repo.calls.last.kind, isNull, reason: 'bitta qator — bitta tanlov');
    expect(repo.calls.last.page, 1);

    // Elektronika — ichida NFC sub-turlari ikkinchi qatorda.
    expect(find.byKey(const ValueKey('catalog-sub-card')), findsNothing);
    await tester.ensureVisible(find.byKey(const ValueKey('catalog-chip-electronics')));
    await tester.tap(find.byKey(const ValueKey('catalog-chip-electronics')));
    await settle(tester, frames: 6);
    await tester.ensureVisible(find.byKey(const ValueKey('catalog-sub-card')));
    await tester.tap(find.byKey(const ValueKey('catalog-sub-card')));
    await settle(tester, frames: 6);
    expect(repo.calls.last.category, MarketCategory.electronics);
    expect(repo.calls.last.sub, NfcProductType.card);

    await tester.tap(find.byKey(const ValueKey('catalog-sort')));
    await settle(tester, frames: 8);
    await tester.tap(find.byKey(const ValueKey('sort-price_asc')));
    await settle(tester, frames: 8);
    expect(repo.calls.last.sort, CatalogSort.priceAsc);
    expect(repo.calls.last.category, MarketCategory.electronics,
        reason: 'saralash tanlangan kategoriyani tashlab yubormasin');
    expect(find.textContaining(l.catalogSortPriceAsc), findsOneWidget);
  });

  testWidgets('bo‘sh kategoriya chipi ko‘rsatilmaydi (dinamik)', (tester) async {
    await _pump(tester, _Repo());
    expect(find.byKey(const ValueKey('catalog-chip-auto')), findsNothing);
    expect(find.byKey(const ValueKey('catalog-chip-health')), findsNothing);
    expect(find.byKey(const ValueKey('catalog-chip-food')), findsOneWidget);
  });

  testWidgets('narx kelishiladi va mavjud emas kartochkada ko‘rinadi',
      (tester) async {
    await _pump(tester, _Repo());
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.byKey(const ValueKey('price-on-request')), findsWidgets);
    expect(find.text(l.catalogPriceOnRequest), findsWidgets);
    expect(find.byKey(const ValueKey('badge-unavailable')), findsOneWidget);
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
