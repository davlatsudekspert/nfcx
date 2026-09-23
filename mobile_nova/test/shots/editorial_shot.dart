@Tags(['shots'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart'
    show rootBundle, FontLoader, MethodChannel, SystemChannels;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/features/auth/profile_setup_screen.dart';
import 'package:nfcstore_nova/features/auth/verify_screen.dart';
import 'package:nfcstore_nova/features/auth/register_screen.dart';
import 'package:nfcstore_nova/features/entry/splash_screen.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/business/business_forms.dart';
import 'package:nfcstore_nova/features/business/business_intro.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import '../support/fake_video_platform.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import '../helpers.dart';
import '../support/rich_fakes.dart';

/// SOFT EDITORIAL — HAQIQIY EKRANLAR, HAQIQIY KONTENT, UCH O'LCHAM.
///
/// Egasining talabi: dizayn faqat maket bo'lib qolmasin; 360x800,
/// 390x844 va 430x932 da overflow, matn kesilishi va pastki nav
/// ustma-ust tushishi bo'lmasin; profil bo'sh demo bilan emas,
/// HAQIQIY kontent (surat, uzun ism, ko'p post, musiqa) bilan.
///
/// Ekranlar to'liq ROUTER orqali chiziladi — ya'ni pastki navigatsiya
/// ham, tablar orasidagi joylashuv ham haqiqiy ilovadagidek.
///
///     flutter test --run-skipped -t shots --update-goldens \
///       test/shots/editorial_shot.dart
Future<void> _loadFonts() async {
  final families = <String, List<String>>{};
  String? current;
  for (final raw in File('pubspec.yaml').readAsLinesSync()) {
    final fam = RegExp(r'^\s{4}- family:\s*(\S+)').firstMatch(raw);
    if (fam != null) {
      current = fam.group(1);
      families[current!] = <String>[];
      continue;
    }
    final asset = RegExp(r'^\s+- asset:\s*(\S+)').firstMatch(raw);
    if (asset != null && current != null) families[current]!.add(asset.group(1)!);
  }
  for (final family in families.entries) {
    final loader = FontLoader(family.key);
    for (final path in family.value) {
      loader.addFont(rootBundle.load(path));
    }
    await loader.load();
  }
  final root = Platform.environment['FLUTTER_ROOT'] ??
      File(Platform.resolvedExecutable).parent.parent.parent.path;
  final icons =
      File('$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
  if (icons.existsSync()) {
    final l = FontLoader('MaterialIcons')
      ..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData()));
    await l.load();
  }
}

const sizes = <String, Size>{
  '360': Size(360, 800),
  '390': Size(390, 844),
  '430': Size(430, 932),
};

Future<void> _settle(WidgetTester tester, [int frames = 16]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 80));
  }
}

void _size(WidgetTester tester, Size s) {
  tester.view.physicalSize = s * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

/// Router orqali tab ekrani.
Future<void> tabShot(
    WidgetTester tester, String location, String name, Size s,
    {bool end = false,
    String? tapText,
    Key? tapKey,
    Key? thenKey,
    Object? extra,
    bool playMusic = false}) async {
  _size(tester, s);
  late GoRouter router;
  await tester.pumpWidget(ProviderScope(
    overrides: await richOverrides(),
    child: Consumer(builder: (context, ref, _) {
      router = ref.watch(routerProvider);
      return MaterialApp.router(
        debugShowCheckedModeBanner: false,
        routerConfig: router,
        theme: buildTheme(NfcTokens.ivory),
        locale: const Locale('uz'),
        supportedLocales: LocaleController.supported,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      );
    }),
  ));
  await _settle(tester);
  router.go(location, extra: extra);
  await _settle(tester, 20);
  if (tapKey != null) {
    await tester.tap(find.byKey(tapKey).hitTestable().first);
    await _settle(tester, 12);
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
    await _settle(tester, 6);
  }
  if (thenKey != null) {
    await tester.tap(find.byKey(thenKey).hitTestable().first);
    await _settle(tester, 12);
  }
  if (playMusic) {
    await tester.tap(find.byKey(const ValueKey('music-play')));
    await _settle(tester, 4);
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 300)));
    await _settle(tester, 6);
  }
  if (tapText != null) {
    await tester.tap(find.text(tapText).hitTestable().first);
    await _settle(tester, 12);
  }
  // Asset suratlar asinxron dekodlanadi — birinchi kadrda bo'sh
  // doira qolmasin.
  await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 400)));
  await _settle(tester, 4);
  if (end) {
    // Ro'yxat oxiri: pastki element nav OSTIDA qolmasligini ko'rish.
    final list = find.byType(Scrollable).hitTestable().first;
    for (var i = 0; i < 6; i++) {
      await tester.drag(list, const Offset(0, -900));
      await _settle(tester, 4);
    }
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 300)));
    await _settle(tester, 6);
  }
  await expectLater(
      find.byType(MaterialApp), matchesGoldenFile('png/ed-$name.png'));
}

/// Routersiz yakka ekran (ro'yxatdan o'tish, biznes formalar).
Future<void> soloShot(
    WidgetTester tester, Widget screen, String name, Size s) async {
  _size(tester, s);
  await tester.pumpWidget(ProviderScope(
    overrides: await richOverrides(),
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildTheme(NfcTokens.ivory),
      locale: const Locale('uz'),
      supportedLocales: LocaleController.supported,
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: screen,
    ),
  ));
  await _settle(tester);
  await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 400)));
  await _settle(tester, 4);
  await expectLater(
      find.byType(MaterialApp), matchesGoldenFile('png/ed-$name.png'));
}

class _RegAuth extends FakeAuthRepository {
  _RegAuth() : super(signedIn: false, ids: const [
          NfcId(code: '48210377', name: 'Aziza Karimova', primary: true),
        ]);
  bool done = false;

  @override
  Future<Result<String>> requestRegisterCode(
          {String email = '', String phone = ''}) async =>
      const Ok('email');

  @override
  Future<Result<User>> register({
    required String name,
    required String email,
    required String phone,
    required String password,
    required String code,
    required bool tosAccepted,
    String? promoCode,
  }) async {
    done = true;
    return const Ok(User(id: 7, email: 'aziza@example.com', name: 'Aziza Karimova'));
  }

  @override
  Future<Result<({User user, List<NfcId> ids})>> restore() async => done
      ? Ok((user: const User(id: 7, email: 'aziza@example.com', name: 'Aziza Karimova'), ids: ids))
      : super.restore();
}

/// Ro'yxatdan o'tish — har qadam alohida surat.
Future<void> registerFlowShot(WidgetTester tester, Size s, String w) async {
  _size(tester, s);
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(SystemChannels.platform, (call) async {
    if (call.method == 'Clipboard.getData') return {'text': '482913'};
    return null;
  });
  addTearDown(() => TestDefaultBinaryMessengerBinding.instance
      .defaultBinaryMessenger
      .setMockMethodCallHandler(SystemChannels.platform, null));
  final base = await richOverrides();
  final auth = _RegAuth();
  final router = GoRouter(initialLocation: Routes.register, routes: [
    GoRoute(path: Routes.register, builder: (_, __) => const RegisterScreen()),
    GoRoute(
        path: Routes.registerVerify,
        builder: (_, st) => VerifyScreen(args: st.extra! as VerifyArgs)),
    GoRoute(path: Routes.profileSetup, builder: (_, __) => const ProfileSetupScreen()),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...base.where((o) => !identical(o, base[1])),
      authRepositoryProvider.overrideWithValue(auth),
    ],
    child: MaterialApp.router(
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: buildTheme(NfcTokens.ivory),
      locale: const Locale('uz'),
      supportedLocales: LocaleController.supported,
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    ),
  ));
  await _settle(tester);
  final l = await L.delegate.load(const Locale('uz'));
  var n = 0;
  Future<void> snap(String step) async {
    n++;
    await _settle(tester, 10);
    await expectLater(find.byType(MaterialApp),
        matchesGoldenFile('png/reg-$w-$n-$step.png'));
  }

  Future<void> next() async {
    await tester.tap(find.text(l.actionNext).last);
    await _settle(tester, 10);
  }

  await tester.tap(find.byKey(const ValueKey('signup-type-personal')));
  await snap('type');
  await next();
  await tester.enterText(find.byType(TextField).hitTestable().first, 'Aziza Karimova');
  await snap('name');
  await next();
  await tester.enterText(find.byType(TextField).hitTestable().first, 'aziza@example.com');
  await snap('email');
  await next();
  await tester.enterText(find.byType(TextField).hitTestable().first, '901234567');
  await snap('phone');
  await next();
  final pw = find.byType(TextField).hitTestable();
  await tester.enterText(pw.at(0), 'Kuchli-parol-2026');
  await tester.enterText(pw.at(1), 'Kuchli-parol-2026');
  await tester.tap(find.byType(Checkbox).last);
  await snap('password');
  await tester.tap(find.text(l.actionContinue).last);
  await _settle(tester, 12);
  for (final st in const [
    AppLifecycleState.inactive,
    AppLifecycleState.hidden,
    AppLifecycleState.paused,
    AppLifecycleState.hidden,
    AppLifecycleState.inactive,
    AppLifecycleState.resumed,
  ]) {
    tester.binding.handleAppLifecycleStateChanged(st);
    await tester.pump();
  }
  await tester.enterText(find.byType(TextField).last, '482');
  await snap('otp');
  await tester.enterText(find.byType(TextField).last, '482913');
  await _settle(tester, 12);
  await snap('setup');
}

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    // Video o'rniga demo kadr — Reels suratlari uchun.
    VideoPlayerPlatform.instance = FakeVideoPlatform(frames: const [
      '$richAssets/z_post_evening.jpg',
      '$richAssets/m_card_metal.jpg',
    ]);
    // Musiqa kesh-menejeri vaqtinchalik papka so'raydi.
    final tmp = Directory.systemTemp.createTempSync('ed_shot').path;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (_) async => tmp,
    );
    await _loadFonts();
  });

  for (final e in sizes.entries) {
    final w = e.key;
    final s = e.value;
    testWidgets('home $w', (t) => tabShot(t, Routes.home, 'home-$w', s));
    testWidgets('discover $w',
        (t) => tabShot(t, Routes.discover, 'discover-$w', s));
    testWidgets('catalog $w',
        (t) => tabShot(t, Routes.discover, 'catalog-$w', s, tapText: 'Katalog'));
    testWidgets('product $w',
        (t) => tabShot(t, Routes.catalogProduct('NFCSTORE', 'p1'), 'product-$w', s,
            extra: richProducts.first));
    testWidgets('reels $w', (t) => tabShot(t, Routes.reels, 'reels-$w', s));
    testWidgets('reels-comments $w',
        (t) => tabShot(t, Routes.reels, 'reels-comments-$w', s,
            tapKey: const ValueKey('reel-comments')));
    testWidgets('reels-more $w',
        (t) => tabShot(t, Routes.reels, 'reels-more-$w', s,
            tapKey: const ValueKey('reel-more')));
    testWidgets('music $w',
        (t) => tabShot(t, Routes.profile, 'music-$w', s,
            tapKey: const ValueKey('music-eq'), playMusic: true));
    testWidgets('compose-post $w',
        (t) => tabShot(t, Routes.postCreate, 'compose-post-$w', s));
    testWidgets('compose-reel $w',
        (t) => tabShot(t, Routes.reelCreate, 'compose-reel-$w', s));
    testWidgets('reels-report $w',
        (t) => tabShot(t, Routes.reels, 'reels-report-$w', s,
            tapKey: const ValueKey('reel-more'),
            thenKey: const ValueKey('reel-report')));
    testWidgets('nfc $w', (t) {
      richNfcPresent = true;
      return tabShot(t, Routes.nfc, 'nfc-$w', s);
    });
    testWidgets('nfc-none $w', (t) async {
      richNfcPresent = false;
      await tabShot(t, Routes.nfc, 'nfc-none-$w', s);
      richNfcPresent = true;
    });
    testWidgets('nfc-end $w',
        (t) => tabShot(t, Routes.nfc, 'nfc-end-$w', s, end: true));
    testWidgets('profile-end $w',
        (t) => tabShot(t, Routes.profile, 'profile-end-$w', s, end: true));
    testWidgets('profile $w',
        (t) => tabShot(t, Routes.profile, 'profile-$w', s));
    testWidgets('biz-intro $w',
        (t) => soloShot(t, const BusinessIntroScreen(), 'biz-intro-$w', s));
    testWidgets('biz-intro-full $w',
        (t) => soloShot(t, const BusinessIntroScreen(), 'biz-intro-full-$w',
            Size(s.width, 1900)));
    testWidgets('biz-free $w',
        (t) => soloShot(t, const BusinessOnboardScreen(), 'biz-free-$w', s));
    testWidgets('regflow $w', (t) => registerFlowShot(t, s, w));
    testWidgets('splash $w',
        (t) => soloShot(t, const SplashScreen(), 'splash-$w', s));
    testWidgets('login $w',
        (t) => soloShot(t, const LoginScreen(), 'login-$w', s));
    testWidgets('register $w',
        (t) => soloShot(t, const RegisterScreen(), 'register-$w', s));
  }
}
