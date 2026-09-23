import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/states.dart';
import 'package:nfcstore_nova/features/business/business_forms.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:nfcstore_nova/features/shop/store_policy.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// BIZNES TARIFI (egasining qarori, 2026-09):
///   bepul ID — 5 ta, Premium (oylik, sayt orqali) — 25 ta,
///   o'z nomi — cheksiz. Mavjud tovarlar o'chmaydi.
///
/// Ilova limitni OLDINDAN ko'rsatadi ("3 / 5"), limitda formani
/// ochmaydi va keyingi qadamni aytadi. Play qoidasi: xarid tugmasi va
/// saytga bosiladigan havola YO'Q — manzil faqat matn.
class _Repo extends BusinessRepository {
  _Repo(this.n) : super(ApiClient());
  final int n;

  @override
  Future<Result<List<CatalogItem>>> catalog(String companyId) async => Ok([
        for (var i = 0; i < n; i++)
          CatalogItem(id: i, ref: 'i$i', name: 'Tovar $i', price: 1000),
      ]);
}

Business _biz(Map<String, dynamic> plan) =>
    Business.fromJson({'companyId': 'QWERTYUIO', 'displayName': 'Test', 'plan': plan});

Future<void> _pump(WidgetTester tester, Business b, int n) async {
  tester.view.physicalSize = const Size(390, 900) * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final router = GoRouter(initialLocation: '/', routes: [
    GoRoute(path: '/', builder: (_, __) => const BusinessCatalogScreen()),
    GoRoute(
        path: Routes.businessProductNew,
        builder: (_, __) => const Scaffold(body: Text('FORM'))),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...await testOverrides(),
      activeBusinessProvider.overrideWithValue(b),
      businessRepositoryProvider.overrideWithValue(_Repo(n)),
    ],
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
  await settle(tester, frames: 8);
}

void main() {
  test('server tarifi o‘qiladi', () {
    final p = _biz({'free': true, 'itemLimit': 5, 'premiumItemLimit': 25, 'canPost': false}).plan;
    expect([p.free, p.itemLimit, p.premiumItemLimit, p.canPost], [true, 5, 25, false]);
    expect(p.atLimit(4), isFalse);
    expect(p.atLimit(5), isTrue);
    final legacy = Business.fromJson(const {'companyId': 'X'}).plan;
    expect([legacy.limited, legacy.canPost], [false, true]);
  });

  testWidgets('bepul: 3 / 5, Premium 25 ta va o‘z nomi haqida aytiladi',
      (tester) async {
    await _pump(tester, _biz({'free': true, 'itemLimit': 5, 'premiumItemLimit': 25, 'canPost': false}), 3);
    final l = await L.delegate.load(const Locale('uz'));
    expect(tester.takeException(), isNull);
    expect(find.text(l.bizPlanUsage(3, 5)), findsOneWidget);
    expect(find.text(l.bizPlanFreeTitle(5)), findsOneWidget);
    expect(find.text(l.bizPlanFreeBody(25)), findsOneWidget);
    expect(find.byType(StoreNotice), findsOneWidget);
    expect(find.byKey(const ValueKey('plan-limit-reached')), findsNothing);

    await tester.tap(find.byKey(const ValueKey('catalog-add')));
    await settle(tester, frames: 8);
    expect(find.text('FORM'), findsOneWidget, reason: 'limit to‘lmagan — forma ochiladi');
  });

  testWidgets('bepul: 5 / 5 — forma ochilmaydi, keyingi qadam aytiladi',
      (tester) async {
    await _pump(tester, _biz({'free': true, 'itemLimit': 5, 'premiumItemLimit': 25, 'canPost': false}), 5);
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.text(l.bizPlanUsage(5, 5)), findsOneWidget);
    expect(find.byKey(const ValueKey('plan-limit-reached')), findsOneWidget);
    expect(find.text('Tovar 0'), findsOneWidget, reason: 'mavjudlari joyida');

    await tester.tap(find.byKey(const ValueKey('catalog-add')));
    await settle(tester, frames: 10);
    expect(find.text('FORM'), findsNothing);
    expect(find.byType(StoreNotice), findsNWidgets(2), reason: 'varaqda ham');
    // Saytga BOSILADIGAN havola yo'q — faqat matn.
    expect(find.widgetWithText(TextButton, kSiteHost), findsNothing);
  });

  testWidgets('Premium: 25 ta, cheksiz uchun o‘z nomi', (tester) async {
    await _pump(tester, _biz({'premium': true, 'itemLimit': 25, 'canPost': true}), 12);
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.text(l.bizPlanPremiumTitle(25)), findsOneWidget);
    expect(find.text(l.bizPlanUsage(12, 25)), findsOneWidget);
    expect(find.text(l.bizPlanPremiumBody), findsOneWidget);
  });

  testWidgets('eski server Premium limitini aytmasa — va‘da berilmaydi',
      (tester) async {
    await _pump(tester, _biz({'free': true, 'itemLimit': 5, 'canPost': false}), 2);
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.textContaining('25'), findsNothing);
    expect(find.text(l.bizPlanPremiumBody), findsOneWidget);
  });

  testWidgets('sinov davri va sotib olingan nom — cheklov kartasi yo‘q',
      (tester) async {
    await _pump(tester, _biz({'trialActive': true, 'canPost': true}), 30);
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.text(l.bizPlanTrial), findsOneWidget);
    expect(find.byKey(const ValueKey('plan-card')), findsNothing);
  });

  test('server xatolari tushunarli matnga aylanadi', () async {
    final l = await L.delegate.load(const Locale('uz'));
    expect(describeError(l, const AppError(AppErrorKind.conflict, code: 'plan_limit_reached')),
        l.errPlanLimit);
    expect(describeError(l, const AppError(AppErrorKind.forbidden, code: 'plan_locked')),
        l.errPlanLocked);
  });
}
