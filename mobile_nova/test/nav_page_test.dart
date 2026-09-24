import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/design/widgets/bottom_nav.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// BOSHQA ODAMNING PROFILI VA VITRINA — PASTKI NAVIGATSIYA BILAN.
///
/// Egasi (2026-09-24): "Tanlov'dan profilga kirib ko'rilganda pastdagi
/// ikonlar yo'q bo'lib qolyapti". `/u/:code` va `/c/:id` shell'dan
/// tashqarida ochiladi — endi ular `NavPage` bilan o'raladi.
void main() {
  testWidgets('/u/:code — pastki panel bor, tab bosilsa bo‘limga qaytadi',
      (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final c = ProviderContainer(overrides: [...await testOverrides()]);
    addTearDown(c.dispose);
    await tester.pumpWidget(
        UncontrolledProviderScope(container: c, child: const NovaApp()));
    await settle(tester, frames: 20);

    c.read(routerProvider).go(Routes.discover);
    await settle(tester, frames: 10);
    c.read(routerProvider).push(Routes.user('PPP777'));
    await settle(tester, frames: 20);

    expect(find.byType(ProfileScreen), findsWidgets);
    expect(find.byType(NovaBottomNav), findsOneWidget,
        reason: 'boshqa profilda pastki panel yo‘qolardi');

    await tester.tap(find.text(LUz().navHome).last);
    await settle(tester, frames: 20);
    expect(find.byType(HomeScreen), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
