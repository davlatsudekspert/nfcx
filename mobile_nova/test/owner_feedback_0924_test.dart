import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/brand_icon.dart';
import 'package:nfcstore_nova/design/widgets/brand_logo.dart';
import 'package:nfcstore_nova/design/widgets/id_lux.dart';
import 'package:nfcstore_nova/features/nfc/nfc_center_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_service.dart';

import 'helpers.dart';

/// EGASINING TELEFONDAGI TEKSHIRUVI (2026-09-24).
///
///   1. Tekin ID "BRONZA" bo'lib ko'rinardi — tekin ID oddiy bo'lsin.
///   2. "NFC o'chirilgan" va boshqa joylarda Android'ning NFC belgisi —
///      brendimizning N belgisi bo'lsin.
///   3. Ichki sahifadan chap chetdan surib ham orqaga qaytilsin.
void main() {
  group('tekin ID — bronza emas', () {
    test('8 raqamli tekin ID darajasiz, 6 belgili Bronza — o‘z rangida', () {
      expect(nfcIdVisualTier('38479396', 'free'), '');
      expect(nfcIdVisualTier('NEOMSONGS', 'free'), '');
      expect(nfcIdVisualTier('QWE321', 'free'), 'free',
          reason: 'pullik eng arzon Bronza — 6 belgili');
      expect(nfcIdVisualTier('38479396', 'gold'), 'gold');
      expect(nfcIdVisualTier('VIP001', 'exclusive'), 'exclusive');
    });

    test('serverdan kelgan tekin ID — na material, na "BRONZA" yozuvi', () {
      final id = NfcId.fromJson({'code': '38479396', 'tier': 'free'});
      expect(id.tier, '');
      expect(IdLux.of(NfcTokens.ivory, id.tier), isNull,
          reason: 'mavzuning oddiy ko‘rinishi');
      final paid = NfcId.fromJson({'code': 'QWE321', 'tier': 'free'});
      expect(IdLux.of(NfcTokens.ivory, paid.tier), isNotNull);
    });

    testWidgets('tekin ID belgisi chizilmaydi', (tester) async {
      await tester.pumpWidget(wrapScreen(
        Scaffold(
          body: IdTierBadge(
              tier: NfcId.fromJson({'code': '38479396', 'tier': 'free'}).tier),
        ),
      ));
      expect(find.text('BRONZA'), findsNothing);
    });
  });

  group('NFC belgisi — brendimizniki', () {
    testWidgets('NFC belgilari N logotipiga, qolganlari o‘zgarishsiz',
        (tester) async {
      await tester.pumpWidget(wrapScreen(const Scaffold(
        body: Column(children: [
          BrandAwareIcon(Icons.nfc_rounded, size: 20),
          BrandAwareIcon(Icons.contactless_outlined, size: 20),
          BrandAwareIcon(Icons.home_rounded, size: 20),
        ]),
      )));
      expect(find.byType(BrandLogo), findsNWidgets(2));
      expect(find.byIcon(Icons.nfc_rounded), findsNothing);
      expect(find.byIcon(Icons.home_rounded), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('"NFC o‘chirilgan" holatida — N logotipi', (tester) async {
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          nfcAvailabilityProvider
              .overrideWith((ref) async => NfcAvailability.disabled),
        ],
        child: wrapScreen(const NfcCenterScreen()),
      ));
      await settle(tester, frames: 8);
      expect(find.byIcon(Icons.nfc_rounded), findsNothing,
          reason: 'Android’ning standart NFC belgisi qolmasin');
      expect(find.byKey(const ValueKey('brand-nfc-icon')), findsWidgets);
    });

    test('ilovada Icon(Icons.nfc…) to‘g‘ridan-to‘g‘ri chizilmaydi', () {
      final bad = <String>[];
      final re = RegExp(r'(?<!Brand\w*)\bIcon\(\s*Icons\.(nfc|contactless)');
      for (final f in Directory('lib')
          .listSync(recursive: true)
          .whereType<File>()
          .where((f) => f.path.endsWith('.dart'))) {
        if (re.hasMatch(f.readAsStringSync())) bad.add(f.path);
      }
      expect(bad, isEmpty);
    });
  });

  testWidgets('chap chetdan o‘ngga surish — orqaga qaytadi', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final nav = GlobalKey<NavigatorState>();
    await tester.pumpWidget(MaterialApp(
      navigatorKey: nav,
      theme: buildTheme(NfcTokens.ivory).copyWith(platform: TargetPlatform.android),
      home: const Scaffold(body: Text('ASOSIY')),
    ));
    nav.currentState!.push(MaterialPageRoute<void>(
      builder: (_) => const Scaffold(body: Center(child: Text('ICHKI'))),
    ));
    await tester.pumpAndSettle();
    expect(find.text('ICHKI'), findsOneWidget);

    final g = await tester.startGesture(const Offset(4, 400));
    await g.moveBy(const Offset(60, 0));
    await g.moveBy(const Offset(240, 0));
    await g.up();
    await tester.pumpAndSettle();
    expect(find.text('ICHKI'), findsNothing, reason: 'surib qaytish ishlamadi');
    expect(find.text('ASOSIY'), findsOneWidget);
  });
}
