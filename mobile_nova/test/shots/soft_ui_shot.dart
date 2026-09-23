@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import '../helpers.dart';
import '../support/fake_video_platform.dart';

/// YUMSHOQ DIZAYN — Reels belgilari va izoh maydoni (ko'z bilan tekshirish).
///   flutter test test/shots/soft_ui_shot.dart --run-skipped -t shots --update-goldens
class _Social extends FakeSocialRepository {
  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
          String kind, int id, {int page = 1}) async =>
      Ok((
        items: [
          Comment(
              id: 1,
              code: 'VIP001',
              authorName: 'Dilnoza Karimova',
              text: 'Juda chiroyli video bo‘libdi, tabriklayman!',
              createdAt: DateTime.now().subtract(const Duration(minutes: 12))),
          Comment(
              id: 2,
              code: 'ALI000',
              authorName: 'Aliyorbek',
              text: 'Qayerda olingan? Manzilini yozib qo‘ying iltimos 🙏',
              createdAt: DateTime.now().subtract(const Duration(hours: 2))),
        ],
        hasMore: false,
        total: 2
      ));
}

void main() {
  setUpAll(() async {
    final fams = {
      'InstrumentSerif': ['assets/fonts/InstrumentSerif-400.ttf'],
      'Manrope': [
        'assets/fonts/Manrope-400.ttf',
        'assets/fonts/Manrope-500.ttf',
        'assets/fonts/Manrope-600.ttf',
        'assets/fonts/Manrope-700.ttf',
      ],
      'IBMPlexMono': ['assets/fonts/IBMPlexMono-500.ttf'],
    };
    for (final f in fams.entries) {
      final loader = FontLoader(f.key);
      for (final p in f.value) {
        if (File(p).existsSync()) loader.addFont(rootBundle.load(p));
      }
      await loader.load();
    }
    final home = Platform.environment['HOME'] ?? '/root';
    final cup = File('$home/.pub-cache/hosted/pub.dev/cupertino_icons-1.0.8/assets/CupertinoIcons.ttf');
    if (cup.existsSync()) {
      final l = FontLoader('packages/cupertino_icons/CupertinoIcons')
        ..addFont(Future.value(cup.readAsBytesSync().buffer.asByteData()));
      await l.load();
    }
    final root = Platform.environment['FLUTTER_ROOT'] ?? '';
    final icons = File('$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (icons.existsSync()) {
      final l = FontLoader('MaterialIcons')
        ..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData()));
      await l.load();
    }
  });

  testWidgets('reels + izohlar varag‘i', (tester) async {
    VideoPlayerPlatform.instance = FakeVideoPlatform();
    tester.view.physicalSize = const Size(390 * 2, 844 * 2);
    tester.view.devicePixelRatio = 2;
    tester.view.padding = const FakeViewPadding(top: 64, bottom: 96);
    tester.view.viewPadding = const FakeViewPadding(top: 64, bottom: 96);
    addTearDown(tester.view.reset);
    final base = await testOverrides();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...base.where((o) => !identical(o, base[2])),
        socialRepositoryProvider.overrideWithValue(_Social()),
        reelsProvider.overrideWith((ref) async => [
              Post(
                id: 7,
                code: 'PPP777',
                authorName: 'Mashrabboy',
                text: 'Toshkent kechasi',
                mediaUrls: const ['https://nfcstore.uz/uploads/a.mp4'],
                isVideo: true,
                likes: 42,
                comments: 2,
              ),
            ]),
        activeTabProvider.overrideWith((ref) => 3),
        currentUserProvider.overrideWithValue(
            const User(id: 1, email: 'a@b.uz', name: 'A', premium: true)),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildTheme(NfcTokens.fallback),
        locale: const Locale('uz'),
        supportedLocales: LocaleController.supported,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const ReelsScreen(),
      ),
    ));
    await settle(tester, frames: 10);
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('png/soft-reels.png'));
    await tester.tap(find.byKey(const ValueKey('reel-comments')));
    await settle(tester, frames: 12);
    await tester.enterText(find.byType(TextField).last, 'Zo‘r');
    await settle(tester, frames: 4);
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('png/soft-comments.png'));
  });
}
