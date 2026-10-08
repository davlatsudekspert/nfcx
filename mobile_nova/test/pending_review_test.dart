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
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/features/showcase/showcase_composer.dart';
import 'package:nfcstore_nova/features/social/feed_card.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_en.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_ru.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

import 'helpers.dart';

const _photo = 'assets/demo/z_post_cafe.jpg';
final _me = testIds.first.code;

final _pending = Post(
  id: 41,
  code: _me,
  authorName: 'Men',
  text: 'Tekshirilmagan',
  mediaUrls: const [_photo],
  pending: true,
);

class _Social extends FakeSocialRepository {
  _Social({this.created});
  final Post? created;

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      Ok([if (code == _me) _pending]);

  @override
  Future<Result<Post?>> createShowcase({
    required String code,
    required bool company,
    required ShowcaseDraft draft,
  }) async => Ok(created);
}

class _Profile extends ProfileRepository {
  _Profile() : super(ApiClient());
  @override
  Future<Result<String>> uploadImage(
    String filePath, {
    String? kind,
    void Function(int, int)? onProgress,
  }) async => const Ok('/uploads/a.jpg');
}

class _Biz extends BusinessRepository {
  _Biz() : super(ApiClient());
  @override
  Future<Result<List<Business>>> mine() async => const Ok([]);
}

class _Source implements ShowcaseImageSource {
  @override
  Future<List<String>> gallery(int limit) async => ['/tmp/a.jpg'];
  @override
  Future<String?> camera() async => null;
}

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  _Social? social,
  String? push,
}) async {
  tester.view.physicalSize = const Size(390 * 3, 1800 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final base = await testOverrides();
  await acceptContentRules();
  final router = GoRouter(
    routes: [
      GoRoute(
        path: '/',
        builder: (_, __) => child,
        routes: [
          GoRoute(
            path: 'create',
            builder: (_, __) => const ShowcaseComposerScreen(),
          ),
        ],
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...base.where((o) => !identical(o, base[2])),
        socialRepositoryProvider.overrideWithValue(social ?? _Social()),
        profileRepositoryProvider.overrideWithValue(_Profile()),
        businessRepositoryProvider.overrideWithValue(_Biz()),
        showcaseImageSourceProvider.overrideWithValue(_Source()),
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
    ),
  );
  await settle(tester, frames: 10);
  if (push != null) {
    router.push(push);
    await settle(tester, frames: 10);
  }
}

void main() {
  test('yozuv uch tilda', () {
    expect(LUz().pendingReview, 'Tekshiruv kutilmoqda');
    expect(LRu().pendingReview, 'Ожидает проверки');
    expect(LEn().pendingReview, 'Pending review');
    expect(LUz().pendingPublished, 'Post tekshiruvdan so‘ng hammaga ko‘rinadi');
  });

  testWidgets('profil to‘ri: o‘z pending postimda belgi', (tester) async {
    await _pump(tester, const ProfileScreen());
    expect(find.byKey(const ValueKey('pending-badge')), findsOneWidget);
  });

  testWidgets('lenta kartasi: pending — belgi', (tester) async {
    await _pump(
      tester,
      Scaffold(
        body: ListView(children: [FeedCard(post: _pending)]),
      ),
    );
    expect(find.text(LUz().pendingReview), findsOneWidget);
  });

  testWidgets('lenta kartasi: oddiy post — belgi yo‘q', (tester) async {
    await _pump(
      tester,
      Scaffold(
        body: ListView(
          children: [
            FeedCard(
              post: Post(id: 1, code: _me, mediaUrls: const [_photo]),
            ),
          ],
        ),
      ),
    );
    expect(find.byKey(const ValueKey('pending-badge')), findsNothing);
  });

  testWidgets('post tafsiloti: pending — belgi', (tester) async {
    await _pump(tester, PostScreen(id: _pending.id, code: _me));
    expect(find.text(LUz().pendingReview), findsOneWidget);
  });

  testWidgets('chop etilgan post pending — snackbar', (tester) async {
    await _pump(
      tester,
      const Scaffold(body: Text('HOME')),
      social: _Social(created: _pending),
      push: '/create',
    );
    await tester.tap(find.byKey(const ValueKey('showcase-add-image')));
    await settle(tester, frames: 6);
    await tester.tap(find.byKey(const ValueKey('showcase-pick-gallery')));
    await settle(tester, frames: 6);
    final btn = find.byKey(const ValueKey('showcase-publish'));
    await tester.ensureVisible(btn);
    await tester.tap(btn);
    await settle(tester, frames: 10);
    expect(find.text('HOME'), findsOneWidget);
    expect(find.text(LUz().pendingPublished), findsOneWidget);
  });

  testWidgets('chop etilgan post tekshirilgan — snackbar yo‘q', (tester) async {
    await _pump(
      tester,
      const Scaffold(body: Text('HOME')),
      social: _Social(created: const Post(id: 9, showcase: true)),
      push: '/create',
    );
    await tester.tap(find.byKey(const ValueKey('showcase-add-image')));
    await settle(tester, frames: 6);
    await tester.tap(find.byKey(const ValueKey('showcase-pick-gallery')));
    await settle(tester, frames: 6);
    final btn = find.byKey(const ValueKey('showcase-publish'));
    await tester.ensureVisible(btn);
    await tester.tap(btn);
    await settle(tester, frames: 10);
    expect(find.text('HOME'), findsOneWidget);
    expect(find.text(LUz().pendingPublished), findsNothing);
  });
}
