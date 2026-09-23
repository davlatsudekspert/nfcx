import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/profile_setup_screen.dart';
import 'package:nfcstore_nova/features/auth/register_screen.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/auth/verify_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// RO'YXATDAN O'TISH — BOSHIDAN OXIRIGACHA.
///
///   Shaxsiy/Biznes → ism → email → telefon → parol + rozilik →
///   email kodi (bufer, o'chirish, qayta yuborish) → hisob yaratiladi →
///   server bergan BEPUL NFC ID → profil sozlash → Home
///   (Biznes tanlagan bo'lsa — Business intro).
///
/// Server bilan shartnoma soxta repozitoriyda qayd etiladi va
/// tekshiriladi: kalit nomlari `scripts/test-nova-register-payload.mjs`
/// da server tomondan ham qo'riqlanadi.
class _Auth extends FakeAuthRepository {
  _Auth() : super(signedIn: false, ids: const [
          // Server ro'yxatdan o'tishda avtomatik beradigan BEPUL
          // 8 xonali ID (`createFreeAutoId`, hosting/api/auth.js).
          NfcId(code: '48210377', name: 'Aziza Karimova', primary: true),
        ]);

  final codeRequests = <({String email, String phone})>[];
  final registers = <Map<String, Object?>>[];
  bool registered = false;

  @override
  Future<Result<String>> requestRegisterCode(
      {String email = '', String phone = ''}) async {
    codeRequests.add((email: email, phone: phone));
    return const Ok('email');
  }

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
    registers.add({
      'name': name,
      'email': email,
      'phone': phone,
      'password': password,
      'code': code,
      'tos': tosAccepted,
    });
    if (code != '482913') {
      return const Err(AppError(AppErrorKind.validation, code: 'bad_email_code'));
    }
    registered = true;
    return const Ok(User(id: 7, email: 'aziza@example.com', name: 'Aziza Karimova'));
  }

  @override
  Future<Result<({User user, List<NfcId> ids})>> restore() async => registered
      ? Ok((user: const User(id: 7, email: 'aziza@example.com', name: 'Aziza Karimova'), ids: ids))
      : const Err(AppError(AppErrorKind.unauthorized));
}

Future<({ProviderContainer c, _Auth auth, GoRouter router})> _app(
    WidgetTester tester) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  final auth = _Auth();
  final base = await testOverrides(signedIn: false);
  final c = ProviderContainer(overrides: [
    ...base.where((o) => !identical(o, base[1])),
    authRepositoryProvider.overrideWithValue(auth),
  ]);
  addTearDown(c.dispose);

  final router = GoRouter(
    initialLocation: Routes.register,
    routes: [
      GoRoute(path: Routes.register, builder: (_, __) => const RegisterScreen()),
      GoRoute(
        path: Routes.registerVerify,
        builder: (_, s) => VerifyScreen(args: s.extra! as VerifyArgs),
      ),
      GoRoute(
          path: Routes.profileSetup,
          builder: (_, __) => const ProfileSetupScreen()),
      GoRoute(
          path: Routes.home,
          builder: (_, __) => const Scaffold(body: Text('HOME'))),
      GoRoute(
          path: Routes.businessIntro,
          builder: (_, __) => const Scaffold(body: Text('BUSINESS INTRO'))),
    ],
  );
  await tester.pumpWidget(UncontrolledProviderScope(
    container: c,
    child: MaterialApp.router(
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
  await settle(tester);
  return (c: c, auth: auth, router: router);
}

Future<void> _fillSteps(WidgetTester tester, L l, {required String type}) async {
  Future<void> next() async {
    await tester.tap(find.text(l.actionNext).last);
    await settle(tester, frames: 8);
  }

  await tester.tap(find.byKey(ValueKey('signup-type-$type')));
  await tester.pump();
  await next();
  await tester.enterText(find.byType(TextField).hitTestable().first, 'Aziza Karimova');
  await next();
  await tester.enterText(find.byType(TextField).hitTestable().first, 'aziza@example.com');
  await next();
  await tester.enterText(find.byType(TextField).hitTestable().first, '901234567');
  await next();
  final pw = find.byType(TextField).hitTestable();
  await tester.enterText(pw.at(0), 'Kuchli-parol-2026');
  await tester.enterText(pw.at(1), 'Kuchli-parol-2026');
  await tester.pump();
}

Future<void> _acceptAndContinue(WidgetTester tester, L l) async {
  await tester.tap(find.byType(Checkbox).last);
  await tester.pump();
  await tester.tap(find.text(l.actionContinue).last);
  await settle(tester, frames: 12);
}

void main() {
  testWidgets('Shaxsiy: to‘liq oqim → bepul NFC ID → Home', (tester) async {
    final r = await _app(tester);
    final l = await L.delegate.load(const Locale('uz'));

    await _fillSteps(tester, l, type: 'personal');
    await _acceptAndContinue(tester, l);

    // Kod so'rovi — email va normallashgan telefon bilan.
    expect(r.auth.codeRequests.single.email, 'aziza@example.com');
    expect(r.auth.codeRequests.single.phone, '+998901234567');
    expect(find.byType(VerifyScreen), findsOneWidget);

    // Noto'g'ri kod — maydon qizaradi, hisob yaratilmaydi.
    await tester.enterText(find.byType(TextField).last, '111111');
    await settle(tester, frames: 6);
    expect(find.text(l.verifyWrongCode), findsOneWidget);
    expect(r.auth.registered, isFalse);

    // Backspace: hammasi o'chiriladi, keyin to'g'ri kod.
    await tester.enterText(find.byType(TextField).last, '');
    await tester.pump();
    await tester.enterText(find.byType(TextField).last, '482913');
    await settle(tester, frames: 12);

    final body = r.auth.registers.last;
    expect(body['code'], '482913');
    expect(body['tos'], isTrue);
    expect(body['phone'], '+998901234567');

    // Server bergan BEPUL ID sessiyada.
    expect(r.c.read(myIdsProvider).map((e) => e.code), contains('48210377'));
    expect(find.byType(ProfileSetupScreen), findsOneWidget);
    expect(find.byKey(const ValueKey('setup-free-id')), findsOneWidget);
    expect(find.text('48210377'), findsOneWidget,
        reason: 'bepul ID hisob ochilgan zahoti ko‘rinadi');

    await tester.tap(find.text(l.setupSkip));
    await settle(tester, frames: 10);
    expect(find.text('HOME'), findsOneWidget);
    expect(find.text('BUSINESS INTRO'), findsNothing);
  });

  testWidgets('Biznes: oqim oxirida Business intro ochiladi', (tester) async {
    await _app(tester);
    final l = await L.delegate.load(const Locale('uz'));

    await _fillSteps(tester, l, type: 'business');
    await _acceptAndContinue(tester, l);
    await tester.enterText(find.byType(TextField).last, '482913');
    await settle(tester, frames: 12);
    await tester.tap(find.text(l.setupSkip));
    await settle(tester, frames: 12);
    expect(find.text('BUSINESS INTRO'), findsOneWidget);
  });

  testWidgets('rozilik belgilanmasa kod so‘ralmaydi', (tester) async {
    final r = await _app(tester);
    final l = await L.delegate.load(const Locale('uz'));
    await _fillSteps(tester, l, type: 'personal');
    await tester.tap(find.text(l.actionContinue).last);
    await settle(tester, frames: 6);
    expect(find.text(l.registerTosRequired), findsOneWidget);
    expect(r.auth.codeRequests, isEmpty);
  });

  testWidgets('bufer: kod nusxalangan bo‘lsa taklif chiqadi va bir bosishda tushadi',
      (tester) async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.getData') return {'text': '482913'};
      return null;
    });
    addTearDown(() => TestDefaultBinaryMessengerBinding
        .instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null));

    final r = await _app(tester);
    final l = await L.delegate.load(const Locale('uz'));
    await _fillSteps(tester, l, type: 'personal');
    await _acceptAndContinue(tester, l);

    // Pochtadan qaytish — ilova qayta faollashadi, bufer o'qiladi.
    for (final s in const [
      AppLifecycleState.inactive,
      AppLifecycleState.hidden,
      AppLifecycleState.paused,
      AppLifecycleState.hidden,
      AppLifecycleState.inactive,
      AppLifecycleState.resumed,
    ]) {
      tester.binding.handleAppLifecycleStateChanged(s);
      await tester.pump();
    }
    await settle(tester, frames: 6);

    final paste = find.textContaining('482913');
    expect(paste, findsWidgets, reason: 'buferdagi kod taklif qilinmadi');
    await tester.tap(paste.first);
    await settle(tester, frames: 12);
    expect(r.auth.registers.last['code'], '482913');
    expect(find.byType(ProfileSetupScreen), findsOneWidget);
  });

  testWidgets('qayta yuborish 60 soniyada ochiladi (5 daqiqa emas)',
      (tester) async {
    final r = await _app(tester);
    final l = await L.delegate.load(const Locale('uz'));
    await _fillSteps(tester, l, type: 'personal');
    await _acceptAndContinue(tester, l);

    expect(find.byKey(const ValueKey('verify-resend')), findsNothing);
    await tester.pump(const Duration(seconds: VerifyScreen.resendCooldownForTest));
    await tester.pump(const Duration(seconds: 1));
    expect(find.byKey(const ValueKey('verify-resend')), findsOneWidget);
    // Kod hali amalda — maydon o'chmagan.
    expect(find.text(l.verifyExpired), findsNothing);

    await tester.tap(find.byKey(const ValueKey('verify-resend')));
    await settle(tester, frames: 4);
    expect(r.auth.codeRequests.length, 2);
    expect(find.byKey(const ValueKey('verify-resend')), findsNothing,
        reason: 'yangi oraliq boshlandi');
  });
}
