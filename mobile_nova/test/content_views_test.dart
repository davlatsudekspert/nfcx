import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/settings/analytics_screen.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// KO'RISHLAR (Instagram kabi) va Sozlamalar → Analitika.
///
///   server `viewCount` o'qiladi · Reels'da ko'z belgisi + son ·
///   reel 2 soniya ko'rinsa yuboriladi (tez o'tilgani yo'q) ·
///   kompaniya posti o'z turi bilan · analitika ekrani raqamlari.
///
/// QAYTA KIRISH (egasi, 2026-10-04): har bir kirish alohida ko'rish —
///   chiqib (boshqa reel/tab, ustiga ekran, ilova fonga) qaytib yana
///   2 soniya ko'rsa yana yuboriladi; bir kirishda aylanib tursa — yo'q.
///   Post tafsiloti (`/post/:id`) ham xuddi shunday.
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

final _reels = [
  const Post(
    id: 7,
    code: 'PPP777',
    authorName: 'Mashrabboy',
    mediaUrls: ['https://nfcstore.uz/uploads/a.mp4'],
    isVideo: true,
    views: 1234,
  ),
  const Post(
    id: 8,
    code: 'KARTAUZ',
    authorName: 'Karta Uz',
    authorKind: 'company',
    mediaUrls: ['https://nfcstore.uz/uploads/b.mp4'],
    isVideo: true,
  ),
];

typedef _Reels = ({FakeSocialRepository social, ProviderContainer c});

Future<_Reels> _pumpReels(WidgetTester tester) async {
  VideoPlayerPlatform.instance = FakeVideoPlatform();
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final social = FakeSocialRepository();
  final base = await testOverrides();
  final c = ProviderContainer(overrides: [
    ...base.where((o) => !identical(o, base[2])),
    socialRepositoryProvider.overrideWithValue(social),
    profileRepositoryProvider.overrideWithValue(_Profile()),
    businessRepositoryProvider.overrideWithValue(_Biz()),
    reelsProvider.overrideWith((ref) async => _reels),
    activeTabProvider.overrideWith((ref) => 3),
  ]);
  addTearDown(c.dispose);
  await tester.pumpWidget(UncontrolledProviderScope(
    container: c,
    child: wrapScreen(const ReelsScreen()),
  ));
  await settle(tester, frames: 10);
  return (social: social, c: c);
}

/// Ilova fonga ketishi va qaytishi — haqiqiy platforma ketma-ketligi.
void _background(WidgetTester tester) {
  for (final s in const [
    AppLifecycleState.inactive,
    AppLifecycleState.hidden,
    AppLifecycleState.paused,
  ]) {
    tester.binding.handleAppLifecycleStateChanged(s);
  }
}

void _foreground(WidgetTester tester) {
  for (final s in const [
    AppLifecycleState.hidden,
    AppLifecycleState.inactive,
    AppLifecycleState.resumed,
  ]) {
    tester.binding.handleAppLifecycleStateChanged(s);
  }
}

/// Ustiga oddiy (shaffof bo'lmagan) ekran ochiladi — `TickerMode` o'chadi.
Future<void> _pushCover(WidgetTester tester, Finder under) async {
  Navigator.of(tester.element(under)).push(MaterialPageRoute<void>(
    builder: (_) => const Scaffold(body: Text('ustidagi ekran')),
  ));
  await settle(tester, frames: 8);
  expect(find.text('ustidagi ekran'), findsOneWidget);
}

Future<void> _popCover(WidgetTester tester) async {
  Navigator.of(tester.element(find.text('ustidagi ekran'))).pop();
  await settle(tester, frames: 8);
  expect(find.text('ustidagi ekran'), findsNothing);
}

const _photo = 'assets/demo/z_post_cafe.jpg';

/// Post tafsiloti uchun server: bitta post (yoki xato).
class _PostSocial extends FakeSocialRepository {
  _PostSocial(this.post, {this.fail = false});

  final Post post;
  final bool fail;

  @override
  Future<Result<Post>> postIn(String code, int id,
          {bool company = false}) async =>
      fail ? const Err(AppError(AppErrorKind.notFound)) : Ok(post);

  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
    String kind,
    int id, {
    int page = 1,
  }) async =>
      const Ok((items: <Comment>[], hasMore: false, total: 0));

  /// Javob — postdagi son + shu testda yuborilganlar.
  @override
  Future<Result<int>> recordView(int id, {bool company = false}) async {
    await super.recordView(id, company: company);
    return Ok(post.views + viewed.length);
  }
}

Future<void> _pumpPost(WidgetTester tester, _PostSocial social,
    {bool company = false}) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final base = await testOverrides();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...base.where((o) => !identical(o, base[2])),
      socialRepositoryProvider.overrideWithValue(social),
      profileRepositoryProvider.overrideWithValue(_Profile()),
      businessRepositoryProvider.overrideWithValue(_Biz()),
    ],
    child: wrapScreen(PostScreen(
        id: social.post.id, code: social.post.code, company: company)),
  ));
  await settle(tester, frames: 4);
}

Finder _postViews(String text) => find.descendant(
    of: find.byKey(const ValueKey('post-views')), matching: find.text(text));

void main() {
  test('Post.fromJson — server viewCount', () {
    expect(Post.fromJson({'id': 1, 'viewCount': 57}).views, 57);
    expect(Post.fromJson({'id': 1}).views, 0);
    expect(const Post(id: 1, views: 3).copyWith(liked: true).views, 3);
    expect(const Post(id: 1, views: 3).copyWithKind(kind: 'post').views, 3);
  });

  test('Katalog tovari — server views (Tanlov va vitrina)', () {
    final p = CatalogProduct.fromJson({
      'id': 'item-1',
      'name': 'Metall karta',
      'views': 12,
      'company': {'companyId': 'KARTAUZ'},
    });
    expect(p.views, 12);
    final i = CatalogItem.fromJson({'id': 5, 'name': 'Stiker', 'views': 3});
    expect(i.views, 3);
    expect(CatalogProduct.fromItem(i, const Business(companyId: 'KARTAUZ')).views, 3);
  });

  test('MyAnalytics.fromJson', () {
    final a = MyAnalytics.fromJson({
      'days': 30,
      'profile': {'views': 40, 'uniqueVisitors': 12, 'clicks': 5, 'totalViews': 900},
      'followers': 7,
      'content': {'posts': 2, 'views': 300, 'likes': 9, 'comments': 4},
      'byDay': [
        {'day': '2026-10-03', 'views': 100},
        {'day': '2026-10-04', 'views': 200},
      ],
      'top': [
        {'kind': 'post', 'id': 5, 'videoUrl': '/uploads/r.mp4', 'views': 250, 'likes': 6, 'comments': 3},
      ],
    });
    expect([a.profileViews, a.uniqueVisitors, a.clicks, a.profileTotalViews], [40, 12, 5, 900]);
    expect([a.followers, a.posts, a.contentViews, a.likes, a.comments], [7, 2, 300, 9, 4]);
    expect(a.byDay.map((d) => d.views), [100, 200]);
    expect(a.top.single.isVideo, isTrue);
    expect(a.top.single.views, 250);
    // Bo'sh yoki buzuq javob — yiqilmaydi.
    expect(MyAnalytics.fromJson(const {}).top, isEmpty);
  });

  testWidgets('Reels: ko‘z belgisi va son ko‘rinadi', (tester) async {
    await _pumpReels(tester);
    final label = find.byKey(const ValueKey('reel-views'));
    expect(label, findsWidgets);
    expect(
        find.descendant(of: label.first, matching: find.text('1.2K')),
        findsOneWidget);
  });

  testWidgets('Reels: 2 soniya ko‘rinsa BIR MARTA yuboriladi, javob ko‘rinadi',
      (tester) async {
    final social = (await _pumpReels(tester)).social;
    expect(social.viewed, isEmpty, reason: 'darhol emas — tez o‘tilsa sanalmaydi');

    await tester.pump(kViewAfter);
    await settle(tester, frames: 3);
    expect(social.viewed, [(id: 7, company: false)]);
    // Javobdagi jami son (soxta repo: 1) ko'rsatiladi.
    expect(
        find.descendant(
            of: find.byKey(const ValueKey('reel-views')).first,
            matching: find.text('1')),
        findsOneWidget);

    // Yana kutish — qayta yuborilmaydi.
    await tester.pump(kViewAfter * 2);
    await settle(tester, frames: 3);
    expect(social.viewed.length, 1);
  });

  testWidgets('Reels: tez o‘tilgan reel sanalmaydi, kompaniya posti o‘z turi bilan',
      (tester) async {
    final social = (await _pumpReels(tester)).social;
    // Birinchisi 2 soniyaga yetmasdan keyingisiga o'tiladi.
    await tester.pump(const Duration(milliseconds: 800));
    await tester.fling(find.byKey(const ValueKey('reels-pager')),
        const Offset(0, -600), 2000);
    await settle(tester, frames: 12);
    await tester.pump(kViewAfter);
    await settle(tester, frames: 3);
    expect(social.viewed, [(id: 8, company: true)]);
  });

  // ── QAYTA KIRISH (egasi, 2026-10-04) ──────────────────────────────
  const r7 = (id: 7, company: false);
  const r8 = (id: 8, company: true);

  testWidgets('Reels: 10 soniya aylanib tursa ham BIR MARTA', (tester) async {
    final social = (await _pumpReels(tester)).social;
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(seconds: 1));
    }
    await settle(tester, frames: 3);
    expect(social.viewed, [r7]);
  });

  testWidgets('Reels: boshqa tabga chiqib qaytib 2 soniya ko‘rsa — yana +1',
      (tester) async {
    final r = await _pumpReels(tester);
    await tester.pump(kViewAfter);
    await settle(tester, frames: 3);
    expect(r.social.viewed, [r7]);

    // Boshqa tab — reel ko'rinmaydi (`visible: false`), holat tirik.
    r.c.read(activeTabProvider.notifier).state = 0;
    await settle(tester, frames: 3);
    await tester.pump(kViewAfter * 3);
    expect(r.social.viewed, [r7], reason: 'yashirin tabda sanalmaydi');

    // Qaytdi — darhol emas, 2 soniyadan keyin.
    r.c.read(activeTabProvider.notifier).state = 3;
    await settle(tester, frames: 3);
    await tester.pump(const Duration(milliseconds: 1500));
    expect(r.social.viewed, [r7], reason: '2 soniya hali to‘lmadi');
    await tester.pump(const Duration(milliseconds: 600));
    await settle(tester, frames: 3);
    expect(r.social.viewed, [r7, r7]);
    // Javobdagi yangi jami son ko'rinadi (soxta repo: 2).
    expect(
        find.descendant(
            of: find.byKey(const ValueKey('reel-views')).first,
            matching: find.text('2')),
        findsOneWidget);

    // Shu kirishda yana kutish — qayta yuborilmaydi.
    await tester.pump(kViewAfter * 3);
    expect(r.social.viewed.length, 2);
  });

  testWidgets('Reels: qo‘shni reelga o‘tib qaytsa — yana sanaladi',
      (tester) async {
    final social = (await _pumpReels(tester)).social;
    await tester.pump(kViewAfter);
    await settle(tester, frames: 3);
    expect(social.viewed, [r7]);

    final pager = find.byKey(const ValueKey('reels-pager'));
    await tester.fling(pager, const Offset(0, -600), 2000);
    await settle(tester, frames: 12);
    await tester.pump(kViewAfter);
    await settle(tester, frames: 3);
    expect(social.viewed, [r7, r8]);

    // Orqaga — oldingi sahifaning holati (`State`) tirik edi; ilgari u
    // "yuborildi" deb qolib, qayta ko'rish sanalmasdi.
    await tester.fling(pager, const Offset(0, 600), 2000);
    await settle(tester, frames: 12);
    await tester.pump(kViewAfter);
    await settle(tester, frames: 3);
    expect(social.viewed, [r7, r8, r7]);
  });

  testWidgets('Reels: ilova fonga ketib qaytsa — yana sanaladi',
      (tester) async {
    addTearDown(() => tester.binding
        .handleAppLifecycleStateChanged(AppLifecycleState.resumed));
    final social = (await _pumpReels(tester)).social;
    await tester.pump(kViewAfter);
    await settle(tester, frames: 3);
    expect(social.viewed, [r7]);

    _background(tester);
    await tester.pump(kViewAfter * 3);
    expect(social.viewed, [r7], reason: 'fonda sanalmaydi');

    _foreground(tester);
    await tester.pump(const Duration(milliseconds: 1500));
    expect(social.viewed, [r7]);
    await tester.pump(const Duration(milliseconds: 600));
    await settle(tester, frames: 3);
    expect(social.viewed, [r7, r7]);
  });

  testWidgets('Reels: 2 soniyaga yetmay fonga ketsa — hisob boshidan',
      (tester) async {
    addTearDown(() => tester.binding
        .handleAppLifecycleStateChanged(AppLifecycleState.resumed));
    final social = (await _pumpReels(tester)).social;
    // `_pumpReels` 0.8 s kutadi; yana 1 s — jami 1.8 s, keyin fonga.
    await tester.pump(const Duration(seconds: 1));
    _background(tester);
    await tester.pump(kViewAfter);
    _foreground(tester);
    await tester.pump(const Duration(milliseconds: 1500));
    expect(social.viewed, isEmpty, reason: 'oldingi 1.8 s qo‘shilmaydi');
    await tester.pump(const Duration(milliseconds: 600));
    await settle(tester, frames: 3);
    expect(social.viewed, [r7]);
  });

  testWidgets('Reels: ustiga boshqa ekran ochilib yopilsa — yana sanaladi',
      (tester) async {
    final social = (await _pumpReels(tester)).social;
    await tester.pump(kViewAfter);
    await settle(tester, frames: 3);
    expect(social.viewed, [r7]);

    await _pushCover(tester, find.byType(ReelsScreen));
    await tester.pump(kViewAfter * 2);
    expect(social.viewed, [r7], reason: 'ostida qolgan reel sanalmaydi');

    await _popCover(tester);
    await tester.pump(kViewAfter);
    await settle(tester, frames: 3);
    expect(social.viewed, [r7, r7]);
  });

  testWidgets('Post: 2 soniyadan keyin BIR MARTA, son media ustida',
      (tester) async {
    final social = _PostSocial(const Post(
        id: 5, code: 'TTS075', mediaUrls: [_photo], views: 41));
    await _pumpPost(tester, social);
    expect(social.viewed, isEmpty, reason: 'darhol emas');
    expect(_postViews('41'), findsOneWidget);

    await tester.pump(kViewAfter);
    await settle(tester, frames: 3);
    expect(social.viewed, [(id: 5, company: false)]);
    expect(_postViews('42'), findsOneWidget,
        reason: 'javobdagi jami son ko‘rsatiladi');

    // Ekranda turaversa — qayta yuborilmaydi.
    await tester.pump(const Duration(seconds: 10));
    expect(social.viewed.length, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Post: chiqib qaytsa va fonga ketib qaytsa — har gal +1',
      (tester) async {
    addTearDown(() => tester.binding
        .handleAppLifecycleStateChanged(AppLifecycleState.resumed));
    final social = _PostSocial(const Post(
        id: 5,
        code: 'KARTAUZ',
        authorKind: 'company',
        mediaUrls: [_photo]));
    await _pumpPost(tester, social, company: true);
    await tester.pump(kViewAfter);
    await settle(tester, frames: 3);
    const v = (id: 5, company: true);
    expect(social.viewed, [v]);

    // Ustiga boshqa ekran (masalan muallif profili) — sanalmaydi.
    await _pushCover(tester, find.byType(PostScreen));
    await tester.pump(kViewAfter * 2);
    expect(social.viewed, [v]);
    await _popCover(tester);
    await tester.pump(kViewAfter);
    await settle(tester, frames: 3);
    expect(social.viewed, [v, v]);

    // Ilova fonga ketib qaytdi.
    _background(tester);
    await tester.pump(kViewAfter * 2);
    expect(social.viewed, [v, v]);
    _foreground(tester);
    await tester.pump(kViewAfter);
    await settle(tester, frames: 3);
    expect(social.viewed, [v, v, v]);
  });

  testWidgets('Post: yuklanmagan post va story sanalmaydi', (tester) async {
    final failed = _PostSocial(
        const Post(id: 5, code: 'TTS075', mediaUrls: [_photo]),
        fail: true);
    await _pumpPost(tester, failed);
    await tester.pump(kViewAfter * 3);
    expect(failed.viewed, isEmpty, reason: 'xato bo‘lgan post');

    final story = _PostSocial(const Post(
        id: 6, code: 'TTS075', kind: 'story', mediaUrls: [_photo]));
    await _pumpPost(tester, story);
    await tester.pump(kViewAfter * 3);
    expect(story.viewed, isEmpty, reason: 'story o‘z ko‘rishlari bilan');
  });

  testWidgets('Analitika ekrani — raqamlar va eng ko‘p ko‘rilganlar',
      (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 1400 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final base = await testOverrides();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...base,
        myAnalyticsProvider.overrideWith((ref) async => const MyAnalytics(
              profileViews: 40,
              followers: 7,
              contentViews: 1500,
              likes: 9,
              comments: 4,
              byDay: [(day: '2026-10-04', views: 1500)],
              top: [
                TopContent(id: 5, caption: 'Yangi kolleksiya', views: 1500),
              ],
            )),
      ],
      child: wrapScreen(const AnalyticsScreen()),
    ));
    await settle(tester, frames: 6);
    expect(find.text('Analitika'), findsWidgets);
    expect(
        find.descendant(
            of: find.byKey(const ValueKey('an-content-views')),
            matching: find.text('1.5K')),
        findsOneWidget);
    expect(
        find.descendant(
            of: find.byKey(const ValueKey('an-profile-views')),
            matching: find.text('40')),
        findsOneWidget);
    expect(find.byKey(const ValueKey('an-top-post-5')), findsOneWidget);
    expect(find.text('Yangi kolleksiya'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
