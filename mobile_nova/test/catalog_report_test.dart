import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:nfcstore_nova/features/discover/catalog_view.dart';
import 'package:nfcstore_nova/features/social/moderation.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';
import 'support/rich_fakes.dart';

class _Mod extends ModerationRepository {
  _Mod() : super(ApiClient());
  final reports = <(ReportTarget, String, ReportReason, String)>[];

  @override
  Future<Result<void>> report({
    required ReportTarget target,
    required String targetId,
    required ReportReason reason,
    String note = '',
    String ownerCode = '',
  }) async {
    reports.add((target, targetId, reason, ownerCode));
    return const Ok(null);
  }
}

/// Shartnoma §5: katalog tovariga shikoyat — `catalog_item`.
void main() {
  test('yangi shikoyat turi serverdagi nom bilan', () {
    expect(ReportTarget.catalogItem.wire, 'catalog_item');
  });

  testWidgets('tovar sahifasi ⋯ → Shikoyat → catalog_item yuboriladi',
      (tester) async {
    tester.view.physicalSize = const Size(390, 1500) * 3;
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final p = richProducts.first;
    final mod = _Mod();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        moderationRepositoryProvider.overrideWithValue(mod),
        myBusinessesProvider.overrideWith((_) async => const <Business>[]),
      ],
      child: MaterialApp.router(
        routerConfig: GoRouter(routes: [
          GoRoute(
              path: '/',
              builder: (_, __) => CatalogProductScreen(
                  companyId: p.companyId, itemId: p.id, initial: p)),
        ]),
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
    final l = await L.delegate.load(const Locale('uz'));

    await tester.tap(find.byKey(const ValueKey('listing-more')));
    await settle(tester, frames: 8);
    expect(find.byKey(const ValueKey('listing-block')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('listing-report')));
    await settle(tester, frames: 8);
    await tester.tap(find.text(ReportReason.spam.label(l)));
    await settle(tester, frames: 2);
    await tester.tap(find.text(l.reportTitle).last);
    await settle(tester, frames: 8);

    expect(mod.reports, hasLength(1));
    expect(mod.reports.single.$1, ReportTarget.catalogItem);
    expect(mod.reports.single.$2, p.id);
    expect(mod.reports.single.$3, ReportReason.spam);
    expect(mod.reports.single.$4, p.companyId);
  });
}
