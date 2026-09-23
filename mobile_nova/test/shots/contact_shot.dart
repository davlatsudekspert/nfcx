@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/contact_buttons.dart';
import 'package:nfcstore_nova/features/profile/contact_editor.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

/// ALOQA TUGMALARI + TAHRIR (ko'z bilan tekshirish).
///   flutter test test/shots/contact_shot.dart --run-skipped -t shots --update-goldens
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
    };
    for (final f in fams.entries) {
      final loader = FontLoader(f.key);
      for (final p in f.value) {
        if (File(p).existsSync()) loader.addFont(rootBundle.load(p));
      }
      await loader.load();
    }
    final root = Platform.environment['FLUTTER_ROOT'] ?? '';
    final icons = File('$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (icons.existsSync()) {
      final l = FontLoader('MaterialIcons')
        ..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData()));
      await l.load();
    }
  });

  testWidgets('aloqa tugmalari va tahrir', (tester) async {
    tester.view.physicalSize = const Size(390 * 2, 1400 * 2);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    const c = ContactInfo(
      phone: '+998901234567',
      telegram: 'nfcstore',
      whatsapp: '+998901234567',
      instagram: 'nfcstore.uz',
      facebook: 'nfcstore',
      website: 'nfcstore.uz',
      address: 'Toshkent',
      extraLinks: [ExtraLink(label: 'Menyu', url: 'menu.uz')],
    );
    await tester.pumpWidget(MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildTheme(NfcTokens.fallback),
      locale: const Locale('uz'),
      supportedLocales: L.supportedLocales,
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Scaffold(
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              ContactButtons(actions: c.actions()),
              const SizedBox(height: 24),
              ContactEditor(initial: c, business: true, onChanged: (_) {}),
            ],
          ),
        ),
      ),
    ));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 80));
    }
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('png/contact.png'));
  });
}
