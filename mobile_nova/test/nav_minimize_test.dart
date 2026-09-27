import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/bottom_nav.dart';
import 'package:nfcstore_nova/design/widgets/brand_logo.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// INSTAGRAM KABI KICHRAYADIGAN PANEL (egasi, 2026-09-27, iPhone surati:
/// "tepaga tortsangiz kattalashadi, pastga tortganingizda kichrayadi";
/// "APK'da ham, iOS'da ham ishlasin").
///
/// Qoidalar:
///   * lenta pastga aylantirilsa — panel ixcham (tor, past, yorliqsiz,
///     muhr kapsula ichida); tepaga qaytilsa — to'liq;
///   * ro'yxat boshida doim to'liq; barmoq titrashi almashtirmaydi;
///   * gorizontal karusel ta'sir qilmaydi; Reels'da doim to'liq;
///   * panelning TASHQI o'lchami o'zgarmaydi (ekran qayta
///     joylashmaydi) va panel hech qachon yo'qolmaydi.
void main() {
  group('NavMinimizer', () {
    Future<(NavMinimizer, ScrollController)> harness(WidgetTester tester,
        {Axis axis = Axis.vertical}) async {
      final min = NavMinimizer();
      final ctl = ScrollController();
      addTearDown(min.dispose);
      addTearDown(ctl.dispose);
      await tester.pumpWidget(MaterialApp(
        home: NotificationListener<ScrollNotification>(
          onNotification: min.handle,
          child: ListView.builder(
            controller: ctl,
            scrollDirection: axis,
            itemCount: 200,
            itemExtent: 80,
            itemBuilder: (_, i) => Text('$i'),
          ),
        ),
      ));
      return (min, ctl);
    }

    testWidgets('pastga — ixcham, tepaga — to‘liq, boshida doim to‘liq',
        (tester) async {
      final (min, ctl) = await harness(tester);
      expect(min.value, isFalse);

      // Ro'yxat boshidagi zona — hali to'liq.
      ctl.jumpTo(NavMinimizer.topZone - 4);
      await tester.pump();
      expect(min.value, isFalse, reason: 'boshida panel kichraymasin');

      ctl.jumpTo(400);
      await tester.pump();
      expect(min.value, isTrue, reason: 'pastga aylantirilganda kichraysin');

      // Kichik qaytish (titrash) — o'zgarmaydi.
      ctl.jumpTo(400 - NavMinimizer.threshold / 2);
      await tester.pump();
      expect(min.value, isTrue, reason: 'titrash panelni ochmasin');

      // Aniq tepaga — to'liq.
      ctl.jumpTo(300);
      await tester.pump();
      expect(min.value, isFalse, reason: 'tepaga qaytganda kattalashsin');

      // Yana pastga — ixcham; ro'yxat boshiga — to'liq.
      ctl.jumpTo(600);
      await tester.pump();
      expect(min.value, isTrue);
      ctl.jumpTo(0);
      await tester.pump();
      expect(min.value, isFalse);

      // Tab almashganda karkas chaqiradi.
      ctl.jumpTo(900);
      await tester.pump();
      expect(min.value, isTrue);
      min.expand();
      expect(min.value, isFalse);
    });

    testWidgets('gorizontal aylantirish panelga ta’sir qilmaydi',
        (tester) async {
      final (min, ctl) = await harness(tester, axis: Axis.horizontal);
      ctl.jumpTo(900);
      await tester.pump();
      expect(min.value, isFalse);
    });
  });

  group('NovaBottomNav ixcham', () {
    List<NavItem> items() => const [
          NavItem(icon: Icons.home_outlined, label: 'Asosiy', route: '/'),
          NavItem(icon: Icons.explore_outlined, label: 'Tanlov', route: '/d'),
          NavItem(icon: Icons.nfc_rounded, label: 'NFC', route: '/n'),
          NavItem(icon: Icons.play_circle_outline, label: 'Reels', route: '/r'),
          NavItem(icon: Icons.person_outline, label: 'Profil', route: '/p'),
        ];

    Future<List<int>> pumpNav(WidgetTester tester,
        {required bool compact, bool onVideo = false}) async {
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final taps = <int>[];
      await tester.pumpWidget(MaterialApp(
        theme: buildTheme(NfcTokens.ivory),
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: NovaBottomNav(
              items: items(),
              currentIndex: 0,
              compact: compact,
              onVideo: onVideo,
              onSelect: taps.add,
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();
      return taps;
    }

    testWidgets('tashqi o‘lcham bir xil, kapsula tor va past, yorliqsiz',
        (tester) async {
      await pumpNav(tester, compact: false);
      final outer = tester.getRect(find.byType(NovaBottomNav));
      final wide = tester.getRect(find.byKey(const ValueKey('nav-capsule')));
      final sealWide = tester.getRect(find.byType(BrandSeal));
      expect(find.text('Asosiy'), findsOneWidget);
      expect(wide.height, kNavHeight);
      expect(sealWide.top, lessThan(wide.top),
          reason: 'to‘liq holatda muhr kapsuladan ko‘tarilib turadi');

      await pumpNav(tester, compact: true);
      expect(tester.getRect(find.byType(NovaBottomNav)), outer,
          reason: 'tashqi o‘lcham o‘zgarsa ekran har kadrda qayta joylashadi');
      final slim = tester.getRect(find.byKey(const ValueKey('nav-capsule')));
      expect(slim.height, kNavCompactHeight);
      expect(slim.width, lessThan(wide.width * .85));
      expect(slim.width, lessThanOrEqualTo(kNavCompactMaxWidth));
      expect(slim.bottom, wide.bottom, reason: 'pastki qirra joyida');
      expect(slim.center.dx, closeTo(wide.center.dx, .5));
      expect(find.text('Asosiy'), findsNothing,
          reason: 'ixcham holatda yorliqlar yashirin');
      final seal = tester.getRect(find.byType(BrandSeal));
      expect(seal.top, greaterThanOrEqualTo(slim.top),
          reason: 'ixcham holatda muhr kapsula ichida');
      expect(seal.bottom, lessThanOrEqualTo(slim.bottom));
      expect(tester.takeException(), isNull);
    });

    testWidgets('ixcham holatda ham bosiladi', (tester) async {
      final taps = await pumpNav(tester, compact: true);
      await tester.tap(find.byIcon(Icons.person_outline));
      await tester.tap(find.byType(BrandSeal));
      await tester.pump(const Duration(milliseconds: 300));
      expect(taps, [4, 2]);
    });

    testWidgets('video ustida (Reels) ixcham bo‘lmaydi', (tester) async {
      await pumpNav(tester, compact: true, onVideo: true);
      final cap = tester.getRect(find.byKey(const ValueKey('nav-capsule')));
      expect(cap.height, kNavHeight);
      expect(find.text('Reels'), findsOneWidget);
    });
  });

  testWidgets('ilovada: Asosiy pastga — ixcham, tepaga — to‘liq; Reels to‘liq',
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
    Future<void> frames([int n = 30]) async {
      for (var i = 0; i < n; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }

    await frames();
    c.read(routerProvider).go(Routes.home);
    await frames();
    NovaBottomNav nav() =>
        tester.widget<NovaBottomNav>(find.byType(NovaBottomNav));
    final outer = tester.getRect(find.byType(NovaBottomNav));
    expect(nav().compact, isFalse);

    final list = find.byType(Scrollable).first;
    final pos = tester.state<ScrollableState>(list).position;
    expect(pos.maxScrollExtent, greaterThan(300),
        reason: 'Asosiy sinovda aylantirishga yetarli uzun bo‘lsin');

    await tester.drag(list, const Offset(0, -400));
    await frames(10);
    expect(nav().compact, isTrue, reason: 'pastga — ixcham');
    expect(tester.getRect(find.byType(NovaBottomNav)), outer,
        reason: 'panel joyida, o‘lchami o‘zgarmaydi');
    expect(find.byType(NovaBottomNav).hitTestable(), findsOneWidget,
        reason: 'ixcham panel ham bosiladi');

    await tester.drag(list, const Offset(0, 120));
    await frames(10);
    expect(nav().compact, isFalse, reason: 'tepaga — to‘liq');

    // Yana ixcham qilib, Reels'ga o'tamiz — u yerda doim to'liq.
    await tester.drag(list, const Offset(0, -400));
    await frames(10);
    expect(nav().compact, isTrue);
    c.read(routerProvider).go(Routes.reels);
    await frames();
    expect(nav().compact, isFalse, reason: 'Reels: panel to‘liq');
    expect(tester.takeException(), isNull);
  });

  test('karkas: asosiy tablar va NavPage ulangan, Reels istisno', () {
    final src = File('lib/routing/shell.dart').readAsStringSync();
    expect(RegExp('NavMinimizer\\(\\)').allMatches(src).length, 2,
        reason: 'HomeShell va NavPage — ikkalasida ham');
    expect(src, contains('onReels ? false : _minimizer.handle(n)'));
    expect(src, contains('compact: compact'));
    expect(src, contains('_minimizer.expand();'));
  });
}
