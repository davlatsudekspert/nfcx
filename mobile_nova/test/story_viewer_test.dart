import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/social/story_viewer.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// ISTORYA KO'RUVCHISI OXIRIGACHA BORISHI KERAK.
///
/// Bu ekran taymer bilan ishlaydi, shuning uchun uni "ko'z bilan"
/// sinab bo'lmaydi: sekundlar soxta vaqt bilan suriladi va
/// oxirida ko'ruvchi HAQIQATAN yopilganini tekshiramiz.
class _StoriesRepo extends SocialRepository {
  _StoriesRepo(this.items) : super(ApiClient());

  final List<StoryItem> items;
  int seenCalls = 0;

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async => Ok(items);

  @override
  Future<Result<void>> markStorySeen(int id) async {
    seenCalls++;
    return const Ok(null);
  }
}

void main() {
  /// Ko'ruvchini haqiqiy `GoRouter` ichida ochadi — `context.pop()`
  /// aynan shu orqali ishlaydi.
  Future<GoRouter> pump(
    WidgetTester tester,
    _StoriesRepo repo, {
    Locale locale = const Locale('uz'),
    NfcTokens? tokens,
  }) async {
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: Text('HOME')),
          routes: [
            GoRoute(
              path: 'story',
              builder: (_, __) => const StoryViewerScreen(code: 'VIP001'),
            ),
          ],
        ),
      ],
    );

    final t = tokens ?? NfcTokens.pearl;
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        socialRepositoryProvider.overrideWithValue(repo),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        theme: buildTheme(t),
        locale: locale,
        supportedLocales: L.supportedLocales,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      ),
    ));
    await tester.pump();
    router.go('/story');
    // DIQQAT: bu yerda `pumpAndSettle` ISHLATILMAYDI — u taymerni
    // oxirigacha surib yuboradi va istorya ko'rilmasdan tugaydi.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    return router;
  }

  String where(GoRouter r) =>
      r.routerDelegate.currentConfiguration.uri.toString();

  StoryItem story(int id) => StoryItem(id: id, code: 'VIP001', authorName: 'M');

  testWidgets('BITTA istorya tugagach ko‘ruvchi YOPILADI', (tester) async {
    final repo = _StoriesRepo([story(1)]);
    final router = await pump(tester, repo);
    expect(where(router), '/story');

    // Bitta istorya 5 soniya ko'rsatiladi.
    await tester.pump(const Duration(seconds: 6));
    await tester.pumpAndSettle();

    expect(where(router), '/',
        reason: 'oxirgi istorya tugagach ko‘ruvchi yopilmadi — osilib qoldi');
  });

  testWidgets('UCHTA istorya birin-ketin o‘tadi va oxirida yopiladi',
      (tester) async {
    final repo = _StoriesRepo([story(1), story(2), story(3)]);
    final router = await pump(tester, repo);

    // Har biri 5 soniya: uchtasi uchun 15 soniyadan bir oz ko'proq.
    for (var i = 0; i < 3; i++) {
      expect(where(router), '/story',
          reason: '${i + 1}-istoryada ko‘ruvchi allaqachon yopilgan');
      await tester.pump(const Duration(seconds: 6));
      await tester.pump();
    }
    await tester.pumpAndSettle();

    expect(where(router), '/',
        reason: 'uchta istorya tugagach ko‘ruvchi yopilmadi');
  });

  testWidgets('o‘ng tomonga tegish keyingisiga o‘tkazadi, oxirida yopadi',
      (tester) async {
    final repo = _StoriesRepo([story(1), story(2)]);
    final router = await pump(tester, repo);

    final size = tester.view.physicalSize / tester.view.devicePixelRatio;
    // O'ng yarim — keyingisi.
    await tester.tapAt(Offset(size.width * 0.8, size.height * 0.5));
    await tester.pump();
    expect(where(router), '/story', reason: 'ikkinchisida yopilib ketdi');

    await tester.tapAt(Offset(size.width * 0.8, size.height * 0.5));
    await tester.pumpAndSettle();
    expect(where(router), '/',
        reason: 'oxirgisida tegish ko‘ruvchini yopmadi');
  });

  testWidgets('har bir istorya SERVERGA bir marta ko‘rildi deb yoziladi',
      (tester) async {
    final repo = _StoriesRepo([story(1), story(2)]);
    await pump(tester, repo);

    await tester.pump(const Duration(seconds: 6));
    await tester.pump();
    await tester.pump(const Duration(seconds: 6));
    await tester.pumpAndSettle();

    expect(repo.seenCalls, 2,
        reason: 'ko‘rildi signali takrorlandi yoki umuman yuborilmadi');
  });

  testWidgets('istorya yo‘q bo‘lsa — bo‘sh holat, osilib qolmaydi',
      (tester) async {
    final repo = _StoriesRepo([]);
    final router = await pump(tester, repo);
    await tester.pump();

    expect(where(router), '/story');
    expect(find.byType(StoryViewerScreen), findsOneWidget);
    expect(repo.seenCalls, 0);
  });
}
