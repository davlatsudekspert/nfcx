@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/bottom_nav.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

/// PASTKI NAVIGATSIYA — Ivory/Noir, 360/390/430, uz/ru/en, faol holatlar.
///
///   flutter test test/shots/nav_shot.dart --run-skipped -t shots \
///     --update-goldens
void main() {
  setUpAll(() async {
    final fams = {
      'Manrope': [
        'assets/fonts/Manrope-400.ttf',
        'assets/fonts/Manrope-500.ttf',
        'assets/fonts/Manrope-600.ttf',
        'assets/fonts/Manrope-700.ttf',
      ],
      'InstrumentSerif': ['assets/fonts/InstrumentSerif-400.ttf'],
    };
    for (final f in fams.entries) {
      final loader = FontLoader(f.key);
      for (final p in f.value) {
        if (File(p).existsSync()) loader.addFont(rootBundle.load(p));
      }
      await loader.load();
    }
    final root = Platform.environment['FLUTTER_ROOT'] ?? '';
    final icons = File(
        '$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (icons.existsSync()) {
      await (FontLoader('MaterialIcons')
            ..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData())))
          .load();
    }
  });

  List<NavItem> items(L l) => [
        NavItem(
            icon: Icons.home_outlined,
            activeIcon: Icons.home_rounded,
            label: l.navHome,
            route: '/'),
        NavItem(
            icon: Icons.explore_outlined,
            activeIcon: Icons.explore_rounded,
            label: l.navDiscover,
            route: '/d'),
        NavItem(icon: Icons.nfc_rounded, label: l.navNfc, route: '/n'),
        NavItem(
            icon: Icons.play_circle_outline_rounded,
            activeIcon: Icons.play_circle_rounded,
            label: l.navReels,
            route: '/r'),
        NavItem(
            icon: Icons.person_outline_rounded,
            activeIcon: Icons.person_rounded,
            label: l.navProfile,
            route: '/p'),
      ];

  for (final t in [NfcTokens.ivory, NfcTokens.noir]) {
    testWidgets('nav ${t.id}', (tester) async {
      debugDisableShadows = false;
      const widths = [360.0, 390.0, 430.0];
      const rowH = 120.0;
      tester.view.physicalSize = Size(430 * 2, rowH * 9 * 2);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);

      Widget nav(Locale loc, int active, double w) => SizedBox(
            width: w,
            height: rowH,
            child: Localizations(
              locale: loc,
              delegates: const [
                L.delegate,
                GlobalMaterialLocalizations.delegate,
                GlobalWidgetsLocalizations.delegate,
              ],
              child: Builder(builder: (context) {
                final l = L.of(context);
                return Container(
                  color: t.bg1,
                  alignment: Alignment.bottomCenter,
                  child: NovaBottomNav(
                    items: items(l),
                    currentIndex: active,
                    onSelect: (_) {},
                  ),
                );
              }),
            ),
          );

      await tester.pumpWidget(MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildTheme(t),
        home: Scaffold(
          backgroundColor: t.bg1,
          body: RepaintBoundary(
            key: const ValueKey('nav-sheet'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final w in widths) ...[
                  nav(const Locale('uz'), 0, w),
                  nav(const Locale('ru'), 3, w),
                  nav(const Locale('en'), 4, w),
                ],
              ],
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();
      await expectLater(find.byKey(const ValueKey('nav-sheet')),
          matchesGoldenFile('png/nav-${t.id}.png'));
      debugDisableShadows = true;
    });
  }
}
