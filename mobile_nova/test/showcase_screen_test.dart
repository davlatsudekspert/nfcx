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
}) =>
    Post.fromJson({
      'id': id,
      'code': 'C7',
      'authorName': 'Ali Market',
      'authorKind': 'company',
      'showcase': true,
      'title': 'Qizil ko‘ylak',
      'priceUzs': 125000,
      'text': 'Yangi kolleksiya',
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
}
