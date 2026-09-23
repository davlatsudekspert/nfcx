import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/utils/external_link.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/discover/catalog_view.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';
import 'support/rich_fakes.dart';

/// Listing sahifasi: galereya, tur va mavjudlik, sotuvchi (Business
/// ID, manzil), aloqa (qo'ng'iroq/Telegram/WhatsApp) va sotuvchi
/// sahifasiga o'tish. Ilovada to'lov/checkout YO'Q.
Future<List<Uri>> _pump(WidgetTester tester, CatalogProduct p,
    {double width = 390}) async {
  tester.view.physicalSize = Size(width, 1500) * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final opened = <Uri>[];
  openLinkOverride = (u) async {
    opened.add(u);
    return true;
  };
  addTearDown(() => openLinkOverride = null);
  final router = GoRouter(initialLocation: '/', routes: [
    GoRoute(
        path: '/',
        builder: (_, __) => CatalogProductScreen(
            companyId: p.companyId, itemId: p.id, initial: p)),
    GoRoute(
        path: '/c/:id',
        builder: (_, s) => Scaffold(body: Text('STORE ${s.pathParameters['id']}'))),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: await testOverrides(),
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
  await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
  await settle(tester, frames: 8);
  return opened;
}

void main() {
  test('sotuvchi marshruti /c/:id', () {
    expect(Routes.storefront('NFCSTORE'), '/c/NFCSTORE');
  });

  for (final w in const [360.0, 390.0, 430.0]) {
    testWidgets('${w.toInt()}: NFC mahsulot — galereya, sotuvchi, aloqa',
        (tester) async {
      final opened = await _pump(tester, richProducts.first, width: w);
      final l = await L.delegate.load(const Locale('uz'));
      expect(tester.takeException(), isNull);

      expect(find.byKey(const ValueKey('listing-gallery')), findsOneWidget);
      expect(find.text('${l.marketElectronics} · ${l.catalogCards}'.toUpperCase()),
          findsOneWidget);
      expect(find.text(l.listingProduct), findsOneWidget);
      expect(find.text(l.catalogInStock), findsOneWidget);
      expect(find.text('NFCSTORE'), findsWidgets);
      expect(find.byKey(const ValueKey('listing-address')), findsOneWidget);
      expect(find.byKey(const ValueKey('listing-no-payment')), findsOneWidget);

      await tester.ensureVisible(find.byKey(const ValueKey('contact-call')));
      await tester.tap(find.byKey(const ValueKey('contact-call')));
      await tester.tap(find.byKey(const ValueKey('contact-telegram')));
      await tester.tap(find.byKey(const ValueKey('contact-whatsapp')));
      await settle(tester, frames: 3);
      expect(opened.map((u) => u.toString()), [
        'tel:+998901234567',
        'https://t.me/nfcstore_uz',
        'https://wa.me/998901234567',
      ]);

      await tester.ensureVisible(find.byKey(const ValueKey('listing-seller')));
      await tester.tap(find.byKey(const ValueKey('listing-seller')));
      await settle(tester, frames: 6);
      expect(find.text('STORE NFCSTORE'), findsOneWidget);
    });
  }

  testWidgets('xizmat: narx kelishiladi, faqat mavjud aloqa kanali', (tester) async {
    final salon = richProducts.firstWhere((p) => p.companyId == 'GOZALSALON');
    await _pump(tester, salon);
    final l = await L.delegate.load(const Locale('uz'));
    expect(tester.takeException(), isNull);
    expect(find.text(l.catalogPriceOnRequest), findsOneWidget);
    expect(find.text(l.listingService), findsOneWidget);
    expect(find.text('Sartaroshlik'), findsOneWidget, reason: 'o‘z bo‘limi');
    expect(find.byKey(const ValueKey('contact-telegram')), findsOneWidget);
    expect(find.byKey(const ValueKey('contact-call')), findsNothing);
    expect(find.textContaining('−'), findsNothing, reason: 'chegirma belgisi yo‘q');
  });

  testWidgets('mavjud emas — sahifada aniq yoziladi', (tester) async {
    final coat = richProducts.firstWhere((p) => !p.available);
    await _pump(tester, coat);
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.text(l.catalogUnavailable), findsWidgets);
    expect(find.text(l.catalogInStock), findsNothing);
  });
}
