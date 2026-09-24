@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, FontLoader;
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
import 'package:nfcstore_nova/features/discover/catalog_view.dart';
import 'package:nfcstore_nova/features/social/feed_card.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import '../helpers.dart' hide settle;
import '../support/fake_video_platform.dart';
import '../support/rich_fakes.dart';

/// INSTAGRAM USLUBI — Reels (odatiy va toza rejim), lenta videosi
/// to'liq ekranda, tovar rasmini kattalashtirish.
///
///   flutter test test/shots/instagram_shot.dart --run-skipped -t shots \
///     --update-goldens
class _Biz extends BusinessRepository {
  _Biz() : super(ApiClient());
  @override
  Future<Result<List<Business>>> mine() async => const Ok([]);
}

const _frames = ['assets/demo/z_post_nfc.jpg'];

final _reels = [
  Post(
    id: 7,
    code: 'NFCSTOREUZ',
    authorName: 'NFCSTORE',
    authorKind: 'company',
    text: 'Siz va biznesingiz — bitta profilda.',
    mediaUrls: const ['https://nfcstore.uz/uploads/a.mp4'],
    isVideo: true,
    likes: 1,
    comments: 1,
  ),
];

void main() {
  setUpAll(() async {
    final fams = {
      'InstrumentSerif': ['assets/fonts/InstrumentSerif-400.ttf'],
      'Manrope': [
        'assets/fonts/Manrope-400.ttf',
        'assets/fonts/Manrope-500.ttf',
        'assets/fonts/Manrope-600.ttf',
        'assets/fonts/Manrope-700.ttf',
      ],
      'IBMPlexMono': [
        'assets/fonts/IBMPlexMono-400.ttf',
        'assets/fonts/IBMPlexMono-500.ttf',
        'assets/fonts/IBMPlexMono-600.ttf',
      ],
      'PlayfairDisplay': ['assets/fonts/PlayfairDisplay-500.ttf'],
    };
    for (final f in fams.entries) {
      final loader = FontLoader(f.key);
      for (final p in f.value) {
        if (File(p).existsSync()) loader.addFont(rootBundle.load(p));
      }
      await loader.load();
    }
    final cup = File('${Platform.environment['HOME']}/.pub-cache/hosted/'
        'pub.dev/cupertino_icons-1.0.9/assets/CupertinoIcons.ttf');
    if (cup.existsSync()) {
      await (FontLoader('packages/cupertino_icons/CupertinoIcons')
            ..addFont(Future.value(cup.readAsBytesSync().buffer.asByteData())))
          .load();
    }
    final root = Platform.environment['FLUTTER_ROOT'] ?? '';
    final icons = File(
        '$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (icons.existsSync()) {
      await (FontLoader('MaterialIcons')
            ..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData())))
          .load();
    }
  });

  Future<void> settle(WidgetTester tester, [int n = 16]) async {
    for (var i = 0; i < n; i++) {
      await tester.pump(const Duration(milliseconds: 80));
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 30)));
    }
  }

  void phone(WidgetTester t) {
    t.view.physicalSize = const Size(390 * 3, 844 * 3);
    t.view.devicePixelRatio = 3;
    // 3 tugmali Android (egasining telefoni).
    t.view.padding = const FakeViewPadding(top: 24 * 3, bottom: 48 * 3);
    t.view.viewPadding = const FakeViewPadding(top: 24 * 3, bottom: 48 * 3);
    addTearDown(t.view.reset);
  }

  Future<ProviderContainer> reels(WidgetTester t) async {
    debugDisableShadows = false;
    VideoPlayerPlatform.instance = FakeVideoPlatform(frames: _frames);
    phone(t);
    final c = ProviderContainer(overrides: [
      ...await testOverrides(),
      businessRepositoryProvider.overrideWithValue(_Biz()),
      reelsProvider.overrideWith((ref) async => _reels),
    ]);
    addTearDown(c.dispose);
    await c.read(prefsProvider)
        .setThemeId(Platform.environment['THEME'] ?? 'ivory');
    await t.pumpWidget(
        UncontrolledProviderScope(container: c, child: const NovaApp()));
    await settle(t);
    c.read(routerProvider).go(Routes.reels);
    await settle(t, 20);
    return c;
  }

  Future<void> shot(WidgetTester t, String name) async {
    await expectLater(find.byType(MaterialApp).first,
        matchesGoldenFile('png/instagram-$name.png'));
    debugDisableShadows = true;
  }

  testWidgets('Reels odatiy', (t) async {
    await reels(t);
    await shot(t, 'reels');
  });

  testWidgets('Reels toza (bosilgan)', (t) async {
    final c = await reels(t);
    c.read(reelsCleanProvider.notifier).state = true;
    await settle(t, 8);
    await shot(t, 'reels-clean');
  });

  testWidgets('Lenta videosi to‘liq ekran', (t) async {
    debugDisableShadows = false;
    VideoPlayerPlatform.instance = FakeVideoPlatform(frames: _frames);
    phone(t);
    await t.pumpWidget(ProviderScope(
      overrides: await testOverrides(),
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildTheme(NfcTokens.ivory),
        locale: const Locale('uz'),
        supportedLocales: LocaleController.supported,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: Scaffold(
          body: ListView(children: [
            FeedCard(post: _reels.first.copyWithId(31)),
          ]),
        ),
      ),
    ));
    await settle(t, 6);
    final box = t.getRect(find.byType(FeedCard));
    await t.tapAt(Offset(box.center.dx, box.top + 150));
    await settle(t, 10);
    await shot(t, 'feed-fullscreen');
  });

  Future<void> product(WidgetTester t) async {
    debugDisableShadows = false;
    phone(t);
    final p = richProducts.first;
    final router = GoRouter(initialLocation: '/', routes: [
      GoRoute(
          path: '/',
          builder: (_, __) => CatalogProductScreen(
              companyId: p.companyId, itemId: p.id, initial: p)),
    ]);
    await t.pumpWidget(ProviderScope(
      overrides: await testOverrides(),
      child: MaterialApp.router(
        debugShowCheckedModeBanner: false,
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
    await settle(t, 8);
    await t.tap(find.byKey(const ValueKey('listing-image')));
    await settle(t, 8);
  }

  testWidgets('Tovar rasmi — to‘liq ekran', (t) async {
    await product(t);
    await shot(t, 'product-viewer');
  });

  testWidgets('Tovar rasmi — kattalashtirilgan', (t) async {
    await product(t);
    final center = t.getCenter(find.byKey(const ValueKey('zoom-0')));
    await t.tapAt(center + const Offset(40, -30));
    await t.pump(const Duration(milliseconds: 60));
    await t.tapAt(center + const Offset(40, -30));
    await settle(t, 8);
    await shot(t, 'product-zoomed');
  });
}

extension on Post {
  Post copyWithId(int id) => Post(
        id: id,
        code: code,
        authorName: authorName,
        authorKind: authorKind,
        text: text,
        mediaUrls: mediaUrls,
        isVideo: isVideo,
        likes: likes,
        comments: comments,
      );
}
