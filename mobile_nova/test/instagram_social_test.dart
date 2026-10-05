import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/social/comments.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';
import 'package:nfcstore_nova/features/social/time_ago.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_en.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_ru.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

/// POST VA IZOHLAR — INSTAGRAM KABI (1.1.1).
///
///   nisbiy vaqt ("2 soat oldin") · post rasmini kattalashtirish ·
///   kompaniya egasi o'z postini o'chiradi · "Yana izohlar" ·
///   post egasi begona izohni o'chiradi.

/// `testIds` dagi shaxsiy kod — testdagi "men".
const _me = '48210377';
const _photo = 'assets/demo/z_post_cafe.jpg';

class _Social extends FakeSocialRepository {
  _Social({this.post = const Post(id: 5), this.pages = const {}});

  final Post post;

  /// Sahifa raqami → izohlar va `hasMore`.
  final Map<int, ({List<Comment> items, bool hasMore})> pages;

  final asked = <int>[];
  final deletedComments = <int>[];
  final deletedPosts = <int>[];

  @override
  Future<Result<Post>> postIn(String code, int id,
          {bool company = false}) async =>
      Ok(post);

  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
    String kind,
    int id, {
    int page = 1,
  }) async {
    asked.add(page);
    final p = pages[page];
    return Ok((
      items: p?.items ?? const <Comment>[],
      hasMore: p?.hasMore ?? false,
      total: pages.values.fold(0, (n, e) => n + e.items.length),
    ));
  }

  @override
  Future<Result<void>> deleteComment(int commentId) async {
    deletedComments.add(commentId);
    return const Ok(null);
  }

  @override
  Future<Result<void>> deletePost(int id) async {
    deletedPosts.add(id);
    return const Ok(null);
  }
}

class _Biz extends BusinessRepository {
  _Biz([this.ids = const []]) : super(ApiClient());
  final List<String> ids;
  final deleted = <(String, int)>[];

  @override
  Future<Result<List<Business>>> mine() async =>
      Ok(ids.map((e) => Business(companyId: e)).toList());

  @override
  Future<Result<void>> deletePost(String companyId, int postId) async {
    deleted.add((companyId, postId));
    return const Ok(null);
  }
}

class _Profile extends ProfileRepository {
  _Profile() : super(ApiClient());

  @override
  Future<Result<FollowStats>> followStats(String code) async =>
      const Ok((followers: 0, following: 0, isFollowing: false));

  @override
  Future<Result<List<NfcId>>> followList(String code,
          {String dir = 'followers'}) async =>
      const Ok([]);
}

Comment _c(int id, {String code = 'ALI000', bool mine = false, DateTime? at}) =>
    Comment(
        id: id,
        code: code,
        authorName: 'Odam $id',
        text: 'Izoh $id',
        mine: mine,
        createdAt: at);

Future<void> _pumpComments(WidgetTester tester, _Social social,
    {String ownerCode = ''}) async {
  tester.view.physicalSize = const Size(390 * 3, 1600 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final base = await testOverrides();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...base.where((o) => !identical(o, base[2])),
      socialRepositoryProvider.overrideWithValue(social),
      businessRepositoryProvider.overrideWithValue(_Biz()),
    ],
    child: wrapScreen(Scaffold(
      body: SingleChildScrollView(
        child: CommentsSection(kind: 'post', id: 5, ownerCode: ownerCode),
      ),
    )),
  ));
  await settle(tester, frames: 4);
}

/// Post ekrani — haqiqiy `GoRouter` ostida (o'chirilgach `context.pop`).
Future<GoRouter> _pumpPost(WidgetTester tester, _Social social,
    {_Biz? biz, bool company = false}) async {
  tester.view.physicalSize = const Size(390 * 3, 1400 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final base = await testOverrides();
  final router = GoRouter(routes: [
    GoRoute(
        path: '/', builder: (_, __) => const Scaffold(body: Text('BOSH'))),
    GoRoute(
      path: '/p',
      builder: (_, __) =>
          PostScreen(id: social.post.id, code: social.post.code, company: company),
    ),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...base.where((o) => !identical(o, base[2])),
      socialRepositoryProvider.overrideWithValue(social),
      businessRepositoryProvider.overrideWithValue(biz ?? _Biz()),
      profileRepositoryProvider.overrideWithValue(_Profile()),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      theme: buildTheme(NfcTokens.pearl),
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
  router.push('/p');
  await settle(tester, frames: 6);
  return router;
}

Future<void> _confirmDelete(WidgetTester tester) async {
  final l = await L.delegate.load(const Locale('uz'));
  // Sarlavha ham "O'chirish" — tasdiq tugmasining o'zi bosiladi.
  await tester.tap(find.descendant(
      of: find.byType(TextButton), matching: find.text(l.actionDelete)));
  await settle(tester, frames: 6);
}

void main() {
  group('timeAgo', () {
    final now = DateTime(2026, 10, 5, 12);
    String ago(L l, Duration d) => timeAgo(now.subtract(d), l, now: now);

    test('o‘zbekcha', () {
      final l = LUz();
      expect(ago(l, const Duration(seconds: 20)), 'hozirgina');
      expect(ago(l, const Duration(minutes: 7)), '7 daqiqa oldin');
      expect(ago(l, const Duration(hours: 2)), '2 soat oldin');
      expect(ago(l, const Duration(days: 3)), '3 kun oldin');
      expect(ago(l, const Duration(days: 15)), '2 hafta oldin');
    });

    test('ruscha va inglizcha — ko‘plik shakllari', () {
      final ru = LRu();
      expect(ago(ru, const Duration(minutes: 1)), '1 минуту назад');
      expect(ago(ru, const Duration(hours: 3)), '3 часа назад');
      expect(ago(ru, const Duration(days: 5)), '5 дней назад');
      final en = LEn();
      expect(ago(en, const Duration(hours: 1)), '1 hour ago');
      expect(ago(en, const Duration(days: 2)), '2 days ago');
      expect(ago(en, const Duration(seconds: 5)), 'just now');
    });

    test('bir oydan eskisi — sana; kelajakdagisi — hozirgina', () {
      final l = LUz();
      expect(timeAgo(DateTime(2026, 8, 1, 9), l, now: now), '01.08.2026');
      expect(timeAgo(now.add(const Duration(minutes: 3)), l, now: now),
          'hozirgina', reason: 'telefon soati orqada qolgan');
    });
  });

  group('IZOHLAR', () {
    testWidgets('har izohda vaqt ko‘rinadi', (tester) async {
      final social = _Social(pages: {
        1: (
          items: [
            _c(1, at: DateTime.now().subtract(const Duration(days: 3, hours: 1))),
          ],
          hasMore: false,
        ),
      });
      await _pumpComments(tester, social);
      expect(find.byKey(const ValueKey('comment-time-1')), findsOneWidget);
      expect(find.text('3 kun oldin'), findsOneWidget);
    });

    testWidgets('"Yana izohlarni ko‘rish" — keyingi sahifa qo‘shiladi',
        (tester) async {
      final social = _Social(pages: {
        1: (items: [_c(1), _c(2)], hasMore: true),
        // Server tartibi siljigan bo'lsa ham (2-izoh qaytib kelsa)
        // ikki marta chizilmaydi.
        2: (items: [_c(2), _c(3)], hasMore: false),
      });
      await _pumpComments(tester, social);
      expect(find.text('Izoh 3'), findsNothing);
      final more = find.byKey(const ValueKey('comments-load-more'));
      expect(more, findsOneWidget);
      expect(find.text('Yana izohlarni ko‘rish'), findsOneWidget);

      await tester.tap(more);
      await settle(tester, frames: 3);
      expect(social.asked, [1, 2]);
      expect(find.text('Izoh 3'), findsOneWidget);
      expect(find.text('Izoh 2'), findsOneWidget);
      expect(more, findsNothing, reason: 'boshqa sahifa yo‘q');
      expect(tester.takeException(), isNull);
    });

    testWidgets('post EGASI begona izohni o‘chira oladi (menyuda)',
        (tester) async {
      final social = _Social(pages: {
        1: (items: [_c(41)], hasMore: false),
      });
      await _pumpComments(tester, social, ownerCode: _me);
      await tester.tap(find.byKey(const ValueKey('comment-actions-41')));
      await settle(tester, frames: 6);
      // Shikoyat va bloklash ham joyida.
      expect(find.byKey(const ValueKey('comment-report')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('comment-delete')));
      await settle(tester, frames: 6);
      await _confirmDelete(tester);
      expect(social.deletedComments, [41]);
    });

    testWidgets('begona postda — begona izohni o‘chirish YO‘Q',
        (tester) async {
      final social = _Social(pages: {
        1: (items: [_c(41)], hasMore: false),
      });
      await _pumpComments(tester, social, ownerCode: 'TTS075');
      await tester.tap(find.byKey(const ValueKey('comment-actions-41')));
      await settle(tester, frames: 6);
      expect(find.byKey(const ValueKey('comment-report')), findsOneWidget);
      expect(find.byKey(const ValueKey('comment-delete')), findsNothing);
    });
  });

  group('POST TAFSILOTI', () {
    testWidgets('vaqt va rasm bosilsa — kattalashtirib ko‘rish',
        (tester) async {
      final social = _Social(
        post: Post(
          id: 5,
          code: 'TTS075',
          authorName: 'Tohir',
          mediaUrls: const [_photo],
          createdAt: DateTime.now().subtract(const Duration(minutes: 12)),
        ),
      );
      await _pumpPost(tester, social);
      expect(find.byKey(const ValueKey('post-time')), findsOneWidget);
      expect(find.text('12 daqiqa oldin'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('post-image')));
      await settle(tester, frames: 6);
      expect(find.byKey(const ValueKey('image-viewer')), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('kompaniya EGASI o‘z postini o‘chiradi — kompaniya yo‘li',
        (tester) async {
      final social = _Social(
        post: const Post(id: 5, code: 'KARTAUZ', authorKind: 'company'),
      );
      final biz = _Biz(const ['KARTAUZ']);
      await _pumpPost(tester, social, biz: biz, company: true);
      final l = await L.delegate.load(const Locale('uz'));
      final del = find.byTooltip(l.actionDelete);
      expect(del, findsOneWidget);

      await tester.tap(del);
      await settle(tester, frames: 6);
      await _confirmDelete(tester);
      expect(biz.deleted, [('KARTAUZ', 5)]);
      expect(social.deletedPosts, isEmpty,
          reason: 'shaxsiy /api/posts/:id ga BORMAYDI');
      expect(find.text('BOSH'), findsOneWidget, reason: 'ekran yopiladi');
    });

    testWidgets('begona kompaniya posti — o‘chirish yo‘q, shikoyat bor',
        (tester) async {
      final social = _Social(
        post: const Post(id: 5, code: 'KARTAUZ', authorKind: 'company'),
      );
      await _pumpPost(tester, social,
          biz: _Biz(const ['BOSHQA']), company: true);
      final l = await L.delegate.load(const Locale('uz'));
      expect(find.byTooltip(l.actionDelete), findsNothing);
      expect(find.byKey(const ValueKey('post-actions')), findsOneWidget);
    });
  });
}
