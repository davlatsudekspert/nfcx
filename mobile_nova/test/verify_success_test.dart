import 'package:flutter/material.dart';
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
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/auth/verify_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// TO'G'RI KOD — YASHIL (egasi, 2026-09): "kod to'g'ri deb yashil
/// rangda chiqsin, qizil rangda chiqmoqda".
class _Auth extends FakeAuthRepository {
  _Auth() : super(signedIn: false);

  @override
  Future<Result<User>> register({
    required String name,
    required String email,
    required String phone,
    required String password,
    required String code,
    required bool tosAccepted,
    String? promoCode,
  }) async =>
      code == '482913'
          ? const Ok(User(id: 9, email: 'a@example.com', name: 'A'))
          : const Err(AppError(AppErrorKind.validation, code: 'bad_email_code'));
}

Future<L> _pump(WidgetTester tester) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final base = await testOverrides(signedIn: false);
  final router = GoRouter(initialLocation: '/v', routes: [
    GoRoute(
        path: '/v',
        builder: (_, __) => const VerifyScreen(
            args: VerifyArgs(email: 'a@example.com', channel: 'email'))),
    GoRoute(
        path: Routes.profileSetup,
        builder: (_, __) => const Scaffold(body: Text('SETUP'))),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...base.where((o) => !identical(o, base[1])),
      authRepositoryProvider.overrideWithValue(_Auth()),
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

void main() {
  testWidgets('to‘g‘ri kod: yashil “Kod tasdiqlandi”, keyin keyingi ekran',
      (tester) async {
    final l = await _pump(tester);
    await tester.enterText(find.byType(TextField).last, '482913');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    final title = tester.widget<Text>(find.byKey(const ValueKey('verify-title')));
    expect(title.data, l.verifyCodeAccepted);
    expect(title.style?.color, NfcTokens.fallback.success,
        reason: 'to‘g‘ri kod YASHIL bo‘lishi kerak');
    expect(find.byIcon(Icons.check_rounded), findsOneWidget);

    await settle(tester, frames: 12);
    expect(find.text('SETUP'), findsOneWidget);
  });

  testWidgets('noto‘g‘ri kod: qizil, yashil yo‘q', (tester) async {
    final l = await _pump(tester);
    await tester.enterText(find.byType(TextField).last, '111111');
    await settle(tester, frames: 6);
    final title = tester.widget<Text>(find.byKey(const ValueKey('verify-title')));
    expect(title.data, l.verifyWrongCode);
    expect(title.style?.color, NfcTokens.fallback.error);
    expect(find.byIcon(Icons.check_rounded), findsNothing);
  });
}
