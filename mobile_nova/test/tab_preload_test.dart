import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/features/discover/discover_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_center_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/features/showcase/showcase_screen.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// TABLAR OLDINDAN TAYYOR (egasi, 2026-10, iPhone TestFlight 303).
///
/// Tanlov, Ko'rgazma va Profil shell ochilganda yashirin quriladi —
/// birinchi bosishda spinner/kechikish yo'q. Asosiy — boshlang'ich
/// tab. NFC oldindan QURILMAYDI: u NFC sessiyasini boshlashi mumkin.
void main() {
  test('Tanlov, Ko‘rgazma, Profil — preload; NFC — yo‘q', () async {
    final c = ProviderContainer(overrides: [...await testOverrides()]);
    addTearDown(c.dispose);
    final router = c.read(routerProvider);
    final shell = router.configuration.routes
        .whereType<StatefulShellRoute>()
        .single;
    final byPath = {
      for (final b in shell.branches)
        (b.routes.single as GoRoute).path: b.preload,
    };
    expect(byPath, {
      Routes.home: false,
      Routes.discover: true,
      Routes.nfc: false,
      Routes.showcase: true,
      Routes.profile: true,
    });
  });

  testWidgets('ilovada: Asosiyda turganda Tanlov/Ko‘rgazma/Profil tayyor, '
      'NFC qurilmagan, Ko‘rgazma pleyer ochmagan; tab almashganda qayta '
      'qurilmaydi', (tester) async {
    final video = FakeVideoPlatform();
    VideoPlayerPlatform.instance = video;
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final c = ProviderContainer(overrides: [...await testOverrides()]);
    addTearDown(c.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: const NovaApp(),
    ));
    Future<void> frames([int n = 30]) async {
      for (var i = 0; i < n; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }

    await frames();
    c.read(routerProvider).go(Routes.home);
    await frames();

    Finder hidden(Type t) => find.byType(t, skipOffstage: false);
    expect(hidden(DiscoverScreen), findsOneWidget);
    expect(hidden(ShowcaseScreen), findsOneWidget);
    expect(hidden(ReelsScreen), findsNothing,
        reason: 'Reels endi pastki menyuda yo‘q');
    expect(hidden(ProfileScreen), findsOneWidget);
    expect(hidden(NfcCenterScreen), findsNothing,
        reason: 'NFC oldindan qurilmasligi kerak');
    expect(video.created, isEmpty,
        reason: 'yashirin Ko‘rgazma pleyer ochmasligi kerak');

    // Profil tabiga o'tish — o'sha tayyor ekran (yangi nusxa emas).
    final before = tester.element(hidden(ProfileScreen));
    c.read(routerProvider).go(Routes.profile);
    await frames(6);
    expect(find.byType(ProfileScreen), findsOneWidget);
    expect(identical(tester.element(find.byType(ProfileScreen)), before), isTrue,
        reason: 'Profil qayta qurildi — holat va ma’lumot saqlanmadi');
  });
}
