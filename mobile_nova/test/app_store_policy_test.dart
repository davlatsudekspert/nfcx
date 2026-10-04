import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/business/business_screens.dart'
    show formatMoney;
import 'package:nfcstore_nova/features/shop/nfc_id_market.dart';
import 'package:nfcstore_nova/features/shop/store_policy.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// APP STORE (iPhone) — RAQAMLI XARIDGA ISHORA YO'Q.
///
/// Egasining qarori (2026-09-27): iPhone versiyasida NFC ID,
/// Premium, o'z nomi va FEATURED NARXI hamda "saytda oling" YOZUVI
/// ko'rsatilmaydi (Apple 3.1.1 / 3.1.3(f)). ANDROID O'ZGARMAYDI —
/// shuning uchun har tekshiruv ikki tomonlama: Android'da BOR,
/// iPhone'da YO'Q. Bittasi yolg'iz sinalsa, "hammasi yashirildi" yoki
/// "hech narsa o'zgarmadi" xatosi ko'rinmay qolardi.
void main() {
  group('platforma kaliti', () {
    test('Android (standart): narx va yozuv bor', () {
      expect(isAppStoreBuild, isFalse);
      expect(showDigitalPrices, isTrue);
    });

    test('iPhone: raqamli narx yo‘q', () {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      try {
        expect(isAppStoreBuild, isTrue);
        expect(showDigitalPrices, isFalse);
      } finally {
        debugDefaultTargetPlatformOverride = null;
      }
    });
  });

  group('StoreNotice', () {
    Future<void> pump(WidgetTester tester, Widget child) =>
        tester.pumpWidget(MaterialApp(
          theme: buildTheme(NfcTokens.ivory),
          home: Scaffold(body: child),
        ));

    testWidgets('Android: raqamli xarid yozuvi ko‘rinadi', (tester) async {
      await pump(tester, const StoreNotice(text: 'RAQAMLI'));
      expect(find.text('RAQAMLI'), findsOneWidget);
      expect(find.text(kSiteHost), findsOneWidget);
    });

    testWidgets('iPhone: raqamli xarid yozuvi YO‘Q', (tester) async {
      await pump(tester, const StoreNotice(text: 'RAQAMLI'));
      expect(find.text('RAQAMLI'), findsNothing);
      expect(find.text(kSiteHost), findsNothing);
    }, variant: TargetPlatformVariant.only(TargetPlatform.iOS));

    testWidgets('iPhone: JISMONIY karta yozuvi qoladi (3.1.5(a))',
        (tester) async {
      await pump(tester, const StoreNotice(text: 'JISMONIY', physical: true));
      expect(find.text('JISMONIY'), findsOneWidget);
      expect(find.text(kSiteHost), findsOneWidget);
    }, variant: TargetPlatformVariant.only(TargetPlatform.iOS));
  });

  group('NFC ID darajalari', () {
    const tiers = [
      IdTier(tier: 'exclusive', price: 2000000, from: true),
      IdTier(tier: 'gold', price: 500000),
      IdTier(tier: 'silver'),
    ];

    Future<L> pump(WidgetTester tester) async {
      tester.view.physicalSize = const Size(390, 900) * 3;
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final router = GoRouter(routes: [
        GoRoute(path: '/', builder: (_, __) => const NfcIdMarketScreen()),
      ]);
      await tester.pumpWidget(ProviderScope(
        overrides: [
          ...await testOverrides(),
          idPricingProvider.overrideWith((ref) async => tiers),
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
      return L.delegate.load(const Locale('uz'));
    }

    testWidgets('Android: narxlar ko‘rinadi', (tester) async {
      final l = await pump(tester);
      expect(tester.takeException(), isNull);
      expect(find.byKey(const ValueKey('tier-tile-gold')), findsOneWidget);
      expect(find.text(formatMoney(500000, 'UZS')), findsOneWidget);
      expect(find.textContaining(l.tierPriceFromSuffix), findsOneWidget);
    });

    testWidgets('iPhone: darajalar bor, narx YO‘Q, "Sotuvda emas" qoladi',
        (tester) async {
      final l = await pump(tester);
      expect(tester.takeException(), isNull);
      expect(find.byKey(const ValueKey('tier-tile-gold')), findsOneWidget);
      expect(find.byKey(const ValueKey('tier-tile-exclusive')), findsOneWidget);
      expect(find.text(formatMoney(500000, 'UZS')), findsNothing);
      expect(find.textContaining(l.tierPriceFromSuffix), findsNothing);
      // Narx emas, holat — iPhone'da ham ko'rinadi.
      expect(find.text(l.idStateNotForSale), findsOneWidget);
    }, variant: TargetPlatformVariant.only(TargetPlatform.iOS));
  });

  /// Barcha raqamli narx joylari kalitdan o'tadi. Yangi narx qo'shilib,
  /// kalit unutilsa — iPhone'da narx qaytib chiqadi va App Store rad
  /// etadi. Widget testi har ekranni qamrab olmaydi, shuning uchun
  /// manba tekshiriladi.
  group('manba qo‘riqchisi', () {
    String read(String p) => File(p).readAsStringSync();

    test('raqamli narx joylari `showDigitalPrices` bilan', () {
      final sites = {
        'lib/features/shop/nfc_id_market.dart': [
          ': !showDigitalPrices',
          'showDigitalPrices && quote.purchasable',
          'showDigitalPrices && q.purchasable',
          'showDigitalPrices ? l.idPendingHint',
          'if (showDigitalPrices) ...[',
          'showDigitalPrices ? l.idMarketTiers : l.idMarketTiersIos',
          'showDigitalPrices ? l.tierHintExclusive : l.tierHintExclusiveIos',
        ],
        'lib/features/social/featured_screen.dart': ['if (showDigitalPrices)'],
        'lib/features/settings/settings_subscreens.dart': [
          'offer != null && showDigitalPrices',
          'if (_showAmount) ...[',
        ],
        'lib/features/business/business_forms.dart': [
          '_price > 0 && showDigitalPrices',
          'showDigitalPrices ? l.bizPremiumHint : l.bizPremiumHintIos',
          'l.bizPlanLimitReachedIos',
          '? l.bizPlanLimitTitle(limit)',
        ],
        'lib/features/business/business_intro.dart': [
          'showDigitalPrices ? l.bizPremiumHint : l.bizPremiumHintIos',
        ],
        'lib/design/widgets/states.dart': [
          '_appStore ? l.errPlanLimitIos : l.errPlanLimit',
          // `plan_locked` endi hamma platformada neytral (post bepul).
          'l.errPublishUnavailable',
        ],
      };
      for (final e in sites.entries) {
        final src = read(e.key);
        for (final marker in e.value) {
          expect(src, contains(marker), reason: '${e.key}: `$marker` yo‘q');
        }
      }
    });

    test('"Lentada ko‘tarish" tugmasi iPhone’da yo‘q', () {
      final src = read('lib/features/social/post_screens.dart');
      final at = src.indexOf('Routes.featured(');
      expect(at, greaterThan(0));
      final before = src.substring(0, at);
      final guard = before.lastIndexOf('if (!isAppStoreBuild)');
      final button = before.lastIndexOf('NovaIconButton(');
      expect(guard, greaterThan(0), reason: 'kalit yo‘q');
      expect(guard, lessThan(button),
          reason: 'kalit aynan shu tugmadan oldin turishi kerak');
    });

    test('iPhone matnlarida xarid va sayt ishorasi yo‘q', () {
      const keys = [
        'errPlanLimitIos',
        'errPublishUnavailable',
        'bizPlanLimitTitle',
        'bizPlanLimitReachedIos',
        'bizPremiumHintIos',
        'idMarketTiersIos',
        'tierHintExclusiveIos',
        'idStateAvailableIos',
        'idStateTakenIos',
        'homeNoIdHintIos',
        'deleteAccountWhatIos',
      ];
      const banned = [
        'sayt', 'сайт', 'website', 'site', //
        'narx', 'цен', 'price', //
        'sotib', 'купи', 'buy', //
        'oshiring', 'повысьте', 'upgrade', //
        'Premium',
      ];
      for (final lang in ['uz', 'ru', 'en']) {
        final arb = jsonDecode(read('lib/l10n/arb/app_$lang.arb'))
            as Map<String, dynamic>;
        for (final k in keys) {
          final v = '${arb[k] ?? ''}';
          expect(v, isNotEmpty, reason: '$lang: $k yo‘q');
          for (final w in banned) {
            expect(v.toLowerCase().contains(w.toLowerCase()), isFalse,
                reason: '$lang: $k ichida "$w" — iPhone’da taqiqlangan');
          }
        }
      }
    });
  });
}
