import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/social/engagement.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// SHAXSIY REELS (`/api/reels`, 2026-10-06): sahifalab olish, davomini
/// oxiriga yaqinlashganda qo'shish, eski serverda eski manbaga qaytish
/// va "Qiziq emas" serverga aytilishi.

/// Server javobini qaytaradigan soxta mijoz — so'rovlar yoziladi.
class _Api extends ApiClient {
  _Api(this.body);
  final Map<String, dynamic> body;
  final gets = <(String, Map<String, dynamic>?)>[];
  final posts = <(String, Object?)>[];

  @override
  Future<Result<T>> get<T>(String path, {Map<String, dynamic>? query}) async {
    gets.add((path, query));
    return Ok(body as T);
  }

  @override
  Future<Result<T>> post<T>(String path, [Object? body]) async {
    posts.add((path, body));
    return Ok(const {'ok': true} as T);
  }
}

Post _reel(int id, {String code = 'AAA111', bool company = false}) => Post(
      id: id,
      code: code,
      authorName: 'Muallif $id',
      authorKind: company ? 'company' : 'card',
      mediaUrls: ['https://nfcstore.uz/uploads/$id.mp4'],
      isVideo: true,
    );

/// Sahifalar `cursor` bo'yicha; `null` — birinchi sahifa.
class _Paged extends FakeSocialRepository {
  _Paged(this.pages);
  final Map<String?, Result<ReelsPage>> pages;
  final cursors = <String?>[];
  var feeds = 0;

  /// Eski manba (`/api/feed` + o'z videolarim) — qaytishni tekshirish uchun.
  List<Post> feedItems = const [];
  List<Post> own = const [];

  /// Berilsa — keyingi sahifalar shu tugaguncha kelmaydi.
  Completer<void>? gate;

  @override
  Future<Result<ReelsPage>> reelsPage({String? cursor, int limit = 10}) async {
    cursors.add(cursor);
    if (cursor != null) await gate?.future;
    return pages[cursor] ?? const Ok(ReelsPage());
  }

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      Ok(own);

  @override
  Future<Result<List<Post>>> feed({int page = 1}) async {
    feeds++;
    return Ok(feedItems);
  }

  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
          String kind, int id, {int page = 1}) async =>
      const Ok((items: <Comment>[], hasMore: false, total: 0));
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

const _me = [NfcId(code: 'TTS075', name: 'Men', primary: true)];

Future<ProviderContainer> _container(SocialRepository social) async {
  final base = await testOverrides();
  final c = ProviderContainer(overrides: [
    ...base.where((o) => !identical(o, base[2])),
    // Faol profil boshidan ma'lum — ro'yxat kod o'zgarib qayta
    // yuklanmasin.
    myIdsProvider.overrideWithValue(_me),
    socialRepositoryProvider.overrideWithValue(social),
  ]);
  addTearDown(c.dispose);
  return c;
}

/// 1-sahifa: 1..10, davomi `c2`. 2-sahifa: 9, 10 (takror) va 11..15,
/// davomi yo'q.
Map<String?, Result<ReelsPage>> _twoPages() => {
      null: Ok(ReelsPage(
        items: [for (var i = 1; i <= 10; i++) _reel(i)],
        nextCursor: 'c2',
        hasMore: true,
      )),
      'c2': Ok(ReelsPage(
        items: [for (var i = 9; i <= 15; i++) _reel(i)],
      )),
    };

void main() {
  group('SocialRepository', () {
    test('reelsPage: elementlar, belgi va davomi o‘qiladi', () async {
      final api = _Api({
        'items': [
          {
            'id': 5,
            'code': 'AAA111',
            'videoUrl': '/uploads/a.mp4',
            'caption': 'salom',
          },
          {
            'id': 6,
            'code': 'KARTAUZ',
            'authorKind': 'company',
            'featured': true,
            'videoUrl': '/uploads/b.mp4',
          },
        ],
        'nextCursor': 'abc',
        'hasMore': true,
      });
      final page =
          (await SocialRepository(api).reelsPage(cursor: 'x1')).valueOrNull!;
      expect(page.items.map((p) => p.id), [5, 6]);
      expect(page.items.last.featured, isTrue, reason: 'reklama belgisi');
      expect(page.nextCursor, 'abc');
      expect(page.hasMore, isTrue);
      expect(api.gets.single.$1, '/api/reels');
      expect(api.gets.single.$2, {'limit': 10, 'cursor': 'x1'});
    });

    test('reelsPage: belgisiz «davomi bor» — davomi yo‘q', () async {
      final api = _Api({'items': [], 'nextCursor': null, 'hasMore': true});
      final page = (await SocialRepository(api).reelsPage()).valueOrNull!;
      expect(page.items, isEmpty);
      expect(page.nextCursor, isNull);
      expect(page.hasMore, isFalse);
      expect(api.gets.single.$2, {'limit': 10},
          reason: 'birinchi sahifada belgi yuborilmaydi');
    });

    test('hideReel: turi va id yuboriladi', () async {
      final api = _Api(const {});
      final repo = SocialRepository(api);
      await repo.hideReel(_reel(7));
      await repo.hideReel(_reel(7, company: true));
      expect(api.posts.map((e) => e.$1), ['/api/reels/hide', '/api/reels/hide']);
      expect(api.posts.map((e) => e.$2), [
        {'kind': 'post', 'id': 7},
        {'kind': 'company_post', 'id': 7},
      ]);
    });
  });

  group('reelsProvider + ReelsPager', () {
    test('1-sahifa, oxiriga yaqin 2-sahifa takrorsiz qo‘shiladi, keyin '
        'to‘xtaydi', () async {
      final social = _Paged(_twoPages());
      final c = await _container(social);
      final sub = c.listen(reelsProvider, (_, __) {});
      addTearDown(sub.close);

      final first = await c.read(reelsProvider.future);
      expect(first.map((p) => p.id), [for (var i = 1; i <= 10; i++) i]);
      final pager = c.read(reelsPagerProvider);
      expect(pager.hasMore, isTrue);
      expect(social.feeds, 0, reason: 'eski lenta so‘ralmaydi');

      // Oxirigacha hali uzoq — so'ralmaydi.
      pager.nearEnd(5, 10);
      await Future<void>.delayed(Duration.zero);
      expect(social.cursors, [null]);

      // 3 ta qoldi — keyingi sahifa. Ikki marta chaqirilsa ham BITTA so'rov.
      pager.nearEnd(7, 10);
      pager.nearEnd(8, 10);
      await Future<void>.delayed(Duration.zero);
      expect(social.cursors, [null, 'c2']);
      final all = c.read(reelsProvider).valueOrNull!;
      expect(all.map((p) => p.id), [for (var i = 1; i <= 15; i++) i],
          reason: 'takror yo‘q, oldingilar o‘z joyida');
      expect(all.take(10), first, reason: 'oldingi reel‘lar o‘sha obyektlar');
      expect(pager.hasMore, isFalse);

      // Davomi yo'q — boshqa so'rov ketmaydi.
      pager.nearEnd(14, 15);
      await pager.loadMore();
      expect(social.cursors, [null, 'c2']);
    });

    test('keyingi sahifa xato bersa — ro‘yxat o‘zgarmaydi, davomi to‘xtaydi',
        () async {
      final social = _Paged({
        ..._twoPages(),
        'c2': const Err(AppError(AppErrorKind.offline)),
      });
      final c = await _container(social);
      final sub = c.listen(reelsProvider, (_, __) {});
      addTearDown(sub.close);
      await c.read(reelsProvider.future);
      await c.read(reelsPagerProvider).loadMore();
      expect(c.read(reelsProvider).valueOrNull!.length, 10);
      expect(c.read(reelsPagerProvider).hasMore, isFalse);
    });

    test('qayta yuklash — davomi boshidan', () async {
      final social = _Paged(_twoPages());
      final c = await _container(social);
      final sub = c.listen(reelsProvider, (_, __) {});
      addTearDown(sub.close);
      await c.read(reelsProvider.future);
      await c.read(reelsPagerProvider).loadMore();
      expect(c.read(reelsPagerProvider).hasMore, isFalse);

      c.invalidate(reelsProvider);
      final again = await c.read(reelsProvider.future);
      expect(again.length, 10);
      expect(c.read(reelsPagerProvider).hasMore, isTrue);
      expect(social.cursors, [null, 'c2', null]);
    });

    for (final kind in [AppErrorKind.endpointMissing, AppErrorKind.notFound]) {
      test('eski server (${kind.name}) — lenta + o‘z videolarim', () async {
        final social = _Paged({null: Err(AppError(kind, status: 404))})
          ..feedItems = [_reel(3), _reel(4)]
          ..own = [_reel(9, code: 'TTS075')];
        final c = await _container(social);
        final reels = await c.read(reelsProvider.future);
        expect(reels.map((p) => p.id).toSet(), {3, 4, 9});
        expect(social.feeds, 1);
        expect(c.read(reelsPagerProvider).hasMore, isFalse);
      });
    }

    test('birinchi sahifa bo‘sh — eski manba', () async {
      final social = _Paged({null: const Ok(ReelsPage())})
        ..feedItems = [_reel(3)];
      final c = await _container(social);
      final reels = await c.read(reelsProvider.future);
      expect(reels.map((p) => p.id), [3]);
    });
  });

  group('ReelsScreen', () {
    int? itemCount(WidgetTester tester) => (tester
            .widget<PageView>(find.byKey(const ValueKey('reels-pager')))
            .childrenDelegate as SliverChildBuilderDelegate)
        .childCount;

    Future<ProviderContainer> pump(WidgetTester tester, _Paged social,
        {List<Post>? reels}) async {
      VideoPlayerPlatform.instance = FakeVideoPlatform();
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final base = await testOverrides();
      final c = ProviderContainer(overrides: [
        ...base.where((o) => !identical(o, base[2])),
        myIdsProvider.overrideWithValue(_me),
        socialRepositoryProvider.overrideWithValue(social),
        profileRepositoryProvider.overrideWithValue(_Profile()),
        businessRepositoryProvider.overrideWithValue(_Biz()),
        if (reels != null) reelsProvider.overrideWith((ref) async => reels),
        activeTabProvider.overrideWith((ref) => 3),
      ]);
      addTearDown(c.dispose);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: wrapScreen(const ReelsScreen()),
      ));
      await settle(tester, frames: 10);
      return c;
    }

    testWidgets('kalta 1-sahifa — davomi darhol so‘raladi', (tester) async {
      final social = _Paged({
        null: Ok(ReelsPage(
          items: [_reel(1), _reel(2), _reel(3)],
          nextCursor: 'c2',
          hasMore: true,
        )),
        'c2': Ok(ReelsPage(items: [_reel(3), _reel(4)])),
      });
      final c = await pump(tester, social);
      expect(social.cursors, [null, 'c2']);
      expect(c.read(reelsProvider).valueOrNull!.map((p) => p.id), [1, 2, 3, 4]);
      // Davomi tugadi — yana cheksiz aylanadi.
      expect(itemCount(tester), isNull);
      expect(tester.takeException(), isNull);
    });

    testWidgets('davomi kelayotganda ro‘yxat chekli, kelgach qo‘shiladi',
        (tester) async {
      final social = _Paged({
        null: Ok(ReelsPage(
          items: [_reel(1), _reel(2), _reel(3)],
          nextCursor: 'c2',
          hasMore: true,
        )),
        'c2': Ok(ReelsPage(items: [_reel(4), _reel(5)])),
      })
        ..gate = Completer();
      await pump(tester, social);
      expect(social.cursors, [null, 'c2']);
      // Oxirida boshiga aylanib ketib, keyin reel sakramasin.
      expect(itemCount(tester), 3);

      social.gate!.complete();
      await settle(tester, frames: 4);
      expect(itemCount(tester), isNull);
      expect(tester.takeException(), isNull);
    });

    testWidgets('«Qiziq emas» serverga ham aytiladi', (tester) async {
      final social = _Paged(const {});
      final c = await pump(tester, social,
          reels: [_reel(7, code: 'PPP777'), _reel(8, code: 'ALI000')]);
      await tester.tap(find.byKey(const ValueKey('reel-more')).first);
      await settle(tester, frames: 10);
      await tester.tap(find.byKey(const ValueKey('reel-not-interested')));
      await settle(tester, frames: 10);
      await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 40)));
      await settle(tester, frames: 3);

      expect(social.hiddenReels.map(likeKey), ['p:7']);
      expect(c.read(reelsHiddenProvider), {'p:7'});
      expect(tester.takeException(), isNull);
    });
  });
}
