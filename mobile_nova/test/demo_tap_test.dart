import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/features/business/business_screens.dart';
import 'package:nfcstore_nova/features/demo/demo_data.dart';
import 'package:nfcstore_nova/features/home/widgets/nfc_mobile_section.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// HAQIQIY TAP TESTLARI.
///
/// "Callback bor" degan tekshiruv yetarli emas: yuza chinakam
/// bosilishi va TEGISHLI MARSHRUT ochilishi kerak. Shuning uchun
/// bu yerda haqiqiy `tap()` qilinadi va qayerga borilgani
/// tekshiriladi.
void main() {
  /// Bosilgan manzillar.
  late List<String> went;

  Future<void> pumpSection(WidgetTester tester) async {
    went = [];
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(
            body: SingleChildScrollView(child: NfcMobileSection()),
          ),
        ),
        GoRoute(
          path: Routes.demoPersonal,
          builder: (_, __) {
            went.add(Routes.demoPersonal);
            return const Scaffold(body: Text('PERSONAL'));
          },
        ),
        GoRoute(
          path: Routes.demoBusiness,
          builder: (_, __) {
            went.add(Routes.demoBusiness);
            return const Scaffold(body: Text('BUSINESS'));
          },
        ),
      ],
    );

    await tester.pumpWidget(ProviderScope(
      overrides: [...await testOverrides()],
      child: wrapRouter(router),
    ));
    await settle(tester);
  }

  /// Yuzani ko'rinadigan joyga surib, o'sha nuqtaga bosadi.
  ///
  /// Ro'yxat DANGASA va test oynasi kichik: pastdagi karta
  /// umuman qurilmaydi, shuning uchun avval surish shart.
  Future<void> tapOn(WidgetTester tester, Finder f) async {
    await tester.scrollUntilVisible(f, 140,
        scrollable: find.byType(Scrollable).first);
    await settle(tester);
    await tester.tapAt(tester.getRect(f).center);
    await settle(tester);
  }

  group('Shaxsiy karta — BUTUN yuzasi bosiladi', () {
    testWidgets('SARLAVHA qismi bosilsa profil ochiladi', (tester) async {
      await pumpSection(tester);
      // "Zafar" yozuvining USTIGA bosamiz — CTA emas.
      await tapOn(tester, find.text(demoPersonalId.name));
      expect(went, [Routes.demoPersonal],
          reason: 'sarlavhani bosganda hech qayerga borilmadi');
    });

    testWidgets('SURAT qismi bosilsa profil ochiladi', (tester) async {
      await pumpSection(tester);
      // Kartadagi portret — o'ng yuqori burchak.
      await tapOn(tester, find.byType(Image).first);
      expect(went, [Routes.demoPersonal],
          reason: 'suratni bosganda hech qayerga borilmadi');
    });

    testWidgets('STATISTIKA qismi bosilsa ham profil ochiladi',
        (tester) async {
      await pumpSection(tester);
      final l = await L.delegate.load(const Locale('uz'));
      // Statistika qutilaridan biri — kartaning "bo'sh" joyi.
      await tapOn(tester, find.text(l.profileFollowers).first);
      expect(went, [Routes.demoPersonal]);
    });

    testWidgets('CTA tugmasi bosilsa profil ochiladi', (tester) async {
      await pumpSection(tester);
      final l = await L.delegate.load(const Locale('uz'));
      await tapOn(tester, find.text(l.demoViewProfile));
      expect(went, [Routes.demoPersonal]);
    });
  });

  group('Biznes karta — BUTUN yuzasi bosiladi', () {
    testWidgets('SARLAVHA qismi bosilsa do‘kon ochiladi', (tester) async {
      await pumpSection(tester);
      await tapOn(tester, find.text(demoBusiness.displayName));
      expect(went, [Routes.demoBusiness],
          reason: 'biznes kartaning sarlavhasi bosilmayapti');
    });

    testWidgets('SURAT qismi bosilsa do‘kon ochiladi', (tester) async {
      await pumpSection(tester);
      // Biznes kartaning surati — do'kon fotosi.
      await tapOn(tester, find.byType(Image).last);
      expect(went, [Routes.demoBusiness],
          reason: 'biznes kartaning surati bosilmayapti');
    });

    testWidgets('CTA tugmasi bosilsa do‘kon ochiladi', (tester) async {
      await pumpSection(tester);
      final l = await L.delegate.load(const Locale('uz'));
      await tapOn(tester, find.text(l.demoViewBusiness));
      expect(went, [Routes.demoBusiness]);
    });
  });

  testWidgets('KATALOG mahsuloti bosilsa TAFSILOT ochiladi',
      (tester) async {
    final item = demoCatalog.first;
    await tester.pumpWidget(ProviderScope(
      overrides: [...await testOverrides()],
      child: wrapScreen(
        Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: CatalogTile(
                item: item,
                onTap: () => showProductSheet(context, item),
              ),
            ),
          ),
        ),
      ),
    ));
    await settle(tester);

    // Ilgari plitkada `onTap` UMUMAN yo'q edi — o'lik yuza.
    await tester.tap(find.text(item.name));
    await settle(tester);

    final l = await L.delegate.load(const Locale('uz'));
    expect(find.text(l.demoAddToCart), findsOneWidget,
        reason: 'mahsulot tafsiloti ochilmadi');
    expect(find.textContaining(item.description.split(' ').first),
        findsWidgets);
  });
}
