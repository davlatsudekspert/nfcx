@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, FontLoader;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/id_lux.dart';
import 'package:nfcstore_nova/design/widgets/id_plate.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import '../helpers.dart';

/// PULLIK NFC ID — VITRINA SURATLARI.
///
///   flutter test test/shots/premium_ids_shot.dart \
///     --run-skipped -t shots --update-goldens
void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    final fams = {
      'InstrumentSerif': ['assets/fonts/InstrumentSerif-400.ttf'],
      'Manrope': [
        'assets/fonts/Manrope-400.ttf',
        'assets/fonts/Manrope-500.ttf',
        'assets/fonts/Manrope-600.ttf',
        'assets/fonts/Manrope-700.ttf',
      ],
      'IBMPlexMono': ['assets/fonts/IBMPlexMono-500.ttf'],
      'PlayfairDisplay': ['assets/fonts/PlayfairDisplay-500.ttf'],
    };
    for (final f in fams.entries) {
      final loader = FontLoader(f.key);
      for (final p in f.value) {
        if (File(p).existsSync()) loader.addFont(rootBundle.load(p));
      }
      await loader.load();
    }
    final root = Platform.environment['FLUTTER_ROOT'] ?? '';
    final icons = File(
        '$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (icons.existsSync()) {
      await (FontLoader('MaterialIcons')
            ..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData())))
          .load();
    }
  });

  Future<void> sized(WidgetTester tester, Size size) async {
    tester.view.physicalSize = size * 2;
    tester.view.devicePixelRatio = 2.0;
    tester.view.padding = const FakeViewPadding(top: 64, bottom: 48);
    tester.view.viewPadding = const FakeViewPadding(top: 64, bottom: 48);
    addTearDown(tester.view.reset);
    // Soyalar telefondagidek yumshoq chizilsin (test standarti — qattiq blok).
    debugDisableShadows = false;
  }

  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 14; i++) {
      await tester.pump(const Duration(milliseconds: 80));
    }
  }

  Widget showcase(NfcTokens t) => Scaffold(
        backgroundColor: t.bg1,
        body: ListView(
          padding: const EdgeInsets.fromLTRB(20, 80, 20, 40),
          children: [
            Wrap(spacing: 8, runSpacing: 8, children: const [
              IdTierBadge(tier: 'gold'),
              IdTierBadge(tier: 'premium'),
              IdTierBadge(tier: 'exclusive'),
              IdTierBadge(tier: 'free', plain: true),
            ]),
            const SizedBox(height: 18),
            Wrap(spacing: 8, runSpacing: 10, children: const [
              IdPlate(code: '48210377', tier: 'free'),
              IdPlate(code: 'SLV2024', tier: 'silver'),
              IdPlate(code: 'GLD777', tier: 'gold'),
              IdPlate(code: 'PRM500', tier: 'premium'),
              IdPlate(code: 'VIP001', tier: 'exclusive'),
            ]),
            const SizedBox(height: 22),
            const IdProductCard(
                code: 'VIP001',
                tier: 'exclusive',
                price: '25 000 000 so‘m',
                status: ('Sotuvda', Color(0xFF2E9E6A))),
            const SizedBox(height: 14),
            const IdProductCard(
                code: 'PRM500',
                tier: 'premium',
                price: '4 900 000 so‘m',
                status: ('Sotuvda', Color(0xFF2E9E6A))),
            const SizedBox(height: 14),
            const IdProductCard(
                code: 'GLD777',
                tier: 'gold',
                price: '990 000 so‘m',
                status: ('Sotuvda', Color(0xFF2E9E6A))),
            const SizedBox(height: 14),
            const IdProductCard(
                code: '48210377',
                tier: 'free',
                price: '0 so‘m',
                status: ('Sotuvda', Color(0xFF2E9E6A))),
          ],
        ),
      );

  for (final (name, tokens) in [
    ('premium-ids-ivory', NfcTokens.ivory),
    ('premium-ids-noir', NfcTokens.noir),
  ]) {
    testWidgets('vitrina — $name', (tester) async {
      await sized(tester, const Size(390, 1180));
      await tester.pumpWidget(ProviderScope(
        overrides: [...await testOverrides()],
        child: wrapScreen(showcase(tokens), tokens: tokens),
      ));
      await settle(tester);
      await expectLater(
          find.byType(MaterialApp), matchesGoldenFile('png/$name.png'));
    debugDisableShadows = true;
    });
  }

  // TO'LIQ ILOVA — pastki navigatsiya bilan; profilda turli toifadagi ID'lar.
  Future<void> app(WidgetTester tester, String route, String name,
      {Size size = const Size(390, 844)}) async {
    await sized(tester, size);
    final c = ProviderContainer(overrides: [
      ...await testOverrides(),
      authRepositoryProvider.overrideWithValue(FakeAuthRepository(ids: const [
        NfcId(code: 'VIP001', name: 'Muhammad', primary: true,
            tier: 'exclusive', views: 1240, cardLinked: true),
        NfcId(code: 'PRM500', name: 'Muhammad Biznes', tier: 'premium', views: 310),
        NfcId(code: 'GLD777', name: 'Oila', tier: 'gold', views: 88),
        NfcId(code: '48210377', name: 'Test', views: 40),
      ])),
    ]);
    addTearDown(c.dispose);
    await c.read(prefsProvider).setThemeId('ivory');
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: const NovaApp(),
    ));
    await settle(tester);
    c.read(routerProvider).go(route);
    await settle(tester);
    await expectLater(
        find.byType(MaterialApp), matchesGoldenFile('png/$name.png'));
    debugDisableShadows = true;
  }

  testWidgets('ilova — Home (navigatsiya bilan)', (t) async {
    await app(t, Routes.home, 'app-home-nav');
  });
  testWidgets('ilova — Profil (pullik ID lentasi)', (t) async {
    await app(t, Routes.profile, 'app-profile-ids',
        size: const Size(390, 1250));
  });
}
