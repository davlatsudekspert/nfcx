@Tags(['shots'])
library;

// PLAY MARKET SKRINSHOTLARI.
//
// Play Console telefon uchun kamida 2 ta surat so'raydi (biz 6 ta
// beramiz). Talab: eng qisqa tomoni >= 320px, eng uzuni <= 3840px,
// nisbat 16:9 va 9:16 oralig'ida.
//
// 1080x1920 chiqadi (540x960 mantiqiy piksel, 2x) — 16:9.
//
// NIMA UCHUN 16:9. Avval 1080x2340 (zamonaviy telefon nisbati)
// olingan edi, lekin Play skrinshot uchun MAKSIMUM 2:1 ga ruxsat
// beradi — 2.17 rad etilardi. 16:9 chegaradan uzoq va xavfsiz.
//
// Suratlar HAQIQIY VIDJETLARDAN chiziladi, maket emas: do'konda
// ko'rgan narsa ilovada ham aynan shunday. Ma'lumot esa
// `testOverrides()` dan — tarmoqqa chiqilmaydi va hech kimning
// haqiqiy profili do'konga tushmaydi.
//
//   flutter test --run-skipped -t shots --update-goldens \
//     test/shots/play_store_shot.dart

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'package:nfcstore_nova/features/activity/activity_screen.dart';
import 'package:nfcstore_nova/features/discover/discover_screen.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_center_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';

import '../helpers.dart';

/// UI/UX AUDIT — ekranlarni STANDART mavzuda suratga oladi.
///
/// `shots_test.dart` ochiq (`pearl`) mavzuda ishlaydi. Egasining
/// shikoyati esa telefonda ko'rinadigan STANDART mavzu haqida
/// ("ko'k va og'ir"), ya'ni auditni aynan o'sha mavzuda qilish
/// kerak.
///
///   flutter test test/shots/ui_audit_shot.dart \
///     --run-skipped -t shots --update-goldens
void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    final fams = {
      'InstrumentSerif': ['assets/fonts/InstrumentSerif-400.ttf'],
      'Manrope': [
        'assets/fonts/Manrope-400.ttf',
        'assets/fonts/Manrope-500.ttf',
        'assets/fonts/Manrope-600.ttf',
        'assets/fonts/Manrope-700.ttf',
      ],
      'IBMPlexMono': ['assets/fonts/IBMPlexMono-500.ttf'],
      'PlayfairDisplay': ['assets/fonts/PlayfairDisplay-500.ttf'],
    };
    for (final f in fams.entries) {
      final loader = FontLoader(f.key);
      var any = false;
      for (final p in f.value) {
        if (File(p).existsSync()) {
          loader.addFont(rootBundle.load(p));
          any = true;
        }
      }
      if (any) await loader.load();
    }
    final root = Platform.environment['FLUTTER_ROOT'] ?? '';
    final icons = File(
        '$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (icons.existsSync()) {
      final l = FontLoader('MaterialIcons')
        ..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData()));
      await l.load();
    }
  });

  Future<void> shot(
    WidgetTester tester,
    Widget screen,
    String name, {
    NfcTokens? tokens,
    Size size = const Size(540, 960),
  }) async {
    tester.view.physicalSize = size * 2;
    tester.view.devicePixelRatio = 2.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(ProviderScope(
      overrides: [...await testOverrides()],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildTheme(tokens ?? NfcTokens.fallback),
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
    // Ambient fon cheksiz aylanadi — belgilangan kadr suriladi.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 80));
    }
    await expectLater(
        find.byType(MaterialApp), matchesGoldenFile('png/$name.png'));
  }


  // ── PLAY UCHUN TO'PLAM ─────────────────────────────────────────
  //
  // Tartib ataylab: odam do'konda birinchi suratni ko'radi va
  // "bu nima?" degan savolga javob olishi kerak.

  testWidgets('play 1 — Profil', (t) async {
    await shot(t, const ProfileScreen(), 'play-1-profil');
  });
  testWidgets('play 2 — Bosh sahifa', (t) async {
    await shot(t, const HomeScreen(), 'play-2-home');
  });
  testWidgets('play 3 — NFC Markaz', (t) async {
    await shot(t, const NfcCenterScreen(), 'play-3-nfc');
  });
  testWidgets('play 4 — Tanlov', (t) async {
    await shot(t, const DiscoverScreen(), 'play-4-tanlov');
  });
  testWidgets('play 5 — Faoliyat', (t) async {
    await shot(t, const ActivityScreen(), 'play-5-faoliyat');
  });
  testWidgets('play 6 — Oq-qora mavzu', (t) async {
    // Bitta surat MUQOBIL mavzuda: ilovada tanlov borligi
    // do'konda ham ko'rinsin.
    await shot(t, const ProfileScreen(), 'play-6-oq-qora',
        tokens: NfcTokens.mono);
  });
}
