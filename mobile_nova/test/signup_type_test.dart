import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/register_screen.dart';
import 'package:nfcstore_nova/features/auth/signup_intent.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// Egasining talabi: ro'yxatdan o'tishning BOSHIDA "Shaxsiy yoki
/// Biznes" so'ralsin; Biznes tanlagan odam profil sozlangach
/// Business intro'ga tushsin.
void main() {
  testWidgets('Biznes tanlovi eslab qolinadi', (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: await testOverrides(signedIn: false),
      child: wrapScreen(const RegisterScreen(), tokens: NfcTokens.ivory),
    ));
    await settle(tester);

    await tester.tap(find.byKey(const ValueKey('signup-type-business')));
    await tester.pump();

    final container =
        ProviderScope.containerOf(tester.element(find.byType(RegisterScreen)));
    expect(container.read(signupAccountTypeProvider),
        SignupAccountType.business);
  });

  testWidgets('yakunlanganda Biznes tanlagan odam intro’ga tushadi, '
      'orqaga bosilsa bosh sahifaga qaytadi', (tester) async {
    late WidgetRef captured;
    late BuildContext ctx;
    final router = GoRouter(
      initialLocation: '/setup',
      routes: [
        GoRoute(
          path: '/setup',
          builder: (context, __) => Consumer(builder: (context, ref, _) {
            captured = ref;
            ctx = context;
            return const Scaffold(body: Text('SETUP'));
          }),
        ),
        GoRoute(
            path: Routes.home,
            builder: (_, __) => const Scaffold(body: Text('HOME'))),
        GoRoute(
            path: Routes.businessIntro,
            builder: (_, __) => const Scaffold(body: Text('INTRO'))),
      ],
    );
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp.router(
        routerConfig: router,
        theme: buildTheme(NfcTokens.ivory),
        supportedLocales: LocaleController.supported,
        localizationsDelegates: const [
          L.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
      ),
    ));
    await tester.pump();

    // Sozlash ekrani yakunda yopiladi — konteyner oldindan olinadi.
    final container = ProviderScope.containerOf(ctx);
    captured.read(signupAccountTypeProvider.notifier).state =
        SignupAccountType.business;
    finishSignup(ctx, captured);
    await settle(tester);

    expect(find.text('INTRO'), findsOneWidget);
    // Tanlov bir marta ishlatiladi — keyingi kirishda qaytmaydi.
    expect(container.read(signupAccountTypeProvider), isNull);

    router.pop();
    await settle(tester);
    expect(find.text('HOME'), findsOneWidget);
  });

  testWidgets('Shaxsiy tanlagan odam to‘g‘ri bosh sahifaga', (tester) async {
    late WidgetRef captured;
    late BuildContext ctx;
    final router = GoRouter(
      initialLocation: '/setup',
      routes: [
        GoRoute(
          path: '/setup',
          builder: (context, __) => Consumer(builder: (context, ref, _) {
            captured = ref;
            ctx = context;
            return const Scaffold(body: Text('SETUP'));
          }),
        ),
        GoRoute(
            path: Routes.home,
            builder: (_, __) => const Scaffold(body: Text('HOME'))),
        GoRoute(
            path: Routes.businessIntro,
            builder: (_, __) => const Scaffold(body: Text('INTRO'))),
      ],
    );
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp.router(routerConfig: router),
    ));
    await tester.pump();

    captured.read(signupAccountTypeProvider.notifier).state =
        SignupAccountType.personal;
    finishSignup(ctx, captured);
    await settle(tester);

    expect(find.text('HOME'), findsOneWidget);
    expect(find.text('INTRO'), findsNothing);
  });
}
