import 'package:flutter/foundation.dart';
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
/// ochmaydi. Xarid tugmasi, tarif nomi, "sotib oling" va sayt yozuvi
/// YO'Q — iPhone'da ham, Android'da ham (Google Play to'lov qoidasi,
/// 2026-10-08, `store_policy.dart`).
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

/// Android va iPhone — qoida ikkalasida bir xil.
final _both = TargetPlatformVariant(
    const {TargetPlatform.android, TargetPlatform.iOS});

void main() {
  test('server tarifi o‘qiladi', () {
    final p = _biz({'free': true, 'itemLimit': 5, 'premiumItemLimit': 25, 'canPost': false}).plan;
    expect([p.free, p.itemLimit, p.premiumItemLimit, p.canPost], [true, 5, 25, false]);
    expect(p.atLimit(4), isFalse);
    expect(p.atLimit(5), isTrue);
    final legacy = Business.fromJson(const {'companyId': 'X'}).plan;
    expect([legacy.limited, legacy.canPost], [false, true]);
  });

  // RAQAMLI TARIF (Premium, o'z nomi) HAQIDA XARID CHAQIRIG'I YO'Q —
  // iPhone'da (egasi, 2026-09-27, Apple 3.1.1) va Android'da ham
  // (2026-10-08, Google Play to'lov qoidasi, `store_policy.dart`).
  // Limit va hisoblagich qoladi; "sotib oling / tarifni oshiring /
  // saytda" — yo'q. Har test ikkala platformada.
  testWidgets('bepul: 3 / 5 — hajm va hisoblagich, tarif nomi va xarid yo‘q',
      (tester) async {
    await _pump(tester, _biz({'free': true, 'itemLimit': 5, 'premiumItemLimit': 25, 'canPost': false}), 3);
    final l = await L.delegate.load(const Locale('uz'));
    expect(tester.takeException(), isNull);
    expect(find.text(l.bizPlanUsage(3, 5)), findsOneWidget);
    expect(find.text(l.bizPlanLimitTitle(5)), findsOneWidget);
    expect(find.text(l.bizPlanFreeTitle(5)), findsNothing);
    expect(find.text(l.bizPlanFreeBody(25)), findsNothing);
    expect(find.text(l.bizPlanStoreNotice), findsNothing);
    expect(find.text(kSiteHost), findsNothing);
    expect(find.textContaining('Premium'), findsNothing);
    expect(find.textContaining('istoriya'), findsNothing);
    expect(find.byKey(const ValueKey('plan-limit-reached')), findsNothing);

    await tester.tap(find.byKey(const ValueKey('catalog-add')));
    await settle(tester, frames: 8);
    expect(find.text('FORM'), findsOneWidget, reason: 'limit to‘lmagan — forma ochiladi');
  }, variant: _both);

  testWidgets('bepul: 5 / 5 — forma ochilmaydi, limit aytiladi, xarid chaqirig‘i yo‘q',
      (tester) async {
    await _pump(tester, _biz({'free': true, 'itemLimit': 5, 'premiumItemLimit': 25, 'canPost': false}), 5);
    final l = await L.delegate.load(const Locale('uz'));
    expect(tester.takeException(), isNull);
    expect(find.text(l.bizPlanUsage(5, 5)), findsOneWidget);
    expect(find.byKey(const ValueKey('plan-limit-reached')), findsOneWidget);
    expect(find.text(l.bizPlanLimitReachedIos), findsOneWidget);
    expect(find.text(l.bizPlanLimitReached), findsNothing);
    expect(find.text(l.bizPlanFreeBody(25)), findsNothing);
    expect(find.text('Tovar 0'), findsOneWidget, reason: 'mavjudlari joyida');

    await tester.tap(find.byKey(const ValueKey('catalog-add')));
    await settle(tester, frames: 10);
    expect(find.text('FORM'), findsNothing);
    // Varaqda ham sayt yozuvi yo'q — na matn, na havola.
    expect(find.text(l.bizPlanStoreNotice), findsNothing);
    expect(find.text(kSiteHost), findsNothing);
    expect(find.widgetWithText(TextButton, kSiteHost), findsNothing);
  }, variant: _both);

  testWidgets('Premium: 25 ta — tarif nomi va "o‘z nomini sotib oling" yo‘q',
      (tester) async {
    await _pump(tester, _biz({'premium': true, 'itemLimit': 25, 'canPost': true}), 12);
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.text(l.bizPlanLimitTitle(25)), findsOneWidget);
    expect(find.text(l.bizPlanPremiumTitle(25)), findsNothing);
    expect(find.text(l.bizPlanUsage(12, 25)), findsOneWidget);
    expect(find.text(l.bizPlanPremiumBody), findsNothing);
  }, variant: _both);

  testWidgets('eski server Premium limitini aytmasa — va‘da berilmaydi',
      (tester) async {
    await _pump(tester, _biz({'free': true, 'itemLimit': 5, 'canPost': false}), 2);
    final l = await L.delegate.load(const Locale('uz'));
    expect(find.textContaining('25'), findsNothing);
    expect(find.text(l.bizPlanPremiumBody), findsNothing);
  }, variant: _both);

  // Post va istoriya hammaga bepul (egasining qarori, 2026-10-04):
  // sinov davrida "Sinov davri: hozircha cheklov yo'q" degan yozuv
  // YO'Q — u "keyin pul to'laysiz" degan ma'no berardi.
  testWidgets('sinov davri — cheklov kartasi ham, "sinov" yozuvi ham yo‘q',
      (tester) async {
    await _pump(tester, _biz({'trialActive': true, 'canPost': true}), 30);
    expect(tester.takeException(), isNull);
    expect(find.byKey(const ValueKey('plan-card')), findsNothing);
    expect(find.byKey(const ValueKey('plan-trial')), findsNothing);
    expect(find.textContaining('Sinov'), findsNothing);
  });

  test('server xatolari tushunarli matnga aylanadi', () async {
    final l = await L.delegate.load(const Locale('uz'));
    // "(sayt orqali)" yo'q — iPhone'da ham, Android'da ham (Google Play
    // to'lov qoidasi): neytral matn ikkala platformada.
    for (final p in [TargetPlatform.android, TargetPlatform.iOS]) {
      debugDefaultTargetPlatformOverride = p;
      try {
        final msg = describeError(
            l, const AppError(AppErrorKind.conflict, code: 'plan_limit_reached'));
        expect(msg, l.errPlanLimitIos, reason: '$p');
        expect(msg.toLowerCase(), isNot(contains('sayt')), reason: '$p');
      } finally {
        debugDefaultTargetPlatformOverride = null;
      }
    }
    // `plan_locked` — eski server qoidasi; post bepul, xato NEYTRAL.
    expect(describeError(l, const AppError(AppErrorKind.forbidden, code: 'plan_locked')),
        l.errPublishUnavailable);
  });
}
