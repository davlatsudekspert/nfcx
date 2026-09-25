import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/forgot_password_screen.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// Egasi (2026-09-25): "ilova bo'yicha parolni unutsa nima qiladi".
class _Auth extends FakeAuthRepository {
  _Auth({this.fail}) : super(signedIn: false);

  final AppError? fail;
  final sent = <String>[];

  @override
  Future<Result<void>> requestPasswordResetEmail(String email) async {
    sent.add(email);
    return fail == null ? const Ok(null) : Err(fail!);
  }
}

Future<L> _pump(WidgetTester tester, _Auth auth) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final base = await testOverrides(signedIn: false);
  final router = GoRouter(initialLocation: Routes.login, routes: [
    GoRoute(path: Routes.login, builder: (_, __) => const LoginScreen()),
    GoRoute(
      path: Routes.forgotPassword,
      builder: (_, s) =>
          ForgotPasswordScreen(initialEmail: s.extra as String? ?? ''),
    ),
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
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    ),
  ));
  await settle(tester);
  return L.delegate.load(const Locale('uz'));
}

Future<void> _openForgot(WidgetTester tester, String email) async {
  await tester.enterText(find.byType(TextField).first, email);
  await tester.ensureVisible(find.byKey(const ValueKey('login-forgot')));
  await tester.tap(find.byKey(const ValueKey('login-forgot')));
  await settle(tester);
}

void main() {
  testWidgets('kirishdan “Parolni unutdingizmi?” → email tayyor → havola yuboriladi',
      (tester) async {
    final auth = _Auth();
    final l = await _pump(tester, auth);
    expect(find.text(l.loginForgot), findsOneWidget);

    await _openForgot(tester, 'ali@example.com');
    expect(find.text(l.forgotTitle), findsOneWidget);
    expect(find.widgetWithText(TextField, 'ali@example.com'), findsOneWidget,
        reason: 'kirishda yozilgan email qayta yozdirilmaydi');

    await tester.tap(find.byKey(const ValueKey('forgot-send')));
    await settle(tester);
    expect(auth.sent, ['ali@example.com']);
    expect(find.text(l.forgotSentTitle), findsOneWidget);
    expect(find.text(l.forgotSentBody('ali@example.com')), findsOneWidget);

    // "Kirishga qaytish" — kirish ekraniga.
    await tester.ensureVisible(find.byKey(const ValueKey('forgot-back')));
    await tester.tap(find.byKey(const ValueKey('forgot-back')));
    await settle(tester);
    expect(find.text(l.loginTitle), findsOneWidget);
  });

  testWidgets('noto‘g‘ri email — so‘rov ketmaydi', (tester) async {
    final auth = _Auth();
    final l = await _pump(tester, auth);
    await _openForgot(tester, 'ali@');
    await tester.tap(find.byKey(const ValueKey('forgot-send')));
    await settle(tester);
    expect(auth.sent, isEmpty);
    expect(find.text(l.errBadEmail), findsOneWidget);
  });

  testWidgets('ko‘p urinish (429) — sabab ko‘rsatiladi, “yuborildi” emas',
      (tester) async {
    final auth = _Auth(fail: const AppError(AppErrorKind.rateLimited, status: 429));
    final l = await _pump(tester, auth);
    await _openForgot(tester, 'ali@example.com');
    await tester.tap(find.byKey(const ValueKey('forgot-send')));
    await settle(tester);
    expect(find.text(l.errRateLimited), findsOneWidget);
    expect(find.text(l.forgotSentTitle), findsNothing);
  });
}
