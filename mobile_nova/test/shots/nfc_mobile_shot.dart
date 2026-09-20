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
import 'package:nfcstore_nova/design/tokens/shapes.dart';
import 'package:nfcstore_nova/features/home/widgets/nfc_mobile_section.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import '../helpers.dart';

/// "NFC MOBILE" BO'LIMINING SURATLARI — HAR MAVZUDA.
///
/// Bu tekshiruv emas, KO'RSATUV: haqiqiy vidjetlar haqiqiy mavzu
/// tokenlari bilan chiziladi va PNG ga saqlanadi. Ya'ni ko'rilgan
/// narsa ilovada aynan shunday chiqadi.
void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    final families = {
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
    for (final f in families.entries) {
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

  Future<void> shot(WidgetTester tester, NfcTokens t, String name) async {
    const size = Size(390, 1900);
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
        home: Builder(builder: (context) {
          final tok = context.tokens;
          return Material(
              color: Colors.transparent,
              child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [tok.bg1, tok.bg2],
              ),
            ),
            child: Column(
              children: [
                const SizedBox(height: Gap.lg),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                  child: Row(
                    children: [
                      Text(t.id.toUpperCase(),
                          style: TextStyle(
                            fontFamily: 'IBMPlexMono',
                            fontSize: 12,
                            letterSpacing: 2,
                            color: tok.text3,
                          )),
                    ],
                  ),
                ),
                const Expanded(
                  child: SingleChildScrollView(child: NfcMobileSection()),
                ),
              ],
            ),
          ));
        }),
      ),
    ));
    // RASMLAR OLDINDAN YUKLANADI.
    //
    // `pump` soxta vaqtda ishlaydi va rasm dekodlash HAQIQIY
    // asinxron ish talab qiladi. Busiz suratlarda avatar, muqova
    // va lenta plitkalari BO'SH chiqardi — ya'ni surat ilovaning
    // haqiqiy ko'rinishini ko'rsatmasdi.
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

  for (final t in NfcTokens.all) {
    testWidgets('NFC Mobile — ${t.id}', (tester) async {
      await shot(tester, t, 'nfc-mobile-${t.id}');
    });
  }
}
