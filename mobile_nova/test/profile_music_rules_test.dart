import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/features/profile/profile_edit_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// PROFIL MUSIQASI — yuklashdan OLDIN kontent qoidalari darvozasi
/// (audio ham serverda avtomatik tekshiriladi).
void main() {
  testWidgets('rozilik yo‘q — "Musiqa qo‘shish" avval qoidalarni ochadi',
      (tester) async {
    tester.view.physicalSize = const Size(393 * 3, 2400 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: await testOverrides(),
      child: MaterialApp.router(
        routerConfig: GoRouter(initialLocation: '/edit', routes: [
          GoRoute(
            path: '/',
            builder: (_, __) => const SizedBox.shrink(),
            routes: [
              GoRoute(
                  path: 'edit',
                  builder: (_, __) => const ProfileEditScreen()),
            ],
          ),
        ]),
        locale: const Locale('uz'),
        supportedLocales: L.supportedLocales,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      ),
    ));
    await settle(tester, frames: 20);
    final l = LUz();
    final add = find.text(l.profileMusicAdd);
    await tester.scrollUntilVisible(add, 300,
        scrollable: find.byType(Scrollable).first);
    await settle(tester, frames: 4);
    await tester.tap(add);
    await settle(tester, frames: 8);
    expect(find.byKey(const ValueKey('rules-accept')), findsOneWidget,
        reason: 'qoidalar varag‘i fayl tanlashdan oldin');
  });
}
