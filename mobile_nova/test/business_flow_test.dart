import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/business/business_forms.dart';
import 'package:nfcstore_nova/features/business/business_intro.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

/// Play testeri: "FREE BIZNES YO'Q".
///
/// Server bepul biznesni qo'llardi (`POST /api/companies` + `auto:
/// true`), ilova esa faqat MAXSUS nom so'rardi va u 349 000 so'mdan
/// boshlanardi. Bu testlar yangi oqimni qo'riqlaydi:
///
///   intro -> ikki variant -> bepul forma -> `auto: true`
///                        -> maxsus nom -> faqat tekshiruv, xarid saytda
class _FakeBusinessRepo extends BusinessRepository {
  _FakeBusinessRepo() : super(ApiClient());

  final created = <Map<String, dynamic>>[];

  @override
  Future<Result<Business>> create(Map<String, dynamic> body) async {
    created.add(body);
    return Ok(Business.fromJson(const {
      'companyId': 'QWERTYUIO',
      'displayName': 'Bepul Test',
      'status': 'pending_review',
    }));
  }
}

Widget _app(_FakeBusinessRepo repo, String initial) {
  final router = GoRouter(
    initialLocation: initial,
    routes: [
      GoRoute(
          path: Routes.businessIntro,
          builder: (_, __) => const BusinessIntroScreen()),
      GoRoute(
        path: Routes.businessOnboard,
        builder: (_, s) => BusinessOnboardScreen(
          custom: s.uri.queryParameters['mode'] == 'custom',
        ),
      ),
      GoRoute(
          path: Routes.businessDashboard,
          builder: (_, __) => const Scaffold(body: Text('DASHBOARD'))),
      GoRoute(
          path: Routes.demoBusiness,
          builder: (_, __) => const Scaffold(body: Text('DEMO'))),
    ],
  );
  return ProviderScope(
    overrides: [businessRepositoryProvider.overrideWithValue(repo)],
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
  );
}

Future<void> _pump(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 80));
  }
}

void main() {
  testWidgets('intro ikki variantni ko‘rsatadi va bepul formaga olib boradi',
      (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final repo = _FakeBusinessRepo();
    await tester.pumpWidget(_app(repo, Routes.businessIntro));
    await _pump(tester);

    final l = await L.delegate.load(const Locale('uz'));
    // Imkoniyatlar ro'yxati tepada; variantlar pastda.
    expect(find.text(l.bizFeatCatalog), findsOneWidget);
    await tester.scrollUntilVisible(
        find.byKey(const ValueKey('biz-option-premium')), 300);
    expect(find.byKey(const ValueKey('biz-option-free')), findsOneWidget);
    expect(find.byKey(const ValueKey('biz-option-premium')), findsOneWidget);
    await tester.scrollUntilVisible(find.text(l.bizFreeCta), -200);
    await tester.tap(find.text(l.bizFreeCta));
    await _pump(tester);

    // Bepul forma: manzil maydoni YO'Q, sababi yozilgan.
    expect(find.text(l.bizFreeIdNote), findsOneWidget);
    expect(find.text(l.bizId), findsNothing);
  });

  testWidgets('bepul forma: qisqa tavsifga ANIQ xabar, keyin auto:true',
      (tester) async {
    tester.view.physicalSize = const Size(1170, 3400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final repo = _FakeBusinessRepo();
    await tester.pumpWidget(_app(repo, Routes.businessOnboard));
    await _pump(tester);
    final l = await L.delegate.load(const Locale('uz'));

    // Yo'nalishlar tarjimada — xom kalit emas.
    expect(find.text(l.bizCatRestaurant), findsOneWidget);
    expect(find.text('restaurant'), findsNothing);

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'Bepul Test');
    await tester.enterText(fields.at(1), 'Toshkent');
    await tester.enterText(fields.at(2), '901234567');
    await tester.enterText(fields.at(3), 'Qisqa');
    await tester.pump();

    final create = find.byKey(const ValueKey('biz-create-free'));
    await tester.ensureVisible(create);
    await tester.tap(create);
    await _pump(tester);

    // Umumiy "to'ldiring" emas — aynan tavsif haqida.
    expect(find.text(l.bizDescriptionMin), findsOneWidget);
    expect(repo.created, isEmpty);

    await tester.enterText(
        fields.at(3), 'Oilaviy kafe: nonushta, tushlik va kechki ovqat.');
    await tester.pump();
    await tester.ensureVisible(create);
    await tester.tap(create);
    await _pump(tester);

    expect(repo.created, hasLength(1));
    final body = repo.created.single;
    expect(body['auto'], isTrue,
        reason: 'bepul Business ID server tomonidan beriladi');
    expect(body['companyId'], '');
    expect(body['displayName'], 'Bepul Test');
    expect(body['phone'], '+998901234567');
    expect(find.text('DASHBOARD'), findsOneWidget);
  });

  testWidgets('maxsus nom rejimida yaratish tugmasi YO‘Q — xarid saytda',
      (tester) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final repo = _FakeBusinessRepo();
    await tester.pumpWidget(_app(repo, Routes.businessOnboardCustom));
    await _pump(tester);
    final l = await L.delegate.load(const Locale('uz'));

    expect(find.byKey(const ValueKey('biz-create-free')), findsNothing);
    expect(find.text(l.bizId), findsOneWidget);
    // Nom faqat harf — raqam va chiziqcha kiritilmaydi, katta harf.
    await tester.enterText(find.byType(TextField).first, 'nfc-2uz');
    await tester.pump();
    expect(find.text('NFCUZ'), findsOneWidget);
    expect(repo.created, isEmpty);
  });
}
