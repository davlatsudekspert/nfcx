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

/// RAQAMLI XARIDGA ISHORA YO'Q — iPhone'da HAM, Android'da HAM.
///
/// Egasining qarori (2026-09-27): iPhone versiyasida NFC ID,
/// Premium, o'z nomi va FEATURED NARXI hamda "saytda oling" YOZUVI
/// ko'rsatilmaydi (Apple 3.1.1 / 3.1.3(f)).
///
/// 2026-10-08: Android ham shunday — Google Play to'lov qoidasi
/// raqamli xizmat uchun Play Billing'dan boshqa to'lov usuliga
/// yo'naltirishni taqiqlaydi. Shuning uchun har tekshiruv IKKALA
/// platformada: raqamli narx YO'Q, tashqi xaridga chaqiriq YO'Q.
/// Jismoniy tovar (NFC karta) yozuvi va narxi ikkalasida QOLADI —
/// busiz "hammasi yashirildi" xatosi ko'rinmay qolardi.
final _both = TargetPlatformVariant(
    const {TargetPlatform.android, TargetPlatform.iOS});

void main() {
  group('platforma kaliti', () {
    test('Android (standart): raqamli narx va sayt yozuvi yo‘q', () {
      expect(isAppStoreBuild, isFalse);
      expect(showDigitalPrices, isFalse);
      expect(showDigitalSiteHints, isFalse);
      expect(showFeaturedEntry, isFalse);
    });

    test('iPhone: raqamli narx va sayt yozuvi yo‘q', () {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      try {
        expect(isAppStoreBuild, isTrue);
        expect(showDigitalPrices, isFalse);
        expect(showDigitalSiteHints, isFalse);
        expect(showFeaturedEntry, isFalse);
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

    testWidgets('raqamli xarid yozuvi YO‘Q (Android va iPhone)',
        (tester) async {
      await pump(tester, const StoreNotice(text: 'RAQAMLI'));
      expect(find.text('RAQAMLI'), findsNothing);
      expect(find.text(kSiteHost), findsNothing);
    }, variant: _both);

    testWidgets('JISMONIY karta yozuvi qoladi (Android va iPhone)',
        (tester) async {
      await pump(tester, const StoreNotice(text: 'JISMONIY', physical: true));
      expect(find.text('JISMONIY'), findsOneWidget);
      expect(find.text(kSiteHost), findsOneWidget);
    }, variant: _both);
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

    testWidgets('darajalar bor, narx YO‘Q, "Sotuvda emas" qoladi',
        (tester) async {
      final l = await pump(tester);
      expect(tester.takeException(), isNull);
      expect(find.byKey(const ValueKey('tier-tile-gold')), findsOneWidget);
      expect(find.byKey(const ValueKey('tier-tile-exclusive')), findsOneWidget);
      expect(find.text(formatMoney(500000, 'UZS')), findsNothing);
      expect(find.textContaining(l.tierPriceFromSuffix), findsNothing);
      // Narx emas, holat — ikkala platformada ko'rinadi.
      expect(find.text(l.idStateNotForSale), findsOneWidget);
    }, variant: _both);
  });

  /// Barcha raqamli narx joylari kalitdan o'tadi. Yangi narx qo'shilib,
  /// kalit unutilsa — narx qaytib chiqadi va App Store ham, Google Play
  /// ham rad etadi. Widget testi har ekranni qamrab olmaydi, shuning uchun
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
          "'plan_limit_reached' => l.errPlanLimitIos,",
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

    test('"Lentada ko‘tarish" tugmasi `showFeaturedEntry` ortida', () {
      final src = read('lib/features/social/post_screens.dart');
      final at = src.indexOf('Routes.featured(');
      expect(at, greaterThan(0));
      final before = src.substring(0, at);
      final guard = before.lastIndexOf('if (showFeaturedEntry)');
      final button = before.lastIndexOf('NovaIconButton(');
      expect(guard, greaterThan(0), reason: 'kalit yo‘q');
      expect(guard, lessThan(button),
          reason: 'kalit aynan shu tugmadan oldin turishi kerak');
    });

    test('`/featured` marshruti `showFeaturedEntry` bilan yopiq', () {
      final src = read('lib/routing/router.dart');
      final at = src.indexOf("path: '/featured/:kind/:id'");
      expect(at, greaterThan(0));
      final route = src.substring(at, src.indexOf('builder:', at));
      expect(route, contains('showFeaturedEntry ? null : Routes.home'));
    });

    /// Avval faqat Android'da chiziladigan "(sayt orqali)", "saytdagi
    /// chegirma" va "o'z nomini sotib oling" matnlari endi ikkala
    /// platformada ham kalit (`showDigitalPrices` / `showDigitalSiteHints`)
    /// ortida — kalitsiz qaytsa Android'da yana chiqib qolardi.
    test('xarid / sayt matnlari faqat kalit ortida', () {
      expect(read('lib/design/widgets/states.dart'),
          isNot(contains('l.errPlanLimit,')));
      expect(read('lib/features/settings/invite_screen.dart'),
          contains('showDigitalSiteHints && kShowSiteNotice'));
      final forms = read('lib/features/business/business_forms.dart');
      for (final k in ['l.bizPlanFreeBody', 'l.bizPlanPremiumBody']) {
        final at = forms.indexOf(k);
        expect(at, greaterThan(0), reason: k);
        expect(forms.substring(0, at).lastIndexOf('if (showDigitalPrices) ...['),
            greaterThan(0), reason: '$k kalitsiz');
      }
    });

    test('neytral (iPhone va Android) matnlarda xarid va sayt ishorasi yo‘q', () {
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
