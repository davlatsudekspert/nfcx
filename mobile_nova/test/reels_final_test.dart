import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// REELS — egasining ro'yxati bo'yicha.
///
///   vertikal silash · oldindan yuklash · like + haqiqiy son ·
///   izoh + son · ulashish · saqlash · shikoyat · obuna ·
///   avatar/ism/matn · pastki navigatsiyadan chiqish qotmasin.
class _Social extends FakeSocialRepository {
  final likes = <({int id, bool company})>[];

  @override
  Future<Result<({bool liked, int count})>> like(int id,
      {bool company = false}) async {
    likes.add((id: id, company: company));
    return Ok((liked: true, count: 43));
  }

  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
          String kind, int id, {int page = 1}) async =>
      const Ok((items: <Comment>[], hasMore: false, total: 12));
}

class _Profile extends ProfileRepository {
  _Profile() : super(ApiClient());
  final followed = <String>[];
  final companyToggles = <String>[];

  @override
  Future<Result<void>> follow(String code) async {
    followed.add(code);
    return const Ok(null);
  }

  @override
  Future<Result<bool>> toggleCompanyFollow(String companyId) async {
    companyToggles.add(companyId);
    return const Ok(true);
  }

  @override
  Future<Result<FollowStats>> followStats(String code) async =>
      const Ok((followers: 0, following: 0, isFollowing: false));

  @override
  Future<Result<List<NfcId>>> followList(String code, {String dir = 'followers'}) async =>
      const Ok([]);
}

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
    comments: 5,
  ),
  Post(
    id: 7,
    code: 'KARTAUZ',
    authorName: 'Karta Uz',
    authorKind: 'company',
    mediaUrls: const ['https://nfcstore.uz/uploads/b.mp4'],
    isVideo: true,
    likes: 3,
  ),
  Post(
    id: 9,
    code: 'ALI000',
    authorName: 'Aliyorbek',
    mediaUrls: const ['https://nfcstore.uz/uploads/c.mp4'],
    isVideo: true,
  ),
];

Future<({ProviderContainer c, _Social social, _Profile profile})> _pump(
    WidgetTester tester, FakeVideoPlatform video) async {
  VideoPlayerPlatform.instance = video;
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final social = _Social();
  final profile = _Profile();
  final base = await testOverrides();
  final c = ProviderContainer(overrides: [
    ...base.where((o) => !identical(o, base[2])),
    socialRepositoryProvider.overrideWithValue(social),
    profileRepositoryProvider.overrideWithValue(profile),
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
  return (c: c, social: social, profile: profile);
}

/// `video_player` kontrollerni yo'q qilishni HAQIQIY asinxron navbatda
/// yakunlaydi — soxta vaqt bilan ilgarilamaydi. Shuning uchun tekshiruvdan
/// oldin qisqa haqiqiy kutish.
Future<void> _flush(WidgetTester tester) async {
  await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 40)));
  await settle(tester, frames: 3);
}

void main() {
  testWidgets('oldindan yuklash: ko‘rinayotgan + KEYINGI, ortiqchasi yo‘q',
      (tester) async {
    final v = FakeVideoPlatform();
    await _pump(tester, v);

    expect(v.alive.length, 2, reason: 'faqat joriy va keyingi video');
    expect(v.playing.length, 1, reason: 'keyingisi pauzada turadi');
    expect(v.urls[v.playing.single], contains('a.mp4'));

    // Silash — keyingi video DARHOL o'ynaydi (u tayyor edi).
    await tester.fling(find.byKey(const ValueKey('reels-pager')),
        const Offset(0, -600), 2000);
    await settle(tester, frames: 12);
    await _flush(tester);
    expect(v.urls[v.playing.single], contains('b.mp4'));
    expect(v.alive.length, 2, reason: 'birinchisi yo‘q qilinadi, uchinchisi yuklanadi');
    expect(v.alive.map((i) => v.urls[i]).any((u) => u!.contains('a.mp4')), isFalse);
  });

  testWidgets('pastki navigatsiyadan chiqish: hammasi to‘xtaydi, qaytganda ochiladi',
      (tester) async {
    final v = FakeVideoPlatform(initDelay: const Duration(milliseconds: 300));
    final r = await _pump(tester, v);

    // Video HALI yuklanayotganda boshqa tabga o'tiladi.
    r.c.read(activeTabProvider.notifier).state = 0;
    await settle(tester, frames: 8);
    await _flush(tester);
    expect(v.alive, isEmpty, reason: 'boshqa tabda video yashamasin');
    expect(v.playing, isEmpty);

    // Qaytganda — "ochilmadi" holatida QOTIB qolmaydi.
    r.c.read(activeTabProvider.notifier).state = 3;
    await settle(tester, frames: 12);
    await _flush(tester);
    expect(v.playing.length, 1);
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.text(l.actionRetry), findsNothing);
  });

  testWidgets('like — umumiy holat, KOMPANIYA reeli o‘z endpointiga',
      (tester) async {
    final v = FakeVideoPlatform();
    final r = await _pump(tester, v);

    expect(find.text('42'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('reel-like')).first);
    await settle(tester, frames: 4);
    expect(find.text('43'), findsOneWidget, reason: 'server soni');
    expect(r.social.likes.single, (id: 7, company: false));

    await tester.fling(find.byKey(const ValueKey('reels-pager')),
        const Offset(0, -600), 2000);
    await settle(tester, frames: 12);
    // Kompaniyaning 7-posti — shaxsiy 7-postning yuragi unga O'TMAYDI.
    expect(find.text('3'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('reel-like')).last);
    await settle(tester, frames: 4);
    expect(r.social.likes.last, (id: 7, company: true));
  });

  testWidgets('izohlar varag‘i: haqiqiy son', (tester) async {
    await _pump(tester, FakeVideoPlatform());
    expect(find.text('5'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('reel-comments')).first);
    await settle(tester, frames: 12);
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.text('${l.postComments} · 12'.toUpperCase()), findsOneWidget);
    await tester.tapAt(const Offset(20, 40));
    await settle(tester, frames: 12);
    expect(find.text('12'), findsOneWidget, reason: 'tugmadagi son yangilanadi');
  });

  testWidgets('obuna: shaxsiy va kompaniya — to‘g‘ri endpoint', (tester) async {
    final r = await _pump(tester, FakeVideoPlatform());
    await tester.tap(find.byKey(const ValueKey('reel-follow')).first);
    await settle(tester, frames: 4);
    expect(r.profile.followed, ['PPP777']);

    await tester.fling(find.byKey(const ValueKey('reels-pager')),
        const Offset(0, -600), 2000);
    await settle(tester, frames: 12);
    await tester.tap(find.byKey(const ValueKey('reel-follow')).last);
    await settle(tester, frames: 4);
    expect(r.profile.companyToggles, ['KARTAUZ']);
  });

  testWidgets('saqlash (shu telefonda) va shikoyat menyusi', (tester) async {
    final r = await _pump(tester, FakeVideoPlatform());
    final l = await L.delegate.load(const Locale('uz'));

    await tester.tap(find.byKey(const ValueKey('reel-save')).first);
    await settle(tester, frames: 4);
    expect(r.c.read(savedReelsProvider), contains('p:7'));
    expect(find.text(l.reelSavedLocal), findsOneWidget,
        reason: 'odamga saqlash telefonda ekanini aytamiz');

    await tester.tap(find.byKey(const ValueKey('reel-more')).first);
    await settle(tester, frames: 10);
    expect(find.byKey(const ValueKey('reel-report')), findsOneWidget);
    expect(find.byKey(const ValueKey('reel-block')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('reel-report')));
    await settle(tester, frames: 10);
    expect(find.text(l.reportReasonPorn), findsOneWidget);
  });

  testWidgets('avatar, ism, NFC ID va matn ko‘rinadi', (tester) async {
    await _pump(tester, FakeVideoPlatform());
    expect(find.text('Mashrabboy'), findsOneWidget);
    expect(find.text('PPP777'), findsOneWidget);
    expect(find.text('Toshkent kechasi'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('cheksiz aylanish: oxirgisidan keyin yana birinchisi',
      (tester) async {
    final v = FakeVideoPlatform();
    await _pump(tester, v);
    // 3 ta reel: a → b → c → yana a (egasi, 2026-09: "loop infinity").
    for (final want in ['b.mp4', 'c.mp4', 'a.mp4', 'b.mp4']) {
      await tester.fling(find.byKey(const ValueKey('reels-pager')),
          const Offset(0, -600), 2000);
      await settle(tester, frames: 12);
      await _flush(tester);
      expect(v.urls[v.playing.single], contains(want));
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets('muallif profiliga o‘tganda video to‘xtaydi, qaytganda davom etadi',
      (tester) async {
    final v = FakeVideoPlatform();
    VideoPlayerPlatform.instance = v;
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final base = await testOverrides();
    final c = ProviderContainer(overrides: [
      ...base.where((o) => !identical(o, base[2])),
      socialRepositoryProvider.overrideWithValue(_Social()),
      profileRepositoryProvider.overrideWithValue(_Profile()),
      businessRepositoryProvider.overrideWithValue(_Biz()),
      reelsProvider.overrideWith((ref) async => _reels),
      activeTabProvider.overrideWith((ref) => 3),
    ]);
    addTearDown(c.dispose);
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, __) => const ReelsScreen()),
      GoRoute(
          path: '/u/:code',
          builder: (_, s) => Scaffold(body: Text('PROFIL ${s.pathParameters['code']}'))),
    ]);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: MaterialApp.router(
        routerConfig: router,
        theme: buildTheme(NfcTokens.fallback),
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
    await settle(tester, frames: 10);
    await _flush(tester);
    expect(v.playing.length, 1, reason: 'reel o‘ynayapti');

    await tester.tap(find.text('Mashrabboy'));
    await settle(tester, frames: 12);
    await _flush(tester);
    expect(find.text('PROFIL PPP777'), findsOneWidget);
    expect(v.playing, isEmpty, reason: 'profil ochilganda video to‘xtashi kerak');

    router.pop();
    await settle(tester, frames: 12);
    await _flush(tester);
    expect(v.playing.length, 1, reason: 'qaytganda video davom etadi');
  });

  testWidgets('Reel yaratish ochilsa video to‘xtaydi, qaytganda davom etadi '
      '(P-H2)', (tester) async {
    final v = FakeVideoPlatform();
    VideoPlayerPlatform.instance = v;
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final base = await testOverrides();
    final c = ProviderContainer(overrides: [
      ...base.where((o) => !identical(o, base[2])),
      socialRepositoryProvider.overrideWithValue(_Social()),
      profileRepositoryProvider.overrideWithValue(_Profile()),
      businessRepositoryProvider.overrideWithValue(_Biz()),
      reelsProvider.overrideWith((ref) async => _reels),
      activeTabProvider.overrideWith((ref) => 3),
    ]);
    addTearDown(c.dispose);
    // Ilovadagidek: `/reel/create` shell USTIGA ochiladi, tab raqami
    // o'zgarmaydi — faqat marshrut Reels'ni yopadi.
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, __) => const ReelsScreen()),
      GoRoute(
          path: '/reel/create',
          builder: (_, __) => const Scaffold(body: Text('YARATISH'))),
    ]);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: MaterialApp.router(
        routerConfig: router,
        theme: buildTheme(NfcTokens.fallback),
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
    await settle(tester, frames: 10);
    await _flush(tester);
    expect(v.playing.length, 1, reason: 'reel o‘ynayapti');

    final l = await L.delegate.load(const Locale('uz'));
    await tester.tap(find.byTooltip(l.reelCreate));
    await settle(tester, frames: 12);
    await _flush(tester);
    expect(find.text('YARATISH'), findsOneWidget);
    expect(v.playing, isEmpty,
        reason: 'yaratish ekrani ostida reel ovoz bilan o‘ynamasin');

    router.pop();
    await settle(tester, frames: 12);
    await _flush(tester);
    expect(v.playing.length, 1, reason: 'qaytganda davom etadi');
  });
}
