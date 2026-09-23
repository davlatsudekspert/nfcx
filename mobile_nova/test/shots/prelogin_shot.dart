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
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/buttons.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/features/auth/register_screen.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/auth/verify_screen.dart';
import 'package:nfcstore_nova/features/entry/welcome_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import '../helpers.dart';

/// KIRISHDAN OLDINGI EKRANLAR — TELEFONNING PASTKI PANELI BILAN.
///
/// Egasi (2026-09 surat): ro'yxatdan o'tishdagi "Keyingi" tugmasi
/// Samsung'ning 3 tugmali paneli OSTIDA qolib ketgan. Test muhitida
/// inset NOL bo'lgani uchun buni hech bir sinov ko'rmagan edi.
///
/// Bu yerda ekran haqiqiy telefondagidek: tepada 32, pastda 48 dp
/// tizim paneli. Har bir tugma panel USTIDA bo'lishi shart.
const _w = 390.0, _h = 844.0, _top = 32.0, _bottom = 48.0;

class _Auth extends FakeAuthRepository {
  _Auth() : super(signedIn: false);

  AppError? codeError;

  @override
  Future<Result<String>> requestRegisterCode(
          {String email = '', String phone = ''}) async =>
      codeError == null ? const Ok('email') : Err(codeError!);
}

Future<({_Auth auth, L l})> _pump(WidgetTester tester, String initial) async {
  tester.view.physicalSize = const Size(_w * 3, _h * 3);
  tester.view.devicePixelRatio = 3;
  tester.view.padding = const FakeViewPadding(top: _top * 3, bottom: _bottom * 3);
  tester.view.viewPadding = const FakeViewPadding(top: _top * 3, bottom: _bottom * 3);
  addTearDown(tester.view.reset);

  final auth = _Auth();
  final base = await testOverrides(signedIn: false);
  final router = GoRouter(initialLocation: initial, routes: [
    GoRoute(path: Routes.welcome, builder: (_, __) => const WelcomeScreen()),
    GoRoute(path: Routes.login, builder: (_, __) => const LoginScreen()),
    GoRoute(path: Routes.register, builder: (_, __) => const RegisterScreen()),
    GoRoute(
      path: Routes.registerVerify,
      builder: (_, s) => VerifyScreen(
          args: s.extra as VerifyArgs? ??
              const VerifyArgs(email: 'aziza@example.com', channel: 'email')),
    ),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...base.where((o) => !identical(o, base[1])),
      authRepositoryProvider.overrideWithValue(auth),
    ],
    child: MaterialApp.router(
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: buildTheme(NfcTokens.fallback),
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
  return (auth: auth, l: await L.delegate.load(const Locale('uz')));
}

/// Hamma tugma va bosiladigan joy tizim paneli ustida.
Future<void> _check(WidgetTester tester, String name) async {
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('png/prelogin-$name.png'));
  final limit = _h - _bottom;
  final targets = [
    ...find.byType(NovaButton).hitTestable().evaluate(),
    ...find.byType(TextButton).hitTestable().evaluate(),
    ...find.byType(Checkbox).hitTestable().evaluate(),
    ...find.byType(TextField).hitTestable().evaluate(),
  ];
  expect(targets, isNotEmpty, reason: '$name: bosiladigan narsa topilmadi');
  for (final e in targets) {
    final r = tester.getRect(find.byElementPredicate((x) => identical(x, e)));
    expect(r.bottom, lessThanOrEqualTo(limit + .5),
        reason: '$name: ${e.widget.runtimeType} tizim paneli ostida '
            '(pasti ${r.bottom.toStringAsFixed(1)} > $limit)');
    expect(r.top, greaterThanOrEqualTo(_top - .5),
        reason: '$name: ${e.widget.runtimeType} status panel ostida');
  }
}

void main() {
  setUpAll(() async {
    final fams = {
      'InstrumentSerif': ['assets/fonts/InstrumentSerif-400.ttf'],
      'Manrope': ['assets/fonts/Manrope-400.ttf','assets/fonts/Manrope-500.ttf','assets/fonts/Manrope-600.ttf','assets/fonts/Manrope-700.ttf'],
      'IBMPlexMono': ['assets/fonts/IBMPlexMono-500.ttf'],
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
      final l = FontLoader('MaterialIcons')..addFont(Future.value(icons.readAsBytesSync().buffer.asByteData()));
      await l.load();
    }
  });
  testWidgets('Xush kelibsiz', (tester) async {
    await _pump(tester, Routes.welcome);
    await _check(tester, 'welcome');
  });

  testWidgets('Kirish', (tester) async {
    await _pump(tester, Routes.login);
    await _check(tester, 'login');
  });

  testWidgets('Ro‘yxatdan o‘tish — har 5 qadam', (tester) async {
    final r = await _pump(tester, Routes.register);
    final l = r.l;
    Future<void> next() async {
      await tester.tap(find.text(l.actionNext).last);
      await settle(tester, frames: 8);
    }

    await _check(tester, 'register-1-type');
    await tester.tap(find.byKey(const ValueKey('signup-type-personal')));
    await tester.pump();
    await next();
    await _check(tester, 'register-2-name');
    await tester.enterText(find.byType(TextField).hitTestable().first, 'Aziza Karimova');
    await next();
    await _check(tester, 'register-3-email');
    await tester.enterText(find.byType(TextField).hitTestable().first, 'aziza@example.com');
    await next();
    await _check(tester, 'register-4-phone');
    await tester.enterText(find.byType(TextField).hitTestable().first, '901234567');
    await next();
    await _check(tester, 'register-5-password');
  });

  testWidgets('Band telefon — telefon qadamiga qaytadi va sababi aytiladi',
      (tester) async {
    final r = await _pump(tester, Routes.register);
    final l = r.l;
    r.auth.codeError =
        const AppError(AppErrorKind.conflict, code: 'phone_taken');
    Future<void> next() async {
      await tester.tap(find.text(l.actionNext).last);
      await settle(tester, frames: 8);
    }

    await tester.tap(find.byKey(const ValueKey('signup-type-personal')));
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
    await tester.tap(find.byType(Checkbox).last);
    await tester.pump();
    await tester.tap(find.text(l.actionContinue).last);
    await settle(tester, frames: 12);

    expect(find.byType(VerifyScreen), findsNothing,
        reason: 'band raqam bilan kod ekraniga o‘tmasligi kerak');
    expect(find.text(l.errPhoneTaken), findsOneWidget);
    expect(find.text(l.errConflict), findsNothing,
        reason: 'umumiy “band” xatosi chiqmasin — sababi aniq aytilsin');
    expect(find.text(l.registerStep(4, 5)), findsOneWidget,
        reason: 'telefon qadamiga qaytishi kerak');
    await _check(tester, 'register-phone-taken');
  });

  testWidgets('Kod ekrani', (tester) async {
    await _pump(tester, Routes.registerVerify);
    await _check(tester, 'verify');
  });
}
