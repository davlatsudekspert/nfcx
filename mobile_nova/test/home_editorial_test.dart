import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/nfc_id_hero.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// SOFT EDITORIAL BOSH SAHIFA.
///
/// Egasining talabi: VIP001 kartasi ekranning qahramoni bo'lib
/// qolsin, tezkor amallar bosilganda javob bersin, raqamlar HAQIQIY
/// bo'lsin va 360/390/430 da hech narsa sig'may qolmasin.
const _vip = NfcId(
  code: 'VIP001',
  name: 'Muhammad Aliyev',
  role: 'Davlat sud eksperti',
  tier: 'exclusive',
  primary: true,
  posts: 29,
  views: 1284,
  followers: 47,
  // Server bu sonni hisoblamaydi — ekranda chiqmasligi kerak.
  taps: 312,
);

Future<void> _pumpHome(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final base = await testOverrides();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...base.where((o) => !identical(o, base[1])),
      authRepositoryProvider
          .overrideWithValue(FakeAuthRepository(ids: const [_vip])),
    ],
    child: wrapScreen(const HomeScreen(), tokens: NfcTokens.ivory),
  ));
  await settle(tester, frames: 16);
}

void main() {
  const sizes = [Size(360, 800), Size(390, 844), Size(430, 932)];

  for (final s in sizes) {
    testWidgets('${s.width.toInt()}: hero karta, amallar va sonlar',
        (tester) async {
      await _pumpHome(tester, s);
      final l = await L.delegate.load(const Locale('uz'));

      // Sig'may qolish (RenderFlex overflow) test istisnosi bo'lib
      // chiqadi.
      expect(tester.takeException(), isNull);

      expect(find.byType(NfcIdHeroCard), findsOneWidget);
      expect(find.text('VIP001'), findsOneWidget);
      final bare = kApiBase.replaceFirst(RegExp(r'^https?://'), '');
      expect(find.text('$bare/VIP001'), findsOneWidget,
          reason: 'ochiq manzil kartada ko‘rinmaydi');
      expect(find.text(l.idTierExclusive.toUpperCase()), findsOneWidget);

      // Ism BIR marta — portret qatorida; kartada takrorlanmaydi.
      expect(find.text('Muhammad Aliyev'), findsOneWidget);

      // Tezkor amallar.
      for (final label in [
        l.nfcScanShort,
        l.nfcWriteShort,
        l.idSearchShort,
        l.postCreate,
      ]) {
        expect(find.text(label), findsOneWidget, reason: label);
      }

      // Haqiqiy sonlar; to'qilgan "tegishlar" YO'Q.
      expect(find.text('29'), findsOneWidget);
      expect(find.text('1.3K'), findsOneWidget);
      expect(find.text('47'), findsOneWidget);
      expect(find.text('312'), findsNothing);
    });
  }

  testWidgets('QR tugmasi QR varag‘ini ochadi', (tester) async {
    await _pumpHome(tester, const Size(390, 844));
    final l = await L.delegate.load(const Locale('uz'));
    await tester.tap(find.byTooltip(l.nfcShowQr));
    await settle(tester, frames: 10);
    expect(find.text(l.nfcQrHint), findsOneWidget);
  });

  test('bosh sahifa manbasi: hero karta va lining raqamlar', () {
    final home = File('lib/features/home/home_screen.dart').readAsStringSync();
    expect(home, contains('NfcIdHeroCard('));
    expect(home, isNot(contains('id.taps')),
        reason: 'server hisoblamaydigan son ko‘rsatilyapti');
    final type = File('lib/design/theme/typography.dart').readAsStringSync();
    // Playfair raqamlari standartda "eski uslub" (VIPoo1).
    expect(type, contains('FontFeature.liningFigures()'));
  });
}
