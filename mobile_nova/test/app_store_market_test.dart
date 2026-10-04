import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/states.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_center_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_service.dart';
import 'package:nfcstore_nova/features/shop/store_policy.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// APP STORE AUDITI (2026-10-04) — EGASINING IKKI QARORI.
///
/// (a) Post, Reels/video, istoriya va izoh — HAMMAGA BEPUL, HAMMA
///     PLATFORMADA. Ilovada Premium/daraja qulfi ham, qulf matni ham
///     yo'q; server eski kodni qaytarsa — neytral xato.
/// (b) iPhone'da NFC ID BOZORI va yashirin xarid yo'llari (Premium,
///     to'lovlar, taklif, FEATURED, do'kon, buyurtmalar, pullik o'z
///     nomi) YO'Q — menyuda ham, `nfcstore://` havolasida ham.
///     Android o'zgarmaydi.
///
/// Har tekshiruv imkon qadar IKKI TOMONLAMA: iPhone'da yo'q, Android'da
/// bor. Bittasi yolg'iz sinalsa "hamma joyda o'chdi" xatosi ko'rinmasdi.
final _ios = TargetPlatformVariant.only(TargetPlatform.iOS);

String _read(String p) => File(p).readAsStringSync();

/// Izohsiz kod — tekshiruv KOD haqida, izohdagi so'zlar haqida emas.
String _codeOnly(String s) => s
    .split('\n')
    .where((l) => !l.trimLeft().startsWith('//'))
    .join('\n');

Future<L> _uz() => L.delegate.load(const Locale('uz'));

class _ReadyNfc extends NfcService {
  @override
  Future<NfcAvailability> check() async => NfcAvailability.ready;
}

class _NoNfc extends NfcService {
  @override
  Future<NfcAvailability> check() async => NfcAvailability.unsupported;
}

const _vip = NfcId(code: 'VIP001', name: 'Ali', primary: true);

/// Ekranni haqiqiy `GoRouter` ichida ochadi; [extra] yo'llarga o'tish
/// [went] ga yoziladi.
Widget _routed(
  Widget screen,
  List<Override> overrides, {
  List<String> extra = const [],
  List<String>? went,
}) {
  final router = GoRouter(routes: [
    GoRoute(path: '/', builder: (_, __) => screen),
    for (final p in extra)
      GoRoute(
        path: p,
        builder: (_, __) {
          went?.add(p);
          return Scaffold(body: Text('ROUTE $p'));
        },
      ),
  ]);
  return ProviderScope(
    overrides: overrides,
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

void _tall(WidgetTester tester) {
  tester.view.physicalSize = const Size(393 * 3, 1600 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

void main() {
  // ─────────────────────────────── (b) Bosh sahifa: tezkor amallar
  group('Bosh sahifa: "ID qidirish" tezkor amali', () {
    Future<(L, List<String>)> pumpHome(WidgetTester tester) async {
      _tall(tester);
      final went = <String>[];
      final base = await testOverrides();
      await tester.pumpWidget(_routed(
        const HomeScreen(),
        [
          // `base[1]` — standart auth; bitta provayder ikki marta
          // almashtirilmaydi.
          ...base.where((o) => !identical(o, base[1])),
          authRepositoryProvider
              .overrideWithValue(FakeAuthRepository(ids: const [_vip])),
        ],
        extra: [Routes.nfcIds, Routes.nfcMarket],
        went: went,
      ));
      await settle(tester, frames: 16);
      return (await _uz(), went);
    }

    testWidgets('iPhone: ID qidirish YO‘Q — o‘rnida "NFC ID’larim"',
        (tester) async {
      final (l, went) = await pumpHome(tester);
      expect(tester.takeException(), isNull);
      expect(find.text(l.idSearchShort), findsNothing);
      expect(find.text(l.idMarketTitle), findsNothing);
      // Tezkor amal plitkasi: belgisi + "NFC ID'larim" yozuvi.
      final mine = find.byIcon(Icons.badge_outlined);
      expect(mine, findsOneWidget);
      expect(find.text(l.nfcMyIds), findsWidgets);
      await tester.tap(mine);
      await settle(tester);
      expect(went, [Routes.nfcIds]);
    }, variant: _ios);

    testWidgets('Android: avvalgidek ID qidirish → bozor', (tester) async {
      final (l, went) = await pumpHome(tester);
      expect(find.text(l.idSearchShort), findsOneWidget);
      await tester.tap(find.text(l.idSearchShort));
      await settle(tester);
      expect(went, [Routes.nfcMarket]);
    });
  });

  // ──────────────────────────────────────────── (b) NFC Markazi
  group('NFC Markazi: bozor qatori va NFC’siz katak', () {
    Future<L> pumpCenter(WidgetTester tester, NfcService nfc,
        {List<String>? went}) async {
      tester.view.physicalSize = const Size(390 * 3, 1600 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_routed(
        const NfcCenterScreen(),
        [
          ...await testOverrides(),
          nfcServiceProvider.overrideWithValue(nfc),
        ],
        extra: [Routes.nfcMarket, Routes.nfcActivate],
        went: went,
      ));
      await settle(tester, frames: 16);
      return _uz();
    }

    testWidgets('iPhone (NFC bor): bozor qatori yo‘q', (tester) async {
      final l = await pumpCenter(tester, _ReadyNfc());
      expect(tester.takeException(), isNull);
      expect(find.text(l.idSearchShort), findsNothing);
      expect(find.text(l.idMarketTitle), findsNothing);
      expect(find.text(l.idMarketSearchHint), findsNothing);
      // Foydali amallar joyida.
      expect(find.text(l.stickerActivate), findsOneWidget);
      expect(find.text(l.nfcWrite), findsOneWidget);
    }, variant: _ios);

    testWidgets('Android (NFC bor): bozor qatori bor', (tester) async {
      final l = await pumpCenter(tester, _ReadyNfc());
      expect(find.text(l.idMarketTitle), findsOneWidget);
    });

    testWidgets('iPhone (NFC yo‘q): bozor katagi o‘rnida faollashtirish',
        (tester) async {
      final went = <String>[];
      final l = await pumpCenter(tester, _NoNfc(), went: went);
      expect(tester.takeException(), isNull);
      expect(find.byKey(const ValueKey('no-nfc-market')), findsNothing);
      expect(find.text(l.noNfcGetHint), findsNothing);
      final act = find.byKey(const ValueKey('no-nfc-activate'));
      expect(act, findsOneWidget);
      await tester.tap(act);
      await settle(tester);
      expect(went, [Routes.nfcActivate]);
    }, variant: _ios);

    testWidgets('Android (NFC yo‘q): bozor katagi avvalgidek',
        (tester) async {
      await pumpCenter(tester, _NoNfc());
      expect(find.byKey(const ValueKey('no-nfc-market')), findsOneWidget);
      expect(find.byKey(const ValueKey('no-nfc-activate')), findsNothing);
    });

    test('manba: bozorga olib boruvchi har bir chaqiruv kalit ortida', () {
      // `Routes.nfcMarket` faqat Android shoxobchasida.
      for (final p in [
        'lib/features/nfc/nfc_center_screen.dart',
        'lib/features/home/home_screen.dart',
      ]) {
        final code = _codeOnly(_read(p));
        var at = code.indexOf('Routes.nfcMarket');
        expect(at, greaterThan(0), reason: p);
        while (at >= 0) {
          final before = code.substring((at - 400).clamp(0, at), at);
          expect(
              before.contains('showIdMarket') ||
                  before.contains('isAppStoreBuild'),
              isTrue,
              reason: '$p: Routes.nfcMarket kalitsiz chaqirilgan');
          at = code.indexOf('Routes.nfcMarket', at + 1);
        }
      }
    });
  });

  // ─────────────────────── (b) Havola bilan ochilsa ham — router
  group('Router: iPhone’da yashirin xarid yo‘llari yopiq', () {
    Future<GoRouter> boot(WidgetTester tester) async {
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final c = ProviderContainer(overrides: [...await testOverrides()]);
      addTearDown(c.dispose);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: const NovaApp(),
      ));
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      return c.read(routerProvider);
    }

    Future<Uri> go(WidgetTester tester, GoRouter r, String to) async {
      r.go(to);
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      return r.routerDelegate.currentConfiguration.uri;
    }

    /// Yopiq yo'l → iPhone'da qayerga tushadi.
    const closed = <String, String>{
      '/nfc/market': Routes.nfcIds,
      '/nfc/market/VIP777': Routes.nfcIds,
      '/nfc/market/order/12': Routes.nfcIds,
      '/settings/premium': Routes.settings,
      '/settings/payment': Routes.settings,
      '/settings/payment/history': Routes.settings,
      '/settings/referral': Routes.settings,
      '/featured/post/5': Routes.home,
      '/shop': Routes.nfc,
      '/shop/checkout': Routes.nfc,
      '/shop/payment/success': Routes.nfc,
      '/shop/abc': Routes.nfc,
      '/orders': Routes.settings,
    };

    testWidgets('iPhone: hammasi xavfsiz joyga buriladi', (tester) async {
      final r = await boot(tester);
      for (final e in closed.entries) {
        final at = await go(tester, r, e.key);
        expect(at.path, e.value, reason: e.key);
      }
      // Pullik o'z nomi → bepul Business ID formasi.
      final biz = await go(tester, r, Routes.businessOnboardCustom);
      expect(biz.path, Routes.businessOnboard);
      expect(biz.queryParameters['mode'], isNull);
      expect(tester.takeException(), isNull);
    }, variant: _ios);

    testWidgets('iPhone: oddiy yo‘llar ochiq qoladi', (tester) async {
      final r = await boot(tester);
      for (final p in [
        Routes.nfcIds,
        Routes.nfcActivate,
        Routes.settings,
        Routes.settingsAbout,
        Routes.businessOnboard,
      ]) {
        expect((await go(tester, r, p)).path, p, reason: p);
      }
    }, variant: _ios);

    testWidgets('Android: o‘zgarmagan — ekranlar ochiladi', (tester) async {
      final r = await boot(tester);
      for (final p in closed.keys) {
        expect((await go(tester, r, p)).path, p, reason: p);
      }
      final biz = await go(tester, r, Routes.businessOnboardCustom);
      expect(biz.queryParameters['mode'], 'custom');
    });
  });

  // ───────────────── (a) Premium/daraja qulfi matni HECH QAYERDA yo'q
  group('Premium qulfi matni yo‘q (hamma platforma)', () {
    /// Olib tashlangan qulf kalitlari.
    const removedKeys = [
      'premiumLocked',
      'premiumLockedVideo',
      'premiumLockedStory',
      'premiumLockedPost',
      'errCommentPremium',
      'commentPremiumTitle',
      'bizPlanTrial',
      'errPlanLocked',
      'errPlanLockedIos',
      'premiumPerkVideo',
      'premiumPerkStory',
      'premiumPerkPosts',
    ];

    /// "Joylash/izoh pullik" degan har qanday ibora.
    const banned = {
      'uz': [
        'Reels uchun Premium kerak',
        'Premium obuna kerak',
        'Premium a’zolar',
        'darajangiz yetmaydi',
        'post va istoriya yopiq',
        'post va istoriya ochiladi',
        'Sinov davri:',
        'Reels, istoriya',
      ],
      'ru': [
        'Reels нужен Premium',
        'нужна подписка Premium',
        'участников Premium',
        'уровня недостаточно',
        'посты и истории закрыты',
        'посты и истории.',
        'Пробный период:',
        'Reels, истории',
      ],
      'en': [
        'Reels need Premium',
        'Premium subscription is required',
        'for Premium members',
        'tier is not high enough',
        'closed on the free plan',
        'posts and stories.',
        'Trial:',
        'Reels, stories',
      ],
    };

    test('ARB: qulf kalitlari va iboralari yo‘q', () {
      for (final lang in ['uz', 'ru', 'en']) {
        final arb = jsonDecode(_read('lib/l10n/arb/app_$lang.arb'))
            as Map<String, dynamic>;
        for (final k in removedKeys) {
          expect(arb.containsKey(k), isFalse, reason: '$lang: $k qoldi');
          expect(arb.containsKey('@$k'), isFalse, reason: '$lang: @$k qoldi');
        }
        for (final e in arb.entries) {
          if (e.key.startsWith('@')) continue;
          final v = '${e.value}';
          for (final w in banned[lang]!) {
            expect(v.contains(w), isFalse,
                reason: '$lang: ${e.key} ichida qulf iborasi "$w"');
          }
        }
      }
    });

    test('kod: qulf karta, daraja matni va feature_locked tarmog‘i yo‘q', () {
      final comments = _codeOnly(_read('lib/features/social/comments.dart'));
      expect(comments, isNot(contains('_PremiumLockedComposer')));
      expect(comments, isNot(contains('comment-premium-locked')));
      expect(comments, isNot(contains('premiumActive')));
      final composer = _codeOnly(_read('lib/features/social/post_screens.dart'));
      expect(composer, isNot(contains("'feature_locked'")));
      expect(composer, isNot(contains('_lockedText')));
      final plan = _codeOnly(_read('lib/features/business/business_forms.dart'));
      expect(plan, isNot(contains('plan-trial')));
      final perks =
          _codeOnly(_read('lib/features/settings/settings_subscreens.dart'));
      expect(perks, isNot(contains('premiumPerkVideo')));
    });

    for (final ios in [true, false]) {
      test('server eski kodni qaytarsa — neytral xato '
          '(${ios ? 'iPhone' : 'Android'})', () async {
        debugDefaultTargetPlatformOverride =
            ios ? TargetPlatform.iOS : TargetPlatform.android;
        try {
          for (final lang in ['uz', 'ru', 'en']) {
            final l = await L.delegate.load(Locale(lang));
            for (final code in [
              'premium_required',
              'feature_locked',
              'plan_locked'
            ]) {
              final msg = describeError(
                  l, AppError(AppErrorKind.forbidden, code: code));
              expect(msg, l.errPublishUnavailable, reason: '$lang $code');
              for (final w in [
                'Premium',
                'tarif',
                'тариф',
                'plan',
                'daraja',
                'уров',
                'tier',
                kSiteHost,
              ]) {
                expect(msg.toLowerCase().contains(w.toLowerCase()), isFalse,
                    reason: '$lang $code: "$w"');
              }
            }
          }
        } finally {
          debugDefaultTargetPlatformOverride = null;
        }
      });
    }
  });
}
