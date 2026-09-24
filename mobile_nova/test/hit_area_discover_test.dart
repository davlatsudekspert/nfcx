import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/discover_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/surfaces.dart';
import 'package:nfcstore_nova/features/business/business_forms.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:nfcstore_nova/features/discover/catalog_view.dart';
import 'package:nfcstore_nova/features/discover/discover_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/shop/shop_screens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

/// TANLOV: BOSISH MAYDONI VA KESILGAN YORLIQLAR (UI-2, UI-3, UI-4, UI-11).
///
/// Qoida — KO'RINISH O'ZGARMAYDI:
///   * belgi va matn aynan avvalgi joyida (quyidagi `before` qiymatlari
///     tuzatishdan OLDINGI kodda o'lchangan, 777a909);
///   * bosish maydoni faqat shaffof chekka bilan kattalashadi;
///   * boshqa elementlar surilmaydi.
///
/// Kesilgan yorliq tekshiruvi: `RenderParagraph` balandligi matnning
/// o'z balandligidan kichik bo'lsa, u pastdan kesib chiziladi
/// (`overflow: ellipsis` — kesish). Eski kodda: 15 va 19 (1.0 da
/// NFC qatori), 19 va 25 (1.3 da tablar).

// ─── umumiy ───────────────────────────────────────────────────────

RenderParagraph _label(WidgetTester tester, Finder capsule) =>
    tester.renderObject<RenderParagraph>(find.descendant(
        of: find.descendant(of: capsule, matching: find.byType(Text)),
        matching: find.byType(RichText)));

Finder _labelFinder(Finder capsule) =>
    find.descendant(of: capsule, matching: find.byType(Text));

Finder _iconFinder(Finder capsule) =>
    find.descendant(of: capsule, matching: find.byType(Icon));

/// Matn to'liq chizilishi uchun kerak bo'lgan balandlik.
double _need(RenderParagraph p) => (TextPainter(
      text: p.text,
      textScaler: p.textScaler,
      textDirection: TextDirection.ltr,
      maxLines: p.maxLines,
      strutStyle: p.strutStyle,
      textHeightBehavior: p.textHeightBehavior,
    )..layout(maxWidth: p.constraints.maxWidth))
        .height;

void _expectUnclipped(WidgetTester tester, Finder capsule, String what) {
  final p = _label(tester, capsule);
  expect(p.size.height, greaterThanOrEqualTo(_need(p) - 0.5),
      reason: '$what: yorliq kesilgan '
          '(${p.size.height} < ${_need(p)})');
}

void _setScale(WidgetTester tester, double s, {Size size = const Size(390, 844)}) {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  tester.platformDispatcher.textScaleFactorTestValue = s;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
}

// ─── Katalog (UI-2) ───────────────────────────────────────────────

class _Catalog extends FakeDiscoverRepository {
  // Yarmi elektronika (NFC sub-turlari bilan), yarmi ovqat.
  static final _all = [
    for (var i = 0; i < 12; i++)
      CatalogProduct(
        id: 'u$i',
        companyId: 'TECHSHOP',
        companyName: 'Tech Shop',
        name: 'Tovar $i',
        price: 100000 + i * 1000,
        marketCategory:
            i.isEven ? MarketCategory.electronics : MarketCategory.food,
        sub: i.isEven ? NfcProductType.values[(i ~/ 2) % 4] : null,
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
    final list = _all
        .where((p) =>
            (kind == null || p.kind == kind) &&
            (category == null || p.marketCategory == category) &&
            (sub == null || p.sub == sub))
        .toList();
    final counts = <String, int>{'all': _all.length};
    for (final p in _all) {
      counts[p.kind.name] = (counts[p.kind.name] ?? 0) + 1;
      counts[p.marketCategory.name] = (counts[p.marketCategory.name] ?? 0) + 1;
      if (p.sub != null) counts[p.sub!.name] = (counts[p.sub!.name] ?? 0) + 1;
    }
    return Ok(CatalogFeedPage(
        items: list, total: list.length, hasMore: false, counts: counts));
  }
}

const _subs = ['card', 'sticker', 'keychain', 'accessory'];

Future<void> _pumpCatalog(WidgetTester tester) async {
  final base = await testOverrides();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...base.where((o) => !identical(o, base[3])),
      discoverRepositoryProvider.overrideWithValue(_Catalog()),
    ],
    child: wrapScreen(const Scaffold(body: CatalogView(query: '')),
        tokens: NfcTokens.ivory),
  ));
  await settle(tester, frames: 10);
}

Future<void> _openElectronics(WidgetTester tester) async {
  final chip = find.byKey(const ValueKey('catalog-chip-electronics'));
  await tester.ensureVisible(chip);
  await settle(tester, frames: 4);
  await tester.tap(chip);
  await settle(tester, frames: 8);
}

// ─── Tanlov ekrani (UI-3, UI-4) ───────────────────────────────────

Future<void> _pumpDiscover(WidgetTester tester) async {
  final base = await testOverrides();
  // Oxirgi qidiruvlar qatori ham ko'rinsin (zich kapsulalar).
  SharedPreferences.setMockInitialValues({
    'nova.recentSearches': ['Tashkent', 'yoga'],
  });
  final prefs = await Prefs.open();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...base.where((o) => !identical(o, base[0])),
      prefsProvider.overrideWithValue(prefs),
    ],
    child: wrapScreen(const DiscoverScreen(), tokens: NfcTokens.ivory),
  ));
  await settle(tester, frames: 12);
}

Future<void> _type(WidgetTester tester, String text) async {
  await tester.enterText(find.byType(TextField), text);
  // `searchQuery` 350ms debounce — keyin tozalash tugmasi chiqadi.
  await tester.pump(const Duration(milliseconds: 400));
  await settle(tester, frames: 6);
}

Finder _searchPill() => find
    .ancestor(of: find.byType(TextField), matching: find.byType(Container))
    .first;

// ─── Do'kon (UI-3) ────────────────────────────────────────────────

Future<void> _pumpShop(WidgetTester tester) async {
  final base = await testOverrides();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...base,
      shopProductsProvider.overrideWith((ref) async => const [
            ShopProduct(
                id: 'a', name: 'NFC karta', price: 100000, category: 'Karta'),
            ShopProduct(
                id: 'b', name: 'NFC brelok', price: 50000, category: 'Brelok'),
          ]),
    ],
    child: wrapScreen(const ShopScreen(), tokens: NfcTokens.ivory),
  ));
  await settle(tester, frames: 12);
}

// ─── Listing formasi (UI-11) ──────────────────────────────────────

class _Biz extends BusinessRepository {
  _Biz() : super(ApiClient());
  @override
  Future<Result<List<CatalogItem>>> catalog(String companyId) async =>
      const Ok([]);
}

class _Profile extends ProfileRepository {
  _Profile() : super(ApiClient());
  @override
  Future<Result<String>> uploadImage(String filePath,
          {String? kind, void Function(int, int)? onProgress}) async =>
      const Ok('assets/demo/m_cards.jpg');
}

Future<void> _pumpListingWithPhoto(WidgetTester tester) async {
  tester.view.physicalSize = const Size(390, 1600) * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final base = await testOverrides();
  final router = GoRouter(initialLocation: '/', routes: [
    GoRoute(path: '/', builder: (_, __) => const Scaffold(body: Text('HOME'))),
    GoRoute(
        path: '/form', builder: (_, __) => const BusinessProductFormScreen()),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...base,
      activeBusinessProvider.overrideWithValue(const Business(
          companyId: 'GOZAL',
          displayName: 'GOZAL',
          category: 'services',
          catalogSchema: 2)),
      businessRepositoryProvider.overrideWithValue(_Biz()),
      profileRepositoryProvider.overrideWithValue(_Profile()),
      listingImagePickerProvider.overrideWithValue(() async => '/tmp/p.jpg'),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      theme: buildTheme(NfcTokens.ivory),
      locale: const Locale('uz'),
      supportedLocales: LocaleController.supported,
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    ),
  ));
  router.push('/form');
  await settle(tester, frames: 10);
  final add = find.byKey(const ValueKey('listing-add-photo'));
  await tester.ensureVisible(add);
  await tester.tap(add);
  await settle(tester, frames: 4);
}

void main() {
  // ═══ UI-2: katalog chip qatorlari ═══════════════════════════════
  group('UI-2 katalog chiplari', () {
    testWidgets('1.0: NFC sub-turlar yorlig‘i kesilmaydi, matn, saralash '
        'va to‘r joyida', (tester) async {
      _setScale(tester, 1.0);
      await _pumpCatalog(tester);

      // Asosiy qator — o'zgarmagan (tuzatishdan oldin ham 8..48).
      final all = find.byKey(const ValueKey('catalog-chip-all'));
      expect(tester.getRect(all).top, 8.0);
      expect(tester.getRect(all).bottom, 48.0);
      expect(tester.getTopLeft(_labelFinder(all)), const Offset(36, 18.5));
      _expectUnclipped(tester, all, 'Hammasi');

      await _openElectronics(tester);

      for (final k in _subs) {
        final chip = find.byKey(ValueKey('catalog-sub-$k'));
        _expectUnclipped(tester, chip, 'sub $k');
        final chipRect = tester.getRect(chip);
        final text = tester.getRect(_labelFinder(chip));
        final icon = tester.getRect(_iconFinder(chip));
        // before: kapsula tepasi 56, matn 66.5 da, chapdan +37.
        expect(chipRect.top, 56.0, reason: '$k: kapsula surilgan');
        expect(text.topLeft, Offset(chipRect.left + 37, 66.5),
            reason: '$k: yorliq joyidan surilgan');
        // Belgi gorizontal joyida; vertikal — yorliq o'rtasida (boshqa
        // hamma kapsulalardagidek). Ilgari yorliq qutisi 15dp ga
        // qirqilgani uchun belgi uning tepasiga yopishib turardi.
        expect(icon.left, chipRect.left + 16, reason: '$k: belgi surilgan');
        expect(icon.size, const Size(15, 15), reason: '$k: belgi o‘lchami');
        expect(icon.center.dy, text.center.dy,
            reason: '$k: belgi yorliq o‘rtasida emas');
      }

      // Pastdagilar SURILMAYDI (before: saralash 104, birinchi karta 160).
      expect(tester.getRect(find.byKey(const ValueKey('catalog-sort'))).top,
          104.0);
      expect(tester.getTopLeft(find.byType(ProductCard).first),
          const Offset(20, 160));
    });

    testWidgets('1.3: asosiy va sub-turlar qatori yorlig‘i kesilmaydi',
        (tester) async {
      // 430 — test shriftida (har harf 1em) "Aksessuarlar · 1" bir
      // qatorga sig'sin; haqiqiy Manrope da 390 da ham sig'adi.
      _setScale(tester, 1.3, size: const Size(430, 844));
      await _pumpCatalog(tester);
      await _openElectronics(tester);

      for (final k in ['all', 'product', 'food', 'electronics']) {
        final chip = find.byKey(ValueKey('catalog-chip-$k'));
        _expectUnclipped(tester, chip, 'chip $k');
        // Matn tepasi joyida (before: 18.5).
        expect(tester.getTopLeft(_labelFinder(chip)).dy, 18.5);
      }
      for (final k in _subs) {
        _expectUnclipped(
            tester, find.byKey(ValueKey('catalog-sub-$k')), 'sub $k');
      }
      expect(tester.takeException(), isNull);
    });

    testWidgets('0.85: qatorlar kichraymaydi, saralash va to‘r joyida',
        (tester) async {
      _setScale(tester, 0.85);
      await _pumpCatalog(tester);
      final all = find.byKey(const ValueKey('catalog-chip-all'));
      // before: 37dp kapsula 40dp qator o'rtasida — 9.5..46.5.
      expect(tester.getRect(all).top, 9.5);
      expect(tester.getRect(all).bottom, 46.5);
      expect(tester.getTopLeft(_labelFinder(all)), const Offset(36, 20));

      await _openElectronics(tester);
      for (final k in _subs) {
        _expectUnclipped(
            tester, find.byKey(ValueKey('catalog-sub-$k')), 'sub $k');
      }
      expect(tester.getRect(find.byKey(const ValueKey('catalog-sort'))).top,
          104.0);
      expect(tester.getTopLeft(find.byType(ProductCard).first),
          const Offset(20, 160));
    });
  });

  // ═══ UI-3: Tanlov tablari, oxirgi qidiruvlar, do'kon ════════════
  group('UI-3 Tanlov va do‘kon chiplari', () {
    testWidgets('1.0: hech narsa o‘zgarmagan (qator 40/36, matn, belgi, '
        'ro‘yxat)', (tester) async {
      _setScale(tester, 1.0);
      await _pumpDiscover(tester);
      final l = await L.delegate.load(const Locale('uz'));

      final people = find.widgetWithText(Capsule, l.discoverPeople);
      final row = find
          .ancestor(of: people, matching: find.byType(SizedBox))
          .first;
      expect(tester.getSize(row).height, 40.0);
      expect(tester.getRect(row).top, 74.0);
      expect(tester.getTopLeft(_labelFinder(people)), const Offset(57, 84.5));
      expect(tester.getRect(_iconFinder(people)),
          const Rect.fromLTRB(36, 86.5, 51, 101.5));

      final recent = find.widgetWithText(Capsule, 'Tashkent');
      expect(tester.getRect(recent).top, 191.0);
      expect(tester.getRect(recent).bottom, 227.0);
      expect(tester.getTopLeft(_labelFinder(recent)), const Offset(52, 200));
      expect(tester.getRect(_iconFinder(recent)),
          const Rect.fromLTRB(33, 202.5, 46, 215.5));

      expect(tester.getTopLeft(find.text(testIds.first.name).first),
          const Offset(34, 253));
    });

    testWidgets('1.3: tab va oxirgi qidiruv yorlig‘i kesilmaydi',
        (tester) async {
      _setScale(tester, 1.3);
      await _pumpDiscover(tester);
      final l = await L.delegate.load(const Locale('uz'));

      for (final label in [l.discoverPeople, l.discoverBusinesses]) {
        final chip = find.widgetWithText(Capsule, label);
        _expectUnclipped(tester, chip, 'tab $label');
      }
      // Matn tepasi joyida (before: x57, y91.5).
      expect(
          tester.getTopLeft(
              _labelFinder(find.widgetWithText(Capsule, l.discoverPeople))),
          const Offset(57, 91.5));
      for (final label in ['Tashkent', 'yoga']) {
        _expectUnclipped(
            tester, find.widgetWithText(Capsule, label), 'recent $label');
      }
      expect(tester.takeException(), isNull);
    });

    testWidgets('0.85: tab qatori 40 va oxirgi qidiruvlar 36 da qoladi',
        (tester) async {
      _setScale(tester, 0.85);
      await _pumpDiscover(tester);
      final l = await L.delegate.load(const Locale('uz'));
      final people = find.widgetWithText(Capsule, l.discoverPeople);
      // before: 71..111 (qator 40), matn 57,83.
      expect(tester.getRect(people).top, 71.0);
      expect(tester.getRect(people).bottom, 111.0);
      expect(tester.getTopLeft(_labelFinder(people)), const Offset(57, 83));
      final recent = find.widgetWithText(Capsule, 'Tashkent');
      expect(tester.getRect(recent).top, 185.0);
      expect(tester.getRect(recent).bottom, 221.0);
    });

    testWidgets('do‘kon: 1.0 da qator 40 va mahsulot joyida', (tester) async {
      _setScale(tester, 1.0);
      await _pumpShop(tester);
      final l = await L.delegate.load(const Locale('uz'));
      final allChip = find.widgetWithText(Capsule, l.shopAll);
      expect(tester.getRect(allChip).top, 60.0);
      expect(tester.getRect(allChip).bottom, 100.0);
      expect(tester.getTopLeft(_labelFinder(allChip)), const Offset(36, 70.5));
      expect(tester.getRect(find.text('NFC brelok')).top, 246.5);
    });

    testWidgets('do‘kon: 1.3 da kategoriya yorlig‘i kesilmaydi',
        (tester) async {
      _setScale(tester, 1.3);
      await _pumpShop(tester);
      final l = await L.delegate.load(const Locale('uz'));
      for (final label in [l.shopAll, 'Brelok', 'Karta']) {
        final chip = find.widgetWithText(Capsule, label);
        _expectUnclipped(tester, chip, 'shop $label');
        expect(tester.getTopLeft(_labelFinder(chip)).dy, 70.5,
            reason: '$label: matn tepasi surilgan');
      }
      expect(tester.takeException(), isNull);
    });
  });

  // ═══ UI-4: qidiruvni tozalash (x) ═══════════════════════════════
  group('UI-4 qidiruvni tozalash tugmasi', () {
    // before: (belgi, qidiruv maydoni qobig'i) — tuzatishdan oldin.
    const before = [
      (0.85, Rect.fromLTRB(335, 24.5, 353, 42.5), Rect.fromLTRB(20, 8, 370, 59)),
      (1.0, Rect.fromLTRB(335, 26, 353, 44), Rect.fromLTRB(20, 8, 370, 62)),
    ];
    for (final e in before) {
      testWidgets('${e.$1}: 44x44, belgi joyida, qobiq o‘smaydi',
          (tester) async {
        _setScale(tester, e.$1);
        await _pumpDiscover(tester);
        final fieldBefore = tester.getRect(find.byType(TextField));
        await _type(tester, 'ali');

        final x = find.byIcon(Icons.close_rounded);
        expect(x, findsOneWidget);
        expect(tester.getRect(x), e.$2, reason: 'belgi surilgan');
        expect(tester.getRect(_searchPill()), e.$3,
            reason: 'qidiruv qobig‘i o‘lchami o‘zgargan');
        // Matn maydoni boshlanishi va balandligi o'zgarmaydi.
        final field = tester.getRect(find.byType(TextField));
        expect(field.left, fieldBefore.left);
        expect(field.top, fieldBefore.top);
        expect(field.bottom, fieldBefore.bottom);
        // Qidiruv belgisi joyida.
        expect(tester.getRect(find.byIcon(Icons.search_rounded)).left, 37.0);

        final hit = tester.getSize(find
            .ancestor(of: x, matching: find.byType(GestureDetector))
            .first);
        expect(hit.width, greaterThanOrEqualTo(44));
        expect(hit.height, greaterThanOrEqualTo(44));
      });
    }

    testWidgets('belgidan 16dp chapga bosish ham tozalaydi', (tester) async {
      _setScale(tester, 1.0);
      await _pumpDiscover(tester);
      await _type(tester, 'ali');
      final x = find.byIcon(Icons.close_rounded);

      await tester.tapAt(tester.getCenter(x) - const Offset(16, 0));
      await settle(tester, frames: 6);

      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.controller!.text, isEmpty,
          reason: 'yaqin bosish matn maydoniga tushdi');
      expect(find.byIcon(Icons.close_rounded), findsNothing);
    });
  });

  // ═══ UI-11: rasmni olib tashlash (x) ════════════════════════════
  group('UI-11 rasm o‘chirish tugmasi', () {
    testWidgets('44x44, doira va belgi joyida, yaqin bosish o‘chiradi',
        (tester) async {
      await _pumpListingWithPhoto(tester);
      final tile = find.byKey(const ValueKey('listing-photo-0'));
      expect(tile, findsOneWidget);
      final x = find.descendant(
          of: tile, matching: find.byIcon(Icons.close_rounded));
      final circle =
          find.ancestor(of: x, matching: find.byType(Container)).first;

      // before: plitka 20,270..112,362; doira 84,272..110,298
      // (o'ngdan 2, tepadan 2), belgi — doira ichida.
      final tileRect = tester.getRect(tile);
      expect(tileRect, const Rect.fromLTRB(20, 270, 112, 362));
      expect(tester.getRect(circle), const Rect.fromLTRB(84, 272, 110, 298));
      expect(tester.getTopRight(x), const Offset(110, 272));
      expect(tester.getCenter(x), const Offset(97, 285));

      final gd = find.ancestor(of: x, matching: find.byType(GestureDetector)).first;
      final hit = tester.getRect(gd);
      expect(hit.width, greaterThanOrEqualTo(44));
      expect(hit.height, greaterThanOrEqualTo(44));
      // Maydon plitka ichida (Stack chetidan chiqsa kesiladi).
      expect(tileRect.contains(hit.topLeft), isTrue);
      expect(hit.right, lessThanOrEqualTo(tileRect.right));
      expect(hit.top, greaterThanOrEqualTo(tileRect.top));

      // Rasmning o'rtasi — o'chirish EMAS.
      await tester.tapAt(tileRect.center);
      await settle(tester, frames: 4);
      expect(find.byKey(const ValueKey('listing-photo-0')), findsOneWidget,
          reason: 'rasm o‘rtasiga bosish uni o‘chirmasligi kerak');

      // Doiradan tashqarida, lekin yonida — o'chiradi.
      await tester.tapAt(tester.getCenter(x) + const Offset(-14, 14));
      await settle(tester, frames: 4);
      expect(find.byKey(const ValueKey('listing-photo-0')), findsNothing,
          reason: 'doira yonidagi bosish o‘tib ketdi');
      expect(tester.takeException(), isNull);
    });
  });
}
