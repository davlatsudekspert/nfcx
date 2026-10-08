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
import 'package:nfcstore_nova/features/social/feed_card.dart';
import 'package:nfcstore_nova/features/social/media_carousel.dart';
import 'package:nfcstore_nova/features/social/moderation.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

class _Mod extends ModerationRepository {
  _Mod() : super(ApiClient());
  final reports = <(ReportTarget, String)>[];
  final blocked = <(BlockKind, String)>[];

  @override
  Future<Result<void>> report({
    required ReportTarget target,
    required String targetId,
    required ReportReason reason,
    String note = '',
    String ownerCode = '',
  }) async {
    reports.add((target, targetId));
    return const Ok(null);
  }

  @override
  Future<Result<void>> block(BlockKind kind, String id) async {
    blocked.add((kind, id));
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

class _Biz extends BusinessRepository {
  _Biz() : super(ApiClient());
  @override
  Future<Result<List<Business>>> mine() async => const Ok([]);
}

class _Social extends FakeSocialRepository {
  _Social(this.posts);
  final List<Post> posts;
  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      Ok(posts.where((p) => p.code == code).toList());
}

const _photo = 'assets/demo/z_post_cafe.jpg';

Post _showcase({String code = 'TTS075', int images = 3}) => Post(
      id: 77,
      code: code,
      authorName: 'Tohir',
      text: 'Tavsif',
      showcase: true,
      title: 'Qizil ko‘ylak',
      priceUzs: 125000,
      linkUrl: 'https://youtu.be/abc',
      catalogItem: const PostCatalogItem(id: 'uuid-1', companyId: 'C7'),
      mediaUrls: [for (var i = 0; i < images; i++) _photo],
    );

Future<({_Mod mod, List<String> pushed, List<int> blockedCalls})> _pump(
  WidgetTester tester,
  Widget child, {
  List<Post> posts = const [],
}) async {
  tester.view.physicalSize = const Size(390 * 3, 1400 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final mod = _Mod();
  final pushed = <String>[];
  final base = await testOverrides();
  final router = GoRouter(routes: [
    GoRoute(path: '/', builder: (_, __) => child),
    GoRoute(
      path: '/catalog/:c/:i',
      builder: (_, s) {
        pushed.add(s.uri.path);
        return const Scaffold(body: Text('PRODUCT'));
      },
    ),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...base.where((o) => !identical(o, base[2])),
      socialRepositoryProvider.overrideWithValue(_Social(posts)),
      profileRepositoryProvider.overrideWithValue(_Profile()),
      businessRepositoryProvider.overrideWithValue(_Biz()),
      moderationRepositoryProvider.overrideWithValue(mod),
    ],
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
  await settle(tester, frames: 8);
  return (mod: mod, pushed: pushed, blockedCalls: <int>[]);
}

Widget _card(Post p, {VoidCallback? onBlocked}) => Scaffold(
      body: ListView(children: [FeedCard(post: p, onBlocked: onBlocked)]),
    );

void main() {
  testWidgets('lenta: bir nechta rasm — karusel, nuqtalar, surish',
      (tester) async {
    await _pump(tester, _card(_showcase()));
    expect(find.byKey(const ValueKey('feed-carousel')), findsOneWidget);
    expect(find.byKey(const ValueKey('feed-carousel-dots')), findsOneWidget);
    int dot() => tester
        .widget<CarouselDots>(find.byKey(const ValueKey('feed-carousel-dots')))
        .index;
    expect(dot(), 0);
    await tester.drag(
        find.byKey(const ValueKey('feed-carousel')), const Offset(-300, 0));
    // Sahifa to'liq joyiga tushguncha (surish paytida bosish o'tmaydi).
    await settle(tester, frames: 25);
    expect(dot(), 1);

    // Rasm bosilsa — butun ekranda ko'rish.
    await tester.tap(find.byKey(const ValueKey('feed-carousel-image-1')));
    await tester.pump(const Duration(milliseconds: 400));
    await settle(tester, frames: 6);
    expect(find.byKey(const ValueKey('image-viewer')), findsOneWidget);
  });

  testWidgets('lenta: bitta rasm — karusel yo‘q', (tester) async {
    await _pump(tester, _card(_showcase(images: 1)));
    expect(find.byKey(const ValueKey('feed-carousel')), findsNothing);
  });

  testWidgets('lenta: sarlavha, narx, tovar va havola — ixcham',
      (tester) async {
    final opened = <Uri>[];
    openLinkOverride = (u) async {
      opened.add(u);
      return true;
    };
    addTearDown(() => openLinkOverride = null);
    final r = await _pump(tester, _card(_showcase()));
    final l = LUz();
    expect(find.text('Qizil ko‘ylak'), findsOneWidget);
    expect(find.text('125 000 so‘m'), findsOneWidget);
    expect(find.text(l.showcaseViewProduct), findsOneWidget);
    expect(find.text(l.showcaseOpenYoutube), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('feed-showcase-link')));
    await settle(tester, frames: 3);
    expect(opened.single.toString(), 'https://youtu.be/abc');
    await tester.tap(find.byKey(const ValueKey('feed-showcase-product')));
    await settle(tester, frames: 6);
    expect(r.pushed, ['/catalog/C7/uuid-1']);
  });

  testWidgets('lenta "⋯": shikoyat (post) va bloklash', (tester) async {
    var blocked = 0;
    final r = await _pump(tester, _card(_showcase(), onBlocked: () => blocked++));
    final l = await L.delegate.load(const Locale('uz'));

    await tester.tap(find.byKey(const ValueKey('feed-more')));
    await settle(tester, frames: 8);
    expect(find.byKey(const ValueKey('feed-report')), findsOneWidget);
    expect(find.byKey(const ValueKey('feed-block')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('feed-report')));
    await settle(tester, frames: 8);
    await tester.tap(find.text(ReportReason.spam.label(l)));
    await settle(tester, frames: 2);
    await tester.tap(find.text(l.reportTitle).last);
    await settle(tester, frames: 8);
    expect(r.mod.reports, [(ReportTarget.post, '77')]);

    await tester.tap(find.byKey(const ValueKey('feed-more')));
    await settle(tester, frames: 8);
    await tester.tap(find.byKey(const ValueKey('feed-block')));
    await settle(tester, frames: 8);
    expect(r.mod.blocked, [(BlockKind.record, 'TTS075')]);
    expect(blocked, 1);
  });

  testWidgets('lenta: o‘z postimda "⋯" yo‘q', (tester) async {
    await _pump(tester, _card(_showcase(code: testIds.first.code)));
    expect(find.byKey(const ValueKey('feed-more')), findsNothing);
  });

  testWidgets('post tafsiloti: karusel va ko‘rgazma ma’lumoti',
      (tester) async {
    final p = _showcase();
    await _pump(tester, PostScreen(id: p.id, code: p.code), posts: [p]);
    expect(find.byKey(const ValueKey('post-carousel')), findsOneWidget);
    expect(find.byKey(const ValueKey('post-showcase-title')), findsOneWidget);
    expect(find.text('125 000 so‘m'), findsOneWidget);
    expect(find.byKey(const ValueKey('post-showcase-product')), findsOneWidget);
    expect(find.byKey(const ValueKey('post-showcase-link')), findsOneWidget);
  });
}
