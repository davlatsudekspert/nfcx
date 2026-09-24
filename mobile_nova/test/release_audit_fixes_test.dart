import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/nova_scaffold.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';
import 'package:nfcstore_nova/features/social/video_poster.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// RELEASE AUDITI (#215 dan keyin) — ikki tasdiqlangan regressiya.
///
/// 1. SM-2: profil ro'yxatidan ochilgan post ro'yxatdagi ESKI nusxani
///    qaytarardi — profil tabi butun sessiya tirik, layk/izoh soni
///    soatlab eskirgan qolardi. Endi nusxa faqat birinchi kadr uchun,
///    post har safar serverdan yangilanadi.
/// 2. SM-1: dangasa to'rda kesh zonasidagi (qurilgan, lekin chizilmagan)
///    video katakchalar muqovasiz abadiy qolardi. Endi muqova katakcha
///    chizilganda olinadi.
const _photo = 'assets/demo/z_post_cafe.jpg';

class _Server extends FakeSocialRepository {
  int likes = 0;
  int nComments = 0;
  Completer<void>? gate;

  List<Post> _list(String code) => [
        for (var i = 0; i < 6; i++)
          Post(
            id: i + 1,
            code: code,
            text: 'Rasm $i',
            mediaUrls: const [_photo],
            likes: i == 0 ? likes : 0,
            comments: i == 0 ? nComments : 0,
            createdAt: DateTime(2026),
          ),
      ];

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      Ok(_list(code));

  @override
  Future<Result<Post>> postIn(String code, int id,
      {bool company = false}) async {
    await gate?.future;
    return Ok(_list(code).firstWhere((p) => p.id == id));
  }
}

class _Videos extends FakeSocialRepository {
  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async => Ok([
        for (var i = 0; i < 24; i++)
          Post(
            id: 100 + i,
            code: code,
            text: 'Video $i',
            mediaUrls: ['https://nfcstore.uz/uploads/v$i.mp4'],
            isVideo: true,
            createdAt: DateTime(2026),
          ),
      ]);
}

Widget _app(GoRouter r) => MaterialApp.router(
      routerConfig: r,
      theme: buildTheme(NfcTokens.ivory),
      locale: const Locale('uz'),
      supportedLocales: LocaleController.supported,
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );

void main() {
  testWidgets(
      'SM-2: profildan ochilgan post darhol chiziladi va YANGI sonlarni oladi',
      (tester) async {
    VideoPoster.clearCache();
    VideoPlayerPlatform.instance = FakeVideoPlatform();
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final server = _Server();
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, __) => const ProfileScreen()),
      GoRoute(
        path: '/post/:id',
        builder: (_, s) => PostScreen(
          id: int.parse(s.pathParameters['id']!),
          code: s.uri.queryParameters['code'] ?? '',
        ),
      ),
    ]);
    final base = await testOverrides();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...base.where((o) => !identical(o, base[2])),
        socialRepositoryProvider.overrideWithValue(server),
      ],
      child: _app(router),
    ));
    await settle(tester, frames: 16);

    // Profil yuklangandan keyin serverda: 7 layk, 3 izoh.
    server
      ..likes = 7
      ..nComments = 3
      ..gate = Completer<void>();
    router.push('/post/1?code=48210377');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    // Server javobi hali yo'q — kutish o'rniga ro'yxatdagi nusxa.
    expect(find.text('Rasm 0'), findsOneWidget);

    server.gate!.complete();
    await settle(tester, frames: 8);
    expect(find.text('7'), findsOneWidget,
        reason: 'layk soni profil yuklangan paytdagi 0 da qoldi');
    expect(find.text('3'), findsWidgets,
        reason: 'izoh soni profil yuklangan paytdagi 0 da qoldi');
    expect(tester.takeException(), isNull);
  });

  testWidgets('SM-1: kesh zonasidan ekranga kirgan video katakcha muqova oladi',
      (tester) async {
    VideoPoster.clearCache();
    final v = FakeVideoPlatform();
    VideoPlayerPlatform.instance = v;
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final base = await testOverrides();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...base.where((o) => !identical(o, base[2])),
        socialRepositoryProvider.overrideWithValue(_Videos()),
      ],
      child: wrapScreen(const ProfileScreen(), tokens: NfcTokens.ivory),
    ));
    await settle(tester, frames: 16);
    final l = await L.delegate.load(const Locale('uz'));
    final sc = find
        .descendant(
            of: find.byType(NovaScroll), matching: find.byType(Scrollable))
        .first;
    final viewport = tester.getRect(sc);

    // Navbat haqiqiy vaqtda ishlaydi (toImage) — kadrlar orasida
    // `runAsync` bilan unga vaqt beriladi.
    Future<void> drive(int n) async {
      for (var i = 0; i < n; i++) {
        await tester.pump(const Duration(milliseconds: 120));
        await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 5)));
      }
    }

    List<String> blankVisible() {
      final out = <String>[];
      for (final e
          in find.byType(VideoPoster, skipOffstage: false).evaluate()) {
        final ro = e.renderObject! as RenderBox;
        final r = ro.localToGlobal(Offset.zero) & ro.size;
        if (!r.overlaps(viewport)) continue;
        final img = find.descendant(
            of: find.byWidget(e.widget, skipOffstage: false),
            matching: find.byType(RawImage, skipOffstage: false));
        if (img.evaluate().isEmpty) {
          out.add((e.widget as VideoPoster).url.split('/').last);
        }
      }
      return out;
    }

    final tab = find.text('${l.navReels} · 24');
    await tester.ensureVisible(tab);
    await settle(tester, frames: 2);
    await tester.tap(tab);
    await drive(80);
    expect(blankVisible(), isEmpty);

    // Qatorma-qator o'qish: kichik surish, 1.5 s to'xtash.
    final pos = tester.state<ScrollableState>(sc).position;
    var step = 0;
    while (pos.pixels < pos.maxScrollExtent - 1 && step < 30) {
      await tester.drag(sc, const Offset(0, -130));
      await drive(12);
      step++;
    }
    await drive(40);
    expect(blankVisible(), isEmpty,
        reason: 'kesh zonasida qurilgan katakchalar muqovasiz qoldi');
    // Har video uchun ko'pi bilan bitta pleer — behuda ochilish yo'q.
    expect(v.created.length, lessThanOrEqualTo(24));

    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 2));
  });
}
