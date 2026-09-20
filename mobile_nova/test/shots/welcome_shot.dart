@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader, rootBundle;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/entry/welcome_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import '../helpers.dart';

/// BIRINCHI KIRISH EKRANINING SURATLARI.
///
/// Maqsad ikkita: ko'rinishni ko'rsatish va PASTDA BO'SH JOY
/// YO'QLIGINI isbotlash. Shuning uchun aynan so'ralgan
/// o'lchamlarda olinadi.
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
    Size size,
    NfcTokens t,
    String name,
  ) async {
    tester.view.physicalSize = size * 2;
    tester.view.devicePixelRatio = 2.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(ProviderScope(
      overrides: [...await testOverrides()],
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
        home: const WelcomeScreen(),
      ),
    ));

    // Surat HAQIQIY asinxron dekodlash talab qiladi — busiz
    // suratda bo'sh joy chiqardi va "to'liq qopladi" degan
    // isbot yolg'on bo'lardi.
    await tester.runAsync(() async {
      for (final e in tester.widgetList<Image>(find.byType(Image))) {
        await precacheImage(e.image, tester.element(find.byType(MaterialApp)));
      }
    });
    // Animatsiya o'rtasidagi kadr — nur ko'rinadigan payt.
    await tester.pump(const Duration(milliseconds: 1600));
    await expectLater(
        find.byType(MaterialApp), matchesGoldenFile('png/$name.png'));
  }

  testWidgets('welcome 390x844 ocean', (t) async {
    await shot(t, const Size(390, 844), NfcTokens.ocean, 'welcome-390-ocean');
  });
  testWidgets('welcome 360x800 ocean', (t) async {
    await shot(t, const Size(360, 800), NfcTokens.ocean, 'welcome-360-ocean');
  });
  testWidgets('welcome 390x844 pearl', (t) async {
    await shot(t, const Size(390, 844), NfcTokens.pearl, 'welcome-390-pearl');
  });
  testWidgets('welcome 360x800 midnight', (t) async {
    await shot(
        t, const Size(360, 800), NfcTokens.midnight, 'welcome-360-midnight');
  });
  // Eng tor va eng cho'ziq holat — bo'sh joy shu yerda chiqardi.
  testWidgets('welcome 320x780 ocean', (t) async {
    await shot(t, const Size(320, 780), NfcTokens.ocean, 'welcome-320-ocean');
  });
}
