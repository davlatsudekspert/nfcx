@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'package:nfcstore_nova/features/discover/discover_screen.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_center_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/features/social/story_viewer.dart';

import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';

import '../helpers.dart';

/// Suratlar uchun NAMUNAVIY ma'lumot.
///
/// Bo'sh ekranning surati dizayn haqida hech narsa aytmaydi.
/// Bu yerdagi qiymatlar faqat `test/` ichida va ilovaga
/// KIRMAYDI.
class _ShotsRepo extends SocialRepository {
  _ShotsRepo() : super(ApiClient());

  static final _stories = [
    StoryItem(
      id: 1,
      code: 'VIP001',
      authorName: 'Muhammad',
      caption: 'Yangi NFC kartalar keldi',
      likes: 12,
      createdAt: DateTime.now().subtract(const Duration(hours: 2)),
    ),
    StoryItem(id: 2, code: 'VIP001', authorName: 'Muhammad', likes: 3),
  ];

  static final _posts = [
    Post(
      id: 11,
      code: 'VIP001',
      authorName: 'Muhammad',
      text: 'NFCSTORE jamoasi bilan yangi loyiha ustida ishlayapmiz.',
      likes: 24,
      comments: 5,
      createdAt: DateTime.now().subtract(const Duration(hours: 5)),
    ),
    Post(
      id: 12,
      code: 'TTS075',
      authorName: 'Tohir',
      text: 'Bugungi uchrashuv.',
      likes: 8,
      comments: 1,
      createdAt: DateTime.now().subtract(const Duration(days: 1)),
    ),
  ];

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async => Ok(_stories);

  @override
  Future<Result<List<StoryItem>>> followedStories() async => const Ok([]);

  @override
  Future<Result<List<Post>>> feed({int page = 1}) async => Ok(_posts);

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      Ok(_posts);

  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
    String kind,
    int id, {
    int page = 1,
  }) async =>
      const Ok((items: <Comment>[], hasMore: false, total: 0));

  @override
  Future<Result<void>> markStorySeen(int id) async => const Ok(null);
}

/// HAQIQIY EKRANLARNI RASMGA OLISH.
///
/// Bu sinov emas — SURATGA OLUVCHI. Ilovaning O'Z vidjetlari
/// telefon o'lchamida chiziladi va PNG ga yoziladi. Chizilgan
/// narsa qo'lda tasvirlangan maket emas, aynan hozir ishlayotgan
/// kod.
///
/// Ishga tushirish:
///
///     flutter test test/shots --update-goldens --tags shots
///
/// `--tags shots` bo'lmasa oddiy `flutter test` bu faylni
/// O'TKAZIB YUBORADI: suratlar CI da qayta-qayta solishtirilishi
/// shart emas, ular faqat ko'rish uchun.
void main() {
  setUpAll(() async {
    // SHRIFTLAR YUKLANMASA matn qora to'rtburchak bo'lib chiqadi.
    // Flutter sinov muhitida `pubspec.yaml` dagi shriftlar o'zi
    // yuklanmaydi — ular qo'lda berilishi kerak.
    //
    // Ro'yxat `pubspec.yaml` DAN o'qiladi: qo'lda yozilsa, yangi
    // shrift qo'shilganda surat jimgina buzilib ketardi.
    final families = <String, List<String>>{};
    String? current;
    for (final raw in File('pubspec.yaml').readAsLinesSync()) {
      final fam = RegExp(r'^\s{4}- family:\s*(\S+)').firstMatch(raw);
      if (fam != null) {
        current = fam.group(1);
        families[current!] = <String>[];
        continue;
      }
      final asset = RegExp(r'^\s+- asset:\s*(\S+)').firstMatch(raw);
      if (asset != null && current != null) {
        families[current]!.add(asset.group(1)!);
      }
    }
    expect(families, isNotEmpty, reason: 'pubspec dan shrift topilmadi');

    for (final family in families.entries) {
      final loader = FontLoader(family.key);
      var any = false;
      for (final path in family.value) {
        if (File(path).existsSync()) {
          loader.addFont(rootBundle.load(path));
          any = true;
        }
      }
      if (any) await loader.load();
    }

    // IKONKA SHRIFTI. `MaterialIcons` Flutter SDK ichida turadi,
    // `pubspec.yaml` da emas — yuklanmasa har bir ikonka bo'sh
    // kvadrat bo'lib chiqadi va suratdan hech narsa tushunib
    // bo'lmaydi.
    final root = Platform.environment['FLUTTER_ROOT'] ??
        File(Platform.resolvedExecutable).parent.parent.parent.path;
    final icons =
        File('$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (icons.existsSync()) {
      final l = FontLoader('MaterialIcons')
        ..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData()));
      await l.load();
    } else {
      // ignore: avoid_print
      print('[shots] MaterialIcons topilmadi: ${icons.path}');
    }
  });

  /// Telefon o'lchami — iPhone 13 / o'rtacha Android sinfi.
  const phone = Size(390, 844);

  Future<void> shot(
    WidgetTester tester,
    Widget screen,
    String name, {
    NfcTokens? tokens,
    Size size = phone,
  }) async {
    tester.view.physicalSize = size * 3;
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final t = tokens ?? NfcTokens.pearl;
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        socialRepositoryProvider.overrideWithValue(_ShotsRepo()),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildTheme(t),
        locale: const Locale('uz'),
        supportedLocales: L.supportedLocales,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: screen,
      ),
    ));
    // Ambient fon CHEKSIZ aylanadi — `pumpAndSettle` hech qachon
    // tugamaydi. Belgilangan miqdorda kadr suriladi.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 80));
    }

    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('png/$name.png'),
    );
  }

  testWidgets('01 — Home', (t) async {
    await shot(t, const HomeScreen(), '01-home');
  });

  testWidgets('02 — Story ko\u2018ruvchisi', (t) async {
    await shot(t, const StoryViewerScreen(code: 'VIP001'), '02-story');
  });

  testWidgets('03 — Reels', (t) async {
    await shot(t, const ReelsScreen(), '03-reels');
  });

  testWidgets('04 — NFC markazi', (t) async {
    await shot(t, const NfcCenterScreen(), '04-nfc-center');
  });

  testWidgets('05 — Shaxsiy profil', (t) async {
    await shot(t, const ProfileScreen(), '05-profile');
  });

  testWidgets('06 — Kashf etish', (t) async {
    await shot(t, const DiscoverScreen(), '06-discover');
  });
}
