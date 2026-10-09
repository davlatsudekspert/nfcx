import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/external_link.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/showcase/showcase_common.dart';
import 'package:nfcstore_nova/features/showcase/showcase_screen.dart';
import 'package:nfcstore_nova/features/profile/music_player.dart'
    show audioOwnerProvider;
import 'package:nfcstore_nova/features/showcase/showcase_extras.dart';
import 'package:nfcstore_nova/features/showcase/showcase_instagram.dart';
import 'package:nfcstore_nova/features/showcase/showcase_sound.dart';
import 'package:nfcstore_nova/features/showcase/showcase_video.dart';
import 'package:nfcstore_nova/features/social/media_carousel.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart'
    show ReelsChrome;
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_en.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_ru.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';
import 'package:webview_flutter/webview_flutter.dart' show WebResourceError;

import 'helpers.dart';
import 'support/fake_video_platform.dart';

class _Social extends FakeSocialRepository {
  _Social(this.pages);
  final List<ReelsPage> pages;
  final cursors = <String?>[];

  @override
  Future<Result<ReelsPage>> showcasePage(
      {String? cursor, int limit = 10}) async {
    cursors.add(cursor);
    // Kursorsiz — 1-sahifa (qayta yuklansa ham), `c<N>` — N+1-sahifa.
    final i = cursor == null ? 0 : int.parse(cursor.substring(1));
    return Ok(i < pages.length ? pages[i] : const ReelsPage());
  }
}

class _Profile extends ProfileRepository {
  _Profile() : super(ApiClient());
  @override
  Future<Result<FollowStats>> followStats(String code) async =>
      const Ok((followers: 0, following: 0, isFollowing: false));
}

class _Biz extends BusinessRepository {
  _Biz() : super(ApiClient());
  @override
  Future<Result<List<Business>>> mine() async => const Ok([]);
}

Post _post({
  int id = 11,
  int images = 3,
  bool featured = false,
  MusicTrack? music,
  String link = 'https://youtu.be/abc',
  String text = 'Yangi kolleksiya',
}) =>
    Post.fromJson({
      'id': id,
      'code': 'C7',
      'authorName': 'Ali Market',
      'authorKind': 'company',
      'showcase': true,
      'title': 'Qizil ko‘ylak',
      'priceUzs': 125000,
      'text': text,
      'linkUrl': link,
      'featured': featured,
      'imageSeconds': 5,
      'catalogItem': {
        'id': 'b9fa1d77-794a-4b7a-b972-aecb1dce7c02',
        'companyId': 'C7',
        'name': 'Ko‘ylak',
      },
      'mediaUrls': [for (var i = 0; i < images; i++) '/uploads/s$i.jpg'],
      if (music != null)
        'music': {'id': music.id, 'title': music.title, 'clipUrl': music.clipUrl},
    });

Future<({ProviderContainer c, List<String> pushed, _Social social})> _pump(
  WidgetTester tester, {
  required List<ReelsPage> pages,
  int tab = kShowcaseTab,
  Future<void> Function(ProviderContainer c)? beforeShow,
}) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final social = _Social(pages);
  final base = await testOverrides();
  final c = ProviderContainer(overrides: [
    ...base.where((o) => !identical(o, base[2])),
    socialRepositoryProvider.overrideWithValue(social),
    profileRepositoryProvider.overrideWithValue(_Profile()),
    businessRepositoryProvider.overrideWithValue(_Biz()),
    activeTabProvider.overrideWith((ref) => tab),
  ]);
  addTearDown(c.dispose);
  await beforeShow?.call(c);
  final pushed = <String>[];
  final router = GoRouter(initialLocation: '/', routes: [
    GoRoute(path: '/', builder: (_, __) => const ShowcaseScreen()),
    GoRoute(
      path: '/catalog/:companyId/:itemId',
      builder: (_, s) {
        pushed.add(s.uri.path);
        return const Scaffold(body: Text('PRODUCT'));
      },
    ),
    GoRoute(
      path: Routes.showcaseCreate,
      builder: (_, s) {
        pushed.add(s.uri.path);
        return const Scaffold(body: Text('CREATE'));
      },
    ),
  ]);
  await tester.pumpWidget(UncontrolledProviderScope(
    container: c,
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
  await settle(tester, frames: 6);
  return (c: c, pushed: pushed, social: social);
}

int _dot(WidgetTester tester) =>
    tester.widget<CarouselDots>(find.byType(CarouselDots)).index;

/// Ikki marta bosish (rasmni butun ekranda ochish).
Future<void> _doubleTapAt(WidgetTester tester, Offset at) async {
  await tester.tapAt(at);
  await tester.pump(const Duration(milliseconds: 60));
  await tester.tapAt(at);
  await settle(tester, frames: 6);
}

Future<void> _doubleTap(WidgetTester tester, Finder f) =>
    _doubleTapAt(tester, tester.getCenter(f));

/// Belgi qatlami ko'rinadimi (toza rejimda — yo'q).
bool _shown(WidgetTester tester, Finder f) =>
    !tester.widget<ReelsChrome>(f).hidden;

Finder _chrome(String key) => find.byKey(ValueKey(key));

/// Ko'rgazma sahifasidagi hamma belgilar (tepa panel, amallar ustuni,
/// izoh/tugmalar bloki, gradient).
const _overlayKeys = [
  'showcase-topbar',
  'showcase-rail',
  'showcase-info',
  'showcase-gradient',
];

void main() {
  // Rasm keshi (`flutter_cache_manager`) `runAsync` ichida haqiqiy
  // papka so'raydi — fayl alohida ishga tushirilganda ham yiqilmasin.
  setUpAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/path_provider'),
            (_) async => Directory.systemTemp.createTempSync('nova').path);
  });

  group('showcaseLinkKind — faqat https YouTube/Instagram', () {
    test('ruxsat etilganlar', () {
      for (final u in [
        'https://youtu.be/abc',
        'https://www.youtube.com/watch?v=1',
        'https://m.youtube.com/watch?v=1',
        'https://youtube.com/shorts/x',
      ]) {
        expect(showcaseLinkKind(u), ShowcaseLinkKind.youtube, reason: u);
      }
      for (final u in [
        'https://instagram.com/p/x',
        'https://www.instagram.com/reel/x',
        'https://m.instagram.com/x',
      ]) {
        expect(showcaseLinkKind(u), ShowcaseLinkKind.instagram, reason: u);
      }
    });

    test('rad etiladiganlar', () {
      for (final u in [
        '',
        'http://youtu.be/abc',
        'https://evil.com/youtube.com',
        'https://youtube.com.evil.com/x',
        'https://notyoutube.com/x',
        'https://youtube.com@evil.com/x',
        'https://facebook.com/x',
        'youtube.com/watch',
        'https://you tube.com',
      ]) {
        expect(showcaseLinkKind(u), isNull, reason: u);
      }
    });
  });

  test('narx: uch xonadan ajratiladi va til bo‘yicha valyuta', () {
    expect(formatUzs(LUz(), 125000), '125 000 so‘m');
    expect(formatUzs(LRu(), 1250000), '1 250 000 сум');
    expect(formatUzs(LEn(), 999), '999 UZS');
    expect(groupThousands(10000000000), '10 000 000 000');
  });

  testWidgets('sahifa: sarlavha, narx, tovar va havola tugmalari, karusel',
      (tester) async {
    final opened = <Uri>[];
    openLinkOverride = (u) async {
      opened.add(u);
      return true;
    };
    addTearDown(() => openLinkOverride = null);
    final r = await _pump(tester, pages: [
      ReelsPage(items: [_post(featured: true)]),
    ]);
    final l = LUz();

    expect(find.byKey(const ValueKey('showcase-pager')), findsOneWidget);
    expect(find.text('Qizil ko‘ylak'), findsOneWidget);
    expect(find.text('125 000 so‘m'), findsOneWidget);
    expect(find.text('Yangi kolleksiya'), findsOneWidget);
    expect(find.byKey(const ValueKey('showcase-sponsored')), findsOneWidget);
    expect(find.text(l.showcaseViewProduct), findsOneWidget);
    expect(find.text(l.showcaseOpenYoutube), findsOneWidget);
    expect(find.byKey(const ValueKey('showcase-carousel')), findsOneWidget);
    expect(find.byType(CarouselDots), findsOneWidget);
    expect(_dot(tester), 0);
    // Amallar ustuni.
    for (final k in ['like', 'comments', 'save', 'share', 'more']) {
      expect(find.byKey(ValueKey('showcase-$k')), findsOneWidget, reason: k);
    }

    // Havola — faqat TASHQARIDA ochiladi.
    await tester.tap(find.byKey(const ValueKey('showcase-link')));
    await settle(tester, frames: 3);
    expect(opened.single.toString(), 'https://youtu.be/abc');

    // Tovar — katalog sahifasi.
    await tester.tap(find.byKey(const ValueKey('showcase-product')));
    await settle(tester, frames: 6);
    expect(r.pushed,
        ['/catalog/C7/b9fa1d77-794a-4b7a-b972-aecb1dce7c02']);
  });

  testWidgets('Instagram havolasi — o‘z yozuvi; yaroqsiz havola — tugma yo‘q',
      (tester) async {
    await _pump(tester, pages: [
      ReelsPage(items: [
        _post(link: 'https://www.instagram.com/p/x'),
      ]),
    ]);
    expect(find.text(LUz().showcaseOpenInstagram), findsOneWidget);
  });

  testWidgets('yaroqsiz havola — tugma chizilmaydi', (tester) async {
    await _pump(tester, pages: [
      ReelsPage(items: [_post(link: 'http://evil.com')]),
    ]);
    expect(find.byKey(const ValueKey('showcase-link')), findsNothing);
  });

  testWidgets('karusel imageSeconds dan keyin o‘zi almashadi, oxiridan boshiga',
      (tester) async {
    await _pump(tester, pages: [
      ReelsPage(items: [_post(images: 2)]),
    ]);
    expect(_dot(tester), 0);
    await tester.pump(const Duration(seconds: 5));
    await settle(tester, frames: 8);
    expect(_dot(tester), 1);
    await tester.pump(const Duration(seconds: 5));
    await settle(tester, frames: 8);
    expect(_dot(tester), 0, reason: 'oxiridan boshiga');
  });

  testWidgets('boshqa tab ochiq — karusel turadi', (tester) async {
    await _pump(tester, tab: 0, pages: [
      ReelsPage(items: [_post(images: 2)]),
    ]);
    await tester.pump(const Duration(seconds: 6));
    await settle(tester, frames: 8);
    expect(_dot(tester), 0);
  });

  testWidgets(
      'rasm IKKI marta bosilsa — butun ekranda ko‘rish; BIR marta — '
      'toza rejim, ko‘ruvchi ochilmaydi', (tester) async {
    final r = await _pump(tester, pages: [
      ReelsPage(items: [_post(images: 2)]),
    ]);
    await tester.tap(find.byKey(const ValueKey('showcase-image-0')));
    await settle(tester, frames: 6);
    expect(find.byKey(const ValueKey('image-viewer')), findsNothing);
    expect(r.c.read(reelsCleanProvider), isTrue);

    await _doubleTap(tester, find.byKey(const ValueKey('showcase-image-0')));
    expect(find.byKey(const ValueKey('image-viewer')), findsOneWidget);
    expect(r.c.read(reelsCleanProvider), isTrue,
        reason: 'ikki bosish toza rejimni o‘zgartirmaydi');
  });

  testWidgets('bo‘sh — "Hali ko‘rgazma yo‘q" va yaratish', (tester) async {
    final r = await _pump(tester, pages: const [ReelsPage()]);
    final l = LUz();
    expect(find.text(l.showcaseEmpty), findsOneWidget);
    expect(l.showcaseEmpty, 'Hali ko‘rgazma yo‘q');
    expect(find.text(l.showcaseCreate), findsWidgets);
    await tester.tap(find.byKey(const ValueKey('showcase-create')));
    await settle(tester, frames: 6);
    expect(r.pushed, [Routes.showcaseCreate]);
  });

  testWidgets('davomi kursor bilan so‘raladi', (tester) async {
    final r = await _pump(tester, pages: [
      ReelsPage(
          items: [_post(id: 1), _post(id: 2)],
          hasMore: true,
          nextCursor: 'c1'),
      ReelsPage(items: [_post(id: 3)]),
    ]);
    await tester.fling(find.byKey(const ValueKey('showcase-pager')),
        const Offset(0, -600), 2000);
    await settle(tester, frames: 10);
    expect(r.social.cursors.where((c) => c != null), ['c1']);
  });

  /// TABGA QAYTISH: ro'yxat `kShowcaseStaleAfter` (10 daqiqa) dan eski
  /// bo'lsa `/api/showcase` qayta so'raladi, yangi bo'lsa — yo'q.
  ///
  /// Soat `showcaseClock` orqali boshqariladi (haqiqiy 10 daqiqa
  /// kutilmaydi). Kursorsiz `showcasePage()` chaqiruvi — 1-sahifa,
  /// ya'ni `/api/showcase` ning o'zi.
  testWidgets(
      'tabga qaytish: 10 daqiqadan oshsa /api/showcase qayta so‘raladi, '
      'oldin — yo‘q', (tester) async {
    final loaded = DateTime(2026, 10, 8, 12);
    var now = loaded;
    showcaseClock = () => now;
    addTearDown(() => showcaseClock = DateTime.now);

    final r = await _pump(tester, pages: [
      ReelsPage(items: [_post(id: 11), _post(id: 12)]),
    ]);
    int fetches() => r.social.cursors.where((c) => c == null).length;
    // Birinchi ochilish. Faol profil (`activeProfileProvider`) testda
    // kechroq aniqlanadi va ro'yxat bir marta qayta quriladi — shuning
    // uchun mutlaq son emas, shu nuqtadan keyingi FARQ tekshiriladi.
    await settle(tester, frames: 8);
    final base = fetches();
    expect(base, greaterThanOrEqualTo(1), reason: 'birinchi ochilish');

    Future<void> leaveAndReturn(Duration after) async {
      r.c.read(activeTabProvider.notifier).state = 0;
      await settle(tester, frames: 4);
      now = now.add(after);
      r.c.read(activeTabProvider.notifier).state = kShowcaseTab;
      await settle(tester, frames: 8);
    }

    // 9 daqiqa 59 soniya — ro'yxat hali yangi: so'rov YO'Q.
    await leaveAndReturn(const Duration(minutes: 9, seconds: 59));
    expect(fetches(), base, reason: '10 daqiqa o‘tmagan — qayta so‘ralmaydi');
    expect(find.byKey(const ValueKey('showcase-pager')), findsOneWidget);

    // Yuklangandan 10 daqiqa 1 soniya — eskirgan: qayta so'raladi.
    await leaveAndReturn(const Duration(seconds: 2));
    expect(fetches(), base + 1,
        reason: '10 daqiqadan oshdi — /api/showcase qayta');
    expect(now.difference(loaded), greaterThan(kShowcaseStaleAfter));
    expect(tester.takeException(), isNull);
    expect(find.byKey(const ValueKey('showcase-pager')), findsOneWidget);

    // Yangi ro'yxat yuklangan vaqtdan sanaladi: 1 daqiqadan keyin — yo'q.
    await leaveAndReturn(const Duration(minutes: 1));
    expect(fetches(), base + 1,
        reason: 'yangi yuklangan ro‘yxat qayta so‘ralmaydi');
  });

  testWidgets('musiqa: bitta audio egasi, mixWithOthers false',
      (tester) async {
    final v = FakeVideoPlatform();
    VideoPlayerPlatform.instance = v;
    final r = await _pump(tester, pages: [
      ReelsPage(items: [
        _post(
            music: const MusicTrack(
                id: 5, title: 'Kuy', clipUrl: 'https://nfcstore.uz/m.mp3')),
      ]),
    ]);
    await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 40)));
    await settle(tester, frames: 4);
    expect(v.created, hasLength(1));
    expect(v.mixCalls, [false]);
    expect(v.playing, hasLength(1));

    // Boshqa tabga o'tildi — musiqa to'xtaydi va pleyer yopiladi.
    r.c.read(activeTabProvider.notifier).state = 0;
    await settle(tester, frames: 4);
    await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 40)));
    await settle(tester, frames: 2);
    expect(v.playing, isEmpty);
    expect(v.alive, isEmpty);
  });

  group('musiqa uzluksizligi (egasi, build 329)', () {
    const track =
        MusicTrack(id: 5, title: 'Kuy', clipUrl: 'https://nfcstore.uz/m.mp3');

    Future<void> drain(WidgetTester tester) async {
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 40)));
      await settle(tester, frames: 4);
    }

    testWidgets('rasm ko‘ruvchi va izohni ochish musiqani TO‘XTATMAYDI',
        (tester) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      await _pump(tester, pages: [
        ReelsPage(items: [
          _post(
              images: 2,
              music: track,
              text: List.filled(40, 'Juda uzun izoh matni').join(' ')),
        ]),
      ]);
      await drain(tester);
      expect(v.playing, hasLength(1));

      // Izoh ochiladi ("… ko‘proq") — musiqa davom etadi.
      await tester.tap(find.byKey(const ValueKey('reel-caption')));
      await drain(tester);
      expect(v.playing, hasLength(1), reason: 'izoh ochilganda');

      // Rasm butun ekranda (ikki bosish) — musiqa davom etadi. Ochiq
      // izoh pastki yarmini egallaydi, shuning uchun rasmning yuqori
      // qismi bosiladi.
      await _doubleTapAt(
          tester,
          tester
              .getTopLeft(find.byKey(const ValueKey('showcase-image-0')))
              .translate(150, 250));
      await drain(tester);
      expect(find.byKey(const ValueKey('image-viewer')), findsOneWidget);
      expect(v.playing, hasLength(1), reason: 'rasm ko‘ruvchi ochiq');
      expect(v.disposed, isEmpty);

      // Yopildi — hamon o'ynayapti, yangi pleer ochilmagan.
      await tester.tap(find.byKey(const ValueKey('image-viewer-close')));
      await settle(tester, frames: 8);
      await drain(tester);
      expect(find.byKey(const ValueKey('image-viewer')), findsNothing);
      expect(v.playing, hasLength(1));
      expect(v.created, hasLength(1));
    });

    testWidgets('boshqa ekran (tovar) — pauza, qaytilganda davom etadi',
        (tester) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      final r = await _pump(tester, pages: [
        ReelsPage(items: [_post(music: track)]),
      ]);
      await drain(tester);
      expect(v.playing, hasLength(1));

      await tester.tap(find.byKey(const ValueKey('showcase-product')));
      await settle(tester, frames: 10);
      await drain(tester);
      expect(r.pushed, hasLength(1));
      expect(v.playing, isEmpty, reason: 'boshqa ekran ochiq — pauza');
      expect(v.disposed, isEmpty, reason: 'pleer saqlanadi');

      GoRouter.of(tester.element(find.text('PRODUCT'))).pop();
      await settle(tester, frames: 10);
      await drain(tester);
      expect(v.playing, hasLength(1), reason: 'qaytildi — davom etadi');
      expect(v.created, hasLength(1));
    });
  });

  group('ovoz tugmasi — burchakda, bitta, saqlanadi', () {
    const track =
        MusicTrack(id: 5, title: 'Kuy', clipUrl: 'https://nfcstore.uz/m.mp3');

    Future<void> drain(WidgetTester tester) async {
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 40)));
      await settle(tester, frames: 4);
    }

    testWidgets(
        '🔇: musiqa to‘xtaydi, Prefs ga yoziladi, har sahifada va rasm '
        'ko‘ruvchida bitta tugma', (tester) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      final r = await _pump(tester, pages: [
        ReelsPage(items: [
          _post(id: 1, music: track),
          _post(id: 2, music: track),
        ]),
      ]);
      await drain(tester);
      expect(v.playing, hasLength(1));
      final l = LUz();

      // Bitta tugma, "+" ostida (ustma-ust emas), sahifadagi eski
      // karnay ikonkasi yo'q.
      final mute = find.byKey(const ValueKey('showcase-mute'));
      expect(mute, findsOneWidget);
      final plus = tester.getRect(find.byKey(const ValueKey('showcase-create')));
      final m = tester.getRect(mute);
      expect(m.top, greaterThanOrEqualTo(plus.bottom));
      expect(m.center.dx, closeTo(plus.center.dx, 1));
      expect(find.bySemanticsLabel(l.actionMute), findsOneWidget);

      await tester.tap(mute);
      await drain(tester);
      expect(r.c.read(showcaseMutedProvider), isTrue);
      expect(r.c.read(prefsProvider).showcaseMuted, isTrue,
          reason: 'ilova qayta ochilganda ham');
      expect(v.playing, isEmpty, reason: 'o‘chiq — musiqa o‘ynamaydi');
      expect(find.bySemanticsLabel(l.actionUnmute), findsOneWidget);

      // Keyingi sahifa — baribir jim.
      await tester.fling(find.byKey(const ValueKey('showcase-pager')),
          const Offset(0, -600), 2000);
      await settle(tester, frames: 10);
      await drain(tester);
      expect(v.playing, isEmpty);
      expect(mute, findsOneWidget);

      // Rasm ko'ruvchida ham o'sha tugma; yoqilsa — musiqa qaytadi.
      await _doubleTap(
          tester, find.byKey(const ValueKey('showcase-image-0')).last);
      final inViewer = find.byKey(const ValueKey('showcase-viewer-mute'));
      expect(inViewer, findsOneWidget);
      await tester.tap(inViewer);
      await drain(tester);
      expect(r.c.read(showcaseMutedProvider), isFalse);
      expect(r.c.read(prefsProvider).showcaseMuted, isFalse);
      expect(v.playing, hasLength(1), reason: 'yoqildi — ko‘ruvchi ostida');
    });

    testWidgets('saqlangan 🔇 — ochilishda musiqa umuman boshlanmaydi',
        (tester) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      // `_pump` omborni tozalaydi — kalit undan keyin, provayder
      // birinchi o'qilishidan oldin yoziladi.
      final r = await _pump(tester, pages: [
        ReelsPage(items: [_post(music: track)]),
      ], beforeShow: (c) => c.read(prefsProvider).setShowcaseMuted(true));
      await drain(tester);
      expect(r.c.read(showcaseMutedProvider), isTrue);
      expect(v.playing, isEmpty);
    });
  });

  /// TOZA REJIM (egasi, build 330: "bosam o'zi toza ko'rinmayapti,
  /// to'liq yozuvlar olinmayapti"). Reels kabi: media BIR MARTA bosilsa
  /// hamma belgilar yo'qoladi, yana bosilsa qaytadi; boshqa sahifaga
  /// surilsa yoki tabdan chiqilsa — oddiy holat. Ijroga ta'sir yo'q.
  group('toza rejim — bosish hamma belgilarni yashiradi', () {
    const track =
        MusicTrack(id: 5, title: 'Kuy', clipUrl: 'https://nfcstore.uz/m.mp3');

    Post ad({MusicTrack? music}) => Post.fromJson({
          'id': 900,
          'code': 'NFCSTORE',
          'authorName': 'NFCSTORE',
          'ad': true,
          'title': 'Boy777',
          'text': 'Yangi NFC kartalar',
          'videoUrl': '/uploads/promo_boy777.mp4',
          'imageUrl': '/promo/boy777.jpg',
          'authorKind': 'company',
          'contact': {
            'phone': '+998901234567',
            'telegram': 'https://t.me/nfcstore',
          },
          'linkUrl': 'https://www.instagram.com/nfcstore',
          if (music != null)
            'music': {
              'id': music.id,
              'title': music.title,
              'clipUrl': music.clipUrl,
            },
        });

    Future<void> drain(WidgetTester tester) async {
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 40)));
      await settle(tester, frames: 4);
    }

    void expectOverlays(WidgetTester tester, {required bool shown}) {
      for (final k in _overlayKeys) {
        expect(_shown(tester, _chrome(k)), shown, reason: k);
        // Yumshoq yo'qolish tugagan: shaffoflik 0/1.
        final fade = tester.widget<AnimatedOpacity>(find
            .descendant(of: _chrome(k), matching: find.byType(AnimatedOpacity))
            .first);
        expect(fade.opacity, shown ? 1.0 : 0.0, reason: k);
      }
    }

    testWidgets(
        'rasm sahifasi: bosish — sarlavha, +, 🔇, ustun, izoh, nuqtalar '
        'yo‘qoladi; yana bosish — qaytadi; musiqa to‘xtamaydi',
        (tester) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      final r = await _pump(tester, pages: [
        ReelsPage(items: [_post(images: 2, music: track)]),
      ]);
      await drain(tester);
      expect(v.playing, hasLength(1));
      expectOverlays(tester, shown: true);
      final dots = find.descendant(
          of: find.byKey(const ValueKey('showcase-dots')),
          matching: find.byType(ReelsChrome));
      expect(_shown(tester, dots), isTrue);
      expect(_shown(tester, _chrome('showcase-header')), isTrue,
          reason: 'rasm sahifasida "Ko‘rgazma" yozuvi bor');

      await tester.tap(find.byKey(const ValueKey('showcase-image-0')));
      await settle(tester, frames: 6);
      await drain(tester);
      expect(r.c.read(reelsCleanProvider), isTrue);
      expectOverlays(tester, shown: false);
      expect(_shown(tester, dots), isFalse);
      // 🔇 va "+" — tepa panel ichida, u ham yashirin va bosilmaydi.
      expect(
          find.ancestor(
              of: find.byKey(const ValueKey('showcase-mute')),
              matching: _chrome('showcase-topbar')),
          findsOneWidget);
      expect(
          find.ancestor(
              of: find.byKey(const ValueKey('showcase-create')),
              matching: _chrome('showcase-topbar')),
          findsOneWidget);
      expect(find.byKey(const ValueKey('image-viewer')), findsNothing);
      expect(v.playing, hasLength(1), reason: 'musiqa davom etadi');
      expect(v.created, hasLength(1));

      // Yashirin "like" o'rni bosilsa — like emas, belgilar qaytadi.
      final likeAt =
          tester.getCenter(find.byKey(const ValueKey('showcase-like')));
      await tester.tapAt(likeAt);
      await settle(tester, frames: 6);
      await drain(tester);
      expect(r.c.read(reelsCleanProvider), isFalse);
      expectOverlays(tester, shown: true);
      expect(_shown(tester, dots), isTrue);
      expect(v.playing, hasLength(1));
      expect(v.created, hasLength(1), reason: 'pleer qayta ochilmagan');
    });

    testWidgets(
        'video reklama: "Ko‘rgazma" yozuvi yo‘q, gradient yengil; bosish — '
        'hammasi yo‘qoladi, video o‘ynayveradi', (tester) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      final r = await _pump(tester, pages: [
        ReelsPage(items: [ad()]),
      ]);
      await drain(tester);
      final id = v.urls.entries
          .firstWhere((e) => e.value.endsWith('promo_boy777.mp4'))
          .key;
      expect(v.playing, {id});

      // Oddiy holat: videoning o'z sarlavhasi ustida "Ko'rgazma" yo'q,
      // "+" va 🔇 qoladi; gradient faqat pastda va yengil.
      expect(_shown(tester, _chrome('showcase-header')), isFalse);
      expect(_shown(tester, _chrome('showcase-topbar')), isTrue);
      final grad = tester
          .widget<DecoratedBox>(find
              .descendant(
                  of: _chrome('showcase-gradient'),
                  matching: find.byType(DecoratedBox))
              .first)
          .decoration as BoxDecoration;
      final g = grad.gradient! as LinearGradient;
      expect(g.colors.first.a, 0, reason: 'tepasi shaffof');
      expect(g.colors.last.a, lessThanOrEqualTo(.6));
      expect((g.begin as Alignment).y, greaterThan(0),
          reason: 'faqat pastki qismda');
      expect(find.byKey(const ValueKey('showcase-contact')), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('showcase-ad-video')));
      await settle(tester, frames: 6);
      await drain(tester);
      expect(r.c.read(reelsCleanProvider), isTrue);
      expectOverlays(tester, shown: false);
      expect(
          find.ancestor(
              of: find.byKey(const ValueKey('showcase-sponsored')),
              matching: _chrome('showcase-info')),
          findsOneWidget,
          reason: '"Reklama" ham yashirin blokda');
      expect(
          find.ancestor(
              of: find.byKey(const ValueKey('showcase-contact')),
              matching: _chrome('showcase-info')),
          findsOneWidget);
      expect(v.playing, {id}, reason: 'video to‘xtamaydi');
      expect(v.created, hasLength(1));

      await tester.tap(find.byKey(const ValueKey('showcase-ad-video')));
      await settle(tester, frames: 6);
      await drain(tester);
      expect(r.c.read(reelsCleanProvider), isFalse);
      expectOverlays(tester, shown: true);
      expect(_shown(tester, _chrome('showcase-header')), isFalse);
      expect(v.playing, {id});
      expect(v.created, hasLength(1));
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(minutes: 1));
    });

    testWidgets('boshqa sahifaga surilsa — toza rejim tugaydi',
        (tester) async {
      final r = await _pump(tester, pages: [
        ReelsPage(items: [_post(id: 1), _post(id: 2)]),
      ]);
      await tester.tap(find.byKey(const ValueKey('showcase-image-0')));
      await settle(tester, frames: 6);
      expect(r.c.read(reelsCleanProvider), isTrue);

      await tester.fling(find.byKey(const ValueKey('showcase-pager')),
          const Offset(0, -600), 2000);
      await settle(tester, frames: 10);
      expect(r.c.read(reelsCleanProvider), isFalse);
      expect(_shown(tester, _chrome('showcase-topbar')), isTrue);
      expect(_shown(tester, _chrome('showcase-rail').last), isTrue);
      expect(_shown(tester, _chrome('showcase-info').last), isTrue);
    });

    testWidgets('boshqa tabga o‘tilsa — toza rejim tugaydi', (tester) async {
      final r = await _pump(tester, pages: [
        ReelsPage(items: [_post()]),
      ]);
      await tester.tap(find.byKey(const ValueKey('showcase-image-0')));
      await settle(tester, frames: 6);
      expect(r.c.read(reelsCleanProvider), isTrue);
      r.c.read(activeTabProvider.notifier).state = 0;
      await settle(tester, frames: 4);
      expect(r.c.read(reelsCleanProvider), isFalse);
    });

    testWidgets('oddiy holatda tugmalar ishlaydi va toza rejimga o‘tmaydi',
        (tester) async {
      final r = await _pump(tester, pages: [
        ReelsPage(items: [_post()]),
      ]);
      await tester.tap(find.byKey(const ValueKey('showcase-mute')));
      await settle(tester, frames: 6);
      expect(r.c.read(showcaseMutedProvider), isTrue);
      expect(r.c.read(reelsCleanProvider), isFalse);

      await tester.tap(find.byKey(const ValueKey('showcase-more')));
      await settle(tester, frames: 8);
      expect(find.byKey(const ValueKey('showcase-report')), findsOneWidget);
      expect(r.c.read(reelsCleanProvider), isFalse);
      await tester.tapAt(const Offset(20, 20));
      await settle(tester, frames: 8);

      await tester.tap(find.byKey(const ValueKey('showcase-product')));
      await settle(tester, frames: 6);
      expect(r.pushed, ['/catalog/C7/b9fa1d77-794a-4b7a-b972-aecb1dce7c02']);
      expect(r.c.read(reelsCleanProvider), isFalse);
    });
  });

  group('YouTube — ilova ichida rasmiy pleer', () {
    test('havoladan video ID: watch, youtu.be, shorts, m., parametrlar',
        () {
      const id = 'dQw4w9WgXcQ';
      for (final u in [
        'https://www.youtube.com/watch?v=$id',
        'https://youtube.com/watch?v=$id',
        'https://m.youtube.com/watch?v=$id',
        'https://www.youtube.com/watch?feature=share&v=$id&t=42s',
        'https://youtu.be/$id',
        'https://youtu.be/$id?si=AbCdEf&t=3',
        'https://www.youtube.com/shorts/$id',
        'https://youtube.com/shorts/$id?feature=share',
        'https://m.youtube.com/shorts/$id',
        'https://www.youtube.com/embed/$id',
        ' https://youtu.be/$id ',
      ]) {
        expect(youtubeVideoId(u), id, reason: u);
      }
      expect(isYoutubeShorts('https://youtube.com/shorts/$id'), isTrue);
      expect(isYoutubeShorts('https://youtu.be/$id'), isFalse);
    });

    test('yaroqsiz havola — ID yo‘q', () {
      for (final u in [
        '',
        'https://youtu.be/abc', // 11 belgi emas
        'https://youtu.be/',
        'https://www.youtube.com/watch',
        'https://www.youtube.com/watch?v=',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ"><',
        'https://www.youtube.com/channel/UCabcdefghijk',
        'https://www.youtube.com/@nfcstore',
        'http://youtu.be/dQw4w9WgXcQ', // https emas
        'https://evil.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
        'https://www.instagram.com/p/dQw4w9WgXcQ',
      ]) {
        expect(youtubeVideoId(u), isNull, reason: u);
      }
    });

    // Ijro faqat odam "Videoni ko'rish" ni O'ZI bosgandan keyin (varaq
    // shu bosishdan ochiladi) — shunda video o'zi boshlanadi (build 330:
    // "ochilyapti, o'ynab ketmayapti"). `music_embed.dart` bilan bir xil.
    test('pleer: "Videoni ko‘rish" dan keyin o‘zi boshlanadi, ilova '
        'kimligi, ≥ 200×200', () {
      final html = ShowcaseYoutubePlayer.html('dQw4w9WgXcQ');
      expect(html, contains('autoplay:1'));
      expect(
          RegExp(r'onReady:function\(e\)\{[^}]*e\.target\.playVideo\(\)')
              .hasMatch(html),
          isTrue,
          reason: 'onReady da zaxira playVideo()');
      expect(html, isNot(contains('mute')), reason: 'ovoz o‘chirilmaydi');
      expect(html, contains('playsinline:1'));
      expect(html, contains("origin:'https://nfcstore.uz'"));
      expect(html, contains("widget_referrer:'https://nfcstore.uz'"));
      expect(html, contains('"dQw4w9WgXcQ"'));
      for (final shorts in [false, true]) {
        for (final w in [180.0, 288.0, 358.0, 700.0]) {
          final s = ShowcaseVideoSheet.playerSize(
              maxWidth: w, screenHeight: 560, shorts: shorts);
          expect(s.width, greaterThanOrEqualTo(200), reason: '$w $shorts');
          expect(s.height, greaterThanOrEqualTo(200), reason: '$w $shorts');
        }
      }
      final shorts = ShowcaseVideoSheet.playerSize(
          maxWidth: 358, screenHeight: 844, shorts: true);
      expect(shorts.height, greaterThan(shorts.width), reason: 'vertikal');
    });

    test('WebView o‘tishlari: pleer freymlari ichida, tashqi havola — '
        'tashqarida', () {
      // Ichki freymlar (YouTube iframe, googlevideo, ytimg, about:blank,
      // srcdoc) — hech qachon to'silmaydi.
      for (final u in [
        'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1',
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'https://rr3---sn-abc.googlevideo.com/videoplayback?x=1',
        'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq.jpg',
        'https://googleads.g.doubleclick.net/pagead/id',
        'about:blank',
        'about:srcdoc',
      ]) {
        expect(youtubeNavStaysInside(u, mainFrame: false), isTrue, reason: u);
      }
      // Asosiy oyna: bazaviy sahifa, about:/data:, YouTube embed.
      for (final u in [
        'https://nfcstore.uz/',
        'https://www.nfcstore.uz/',
        'about:blank',
        'about:srcdoc',
        'data:text/html,<html></html>',
        'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1',
        'https://youtube.com/embed/dQw4w9WgXcQ',
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      ]) {
        expect(youtubeNavStaysInside(u, mainFrame: true), isTrue, reason: u);
      }
      // Haqiqiy tashqi havolalar — ilovadan tashqarida.
      for (final u in [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://www.youtube.com/channel/UCabcdefghijk',
        'https://www.youtube.com/@nfcstore',
        'https://www.youtube.com/shorts/dQw4w9WgXcQ',
        'http://www.youtube.com/embed/dQw4w9WgXcQ',
        'https://evil.com/embed/dQw4w9WgXcQ',
        'https://youtube.com.evil.com/embed/dQw4w9WgXcQ',
        'https://accounts.google.com/ServiceLogin',
      ]) {
        expect(youtubeNavStaysInside(u, mainFrame: true), isFalse, reason: u);
      }
      // Bekor qilingan yuklash (iOS -999, WebKit 102) — zaxira panel emas.
      WebResourceError err(int code) => WebResourceError(
          errorCode: code, description: '', isForMainFrame: true);
      expect(webLoadCancelled(err(-999)), isTrue);
      expect(webLoadCancelled(err(102)), isTrue);
      expect(webLoadCancelled(err(-1009)), isFalse, reason: 'internet yo‘q');
      expect(webLoadCancelled(err(-2)), isFalse, reason: 'Android host');
    });

    const track =
        MusicTrack(id: 5, title: 'Kuy', clipUrl: 'https://nfcstore.uz/m.mp3');
    const ytUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s';

    Future<void> drain(WidgetTester tester) async {
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 40)));
      await settle(tester, frames: 4);
    }

    /// Soxta pleer: WebView o'rniga. Oxirgi `onState` saqlanadi.
    ({List<String> ids, ValueChanged<String> Function() state}) fakePlayer() {
      final ids = <String>[];
      ValueChanged<String>? last;
      showcaseYoutubePlayerOverride = (id, onState) {
        ids.add(id);
        last = onState;
        return ColoredBox(
            key: ValueKey('fake-yt-$id'), color: const Color(0xFF000000));
      };
      addTearDown(() => showcaseYoutubePlayerOverride = null);
      return (ids: ids, state: () => last!);
    }

    testWidgets('YouTube — "Videoni ko‘rish"; Instagram — tashqi tugma',
        (tester) async {
      final l = LUz();
      expect(l.showcaseWatchVideo, 'Videoni ko‘rish');
      expect(LRu().showcaseWatchVideo, 'Смотреть видео');
      expect(LEn().showcaseWatchVideo, 'Watch video');
      await _pump(tester, pages: [
        ReelsPage(items: [_post(link: ytUrl)]),
      ]);
      expect(find.byKey(const ValueKey('showcase-video')), findsOneWidget);
      expect(find.text(l.showcaseWatchVideo), findsOneWidget);
      expect(find.byKey(const ValueKey('showcase-link')), findsNothing);
      expect(find.text(l.showcaseOpenYoutube), findsNothing);
    });

    testWidgets('Instagram profili — tashqi "Instagram’da ochish" qoladi',
        (tester) async {
      final opened = <Uri>[];
      openLinkOverride = (u) async {
        opened.add(u);
        return true;
      };
      addTearDown(() => openLinkOverride = null);
      await _pump(tester, pages: [
        ReelsPage(items: [_post(link: 'https://www.instagram.com/nfcstore')]),
      ]);
      expect(find.byKey(const ValueKey('showcase-video')), findsNothing);
      expect(find.byKey(const ValueKey('showcase-instagram')), findsNothing);
      expect(find.text(LUz().showcaseOpenInstagram), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('showcase-link')));
      await settle(tester, frames: 3);
      expect(opened.single.toString(), 'https://www.instagram.com/nfcstore');
    });

    testWidgets(
        'varaq ochilsa musiqa pauza, pleer ustida hech narsa yo‘q, '
        'yopilsa davom etadi', (tester) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      final yt = fakePlayer();
      final r = await _pump(tester, pages: [
        ReelsPage(items: [_post(link: ytUrl, music: track)]),
      ]);
      await drain(tester);
      expect(v.playing, hasLength(1));

      await tester.tap(find.byKey(const ValueKey('showcase-video')));
      await settle(tester, frames: 10);
      await drain(tester);
      expect(yt.ids, ['dQw4w9WgXcQ']);
      final player = find.byKey(const ValueKey('fake-yt-dQw4w9WgXcQ'));
      expect(player, findsOneWidget);
      expect(v.playing, isEmpty, reason: 'YouTube varag‘i ochiq — musiqa jim');
      expect(v.disposed, isEmpty);

      // Pleer ≥ 200×200 va "YouTube'da ochish" PASTDA, ustida emas.
      final area = tester.getRect(
          find.byKey(const ValueKey('showcase-video-player-area')));
      expect(area.width, greaterThanOrEqualTo(200));
      expect(area.height, greaterThanOrEqualTo(200));
      final ext = tester
          .getRect(find.byKey(const ValueKey('showcase-video-external')));
      expect(ext.top, greaterThanOrEqualTo(area.bottom));
      final close =
          tester.getRect(find.byKey(const ValueKey('showcase-video-close')));
      expect(close.bottom, lessThanOrEqualTo(area.top));

      // Pleerda play — audio egasi YouTube.
      yt.state()('ready');
      yt.state()('playing');
      await settle(tester, frames: 2);
      expect(r.c.read(audioOwnerProvider).current, isNotNull);
      expect(v.playing, isEmpty);

      await tester.tap(find.byKey(const ValueKey('showcase-video-close')));
      await settle(tester, frames: 10);
      await drain(tester);
      expect(player, findsNothing);
      expect(v.playing, hasLength(1), reason: 'yopildi — musiqa davom etadi');
      expect(v.created, hasLength(1));
    });

    testWidgets('🔇 bo‘lsa varaq yopilgach ham musiqa jim', (tester) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      fakePlayer();
      await _pump(tester, pages: [
        ReelsPage(items: [_post(link: ytUrl, music: track)]),
      ]);
      await drain(tester);
      await tester.tap(find.byKey(const ValueKey('showcase-mute')));
      await drain(tester);
      expect(v.playing, isEmpty);
      await tester.tap(find.byKey(const ValueKey('showcase-video')));
      await settle(tester, frames: 10);
      await tester.tap(find.byKey(const ValueKey('showcase-video-close')));
      await settle(tester, frames: 10);
      await drain(tester);
      expect(v.playing, isEmpty);
    });

    testWidgets('101/150 — pleer o‘rnida "YouTube’da ochish"',
        (tester) async {
      final opened = <Uri>[];
      openLinkOverride = (u) async {
        opened.add(u);
        return true;
      };
      addTearDown(() => openLinkOverride = null);
      final yt = fakePlayer();
      await _pump(tester, pages: [
        ReelsPage(items: [_post(link: ytUrl)]),
      ]);
      await tester.tap(find.byKey(const ValueKey('showcase-video')));
      await settle(tester, frames: 10);
      expect(find.byKey(const ValueKey('showcase-video-fallback')), findsNothing);

      yt.state()('error:150');
      await settle(tester, frames: 3);
      expect(find.byKey(const ValueKey('fake-yt-dQw4w9WgXcQ')), findsNothing);
      expect(find.byKey(const ValueKey('showcase-video-fallback')),
          findsOneWidget);
      expect(find.text(LUz().showcaseVideoUnavailable), findsOneWidget);
      await tester
          .tap(find.byKey(const ValueKey('showcase-video-fallback-open')));
      await settle(tester, frames: 3);
      expect(opened.single.toString(), ytUrl);
    });

    testWidgets('pleer javob bermasa — zaxira yo‘l; fonda pleer yo‘q qilinadi',
        (tester) async {
      final yt = fakePlayer();
      await _pump(tester, pages: [
        ReelsPage(items: [_post(link: 'https://youtube.com/shorts/dQw4w9WgXcQ')]),
      ]);
      await tester.tap(find.byKey(const ValueKey('showcase-video')));
      await settle(tester, frames: 10);
      final player = find.byKey(const ValueKey('fake-yt-dQw4w9WgXcQ'));
      expect(player, findsOneWidget);

      // Fonda — pleer yo'q qilinadi (fonda ijro yo'q), qaytilganda
      // YANGI pleer quriladi.
      expect(yt.ids, hasLength(1));
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await settle(tester, frames: 3);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await settle(tester, frames: 3);
      expect(player, findsOneWidget);
      expect(yt.ids, hasLength(2), reason: 'qaytildi — yangi pleer');

      // `ready` kelmadi — vaqt tugagach zaxira yo'l.
      await tester.pump(kShowcaseVideoReadyTimeout);
      await settle(tester, frames: 3);
      expect(find.byKey(const ValueKey('showcase-video-fallback')),
          findsOneWidget);
    });

    testWidgets('lenta kartasi (ShowcaseExtras) — YouTube "Videoni ko‘rish"',
        (tester) async {
      final yt = fakePlayer();
      await tester.pumpWidget(ProviderScope(
        child: wrapScreen(Scaffold(
          body: ShowcaseExtras(
            post: _post(link: 'https://youtu.be/dQw4w9WgXcQ'),
            keyPrefix: 'feed-showcase',
          ),
        )),
      ));
      await settle(tester, frames: 4);
      expect(find.text(LUz().showcaseWatchVideo), findsOneWidget);
      expect(find.byKey(const ValueKey('feed-showcase-link')), findsNothing);
      await tester.tap(find.byKey(const ValueKey('feed-showcase-video')));
      await settle(tester, frames: 10);
      expect(yt.ids, ['dQw4w9WgXcQ']);
      await tester.tap(find.byKey(const ValueKey('showcase-video-close')));
      await settle(tester, frames: 10);
    });
  });

  group('video reklama (admin tanlagan)', () {
    const track =
        MusicTrack(id: 5, title: 'Kuy', clipUrl: 'https://nfcstore.uz/m.mp3');

    Post ad({int id = 900, MusicTrack? music, bool adFlag = true}) =>
        Post.fromJson({
          'id': id,
          'code': 'NFCSTORE',
          'authorName': 'NFCSTORE',
          'featured': !adFlag,
          'ad': adFlag,
          'title': 'Boy777',
          'text': 'Yangi NFC kartalar',
          'videoUrl': '/uploads/promo_boy777.mp4',
          'imageUrl': '/promo/boy777.jpg',
          'linkUrl': 'https://www.instagram.com/nfcstore',
          if (music != null)
            'music': {
              'id': music.id,
              'title': music.title,
              'clipUrl': music.clipUrl,
            },
        });

    Future<void> drain(WidgetTester tester) async {
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 40)));
      await settle(tester, frames: 4);
    }

    int videoId(FakeVideoPlatform v) => v.urls.entries
        .firstWhere((e) => e.value.endsWith('promo_boy777.mp4'))
        .key;

    test('model: ad/featured, nisbiy manzil bazaga ulanadi, poster', () {
      final p = ad();
      expect(p.isShowcaseVideoAd, isTrue);
      expect(p.isAd, isTrue);
      expect(p.videoUrl, 'https://nfcstore.uz/uploads/promo_boy777.mp4');
      expect(p.posterUrl, 'https://nfcstore.uz/promo/boy777.jpg');
      expect(ad(adFlag: false).isShowcaseVideoAd, isTrue, reason: 'featured');
      // Server videoni `/uploads/` dan beradi (Range/206), poster esa
      // `/promo/` da; `/promo/` dagi video ham xuddi shunday ulanadi —
      // maxsus holat yo'q.
      final promo = Post.fromJson({
        'id': 901,
        'ad': true,
        'videoUrl': '/promo/nfcstore-boy777.mp4',
      });
      expect(promo.videoUrl, 'https://nfcstore.uz/promo/nfcstore-boy777.mp4');
      expect(showcasePlayable(promo), isTrue);
      expect(showcasePlayable(p), isTrue);
      expect(showcasePlayable(p.copyWith(likes: 1)), isTrue);
      // Reklama emas — oddiy video ko'rgazmaga tushmaydi.
      expect(
          showcasePlayable(Post.fromJson(
              {'id': 1, 'showcase': true, 'videoUrl': '/uploads/a.mp4'})),
          isFalse);
    });

    testWidgets('video pleer + "Reklama", musiqasiz — o‘z ovozi',
        (tester) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      final r = await _pump(tester, pages: [
        ReelsPage(items: [ad()]),
      ]);
      await drain(tester);
      expect(find.byKey(const ValueKey('showcase-ad-video')), findsOneWidget);
      expect(find.byKey(const ValueKey('showcase-ad-player')), findsOneWidget);
      expect(find.byKey(const ValueKey('showcase-carousel')), findsNothing);
      expect(find.byKey(const ValueKey('showcase-sponsored')), findsOneWidget);
      expect(find.text(LUz().feedSponsored), findsOneWidget);
      expect(v.urls.values,
          contains('https://nfcstore.uz/uploads/promo_boy777.mp4'));
      final id = videoId(v);
      expect(v.playing, {id});
      expect(v.volumeOf[id], 1.0);
      expect(r.c.read(audioOwnerProvider).current, isNotNull);

      // 🔇 — video jim davom etadi.
      await tester.tap(find.byKey(const ValueKey('showcase-mute')));
      await drain(tester);
      expect(v.playing, {id});
      expect(v.volumeOf[id], 0.0);
      expect(r.c.read(audioOwnerProvider).current, isNull);

      // 🔊 — ovoz qaytadi.
      await tester.tap(find.byKey(const ValueKey('showcase-mute')));
      await drain(tester);
      expect(v.volumeOf[id], 1.0);
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(minutes: 1));
    });

    testWidgets('musiqali reklama: video ovozsiz, musiqa o‘ynaydi; 🔇 — jim',
        (tester) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      await _pump(tester, pages: [
        ReelsPage(items: [ad(music: track)]),
      ]);
      await drain(tester);
      final id = videoId(v);
      final music =
          v.urls.entries.firstWhere((e) => e.value.endsWith('m.mp3')).key;
      expect(v.playing, {id, music});
      expect(v.volumeOf[id], 0.0, reason: 'musiqa bor — video ovozsiz');
      expect(v.volumeOf[music], 1.0);

      await tester.tap(find.byKey(const ValueKey('showcase-mute')));
      await drain(tester);
      expect(v.playing, {id}, reason: 'musiqa to‘xtadi, video jim o‘ynaydi');
      expect(v.volumeOf[id], 0.0);
    });

    testWidgets('ekrandan chiqsa pauza va yo‘q qilinadi; boshqa tab — pauza',
        (tester) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      final r = await _pump(tester, pages: [
        ReelsPage(items: [ad(), _post(id: 2)]),
      ]);
      await drain(tester);
      final id = videoId(v);
      expect(v.playing, {id});

      // Boshqa tab — to'xtaydi va yopiladi.
      r.c.read(activeTabProvider.notifier).state = 0;
      await settle(tester, frames: 4);
      await drain(tester);
      expect(v.playing, isEmpty);
      expect(v.alive, isNot(contains(id)));

      // Qaytildi — yangi pleer o'ynaydi.
      r.c.read(activeTabProvider.notifier).state = kShowcaseTab;
      await settle(tester, frames: 4);
      await drain(tester);
      expect(v.created, hasLength(2), reason: 'yangi pleer');
      final id2 = v.created.last;
      expect(v.playing, {id2});

      // Keyingi sahifaga surildi — reklama videosi to'xtaydi.
      await tester.fling(find.byKey(const ValueKey('showcase-pager')),
          const Offset(0, -600), 2000);
      await settle(tester, frames: 10);
      await drain(tester);
      expect(v.playing, isEmpty);
      expect(v.alive, isNot(contains(id2)), reason: 'ko‘rinmaydi — yopildi');
    });
  });

  group('Instagram — ilova ichida rasmiy embed', () {
    const code = 'C9xYz_Ab-12';
    const reelUrl = 'https://www.instagram.com/reel/$code/?igsh=abc123';

    test('shortcode: reel/reels/p/tv, parametrlar bilan; profil — null', () {
      final reel = 'https://www.instagram.com/reel/$code/embed/';
      final post = 'https://www.instagram.com/p/$code/embed/';
      final cases = {
        'https://www.instagram.com/reel/$code/': reel,
        'https://instagram.com/reel/$code': reel,
        'https://www.instagram.com/reels/$code/': reel,
        'https://m.instagram.com/reel/$code/?utm_source=ig_web_copy_link':
            reel,
        reelUrl: reel,
        'https://www.instagram.com/p/$code/': post,
        'https://www.instagram.com/p/$code/?img_index=2': post,
        'https://www.instagram.com/tv/$code/': post,
        'https://www.instagram.com/nfcstore/p/$code/': post,
        'https://www.instagram.com/nfcstore/reel/$code/': reel,
      };
      cases.forEach((u, want) {
        expect(instagramEmbedUri(u)?.toString(), want, reason: u);
      });
      for (final u in [
        '',
        'https://www.instagram.com/nfcstore',
        'https://www.instagram.com/nfcstore/',
        'https://www.instagram.com/explore/tags/nfc/',
        'https://www.instagram.com/p/',
        'https://www.instagram.com/p/x', // juda qisqa
        'https://www.instagram.com/p/a%22b<c/',
        'http://www.instagram.com/p/$code/', // https emas
        'https://evil.com/p/$code/',
        'https://instagram.com.evil.com/p/$code/',
        'https://youtu.be/dQw4w9WgXcQ',
      ]) {
        expect(instagramEmbedUri(u), isNull, reason: u);
      }
    });

    test('embed ichida faqat o‘zi; boshqa o‘tishlar — tashqarida', () {
      final e = Uri.parse('https://www.instagram.com/reel/$code/embed/');
      expect(instagramEmbedStaysInside(e, e.toString()), isTrue);
      expect(
          instagramEmbedStaysInside(
              e, 'https://www.instagram.com/reel/$code/embed'),
          isTrue);
      expect(instagramEmbedStaysInside(e, 'about:blank'), isTrue);
      for (final u in [
        'https://www.instagram.com/reel/$code/',
        'https://www.instagram.com/nfcstore/',
        'https://www.instagram.com/accounts/login/',
        'https://evil.com/reel/$code/embed/',
      ]) {
        expect(instagramEmbedStaysInside(e, u), isFalse, reason: u);
      }
    });

    const track =
        MusicTrack(id: 5, title: 'Kuy', clipUrl: 'https://nfcstore.uz/m.mp3');

    Future<void> drain(WidgetTester tester) async {
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 40)));
      await settle(tester, frames: 4);
    }

    ({List<Uri> embeds, ValueChanged<String> Function() state}) fakeEmbed() {
      final embeds = <Uri>[];
      ValueChanged<String>? last;
      showcaseInstagramEmbedOverride = (e, onState) {
        embeds.add(e);
        last = onState;
        return const ColoredBox(
            key: ValueKey('fake-ig'), color: Color(0xFFFFFFFF));
      };
      addTearDown(() => showcaseInstagramEmbedOverride = null);
      return (embeds: embeds, state: () => last!);
    }

    testWidgets('tugma yozuvi havola turiga qarab', (tester) async {
      final l = LUz();
      expect(l.showcaseWatchInstagram, 'Instagram’da ko‘rish');
      expect(LRu().showcaseWatchInstagram, 'Смотреть в Instagram');
      expect(LEn().showcaseWatchInstagram, 'View on Instagram');
      await _pump(tester, pages: [
        ReelsPage(items: [_post(link: reelUrl)]),
      ]);
      expect(find.byKey(const ValueKey('showcase-instagram')), findsOneWidget);
      expect(find.text(l.showcaseWatchInstagram), findsOneWidget);
      expect(find.byKey(const ValueKey('showcase-link')), findsNothing);
      expect(find.text(l.showcaseOpenInstagram), findsNothing);
    });

    testWidgets('varaq: musiqa pauza, embed ostida tashqi havola, '
        'yopilsa davom etadi', (tester) async {
      final v = FakeVideoPlatform();
      VideoPlayerPlatform.instance = v;
      final ig = fakeEmbed();
      final opened = <Uri>[];
      openLinkOverride = (u) async {
        opened.add(u);
        return true;
      };
      addTearDown(() => openLinkOverride = null);
      await _pump(tester, pages: [
        ReelsPage(items: [_post(link: reelUrl, music: track)]),
      ]);
      await drain(tester);
      expect(v.playing, hasLength(1));

      await tester.tap(find.byKey(const ValueKey('showcase-instagram')));
      await settle(tester, frames: 10);
      await drain(tester);
      expect(ig.embeds.single.toString(),
          'https://www.instagram.com/reel/$code/embed/');
      expect(find.byKey(const ValueKey('fake-ig')), findsOneWidget);
      expect(v.playing, isEmpty, reason: 'Instagram varag‘i ochiq');
      ig.state()('ready');
      await settle(tester, frames: 2);

      final area = tester.getRect(find.byKey(const ValueKey('showcase-ig-area')));
      final ext =
          tester.getRect(find.byKey(const ValueKey('showcase-ig-external')));
      expect(ext.top, greaterThanOrEqualTo(area.bottom));
      await tester.tap(find.byKey(const ValueKey('showcase-ig-external')));
      await settle(tester, frames: 3);
      expect(opened.single.toString(), reelUrl);

      await tester.tap(find.byKey(const ValueKey('showcase-ig-close')));
      await settle(tester, frames: 10);
      await drain(tester);
      expect(find.byKey(const ValueKey('fake-ig')), findsNothing);
      expect(v.playing, hasLength(1), reason: 'yopildi — musiqa davom etadi');
    });

    testWidgets('yuklanmasa — embed o‘rnida "Instagram’da ochish"',
        (tester) async {
      final ig = fakeEmbed();
      await _pump(tester, pages: [
        ReelsPage(items: [_post(link: reelUrl)]),
      ]);
      await tester.tap(find.byKey(const ValueKey('showcase-instagram')));
      await settle(tester, frames: 10);
      ig.state()('error:load');
      await settle(tester, frames: 3);
      expect(find.byKey(const ValueKey('fake-ig')), findsNothing);
      expect(find.byKey(const ValueKey('showcase-ig-fallback')), findsOneWidget);
      expect(find.text(LUz().showcaseInstagramUnavailable), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('showcase-ig-close')));
      await settle(tester, frames: 10);

      // Javobsizlik ham — zaxira yo'l.
      await tester.tap(find.byKey(const ValueKey('showcase-instagram')));
      await settle(tester, frames: 10);
      await tester.pump(kShowcaseInstagramTimeout);
      await settle(tester, frames: 3);
      expect(find.byKey(const ValueKey('showcase-ig-fallback')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('showcase-ig-close')));
      await settle(tester, frames: 10);
    });
  });

  group('/api/showcase so‘rovi', () {
    test('har sahifada video=1 (birinchi va kursor bilan)', () async {
      final api = _Api();
      final repo = SocialRepository(api);
      await repo.showcasePage();
      await repo.showcasePage(cursor: 'c1');
      expect(api.gets.map((g) => g.$1), ['/api/showcase', '/api/showcase']);
      expect(api.gets[0].$2, {'limit': 10, 'video': 1});
      expect(api.gets[1].$2, {'limit': 10, 'video': 1, 'cursor': 'c1'});
    });
  });
}

class _Api extends ApiClient {
  final gets = <(String, Map<String, dynamic>?)>[];

  @override
  Future<Result<T>> get<T>(String path, {Map<String, dynamic>? query}) async {
    gets.add((path, query));
    return Ok(<String, dynamic>{'items': <Object>[]} as T);
  }
}
