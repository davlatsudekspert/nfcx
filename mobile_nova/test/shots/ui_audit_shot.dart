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
import 'package:nfcstore_nova/features/profile/follow_list_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/features/auth/register_screen.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';

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
    Size size = const Size(390, 844),
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

  testWidgets('audit — Home', (t) async {
    await shot(t, const HomeScreen(), 'audit-home');
  });
  testWidgets('audit — Profil', (t) async {
    await shot(t, const ProfileScreen(), 'audit-profile');
  });
  testWidgets('audit — Tanlov', (t) async {
    await shot(t, const DiscoverScreen(), 'audit-discover');
  });
  testWidgets('audit — NFC markazi', (t) async {
    await shot(t, const NfcCenterScreen(), 'audit-nfc');
  });
  testWidgets('audit — Faoliyat', (t) async {
    await shot(t, const ActivityScreen(), 'audit-activity');
  });
  testWidgets('audit — Obunachilar', (t) async {
    await shot(t, const FollowListScreen(code: 'VIP001', dir: 'followers'),
        'audit-followers');
  });
  testWidgets('audit — Xush kelibsiz', (t) async {
    await shot(t, const WelcomeScreen(), 'audit-welcome');
  });

  // Tor ekran — toshib ketish shu yerda ko'rinadi.
  testWidgets('audit — Home 360x640', (t) async {
    await shot(t, const HomeScreen(), 'audit-home-360',
        size: const Size(360, 640));
  });
  testWidgets('audit — Profil 360x640', (t) async {
    await shot(t, const ProfileScreen(), 'audit-profile-360',
        size: const Size(360, 640));
  });

  // Ochiq mavzu ham NFCSTORE bo'lib qolsinmi.
  testWidgets('audit — Profil (ochiq mavzu)', (t) async {
    await shot(t, const ProfileScreen(), 'audit-profile-light',
        tokens: NfcTokens.pearl);
  });

  // ── YANGI MAVZU: NOIR ─────────────────────────────────────────
  testWidgets('noir — Profil', (t) async {
    await shot(t, const ProfileScreen(), 'noir-profile',
        tokens: NfcTokens.noir);
  });
  testWidgets('noir — Home', (t) async {
    await shot(t, const HomeScreen(), 'noir-home', tokens: NfcTokens.noir);
  });
  testWidgets('noir — Tanlov', (t) async {
    await shot(t, const DiscoverScreen(), 'noir-discover',
        tokens: NfcTokens.noir);
  });
  testWidgets('noir — Faoliyat', (t) async {
    await shot(t, const ActivityScreen(), 'noir-activity',
        tokens: NfcTokens.noir);
  });
  testWidgets('noir — NFC markazi', (t) async {
    await shot(t, const NfcCenterScreen(), 'noir-nfc', tokens: NfcTokens.noir);
  });
  testWidgets('noir — Profil 360x640', (t) async {
    await shot(t, const ProfileScreen(), 'noir-profile-360',
        tokens: NfcTokens.noir, size: const Size(360, 640));
  });

  testWidgets('noir — Reels', (t) async {
    await shot(t, const ReelsScreen(), 'noir-reels', tokens: NfcTokens.noir);
  });
  testWidgets('noir — Kirish', (t) async {
    await shot(t, const LoginScreen(), 'noir-login', tokens: NfcTokens.noir);
  });
  testWidgets('noir — Ro\'yxatdan o\'tish', (t) async {
    await shot(t, const RegisterScreen(), 'noir-register',
        tokens: NfcTokens.noir);
  });
  testWidgets('noir — Xush kelibsiz', (t) async {
    await shot(t, const WelcomeScreen(), 'noir-welcome',
        tokens: NfcTokens.noir);
  });
  testWidgets('noir — Obunachilar', (t) async {
    await shot(t, const FollowListScreen(code: 'VIP001', dir: 'followers'),
        'noir-followers', tokens: NfcTokens.noir);
  });

  // Ochiq mavzu — brend identikligi saqlanganmi.
  testWidgets('pearl — Profil', (t) async {
    await shot(t, const ProfileScreen(), 'light-profile',
        tokens: NfcTokens.pearl);
  });
  testWidgets('pearl — Home', (t) async {
    await shot(t, const HomeScreen(), 'light-home', tokens: NfcTokens.pearl);
  });

  // Tor ekran — toshib ketish.
  testWidgets('noir — Home 360x640', (t) async {
    await shot(t, const HomeScreen(), 'noir-home-360',
        tokens: NfcTokens.noir, size: const Size(360, 640));
  });
  testWidgets('noir — Faoliyat 360x640', (t) async {
    await shot(t, const ActivityScreen(), 'noir-activity-360',
        tokens: NfcTokens.noir, size: const Size(360, 640));
  });
}
