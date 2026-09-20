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
import 'package:nfcstore_nova/features/demo/demo_screens.dart';
import 'package:nfcstore_nova/features/home/widgets/nfc_mobile_section.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import '../helpers.dart';

/// DEMO BO'LIMINING TO'LIQ SURATLARI.
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
      'IBMPlexMono': [
        'assets/fonts/IBMPlexMono-400.ttf',
        'assets/fonts/IBMPlexMono-500.ttf',
        'assets/fonts/IBMPlexMono-600.ttf',
      ],
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

  Future<void> shot(WidgetTester tester, Widget screen, NfcTokens t,
      String name, {double h = 1700}) async {
    tester.view.physicalSize = Size(390, h) * 2;
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
        home: screen,
      ),
    ));
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 80));
    }
    // Rasm dekodlash HAQIQIY asinxron ish talab qiladi.
    await tester.runAsync(() async {
      for (final e in tester.widgetList<Image>(find.byType(Image))) {
        await precacheImage(e.image, tester.element(find.byType(MaterialApp)));
      }
    });
    for (var i = 0; i < 14; i++) {
      await tester.pump(const Duration(milliseconds: 80));
    }
    await expectLater(
        find.byType(MaterialApp), matchesGoldenFile('png/$name.png'));
  }

  for (final (t, tag) in [
    (NfcTokens.ocean, 'ocean'),
    (NfcTokens.pearl, 'pearl'),
    (NfcTokens.midnight, 'midnight'),
  ]) {
    testWidgets('home $tag', (x) async {
      await shot(
          x,
          const Scaffold(
              body: SingleChildScrollView(child: NfcMobileSection())),
          t,
          'demo-home-$tag',
          h: 1180);
    });
    testWidgets('zafar $tag', (x) async {
      await shot(x, const DemoPersonalScreen(), t, 'demo-zafar-$tag');
    });
    testWidgets('market $tag', (x) async {
      await shot(x, const DemoBusinessScreen(), t, 'demo-market-$tag');
    });
  }
}
