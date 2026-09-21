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
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import '../helpers.dart';

/// Mavzu taqqoslash: hozirgi sovuq `midnight` va saytdan olingan iliq `onyx`.
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

  Future<void> shot(WidgetTester tester, NfcTokens tokens, String name) async {
    const size = Size(390, 820);
    tester.view.physicalSize = size * 2;
    tester.view.devicePixelRatio = 2.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(ProviderScope(
      overrides: [...await testOverrides()],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildTheme(tokens),
        locale: const Locale('uz'),
        supportedLocales: L.supportedLocales,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const HomeScreen(),
      ),
    ));
    await tester.runAsync(() async {
      for (final e in tester.widgetList<Image>(find.byType(Image))) {
        await precacheImage(e.image, tester.element(find.byType(MaterialApp)));
      }
      await Future<void>.delayed(const Duration(milliseconds: 120));
    });
    for (var i = 0; i < 16; i++) {
      await tester.pump(const Duration(milliseconds: 60));
    }
    await expectLater(
        find.byType(MaterialApp), matchesGoldenFile('png/$name.png'));
  }

  testWidgets('midnight', (t) => shot(t, NfcTokens.mono, 'th-midnight'));
  testWidgets('onyx', (t) => shot(t, NfcTokens.onyx, 'th-onyx'));
}
