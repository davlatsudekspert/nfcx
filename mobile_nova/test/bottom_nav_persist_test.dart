import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/design/widgets/bottom_nav.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

Future<void> _frames(WidgetTester tester, [int n = 30]) async {
  for (var i = 0; i < n; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

/// PASTKI NAVIGATSIYA HECH QACHON YO'QOLMASIN (egasi, 2026-09:
/// "Asosiy – Tanlov – NFC – Reels – Profil bottom navigation yo'qolib
/// qolmasin ... scroll qilganda ham").
///
/// Beshala asosiy ekranda panel ko'rinadi va bosiladi; uzun ekranni
/// pastga surganda ham joyida qoladi.
void main() {
  testWidgets('5 ta asosiy ekranda pastki panel doimiy, scrollda ham',
      (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final c = ProviderContainer(overrides: [...await testOverrides()]);
    addTearDown(c.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: const NovaApp(),
    ));
    await _frames(tester);

    Future<void> expectNav(String where) async {
      final nav = find.byType(NovaBottomNav);
      expect(nav, findsOneWidget, reason: '$where: pastki panel yo‘q');
      expect(nav.hitTestable(), findsOneWidget,
          reason: '$where: panel ko‘rinmayapti yoki bosilmaydi');
      final box = tester.getRect(nav);
      expect(box.bottom, lessThanOrEqualTo(844 + .5),
          reason: '$where: panel ekrandan tashqarida');
      expect(box.height, greaterThan(40), reason: '$where: panel siqilgan');
    }

    for (final r in [
      Routes.home,
      Routes.discover,
      Routes.nfc,
      Routes.reels,
      Routes.profile,
    ]) {
      c.read(routerProvider).go(r);
      await _frames(tester, 30);
      await expectNav(r);
    }

    // Uzun ekranni pastga surish — panel joyida qoladi.
    for (final r in [Routes.home, Routes.profile, Routes.discover]) {
      c.read(routerProvider).go(r);
      await _frames(tester, 20);
      final before = tester.getRect(find.byType(NovaBottomNav));
      await tester.fling(
          find.byType(Scrollable).first, const Offset(0, -1400), 3000);
      await _frames(tester, 30);
      await expectNav('$r (scroll)');
      expect(tester.getRect(find.byType(NovaBottomNav)), before,
          reason: '$r: scrollda panel siljidi/yashirindi');
    }
    expect(tester.takeException(), isNull);
  });
}
