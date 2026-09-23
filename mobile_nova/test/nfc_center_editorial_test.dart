import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/brand_logo.dart';
import 'package:nfcstore_nova/features/home/widgets/my_ids_strip.dart';
import 'package:nfcstore_nova/features/nfc/nfc_center_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_service.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

class _ReadyNfc extends NfcService {
  @override
  Future<NfcAvailability> check() async => NfcAvailability.ready;
}

/// NFC markazi — soft editorial.
///
/// Markazda brend muhri (nav'dagi bilan bir xil), atrofida sekin
/// to'lqinlar; amallar bitta ro'yxatda; "NFC ID'larim" pastki
/// navigatsiya OSTIGA kirmaydi.
void main() {
  for (final size in const [Size(360, 800), Size(390, 844), Size(430, 932)]) {
    testWidgets('${size.width.toInt()}: muhr, amallar va ID lentasi',
        (tester) async {
      tester.view.physicalSize = size * 3;
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          nfcServiceProvider.overrideWithValue(_ReadyNfc()),
        ],
        child: wrapScreen(const NfcCenterScreen(), tokens: NfcTokens.ivory),
      ));
      await settle(tester, frames: 16);
      final l = await L.delegate.load(const Locale('uz'));

      expect(tester.takeException(), isNull);
      expect(find.byType(ScanCore), findsOneWidget);
      expect(
          find.descendant(
              of: find.byType(ScanCore), matching: find.byType(BrandSeal)),
          findsOneWidget,
          reason: 'markazda NFCSTORE muhri emas');
      for (final s in [l.nfcWrite, l.idMarketTitle, l.nfcSecurity]) {
        expect(find.text(s), findsOneWidget, reason: s);
      }

      // Oxirigacha aylantiriladi: ID lentasi ko'rinadigan joyda,
      // nav balandligidan yuqorida tugaydi.
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -3000));
      await settle(tester, frames: 10);
      final strip = tester.getRect(find.byType(MyIdsStrip));
      expect(strip.bottom, lessThan(size.height - 64),
          reason: 'NFC ID lentasi pastki navigatsiya ostida qoldi');
    });
  }

  test('manba: markazda eski orb/orbit yo‘q, pastda navSafeBottom', () {
    final src = File('lib/features/nfc/nfc_center_screen.dart')
        .readAsStringSync();
    expect(src, isNot(contains('OrbitActions(')));
    expect(src, isNot(contains('NfcOrb(')));
    expect(src, contains('navSafeBottom(context)'));
    expect(src, contains('reduceMotion(context)'),
        reason: 'to‘lqinlar "harakatni kamaytirish"ga bo‘ysunishi kerak');
  });
}
