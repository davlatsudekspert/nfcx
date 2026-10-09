import 'package:flutter/material.dart';
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
import 'package:nfcstore_nova/features/showcase/showcase_sound.dart';
import 'package:nfcstore_nova/features/social/media_carousel.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_en.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_ru.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

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

void main() {
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

  testWidgets('rasm bosilsa — butun ekranda ko‘rish', (tester) async {
    await _pump(tester, pages: [
      ReelsPage(items: [_post(images: 2)]),
    ]);
    await tester.tap(find.byKey(const ValueKey('showcase-image-0')));
    await settle(tester, frames: 6);
    expect(find.byKey(const ValueKey('image-viewer')), findsOneWidget);
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

      // Rasm butun ekranda — musiqa davom etadi. Ochiq izoh pastki
      // yarmini egallaydi, shuning uchun rasmning yuqori qismi bosiladi.
      await tester.tapAt(tester
          .getTopLeft(find.byKey(const ValueKey('showcase-image-0')))
          .translate(150, 250));
      await settle(tester, frames: 6);
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
      await tester.tap(find.byKey(const ValueKey('showcase-image-0')).last);
      await settle(tester, frames: 6);
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
}
