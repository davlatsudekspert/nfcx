import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/discover_repository.dart';
import 'package:nfcstore_nova/features/discover/catalog_view.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/home/widgets/nfc_mobile_section.dart';

import 'helpers.dart';

/// ASOSIYDAGI «TANLOVDAN» QATORI.
///
/// Katalogning eng ko'p ko'rilgan tovar va xizmatlari NFC Mobile
/// (demo kartalar) bo'limidan KEYIN, lentadan OLDIN turadi. Postlar
/// joyida qoladi. Katalog bo'sh yoki kelmasa qator umuman chizilmaydi.
class _Repo extends FakeDiscoverRepository {
  _Repo({this.items = const [], this.fail = false});

  final List<CatalogProduct> items;
  final bool fail;
  final calls = <({int limit, CatalogSort sort})>[];

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
    calls.add((limit: limit, sort: sort));
    if (fail) return const Err(AppError(AppErrorKind.offline));
    return Ok(CatalogFeedPage(items: items, total: items.length));
  }
}

CatalogProduct _p(int i) => CatalogProduct(
      id: 'p$i',
      companyId: 'SHOP',
      companyName: 'Do‘kon',
      name: 'Tovar $i',
      price: 100000 + i,
    );

void main() {
  Future<_Repo> pumpHome(WidgetTester tester, _Repo repo) async {
    // Baland oyna: bosh sahifa dangasa ro'yxat, pastdagi bo'limlar
    // faqat ko'rinsa quriladi.
    tester.view.physicalSize = const Size(1080, 9000);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        discoverRepositoryProvider.overrideWithValue(repo),
      ],
      child: wrapScreen(const HomeScreen()),
    ));
    await settle(tester, frames: 25);
    return repo;
  }

  testWidgets('ommabop tartibda so‘raladi va kartalar chiziladi', (tester) async {
    final repo = await pumpHome(tester, _Repo(items: [_p(1), _p(2), _p(3)]));
    expect(repo.calls, isNotEmpty);
    expect(repo.calls.last.sort, CatalogSort.popular);
    expect(repo.calls.last.limit, HomeCatalogRow.limit);
    expect(find.byKey(const ValueKey('home-catalog-row')), findsOneWidget);
    expect(find.text('Tovar 1'), findsOneWidget);
    expect(find.text('Hammasi'), findsOneWidget);
    // Server tartibi saqlanadi — ilova qayta saralamaydi.
    final x1 = tester.getTopLeft(find.text('Tovar 1')).dx;
    final x2 = tester.getTopLeft(find.text('Tovar 2')).dx;
    expect(x1, lessThan(x2));
    expect(tester.takeException(), isNull);
  });

  testWidgets('joyi: NFC Mobile (demo) dan keyin, lentadan oldin', (tester) async {
    await pumpHome(tester, _Repo(items: [_p(1)]));
    final demo = tester.getTopLeft(find.byType(NfcMobileSection)).dy;
    final row = tester.getTopLeft(find.byKey(const ValueKey('home-catalog-row'))).dy;
    final feed = tester.getTopLeft(find.text('LENTA')).dy;
    expect(demo, lessThan(row), reason: 'demo kartalar joyida qolishi kerak');
    expect(row, lessThan(feed), reason: 'postlar qatordan keyin turadi');
  });

  testWidgets('katalog bo‘sh — qator YO‘Q, lenta joyida', (tester) async {
    await pumpHome(tester, _Repo());
    expect(find.byKey(const ValueKey('home-catalog-row')), findsNothing);
    expect(find.byType(NfcMobileSection), findsOneWidget);
    expect(find.text('LENTA'), findsOneWidget);
  });

  testWidgets('katalog kelmasa — bosh sahifa yiqilmaydi', (tester) async {
    await pumpHome(tester, _Repo(fail: true));
    expect(find.byKey(const ValueKey('home-catalog-row')), findsNothing);
    expect(find.text('LENTA'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('tovar sahifasi ochilganda ko‘rish sanaladi', (tester) async {
    final repo = _Repo();
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        discoverRepositoryProvider.overrideWithValue(repo),
      ],
      child: wrapScreen(CatalogProductScreen(
        companyId: 'SHOP',
        itemId: 'p7',
        initial: _p(7),
      )),
    ));
    await settle(tester, frames: 10);
    expect(repo.viewed, ['p7']);
    // Qayta chizish qayta sanamaydi (bir marta — initState'da).
    await tester.pump(const Duration(milliseconds: 100));
    expect(repo.viewed, ['p7']);
  });

  test('saralash ro‘yxatida «Ommabop» bor', () {
    expect(CatalogSort.values.map((s) => s.wire), contains('popular'));
  });
}
