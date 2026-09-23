import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/register_screen.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/auth/verify_screen.dart';
import 'package:nfcstore_nova/features/settings/settings_subscreens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// PROMOKOD (egasi, 2026-09):
///   1) ro'yxatdan o'tishda promokod maydoni yo'q edi;
///   2) "Promokod" bo'limida taklif qilinganlar bo'sh kartalar bo'lib
///      chiqardi — server `referredEmail`/`referredName` yuboradi,
///      ilova esa `email`/`name` o'qirdi.
class _Auth extends FakeAuthRepository {
  _Auth() : super(signedIn: false);

  String? sentPromo;

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
    sentPromo = promoCode;
    return const Ok(User(id: 9, email: 'aziza@example.com', name: 'Aziza'));
  }
}

const _delegates = [
  L.delegate,
  GlobalMaterialLocalizations.delegate,
  GlobalWidgetsLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
];

void main() {
  testWidgets('ro‘yxatda promokod maydoni bor va serverga ketadi',
      (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final l = await L.delegate.load(const Locale('uz'));
    final auth = _Auth();
    final base = await testOverrides(signedIn: false);
    final router = GoRouter(initialLocation: Routes.register, routes: [
      GoRoute(path: Routes.register, builder: (_, __) => const RegisterScreen()),
      GoRoute(
          path: Routes.registerVerify,
          builder: (_, s) => VerifyScreen(args: s.extra! as VerifyArgs)),
      GoRoute(
          path: Routes.profileSetup,
          builder: (_, __) => const Scaffold(body: Text('SETUP'))),
    ]);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...base.where((o) => !identical(o, base[1])),
        authRepositoryProvider.overrideWithValue(auth),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        theme: buildTheme(NfcTokens.fallback),
        locale: const Locale('uz'),
        supportedLocales: LocaleController.supported,
        localizationsDelegates: _delegates,
      ),
    ));
    await settle(tester);

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

    expect(find.text(l.fieldPromo), findsOneWidget,
        reason: 'parol qadamida promokod maydoni yo‘q');
    final pw = find.byType(TextField).hitTestable();
    await tester.enterText(pw.at(0), 'Kuchli-parol-2026');
    await tester.enterText(pw.at(1), 'Kuchli-parol-2026');
    await tester.enterText(
        find.descendant(
            of: find.byKey(const ValueKey('register-promo')),
            matching: find.byType(TextField)),
        ' abc234 ');
    await tester.tap(find.byType(Checkbox).last);
    await tester.pump();
    await tester.tap(find.text(l.actionContinue).last);
    await settle(tester, frames: 12);

    expect(find.byType(VerifyScreen), findsOneWidget);
    await tester.enterText(find.byType(TextField).last, '482913');
    await settle(tester, frames: 12);
    expect(auth.sentPromo, 'ABC234',
        reason: 'promokod katta harfda, bo‘shliqsiz serverga ketishi kerak');
  });

  testWidgets('Promokod bo‘limi: taklif qilinganlar ismi, emaili, sanasi',
      (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 1400 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final l = await L.delegate.load(const Locale('uz'));
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        // Serverning HAQIQIY javob shakli (`GET /api/referrals`).
        referralsProvider.overrideWith((ref) async => [
              {
                'id': 2,
                'createdAt': '2026-09-20T10:00:00.000Z',
                'referredEmail': 'dost@example.com',
                'referredName': 'Dilshod Aliyev',
              },
              {
                // Telefon bilan ochilgan: email ham, ism ham yo'q.
                'id': 1,
                'createdAt': '2026-09-18T10:00:00.000Z',
                'referredEmail': '',
                'referredName': '',
              },
            ]),
      ],
      child: MaterialApp(
        theme: buildTheme(NfcTokens.fallback),
        locale: const Locale('uz'),
        supportedLocales: LocaleController.supported,
        localizationsDelegates: _delegates,
        home: const ReferralScreen(),
      ),
    ));
    await settle(tester);

    expect(find.text('Dilshod Aliyev'), findsOneWidget);
    expect(find.textContaining('dost@example.com'), findsOneWidget);
    expect(find.textContaining('20.09.2026'), findsOneWidget);
    expect(find.text(l.referralNoName), findsOneWidget);
    expect(find.text('${l.referralInvited} · 2'.toUpperCase()), findsOneWidget);
    expect(find.text(l.profileFollowers.toUpperCase()), findsNothing,
        reason: 'bu ro‘yxat obunachilar emas');
  });
}
