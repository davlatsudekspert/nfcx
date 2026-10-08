import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/widgets/bottom_nav.dart';
import 'package:nfcstore_nova/features/showcase/showcase_screen.dart';
import 'package:nfcstore_nova/features/social/music_picker.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_en.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_ru.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:nfcstore_nova/routing/shell.dart';

import 'helpers.dart';

/// PASTKI MENYU: Reels o'rnida "Ko'rgazma" (2026-10, kompilyatsiya
/// paytida — server kalitiga bog'liq emas).
void main() {
  test('4-tab — Ko‘rgazma (uz/ru/en), Reels yo‘q', () {
    for (final l in [LUz(), LRu(), LEn()]) {
      final items = navItems(l);
      expect(items, hasLength(5));
      expect(items[kShowcaseTab].label, l.navShowcase);
      expect(items[kShowcaseTab].route, Routes.showcase);
      expect(items.map((e) => e.label), isNot(contains(l.navReels)));
      expect(items.map((e) => e.route), isNot(contains(Routes.reels)));
    }
    expect(LUz().navShowcase, 'Ko‘rgazma');
    expect(LRu().navShowcase, 'Витрина');
    expect(LEn().navShowcase, 'Showcase');
    expect(navItems(LUz())[kShowcaseTab].icon, Icons.collections_outlined);
    expect(HomeShell.tabRoutes[kShowcaseTab], Routes.showcase);
  });

  group('ilovada', () {
    Future<ProviderContainer> boot(WidgetTester tester) async {
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final c = ProviderContainer(overrides: [
        ...await testOverrides(),
        showcaseProvider.overrideWith((ref) async => const <Post>[]),
      ]);
      addTearDown(c.dispose);
      await tester.pumpWidget(
          UncontrolledProviderScope(container: c, child: const NovaApp()));
      await settle(tester, frames: 12);
      return c;
    }

    String loc(ProviderContainer c) => c
        .read(routerProvider)
        .routerDelegate
        .currentConfiguration
        .uri
        .toString();

    testWidgets('pastki panelda "Ko‘rgazma", bosilsa Ko‘rgazma ekrani',
        (tester) async {
      final c = await boot(tester);
      final l = await L.delegate.load(const Locale('uz'));
      final nav = find.byType(NovaBottomNav);
      expect(find.descendant(of: nav, matching: find.text(l.navShowcase)),
          findsOneWidget);
      expect(find.descendant(of: nav, matching: find.text(l.navReels)),
          findsNothing);
      await tester.tap(
          find.descendant(of: nav, matching: find.text(l.navShowcase)));
      await settle(tester, frames: 10);
      expect(loc(c), Routes.showcase);
      expect(find.byType(ShowcaseScreen), findsOneWidget);
      expect(find.text(l.showcaseEmpty), findsOneWidget);
    });

    for (final from in [Routes.reels, Routes.reelCreate]) {
      testWidgets('$from — Ko‘rgazmaga buriladi', (tester) async {
        final c = await boot(tester);
        c.read(routerProvider).go(from);
        await settle(tester, frames: 10);
        expect(loc(c), Routes.showcase);
        expect(find.byType(ReelsScreen, skipOffstage: false), findsNothing);
        expect(find.byType(ComposerScreen), findsNothing,
            reason: 'reel (video) yaratish ochilmaydi');
      });
    }

    testWidgets('/reel/<id> havolasi — PostScreen, yiqilmaydi',
        (tester) async {
      final c = await boot(tester);
      c.read(routerProvider).go('/reel/5?code=48210377');
      await settle(tester, frames: 10);
      expect(tester.takeException(), isNull);
      final post = tester.widget<PostScreen>(find.byType(PostScreen));
      expect(post.id, 5);
      expect(post.code, '48210377');
    });
  });

  testWidgets('«Shu musiqani ishlatish» — Ko‘rgazma yaratish, trek tanlangan',
      (tester) async {
    const track = MusicTrack(id: 5, title: 'Kuy', clipUrl: 'https://x/m.mp3');
    final pushed = <String>[];
    final c = ProviderContainer(overrides: await testOverrides());
    addTearDown(c.dispose);
    final router = GoRouter(routes: [
      GoRoute(
        path: '/',
        builder: (context, _) => Scaffold(
          body: Center(
            child: TextButton(
              onPressed: () => showMusicUseSheet(context, track),
              child: const Text('OPEN'),
            ),
          ),
        ),
      ),
      GoRoute(
        path: Routes.showcaseCreate,
        builder: (_, s) {
          pushed.add(s.uri.path);
          return const Scaffold(body: Text('CREATE'));
        },
      ),
      GoRoute(
        path: Routes.reelCreate,
        builder: (_, s) {
          pushed.add(s.uri.path);
          return const Scaffold(body: Text('REEL'));
        },
      ),
    ]);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: MaterialApp.router(
        routerConfig: router,
        locale: const Locale('uz'),
        supportedLocales: LocaleController.supported,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      ),
    ));
    await tester.tap(find.text('OPEN'));
    await settle(tester, frames: 8);
    await tester.tap(find.byKey(const ValueKey('music-use')));
    await settle(tester, frames: 8);
    expect(pushed, [Routes.showcaseCreate]);
    expect(c.read(pendingComposerMusicProvider)?.id, 5);
  });
}
