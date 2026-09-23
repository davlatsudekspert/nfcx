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

import 'package:nfcstore_nova/features/activity/activity_screen.dart';
import 'package:nfcstore_nova/features/discover/discover_screen.dart';
import 'package:nfcstore_nova/features/entry/welcome_screen.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_center_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/features/settings/settings_screen.dart';


import '../helpers.dart';

/// MAVZU MATRITSASI — asosiy ekranlar Ivory/Noir x 360/390/430.
///
/// Toshib ketish (overflow) bo'lsa test YIQILADI.
///
///   flutter test test/shots/theme_matrix_shot.dart --run-skipped -t shots \
///     --update-goldens
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
    final home = Platform.environment['HOME'] ?? '/root';
    final cup = File('$home/.pub-cache/hosted/pub.dev/cupertino_icons-1.0.8/assets/CupertinoIcons.ttf');
    if (cup.existsSync()) {
      await (FontLoader('packages/cupertino_icons/CupertinoIcons')
            ..addFont(Future.value(cup.readAsBytesSync().buffer.asByteData())))
          .load();
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
    required NfcTokens tokens,
    required Size size,
  }) async {
    tester.view.physicalSize = size * 2;
    tester.view.devicePixelRatio = 2.0;
    tester.view.padding = const FakeViewPadding(top: 64, bottom: 96);
    tester.view.viewPadding = const FakeViewPadding(top: 64, bottom: 96);
    addTearDown(tester.view.reset);
    debugDisableShadows = false;
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
        home: screen,
      ),
    ));
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 80));
    }
    await tester.runAsync(() async {
      for (final e in find.byType(Image).evaluate()) {
        await precacheImage((e.widget as Image).image, e);
      }
    });
    await tester.pump(const Duration(milliseconds: 200));
    await expectLater(
        find.byType(MaterialApp), matchesGoldenFile('png/mx/$name.png'));
    debugDisableShadows = true;
  }

  final screens = <String, Widget>{
    'home': const HomeScreen(),
    'profile': const ProfileScreen(),
    'discover': const DiscoverScreen(),
    'nfc': const NfcCenterScreen(),
    'activity': const ActivityScreen(),
    'settings': const SettingsScreen(),
    'welcome': const WelcomeScreen(),
    'login': const LoginScreen(),
  };
  const sizes = {
    360: Size(360, 780),
    390: Size(390, 844),
    430: Size(430, 932),
  };
  for (final t in [NfcTokens.ivory, NfcTokens.noir]) {
    for (final s in screens.entries) {
      for (final z in sizes.entries) {
        testWidgets('${t.id} ${s.key} ${z.key}', (tester) async {
          await shot(tester, s.value, '${t.id}-${s.key}-${z.key}',
              tokens: t, size: z.value);
        });
      }
    }
  }
}
