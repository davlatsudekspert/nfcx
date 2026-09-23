@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/business/business_forms.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:nfcstore_nova/features/profile/profile_edit_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import '../helpers.dart';

/// Profil, profil tahriri va biznes tahriri — aloqa tugmalari qayerda.
///   flutter test test/shots/contact_screens_shot.dart --run-skipped -t shots --update-goldens
const _contact = ContactInfo(
  phone: '+998901234567',
  telegram: 'nfcstore',
  instagram: 'nfcstore.uz',
  facebook: 'nfcstore',
  website: 'nfcstore.uz',
  extraLinks: [ExtraLink(label: 'Portfolio', url: 'behance.net/nfc')],
);

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
      'PlayfairDisplay': ['assets/fonts/PlayfairDisplay-500.ttf'],
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
      await (FontLoader('packages/cupertino_icons/CupertinoIcons')
            ..addFont(Future.value(cup.readAsBytesSync().buffer.asByteData())))
          .load();
    }
    final root = Platform.environment['FLUTTER_ROOT'] ?? '';
    final icons = File('$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (icons.existsSync()) {
      await (FontLoader('MaterialIcons')
            ..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData())))
          .load();
    }
  });

  Future<void> shot(WidgetTester tester, Widget screen, String name,
      {List<Override> extra = const [], double h = 844}) async {
    tester.view.physicalSize = Size(390 * 2, h * 2);
    tester.view.devicePixelRatio = 2;
    tester.view.padding = const FakeViewPadding(top: 64, bottom: 96);
    tester.view.viewPadding = const FakeViewPadding(top: 64, bottom: 96);
    addTearDown(tester.view.reset);
    final base = await testOverrides();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...base.where((o) => !identical(o, base[1])),
        authRepositoryProvider.overrideWithValue(FakeAuthRepository(ids: [
          NfcId(
            code: '48210377',
            name: 'Aziza Karimova',
            role: 'Dizayner',
            primary: true,
            bio: 'Brend dizayni va veb-sahifalar. Toshkent.',
            contact: _contact,
          ),
        ])),
        ...extra,
      ],
      child: MaterialApp.router(
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
        routerConfig: GoRouter(routes: [
          GoRoute(path: '/', builder: (_, __) => screen),
        ]),
      ),
    ));
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 80));
    }
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('png/$name.png'));
  }

  testWidgets('profil', (t) async {
    await shot(t, const ProfileScreen(), 'cs-profile', h: 1100);
  });
  testWidgets('profil tahriri', (t) async {
    await shot(t, const ProfileEditScreen(), 'cs-edit', h: 2700);
  });
  testWidgets('biznes tahriri', (t) async {
    await shot(t, const BusinessEditScreen(), 'cs-biz', h: 2300, extra: [
      activeBusinessProvider.overrideWithValue(const Business(
        companyId: 'KARTAUZ',
        displayName: 'Karta Uz',
        city: 'Toshkent',
        description: 'NFC vizitkalar va stikerlar.',
        contact: ContactInfo(
            phone: '+998711234567', telegram: 'kartauz', whatsapp: '+998901112233'),
      )),
    ]);
  });
}
