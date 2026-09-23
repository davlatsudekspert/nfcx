import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/nfc/nfc_scan_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_service.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// Egasining talabi: "scan/write flow qotib qolmasin".
///
/// Ilgari `readOnce` ichidagi `startSession` xato bersa (masalan,
/// yozish ekranidan qolgan sessiya yopilmagan bo'lsa), istisno skaner
/// ekranigacha uchib borar va ekran "Qidirilmoqda…" holatida ABADIY
/// qolardi: tugma o'chiq, orb bosilmaydi, chiqishdan boshqa yo'l yo'q.
class _ThrowingNfc extends NfcService {
  int reads = 0;

  @override
  Future<NfcAvailability> check() async => NfcAvailability.ready;

  @override
  Future<String?> readOnce({Duration timeout = const Duration(seconds: 30)}) {
    reads++;
    return Future.error(StateError('session already started'));
  }
}

class _SlowNfc extends NfcService {
  int reads = 0;
  final gate = Completer<String?>();

  @override
  Future<NfcAvailability> check() async => NfcAvailability.ready;

  @override
  Future<String?> readOnce({Duration timeout = const Duration(seconds: 30)}) {
    reads++;
    return gate.future;
  }
}

Future<void> _pump(WidgetTester tester, NfcService nfc) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...await testOverrides(),
      nfcServiceProvider.overrideWithValue(nfc),
    ],
    child: wrapScreen(const NfcScanScreen()),
  ));
  await settle(tester);
}

void main() {
  testWidgets('sessiya xatosi — ekran qotmaydi, xato ko‘rinadi, qayta bosiladi',
      (tester) async {
    final nfc = _ThrowingNfc();
    await _pump(tester, nfc);
    final l = await L.delegate.load(const Locale('uz'));

    await tester.tap(find.text(l.nfcTapToScan).last);
    await settle(tester);

    expect(tester.takeException(), isNull);
    expect(find.text(l.nfcScanFailed), findsOneWidget,
        reason: 'ekran "Qidirilmoqda…" da qolib ketdi');

    // Tugma yana faol — qayta urinish haqiqatan yangi o'qishni boshlaydi.
    await tester.tap(find.text(l.nfcTapToScan).last);
    await settle(tester);
    expect(nfc.reads, 2);
  });

  testWidgets('qidirilayotganda qayta bosish ikkinchi sessiya ochmaydi',
      (tester) async {
    final nfc = _SlowNfc();
    await _pump(tester, nfc);
    final l = await L.delegate.load(const Locale('uz'));

    await tester.tap(find.text(l.nfcTapToScan).last);
    await settle(tester, frames: 3);
    // Tugma "Qidirilmoqda…" — bosilsa ham hech narsa bo'lmaydi.
    await tester.tap(find.text(l.nfcScanning).last, warnIfMissed: false);
    await settle(tester, frames: 3);
    expect(nfc.reads, 1);

    nfc.gate.complete(null);
    await settle(tester);
    expect(find.text(l.nfcScanFailed), findsOneWidget);
  });
}
