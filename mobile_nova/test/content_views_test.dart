import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/settings/analytics_screen.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// KO'RISHLAR (Instagram kabi) va Sozlamalar → Analitika.
///
///   server `viewCount` o'qiladi · Reels'da ko'z belgisi + son ·
///   reel 2 soniya ko'rinsa BIR MARTA yuboriladi (tez o'tilgani yo'q) ·
///   kompaniya posti o'z turi bilan · analitika ekrani raqamlari.
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

Future<FakeSocialRepository> _pumpReels(WidgetTester tester) async {
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
  return social;
}

void main() {
  test('Post.fromJson — server viewCount', () {
    expect(Post.fromJson({'id': 1, 'viewCount': 57}).views, 57);
    expect(Post.fromJson({'id': 1}).views, 0);
    expect(const Post(id: 1, views: 3).copyWith(liked: true).views, 3);
    expect(const Post(id: 1, views: 3).copyWithKind(kind: 'post').views, 3);
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
    final social = await _pumpReels(tester);
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
    final social = await _pumpReels(tester);
    // Birinchisi 2 soniyaga yetmasdan keyingisiga o'tiladi.
    await tester.pump(const Duration(milliseconds: 800));
    await tester.fling(find.byKey(const ValueKey('reels-pager')),
        const Offset(0, -600), 2000);
    await settle(tester, frames: 12);
    await tester.pump(kViewAfter);
    await settle(tester, frames: 3);
    expect(social.viewed, [(id: 8, company: true)]);
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
