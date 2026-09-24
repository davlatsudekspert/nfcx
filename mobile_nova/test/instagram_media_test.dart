import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/bottom_nav.dart';
import 'package:nfcstore_nova/features/discover/catalog_view.dart';
import 'package:nfcstore_nova/features/social/feed_card.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';
import 'support/rich_fakes.dart';

/// INSTAGRAM USLUBIDAGI MEDIA (egasi, 2026-09-24):
///
/// * Reels'da aylantirish chizig'i va NFC ID pastki panel ostida
///   qolib ketardi (3 tugmali Android). Endi panelning O'LCHANGAN
///   balandligidan yuqorida; panel video ustida qora shisha.
/// * Video bosilsa — belgilarsiz to'liq ekran (Reels va lentada).
/// * Tovar rasmi bosilsa — kattalashtirib ko'riladi.
class _Biz extends BusinessRepository {
  _Biz() : super(ApiClient());
  @override
  Future<Result<List<Business>>> mine() async => const Ok([]);
}

final _reels = [
  Post(
    id: 7,
    code: 'PPP777',
    authorName: 'Mashrabboy',
    text: 'Toshkent kechasi',
    mediaUrls: const ['https://nfcstore.uz/uploads/a.mp4'],
    isVideo: true,
    likes: 42,
  ),
  Post(
    id: 9,
    code: 'ALI000',
    authorName: 'Aliyorbek',
    mediaUrls: const ['https://nfcstore.uz/uploads/c.mp4'],
    isVideo: true,
  ),
];

Future<void> _flush(WidgetTester tester) async {
  await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 40)));
  await settle(tester, frames: 4);
}

/// Tizim panellari rejimini yozib boradi (`SystemChrome`).
List<String> _captureSystemUi() {
  final modes = <String>[];
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(SystemChannels.platform, (call) async {
    if (call.method == 'SystemChrome.setEnabledSystemUIMode') {
      modes.add('${call.arguments}');
    } else if (call.method == 'SystemChrome.setEnabledSystemUIOverlays') {
      modes.add('overlays');
    }
    return null;
  });
  addTearDown(() => TestDefaultBinaryMessengerBinding
      .instance.defaultBinaryMessenger
      .setMockMethodCallHandler(SystemChannels.platform, null));
  return modes;
}

void main() {
  group('Reels — Instagram uslubi', () {
    late ProviderContainer c;
    late FakeVideoPlatform video;

    Future<void> boot(WidgetTester tester, {double inset = 48}) async {
      video = FakeVideoPlatform();
      VideoPlayerPlatform.instance = video;
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      // 3 tugmali Android: tizim paneli ~48 dp.
      tester.view.padding = FakeViewPadding(bottom: inset * 3);
      tester.view.viewPadding = FakeViewPadding(bottom: inset * 3);
      addTearDown(tester.view.reset);
      c = ProviderContainer(overrides: [
        ...await testOverrides(),
        businessRepositoryProvider.overrideWithValue(_Biz()),
        reelsProvider.overrideWith((ref) async => _reels),
      ]);
      addTearDown(c.dispose);
      await tester.pumpWidget(
          UncontrolledProviderScope(container: c, child: const NovaApp()));
      await settle(tester, frames: 10);
      c.read(routerProvider).go(Routes.reels);
      await settle(tester, frames: 12);
      await _flush(tester);
    }

    /// Ekranda turgan (ko'rinayotgan sahifadagi) element.
    Rect onScreen(WidgetTester tester, Key key) {
      final rects = find
          .byKey(key)
          .evaluate()
          .map((e) => tester.getRect(find.byWidget(e.widget)))
          .where((r) => r.top >= 0 && r.bottom <= 844)
          .toList();
      expect(rects, isNotEmpty, reason: '$key ekranda yo‘q');
      return rects.first;
    }

    for (final inset in const [0.0, 24.0, 48.0]) {
      testWidgets(
          'inset ${inset.toInt()}: progress va NFC ID pastki panel USTIDA',
          (tester) async {
        await boot(tester, inset: inset);
        expect(tester.takeException(), isNull);
        final nav = find.byType(NovaBottomNav);
        expect(nav, findsOneWidget);
        expect(tester.widget<NovaBottomNav>(nav).onVideo, isTrue,
            reason: 'Reels’da panel video ustidagi qora shisha');
        final navTop = tester.getRect(nav).top;

        final progress = onScreen(tester, const ValueKey('reel-progress'));
        final chip = onScreen(tester, const ValueKey('reel-id-chip'));
        final like = onScreen(tester, const ValueKey('reel-like'));
        expect(progress.bottom, lessThanOrEqualTo(navTop - 6),
            reason: 'aylantirish chizig‘i panel ostida qolmasin');
        expect(chip.bottom, lessThan(progress.top),
            reason: 'NFC ID chizig‘i ustida turadi');
        expect(like.bottom, lessThan(navTop));
      });
    }

    testWidgets('bosish — toza to‘liq ekran, yana bosish — qaytadi',
        (tester) async {
      final modes = _captureSystemUi();
      await boot(tester);
      await tester.tapAt(const Offset(195, 380));
      // Ikki marta bosishni kutish oralig'i.
      await tester.pump(const Duration(milliseconds: 350));
      await settle(tester, frames: 6);
      expect(c.read(reelsCleanProvider), isTrue);
      expect(find.byType(NovaBottomNav), findsNothing,
          reason: 'toza rejimda pastki panel yo‘q');
      // Tizim panellari TEGILMAYDI: immersive'dan qaytish Android'da
      // oynani boshqa rejimga o'tkazardi (egasining telefoni, 2026-09-24).
      expect(modes, isEmpty, reason: 'tizim panellari rejimi o‘zgarmaydi');
      final chip = find.byKey(const ValueKey('reel-id-chip')).first;
      final ignoring = tester
          .widgetList<IgnorePointer>(
              find.ancestor(of: chip, matching: find.byType(IgnorePointer)))
          .any((w) => w.ignoring);
      expect(ignoring, isTrue, reason: 'belgilar yashirin va bosilmaydi');
      expect(video.playing, isNotEmpty, reason: 'video to‘xtamaydi');

      await tester.tapAt(const Offset(195, 380));
      await tester.pump(const Duration(milliseconds: 350));
      await settle(tester, frames: 6);
      expect(c.read(reelsCleanProvider), isFalse);
      expect(find.byType(NovaBottomNav), findsOneWidget);
      expect(modes, isEmpty);
      expect(tester.takeException(), isNull);
    });

    testWidgets('"orqaga" avval toza rejimdan chiqaradi', (tester) async {
      await boot(tester);
      c.read(reelsCleanProvider.notifier).state = true;
      await settle(tester, frames: 4);
      await tester.binding.handlePopRoute();
      await settle(tester, frames: 6);
      expect(c.read(reelsCleanProvider), isFalse);
      expect(find.byType(ReelsScreen), findsOneWidget,
          reason: 'Reels’dan chiqib ketmaydi');
    });

    testWidgets('boshqa tabga o‘tilsa toza rejim tugaydi', (tester) async {
      await boot(tester);
      c.read(reelsCleanProvider.notifier).state = true;
      await settle(tester, frames: 4);
      c.read(routerProvider).go(Routes.home);
      await settle(tester, frames: 10);
      expect(c.read(reelsCleanProvider), isFalse);
      expect(find.byType(NovaBottomNav), findsOneWidget);
      expect(tester.widget<NovaBottomNav>(find.byType(NovaBottomNav)).onVideo,
          isFalse);
    });

    testWidgets('bosib turish — pauza, qo‘yib yuborish — davom', (tester) async {
      await boot(tester);
      expect(video.playing, hasLength(1));
      final g = await tester.startGesture(const Offset(195, 380));
      await tester.pump(const Duration(milliseconds: 650));
      await _flush(tester);
      expect(video.playing, isEmpty, reason: 'bosib turilganda pauza');
      await g.up();
      await settle(tester, frames: 4);
      await _flush(tester);
      expect(video.playing, hasLength(1), reason: 'qo‘yib yuborilsa davom');
      expect(c.read(reelsCleanProvider), isFalse,
          reason: 'bosib turish toza rejimni almashtirmaydi');
    });
  });

  group('Lenta videosi — to‘liq ekran', () {
    const post = Post(
      id: 31,
      code: 'PPP777',
      authorName: 'Mashrabboy',
      mediaUrls: ['https://nfcstore.uz/uploads/f.mp4'],
      isVideo: true,
    );

    Future<({FakeVideoPlatform v, ValueNotifier<bool> show})> pump(
        WidgetTester tester) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final show = ValueNotifier(true);
      await tester.pumpWidget(ProviderScope(
        overrides: await testOverrides(),
        child: wrapScreen(Scaffold(
          body: ValueListenableBuilder<bool>(
            valueListenable: show,
            builder: (_, on, __) => ListView(children: [
              if (on) const FeedCard(post: post) else const SizedBox(),
            ]),
          ),
        )),
      ));
      await settle(tester, frames: 6);
      return (v: v, show: show);
    }

    Future<void> openFull(WidgetTester tester) async {
      final media = find.byType(FeedCard);
      final box = tester.getRect(media);
      // Karta ichidagi media (sarlavhadan pastroq).
      await tester.tapAt(Offset(box.center.dx, box.top + 150));
      await _flush(tester);
      await settle(tester, frames: 6);
      await _flush(tester);
    }

    testWidgets('bosilsa belgilarsiz to‘liq ekran, pastga surilsa yopiladi',
        (tester) async {
      final modes = _captureSystemUi();
      final r = await pump(tester);
      await openFull(tester);
      expect(find.byKey(const ValueKey('video-fullscreen')), findsOneWidget);
      expect(r.v.playing, hasLength(1), reason: 'to‘liq ekranda o‘ynaydi');
      expect(r.v.created, hasLength(1),
          reason: 'video QAYTA yuklanmaydi — o‘sha pleer');
      expect(modes, isEmpty, reason: 'tizim panellari rejimi o‘zgarmaydi');
      // Belgilar yo'q: na like, na izoh, na ulashish.
      expect(find.byIcon(Icons.close_rounded), findsNothing);

      await tester.drag(find.byKey(const ValueKey('video-fullscreen')),
          const Offset(0, 300));
      await settle(tester, frames: 8);
      expect(find.byKey(const ValueKey('video-fullscreen')), findsNothing);
      expect(r.v.disposed, isEmpty,
          reason: 'lentaga qaytganda pleer yopilmaydi — davom etadi');
      expect(modes, isEmpty);
      expect(tester.takeException(), isNull);
    });

    // Egasi (2026-09-24): "lentada video ochilgan, yana bir bosganda
    // joyiga qaytmayapti — Reels'dagidek ishlasin".
    testWidgets('to‘liq ekranda BOSISH — lentaga qaytadi, video davom etadi',
        (tester) async {
      final r = await pump(tester);
      await openFull(tester);
      await tester.tapAt(const Offset(195, 420));
      await settle(tester, frames: 8);
      expect(find.byKey(const ValueKey('video-fullscreen')), findsNothing,
          reason: 'bitta bosish bilan qaytishi kerak');
      expect(r.v.disposed, isEmpty);
      expect(r.v.playing, hasLength(1), reason: 'lentada davom etadi');
    });

    testWidgets('to‘liq ekranda TEPAGA surish ham yopadi', (tester) async {
      await pump(tester);
      await openFull(tester);
      await tester.drag(find.byKey(const ValueKey('video-fullscreen')),
          const Offset(0, -300));
      await settle(tester, frames: 8);
      expect(find.byKey(const ValueKey('video-fullscreen')), findsNothing);
    });

    testWidgets('to‘liq ekranda BOSIB TURISH — pauza, qo‘yib yuborilsa davom',
        (tester) async {
      final r = await pump(tester);
      await openFull(tester);
      final g = await tester.startGesture(const Offset(195, 420));
      await tester.pump(const Duration(milliseconds: 650));
      await _flush(tester);
      expect(r.v.playing, isEmpty, reason: 'bosib turilganda pauza');
      expect(find.byKey(const ValueKey('video-fullscreen')), findsOneWidget,
          reason: 'bosib turish yopmaydi');
      await g.up();
      await settle(tester, frames: 4);
      await _flush(tester);
      expect(r.v.playing, hasLength(1));
      expect(find.byKey(const ValueKey('video-fullscreen')), findsOneWidget);
    });

    testWidgets('to‘liq ekran ochiq turganda karta yo‘qolsa — pleer '
        'sahifa yopilganda yopiladi (oqib ketmaydi)', (tester) async {
      final r = await pump(tester);
      await openFull(tester);
      expect(find.byKey(const ValueKey('video-fullscreen')), findsOneWidget);
      r.show.value = false;
      await settle(tester, frames: 4);
      await _flush(tester);
      expect(r.v.disposed, isEmpty, reason: 'hali ko‘rsatilyapti');
      expect(find.byKey(const ValueKey('video-fullscreen')), findsOneWidget);

      await tester.binding.handlePopRoute();
      await settle(tester, frames: 8);
      await _flush(tester);
      expect(r.v.alive, isEmpty, reason: 'egasiz pleer yopildi');
      expect(tester.takeException(), isNull);
    });
  });

  group('Tovar rasmi — kattalashtirish', () {
    Future<void> pump(WidgetTester tester) async {
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final p = richProducts.first;
      final router = GoRouter(initialLocation: '/', routes: [
        GoRoute(
            path: '/',
            builder: (_, __) => CatalogProductScreen(
                companyId: p.companyId, itemId: p.id, initial: p)),
      ]);
      await tester.pumpWidget(ProviderScope(
        overrides: await testOverrides(),
        child: MaterialApp.router(
          routerConfig: router,
          theme: buildTheme(NfcTokens.ivory),
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
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 50)));
      await settle(tester, frames: 8);
    }

    testWidgets('bosilsa to‘liq ekran galereya: sahifa, zoom, yopish',
        (tester) async {
      await pump(tester);
      await tester.tap(find.byKey(const ValueKey('listing-image')));
      await settle(tester, frames: 6);
      expect(find.byKey(const ValueKey('image-viewer')), findsOneWidget);
      expect(find.text('1 / 3'), findsOneWidget);

      // Yon tomonga — keyingi rasm.
      await tester.drag(find.byKey(const ValueKey('image-viewer-pages')),
          const Offset(-300, 0));
      // Sahifa aylanishi to'liq tugasin (aylanish paytida bosish
      // aylantirishni to'xtatadi, rasmga yetmaydi).
      await settle(tester, frames: 20);
      expect(find.text('2 / 3'), findsOneWidget);

      // Ikki marta bosish — kattalashadi.
      final center = tester.getCenter(find.byKey(const ValueKey('zoom-1')));
      await tester.tapAt(center);
      await tester.pump(const Duration(milliseconds: 60));
      await tester.tapAt(center);
      await settle(tester, frames: 6);
      final iv = tester.widget<InteractiveViewer>(find.descendant(
          of: find.byKey(const ValueKey('zoom-1')),
          matching: find.byType(InteractiveViewer)));
      expect(iv.transformationController!.value.getMaxScaleOnAxis(),
          greaterThan(2));
      // Kattalashganda sahifalash o'chadi — barmoq rasmni suradi.
      final pv = tester.widget<PageView>(
          find.byKey(const ValueKey('image-viewer-pages')));
      expect(pv.physics, isA<NeverScrollableScrollPhysics>());

      await tester.tap(find.byKey(const ValueKey('image-viewer-close')));
      await settle(tester, frames: 6);
      expect(find.byKey(const ValueKey('image-viewer')), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('pastga surilsa yopiladi', (tester) async {
      await pump(tester);
      await tester.tap(find.byKey(const ValueKey('listing-image')));
      await settle(tester, frames: 6);
      await tester.drag(find.byKey(const ValueKey('image-viewer-pages')),
          const Offset(0, 300));
      await settle(tester, frames: 6);
      expect(find.byKey(const ValueKey('image-viewer')), findsNothing);
    });
  });
}
