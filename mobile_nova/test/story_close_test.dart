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
import 'package:nfcstore_nova/features/profile/music_player.dart';
import 'package:nfcstore_nova/features/social/story_viewer.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// ISTORYA YOPILGANDA OVOZ DARHOL TO'XTASIN.
///
/// APK #48 telefonda FAIL bo'ldi: X bosilgandan keyin ham video
/// ovozi davom etardi. O'shanda to'xtatish `InlineVideo.dispose()`
/// ga tayanardi, `context.pop()` esa marshrutni ANIMATSIYA bilan
/// yopadi va vidjet darhol o'chmaydi.
///
/// Shuning uchun bu testlar `dispose` chaqirilganini EMAS,
/// to'xtatish POP'DAN OLDIN bo'lganini tekshiradi.
class _Repo extends SocialRepository {
  _Repo(this.items) : super(ApiClient());
  final List<StoryItem> items;

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async => Ok(items);

  @override
  Future<Result<void>> markStorySeen(int id) async => const Ok(null);
}

void main() {
  /// Media to'xtatilganda yoziladi — haqiqiy video o'rnida.
  late List<String> events;

  Future<GoRouter> pump(WidgetTester tester, {int count = 2}) async {
    events = [];
    final items = [
      for (var i = 0; i < count; i++)
        StoryItem(
          id: i + 1,
          code: 'TTS075',
          mediaUrl: 'https://nfcstore.uz/uploads/s$i.mp4',
          isVideo: true,
        ),
    ];

    // Istorya TO'G'RIDAN-TO'G'RI ochiladi — xuddi jismoniy
    // kartadan yoki App Link orqali kirgandagi kabi. Yopilganda
    // uyga qaytishi kerak.
    final router = GoRouter(
      initialLocation: '/story/TTS075',
      routes: [
        GoRoute(
            path: '/home',
            builder: (_, __) => const Scaffold(body: Text('UY'))),
        GoRoute(
          path: '/story/:code',
          builder: (_, s) =>
              StoryViewerScreen(code: s.pathParameters['code']!),
        ),
      ],
    );

    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        socialRepositoryProvider.overrideWithValue(_Repo(items)),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        theme: buildTheme(NfcTokens.midnight),
        locale: const Locale('uz'),
        supportedLocales: L.supportedLocales,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      ),
    ));
    // `pumpAndSettle` ATAYLAB ISHLATILMAYDI: istorya taymeri
    // 5 soniya va settle uni OXIRIGACHA aylantirib, ekranni o'zi
    // yopib yuborardi — test hech narsa tekshirolmasdi.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    // HAQIQIY VIDEO O'RNIGA — ro'yxatga yozilgan to'xtatuvchi.
    // `InlineVideo` ham aynan shunday ro'yxatdan o'tadi.
    ProviderScope.containerOf(
            tester.element(find.byType(StoryViewerScreen)),
            listen: false)
        .read(audioOwnerProvider.notifier)
        .take(#video, () => events.add('stop'));
    return router;
  }

  bool storyOpen() => find.byType(StoryViewerScreen).evaluate().isNotEmpty;

  testWidgets('X bosilganda media POP\'DAN OLDIN to‘xtaydi', (tester) async {
    await pump(tester);
    expect(storyOpen(), isTrue);

    await tester.tap(find.byIcon(Icons.close_rounded));
    // HALI BIRORTA KADR O'TMADI — ya'ni animatsiya ham, `dispose`
    // ham boshlanmagan. To'xtatish allaqachon bo'lishi shart.
    expect(events, ['stop'],
        reason: 'ovoz pop dan oldin to‘xtatilmadi — `dispose` ga '
            'tayanilgan');

    await tester.pumpAndSettle();
    expect(storyOpen(), isFalse, reason: 'ekran yopilmadi');
  });

  testWidgets('pastga surilganda ham to‘xtaydi', (tester) async {
    await pump(tester);
    await tester.fling(
        find.byIcon(Icons.close_rounded), const Offset(0, 300), 1200);
    expect(events, ['stop']);
    await tester.pumpAndSettle();
  });

  testWidgets('ANDROID ORQAGA tugmasi ham to‘xtatadi', (tester) async {
    await pump(tester);

    // Tizim tugmasi marshrutni to'g'ridan-to'g'ri yopadi va X
    // tugmasidagi kod umuman ishlamaydi — `PopScope` shuning
    // uchun kerak.
    await tester.binding.handlePopRoute();
    expect(events, ['stop'],
        reason: 'tizim orqaga tugmasi to‘xtatishni chetlab o‘tdi');

    await tester.pumpAndSettle();
    expect(storyOpen(), isFalse);
  });

  testWidgets('OXIRGI istorya tugaganda ham to‘xtaydi', (tester) async {
    await pump(tester, count: 1);

    // 5 soniya — bitta istoryaning davomiyligi.
    await tester.pump(const Duration(seconds: 6));
    expect(events, ['stop'],
        reason: 'avtomatik tugaganda ovoz to‘xtatilmadi');

    await tester.pumpAndSettle();
    expect(storyOpen(), isFalse);
  });

  testWidgets('ILOVA FONGA ketganda to‘xtaydi', (tester) async {
    await pump(tester);

    // Telefon cho'ntakka solindi — ovoz davom etmasin.
    tester.binding
        .handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    expect(events, ['stop']);
  });
}
