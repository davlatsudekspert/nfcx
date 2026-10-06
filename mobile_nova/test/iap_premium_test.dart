import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/iap_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/business/business_forms.dart';
import 'package:nfcstore_nova/features/premium/iap_controller.dart';
import 'package:nfcstore_nova/features/premium/iap_store.dart';
import 'package:nfcstore_nova/features/premium/premium_iap_screen.dart';
import 'package:nfcstore_nova/features/settings/settings_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// APPLE IN-APP PURCHASE — Premium obunasi (faqat iPhone).
///
/// StoreKit va server soxta: xarid oqimi (narx -> xarid -> JWS ->
/// server tekshiruvi -> `completePurchase` -> sessiya yangilanishi)
/// haqiqiy plaginsiz sinaladi.

const _monthly = 'uz.nfcstore.nova.premium.monthly';
const _yearly = 'uz.nfcstore.nova.premium.yearly';
const _enabled = IapConfig(enabled: true, products: [_monthly, _yearly]);

final _ios = TargetPlatformVariant.only(TargetPlatform.iOS);

/// Hamma soxta qatlamlar bitta jurnalga yozadi — TARTIB tekshiriladi.
final _log = <String>[];

class _Store implements IapStore {
  final _ctrl = StreamController<List<IapPurchase>>.broadcast();
  bool available = true;
  bool listened = false;

  /// `buy()` chaqirilganda oqimga yuboriladigan natija.
  IapPurchase Function(String id)? onBuy;
  List<IapPurchase> restorable = const [];

  void emit(List<IapPurchase> list) => _ctrl.add(list);

  @override
  Future<bool> isAvailable() async => available;

  @override
  Future<List<IapProduct>> products(Set<String> ids) async => [
        // Ataylab teskari tartibda — ekran server tartibini tiklaydi.
        if (ids.contains(_yearly))
          const IapProduct(
              id: _yearly,
              title: 'Premium Year',
              price: r'$39.99',
              periodUnit: IapPeriodUnit.year),
        if (ids.contains(_monthly))
          const IapProduct(
              id: _monthly,
              title: 'Premium Month',
              price: r'$4.99',
              periodUnit: IapPeriodUnit.month),
      ];

  @override
  Future<void> buy(String productId, {String? accountToken}) async {
    _log.add('buy:$productId:$accountToken');
    final r = onBuy?.call(productId);
    if (r != null) emit([r]);
  }

  @override
  Future<void> buyConsumable(String productId, {String? accountToken}) =>
      buy(productId, accountToken: accountToken);

  @override
  Future<void> restore() async {
    _log.add('restore');
    if (restorable.isNotEmpty) emit(restorable);
  }

  @override
  Future<void> complete(IapPurchase purchase) async =>
      _log.add('complete:${purchase.purchaseId}');

  @override
  Stream<List<IapPurchase>> get purchases {
    listened = true;
    return _ctrl.stream;
  }
}

class _Iap extends FakeIapRepository {
  _Iap({super.cfg});

  int configCalls = 0;
  Result<IapVerifyResult> verifyResult = const Ok(IapVerifyResult(premium: true));

  /// `true` — verify qaytgach sessiya "premium" bo'ladi.
  void Function()? onVerified;

  @override
  Future<Result<IapConfig>> config() {
    configCalls++;
    return super.config();
  }

  @override
  Future<Result<String>> accountToken() async {
    _log.add('token');
    return const Ok('6f1c2a7e-0d3b-4e4f-9a51-2b8c7d6e5f40');
  }

  @override
  Future<Result<IapVerifyResult>> verify(String signedTransaction) async {
    _log.add('verify:$signedTransaction');
    if (verifyResult.isOk) onVerified?.call();
    return verifyResult;
  }
}

class _Auth extends FakeAuthRepository {
  _Auth({this.user = testUser});
  User user;

  @override
  Future<Result<({User user, List<NfcId> ids})>> restore() async =>
      Ok((user: user, ids: testIds));

  @override
  Future<Result<({User user, List<NfcId> ids})>> me() async {
    _log.add('me');
    return restore();
  }
}

const _premiumUser = User(
  id: 1,
  email: 'test@nfcstore.uz',
  name: 'Test Foydalanuvchi',
  premium: true,
);

/// Bepul sinovdagi (to'lanmagan) foydalanuvchi — [days] kun qoldi.
User _trialUser(int days) => User(
      id: 1,
      email: 'test@nfcstore.uz',
      name: 'Test Foydalanuvchi',
      trialUntil:
          DateTime.now().add(Duration(days: days, minutes: -5)),
    );

Future<L> _uz() => L.delegate.load(const Locale('uz'));

void _tall(WidgetTester tester) {
  tester.view.physicalSize = const Size(393 * 3, 2000 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

IapPurchase _purchased(String id, String jws,
        {IapPurchaseStatus status = IapPurchaseStatus.purchased}) =>
    IapPurchase(
      productId: id,
      status: status,
      purchaseId: '2000000123',
      signedTransaction: jws,
      needsCompletion: status == IapPurchaseStatus.purchased,
    );

class _Env {
  _Env(this.c, this.store, this.iap, this.auth);
  final ProviderContainer c;
  final _Store store;
  final _Iap iap;
  final _Auth auth;
}

Future<_Env> _env({IapConfig cfg = _enabled, User user = testUser}) async {
  _log.clear();
  final store = _Store();
  final iap = _Iap(cfg: cfg);
  final auth = _Auth(user: user);
  final c = ProviderContainer(overrides: [
    ...await testOverrides(),
    authRepositoryProvider.overrideWithValue(auth),
    iapRepositoryProvider.overrideWithValue(iap),
    iapStoreProvider.overrideWithValue(store),
  ]);
  addTearDown(c.dispose);
  return _Env(c, store, iap, auth);
}

Widget _app(ProviderContainer c, GoRouter router) => UncontrolledProviderScope(
      container: c,
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

/// Sozlamalar + `/premium` (haqiqiy marshrutdagi kabi kalit bilan).
GoRouter _router(ProviderContainer c) => GoRouter(routes: [
      GoRoute(path: '/', builder: (_, __) => const SettingsScreen()),
      GoRoute(
          path: Routes.premium,
          redirect: (_, __) =>
              c.read(iapEnabledProvider) ? null : Routes.settings,
          builder: (_, __) => const PremiumIapScreen()),
      GoRoute(
          path: Routes.settings,
          builder: (_, __) => const Scaffold(body: Text('SETTINGS'))),
    ]);

Future<_Env> _pumpPremium(WidgetTester tester,
    {IapConfig cfg = _enabled, User user = testUser}) async {
  _tall(tester);
  final e = await _env(cfg: cfg, user: user);
  await e.c.read(iapConfigProvider.future);
  final router = _router(e.c);
  await tester.pumpWidget(_app(e.c, router));
  await settle(tester, frames: 6);
  router.push(Routes.premium);
  await settle(tester, frames: 10);
  return e;
}

void main() {
  tearDown(disposeTestContainers);

  group('kalit (kill switch)', () {
    testWidgets('Android: o‘chiq, serverga ham chiqilmaydi', (tester) async {
      final e = await _env();
      final cfg = await e.c.read(iapConfigProvider.future);
      expect(cfg.enabled, isFalse);
      expect(e.iap.configCalls, 0, reason: 'Android’da so‘rov ketmasin');
      expect(e.c.read(iapEnabledProvider), isFalse);
      e.c.read(iapWatcherProvider);
      expect(e.store.listened, isFalse, reason: 'StoreKit’ga tegilmaydi');
    });

    testWidgets('Android: Sozlamalarda Premium yo‘q, /premium ochilmaydi',
        (tester) async {
      _tall(tester);
      final e = await _env();
      final router = _router(e.c);
      await tester.pumpWidget(_app(e.c, router));
      await settle(tester, frames: 8);
      final l = await _uz();
      expect(find.text(l.settingsPremium), findsNothing);
      router.push(Routes.premium);
      await settle(tester, frames: 8);
      expect(find.byType(PremiumIapScreen), findsNothing);
      expect(find.text('SETTINGS'), findsOneWidget);
    });

    testWidgets('iPhone, kalit o‘chiq: kirish yo‘li ham, ekran ham yo‘q',
        (tester) async {
      _tall(tester);
      final e = await _env(cfg: IapConfig.disabled);
      final router = _router(e.c);
      await tester.pumpWidget(_app(e.c, router));
      await settle(tester, frames: 8);
      final l = await _uz();
      expect(e.iap.configCalls, 1);
      expect(find.text(l.settingsPremium), findsNothing);
      router.push(Routes.premium);
      await settle(tester, frames: 8);
      expect(find.byType(PremiumIapScreen), findsNothing);
      expect(find.text('SETTINGS'), findsOneWidget);
      expect(e.store.listened, isFalse);
    }, variant: _ios);

    testWidgets('iPhone, config so‘rovi xato — o‘chiq', (tester) async {
      final c = ProviderContainer(overrides: [
        ...await testOverrides(),
        iapRepositoryProvider.overrideWithValue(_FailingIap()),
        iapStoreProvider.overrideWithValue(_Store()),
      ]);
      addTearDown(c.dispose);
      final cfg = await c.read(iapConfigProvider.future);
      expect(cfg.enabled, isFalse);
      expect(c.read(iapEnabledProvider), isFalse);
    }, variant: _ios);

    test('mahsulotsiz yoqilgan kalit — o‘chiq', () {
      expect(IapConfig.fromJson(const {'enabled': true, 'products': []}).enabled,
          isFalse);
      final c = IapConfig.fromJson(const {
        'enabled': true,
        'products': [_monthly, _yearly]
      });
      expect([c.enabled, c.products], [true, [_monthly, _yearly]]);
    });
  });

  group('kalit yoqilgan (iPhone)', () {
    testWidgets('Sozlamalarda Premium qatori -> ekran', (tester) async {
      _tall(tester);
      final e = await _env();
      await e.c.read(iapConfigProvider.future);
      final router = _router(e.c);
      await tester.pumpWidget(_app(e.c, router));
      await settle(tester, frames: 8);
      final l = await _uz();
      expect(find.text(l.settingsPremium), findsOneWidget);
      await tester.tap(find.text(l.settingsPremium));
      await settle(tester, frames: 10);
      expect(find.byType(PremiumIapScreen), findsOneWidget);
    }, variant: _ios);

    testWidgets('ikki reja, narx App Store’dan, server tartibida',
        (tester) async {
      await _pumpPremium(tester);
      final l = await _uz();
      expect(tester.takeException(), isNull);
      final m = find.byKey(const ValueKey('iap-plan-$_monthly'));
      final y = find.byKey(const ValueKey('iap-plan-$_yearly'));
      expect(m, findsOneWidget);
      expect(y, findsOneWidget);
      expect(tester.getTopLeft(m).dy, lessThan(tester.getTopLeft(y).dy),
          reason: 'oylik birinchi (server tartibi)');
      expect(find.text(r'$4.99'), findsOneWidget);
      expect(find.text(r'$39.99'), findsOneWidget);
      expect(find.text('/ ${l.iapPeriodMonths(1)}'), findsOneWidget);
      expect(find.text('/ ${l.iapPeriodYears(1)}'), findsOneWidget);
      expect(find.text(l.iapPlanMonthly), findsOneWidget);
      expect(find.text(l.iapPlanYearly), findsOneWidget);
      // Apple talab qiladigan matn va havolalar.
      expect(find.text(l.iapDisclosure), findsOneWidget);
      expect(find.byKey(const ValueKey('iap-terms')), findsOneWidget);
      expect(find.byKey(const ValueKey('iap-privacy')), findsOneWidget);
      expect(find.byKey(const ValueKey('iap-restore')), findsOneWidget);
      // Saytga to'lov yo'li yo'q (Apple 3.1.1).
      expect(find.textContaining('Payme'), findsNothing);
      expect(find.textContaining('Click'), findsNothing);
    }, variant: _ios);

    testWidgets('xarid: token -> JWS verify -> complete -> sessiya',
        (tester) async {
      final e = await _pumpPremium(tester);
      final l = await _uz();
      e.store.onBuy = (id) => _purchased(id, 'JWS-$id');
      e.iap.onVerified = () => e.auth.user = _premiumUser;

      // Yillik tanlanadi, keyin obuna.
      await tester.tap(find.byKey(const ValueKey('iap-plan-$_yearly')));
      await settle(tester, frames: 2);
      await tester.tap(find.byKey(const ValueKey('iap-subscribe')));
      await settle(tester, frames: 10);

      expect(_log, [
        'token',
        'buy:$_yearly:6f1c2a7e-0d3b-4e4f-9a51-2b8c7d6e5f40',
        'verify:JWS-$_yearly',
        'complete:2000000123',
        'me',
      ], reason: 'completePurchase FAQAT server tasdig‘idan keyin');
      expect(e.c.read(currentUserProvider)?.premium, isTrue,
          reason: 'Premium holati butun ilovada yangilandi');
      expect(find.text(l.iapActivated), findsOneWidget);
      expect(find.text(l.premiumActive), findsOneWidget);
      expect(find.byKey(const ValueKey('iap-subscribe')), findsNothing);
    }, variant: _ios);

    testWidgets('server 200 premium:false — baribir yopiladi', (tester) async {
      final e = await _pumpPremium(tester);
      final l = await _uz();
      e.store.onBuy = (id) => _purchased(id, 'JWS-X');
      e.iap.verifyResult =
          const Ok(IapVerifyResult(premium: false, reason: 'expired'));
      await tester.tap(find.byKey(const ValueKey('iap-subscribe')));
      await settle(tester, frames: 10);
      expect(_log, contains('complete:2000000123'));
      expect(find.text(l.iapInactive), findsOneWidget);
    }, variant: _ios);

    testWidgets('tarmoq xatosi: completePurchase CHAQIRILMAYDI',
        (tester) async {
      final e = await _pumpPremium(tester);
      final l = await _uz();
      e.store.onBuy = (id) => _purchased(id, 'JWS-NET');
      e.iap.verifyResult = const Err(AppError(AppErrorKind.offline));
      await tester.tap(find.byKey(const ValueKey('iap-subscribe')));
      await settle(tester, frames: 10);
      expect(_log, contains('verify:JWS-NET'));
      expect(_log.where((s) => s.startsWith('complete')), isEmpty,
          reason: 'tranzaksiya ochiq qolishi kerak — StoreKit qayta beradi');
      expect(_log, isNot(contains('me')));
      expect(find.text(l.iapErrNetwork), findsOneWidget);
    }, variant: _ios);

    // Server javoblari — ApiClient qanday quradi, shunday (`status` bilan).
    // `terminal` — server qarori yakuniy: tranzaksiya BIR MARTA yopiladi.
    // Qolganlari — ochiq qoladi, StoreKit keyingi ochilishda qayta beradi.
    final cases = <(String, AppError, bool, String Function(L))>[
      // ── YAKUNIY (422 / 400) ──
      ('422 sandbox_not_allowed',
          const AppError(AppErrorKind.validation,
              code: 'sandbox_not_allowed', status: 422),
          true, (l) => l.iapErrSandbox),
      ('422 family_shared_not_supported',
          const AppError(AppErrorKind.validation,
              code: 'family_shared_not_supported', status: 422),
          true, (l) => l.iapErrFamilyShared),
      for (final code in const [
        'wrong_bundle',
        'unknown_product',
        'wrong_type',
        'bad_transaction',
      ])
        ('422 $code',
            AppError(AppErrorKind.validation, code: code, status: 422),
            true, (l) => l.iapErrRejected),
      for (final code in const ['invalid_signature', 'bad_request'])
        ('400 $code',
            AppError(AppErrorKind.unknown, code: code, status: 400),
            true, (l) => l.iapErrRejected),
      ('413 payload_too_large',
          const AppError(AppErrorKind.unknown,
              code: 'payload_too_large', status: 413),
          true, (l) => l.iapErrRejected),
      // ── VAQTINCHA (ochiq qoladi) ──
      ('429 too_many_requests',
          const AppError(AppErrorKind.rateLimited,
              code: 'too_many_requests', status: 429),
          false, (l) => l.iapErrRateLimited),
      ('403 account_mismatch',
          const AppError(AppErrorKind.forbidden,
              code: 'account_mismatch', status: 403),
          false, (l) => l.iapErrAccountMismatch),
      ('409 already_linked',
          const AppError(AppErrorKind.conflict,
              code: 'already_linked', status: 409),
          false, (l) => l.iapErrAlreadyLinked),
      ('503 iap_disabled',
          const AppError(AppErrorKind.server,
              code: 'iap_disabled', status: 503),
          false, (l) => l.iapErrDisabled),
      ('timeout',
          const AppError(AppErrorKind.timeout),
          false, (l) => l.iapErrNetwork),
    ];

    for (final (name, error, terminal, msg) in cases) {
      testWidgets(
          'server $name: ${terminal ? 'YAKUNIY — bir marta yopiladi' : 'ochiq qoladi'}',
          (tester) async {
        final e = await _pumpPremium(tester);
        final l = await _uz();
        e.store.onBuy = (id) => _purchased(id, 'JWS-$name');
        e.iap.verifyResult = Err(error);
        await tester.tap(find.byKey(const ValueKey('iap-subscribe')));
        await settle(tester, frames: 10);
        expect(_log, contains('verify:JWS-$name'));
        final completes = _log.where((s) => s.startsWith('complete'));
        expect(completes.length, terminal ? 1 : 0,
            reason: terminal
                ? 'yakuniy rad etish — StoreKit abadiy qayta bermasin'
                : 'vaqtincha xato — tranzaksiya ochiq qolishi kerak');
        if (terminal) {
          // Yopilganidan keyin "Premium faol" deb sessiya yangilanmaydi.
          expect(_log, isNot(contains('me')));
        }
        expect(find.text(msg(l)), findsOneWidget);
        expect(e.c.read(iapControllerProvider).busy, isFalse);
      }, variant: _ios);
    }

    testWidgets('409 matni: Apple ID boshqa hisobga ulangan (uch tilda)',
        (tester) async {
      for (final code in ['uz', 'ru', 'en']) {
        final l = await L.delegate.load(Locale(code));
        expect(l.iapErrAlreadyLinked, contains('Apple ID'), reason: code);
        expect(l.iapErrAlreadyLinked, contains('NFCSTORE'), reason: code);
      }
    });

    testWidgets('kutilayotgan xarid (Ask to Buy) — holat ko‘rsatiladi',
        (tester) async {
      final e = await _pumpPremium(tester);
      final l = await _uz();
      e.store.onBuy = (id) =>
          IapPurchase(productId: id, status: IapPurchaseStatus.pending);
      await tester.tap(find.byKey(const ValueKey('iap-subscribe')));
      await settle(tester, frames: 8);
      expect(find.text(l.iapPending), findsOneWidget);
      expect(_log.where((s) => s.startsWith('verify')), isEmpty);
    }, variant: _ios);

    testWidgets('bekor qilindi — xato yo‘q, tugma yana faol', (tester) async {
      final e = await _pumpPremium(tester);
      e.store.onBuy = (id) =>
          IapPurchase(productId: id, status: IapPurchaseStatus.canceled);
      await tester.tap(find.byKey(const ValueKey('iap-subscribe')));
      await settle(tester, frames: 8);
      expect(find.byKey(const ValueKey('iap-error')), findsNothing);
      expect(e.c.read(iapControllerProvider).busy, isFalse);
    }, variant: _ios);

    testWidgets('tiklash: restored -> verify, complete yo‘q, sessiya',
        (tester) async {
      final e = await _pumpPremium(tester);
      final l = await _uz();
      e.store.restorable = [
        _purchased(_monthly, 'JWS-R', status: IapPurchaseStatus.restored),
      ];
      e.iap.onVerified = () => e.auth.user = _premiumUser;
      await tester.tap(find.byKey(const ValueKey('iap-restore')));
      await settle(tester, frames: 10);
      expect(_log, ['restore', 'verify:JWS-R', 'me']);
      expect(e.c.read(currentUserProvider)?.premium, isTrue);
      expect(find.text(l.iapActivated), findsOneWidget);
    }, variant: _ios);

    testWidgets('tiklash: hech narsa topilmadi', (tester) async {
      await _pumpPremium(tester);
      final l = await _uz();
      await tester.tap(find.byKey(const ValueKey('iap-restore')));
      await settle(tester, frames: 8);
      expect(_log, ['restore']);
      expect(find.text(l.iapNothingToRestore), findsOneWidget);
    }, variant: _ios);

    testWidgets('allaqachon Premium — muddat, boshqarish, rejalar yo‘q',
        (tester) async {
      final until = DateTime(2027, 3, 9, 12);
      await _pumpPremium(tester,
          user: User(
              id: 1,
              email: 'a@b.uz',
              premium: true,
              premiumUntil: until));
      final l = await _uz();
      expect(find.text(l.premiumActive), findsOneWidget);
      expect(find.text(l.premiumUntil('09.03.2027')), findsOneWidget);
      expect(find.byKey(const ValueKey('iap-manage')), findsOneWidget);
      expect(find.byKey(const ValueKey('iap-subscribe')), findsNothing);
      expect(find.byKey(const ValueKey('iap-restore')), findsOneWidget);
    }, variant: _ios);

    testWidgets('App Store narx bermadi — tushunarli holat', (tester) async {
      _tall(tester);
      final e = await _env();
      e.store.available = false;
      await e.c.read(iapConfigProvider.future);
      final router = _router(e.c);
      await tester.pumpWidget(_app(e.c, router));
      await settle(tester, frames: 4);
      router.push(Routes.premium);
      await settle(tester, frames: 10);
      expect(find.byKey(const ValueKey('iap-unavailable')), findsOneWidget);
      expect(find.byKey(const ValueKey('iap-subscribe')), findsNothing);
    }, variant: _ios);
  });

  group('ilova ochilishida ochiq tranzaksiya', () {
    testWidgets('kirgan + kalit yoqilgan: oqim tinglanadi va tasdiqlanadi',
        (tester) async {
      final e = await _env();
      e.c.listen(iapWatcherProvider, (_, __) {});
      // Sessiya tiklanishi va config.
      await e.c.read(iapConfigProvider.future);
      await tester.pump(const Duration(milliseconds: 50));
      expect(e.c.read(sessionProvider), isA<SessionActive>());
      expect(e.store.listened, isTrue);

      // Oldingi safar tarmoq uzilgan xarid StoreKit'dan qayta keladi.
      e.store.emit([_purchased(_monthly, 'JWS-OLD')]);
      await tester.pump(const Duration(milliseconds: 50));
      expect(_log, ['verify:JWS-OLD', 'complete:2000000123', 'me']);
    }, variant: _ios);

    testWidgets('kirmagan: tinglanmaydi', (tester) async {
      _log.clear();
      final store = _Store();
      final c = ProviderContainer(overrides: [
        ...await testOverrides(signedIn: false),
        iapRepositoryProvider.overrideWithValue(_Iap(cfg: _enabled)),
        iapStoreProvider.overrideWithValue(store),
      ]);
      addTearDown(c.dispose);
      c.listen(iapWatcherProvider, (_, __) {});
      await tester.pump(const Duration(milliseconds: 50));
      expect(store.listened, isFalse);
    }, variant: _ios);
  });

  group('biznes katalogi kartasi', () {
    const plan = CompanyPlan(free: true, itemLimit: 5, premiumItemLimit: 25);

    Future<void> pumpCard(WidgetTester tester, IapConfig cfg,
        {User user = testUser}) async {
      _tall(tester);
      final e = await _env(cfg: cfg, user: user);
      // Sessiya (foydalanuvchi) tiklansin.
      await tester.pump(const Duration(milliseconds: 20));
      await e.c.read(iapConfigProvider.future);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: e.c,
        child: wrapScreen(const Scaffold(
            body: Padding(
                padding: EdgeInsets.all(16),
                child: BusinessPlanCard(plan: plan, count: 5)))),
      ));
      await settle(tester, frames: 4);
    }

    testWidgets('iPhone + kalit: Premium tugmasi', (tester) async {
      await pumpCard(tester, _enabled);
      final l = await _uz();
      expect(find.byKey(const ValueKey('plan-premium')), findsOneWidget);
      expect(find.text(l.iapPlanUpsell(25)), findsOneWidget);
    }, variant: _ios);

    testWidgets('iPhone, kalit o‘chiq: avvalgidek — tugma yo‘q',
        (tester) async {
      await pumpCard(tester, IapConfig.disabled);
      final l = await _uz();
      expect(find.byKey(const ValueKey('plan-premium')), findsNothing);
      expect(find.text(l.iapPlanUpsell(25)), findsNothing);
    }, variant: _ios);

    testWidgets('Android: tugma yo‘q', (tester) async {
      await pumpCard(tester, _enabled);
      expect(find.byKey(const ValueKey('plan-premium')), findsNothing);
    });

    testWidgets('iPhone + kalit, lekin BEPUL SINOV: upsell yo‘q',
        (tester) async {
      await pumpCard(tester, _enabled, user: _trialUser(30));
      final l = await _uz();
      expect(find.byKey(const ValueKey('plan-premium')), findsNothing);
      expect(find.text(l.iapPlanUpsell(25)), findsNothing);
      // Limit va hisoblagich joyida.
      expect(find.byKey(const ValueKey('plan-usage')), findsOneWidget);
    }, variant: _ios);
  });

  group('bepul sinov (launch promo)', () {
    test('qolgan kunlar — yuqoriga yaxlitlanadi, sayt bilan bir xil', () {
      final now = DateTime(2026, 10, 6, 12);
      User u(DateTime? trial, {bool premium = false, DateTime? until}) =>
          User(
              id: 1,
              email: 'a@b.uz',
              trialUntil: trial,
              premium: premium,
              premiumUntil: until);
      expect(iapTrialDaysLeft(u(now.add(const Duration(days: 90))), now: now),
          90);
      expect(
          iapTrialDaysLeft(u(now.add(const Duration(days: 2, hours: 1))),
              now: now),
          3);
      expect(iapTrialDaysLeft(u(now.add(const Duration(minutes: 5))), now: now),
          1);
      expect(iapTrialDaysLeft(u(now.subtract(const Duration(days: 1))), now: now),
          isNull, reason: 'tugagan');
      expect(iapTrialDaysLeft(u(null), now: now), isNull);
      expect(
          iapTrialDaysLeft(
              u(now.add(const Duration(days: 30)),
                  until: now.add(const Duration(days: 10))),
              now: now),
          isNull,
          reason: 'to‘langan Premium ustun');
      expect(iapTrialDaysLeft(null, now: now), isNull);
    });

    testWidgets('sinov faol: tinch karta, rejalar yig‘ilgan, CTA yo‘q',
        (tester) async {
      await _pumpPremium(tester, user: _trialUser(30));
      final l = await _uz();
      expect(tester.takeException(), isNull);
      expect(find.byKey(const ValueKey('iap-trial')), findsOneWidget);
      expect(find.text(l.iapTrialTitle(30)), findsOneWidget);
      expect(find.text(l.iapTrialBody), findsOneWidget);
      // Sotuv qatori va asosiy xarid tugmasi YO'Q.
      expect(find.text(l.premiumTagline), findsNothing);
      expect(find.byKey(const ValueKey('iap-subscribe')), findsNothing);
      expect(find.byKey(const ValueKey('iap-plan-$_monthly')), findsNothing);
      // Karta imkoniyatlar ro'yxatidan YUQORIDA.
      expect(
          tester.getTopLeft(find.byKey(const ValueKey('iap-trial'))).dy,
          lessThan(tester.getTopLeft(find.text(l.premiumPerksTitle)).dy));

      // Ikkinchi darajali tugma — ochilganda rejalar paydo bo'ladi.
      await tester.tap(find.byKey(const ValueKey('iap-trial-expand')));
      await settle(tester, frames: 6);
      expect(find.byKey(const ValueKey('iap-trial-expand')), findsNothing);
      expect(find.byKey(const ValueKey('iap-plan-$_monthly')), findsOneWidget);
      expect(find.byKey(const ValueKey('iap-plan-$_yearly')), findsOneWidget);
      expect(find.byKey(const ValueKey('iap-subscribe')), findsOneWidget);
      expect(find.byKey(const ValueKey('iap-disclosure')), findsOneWidget);
    }, variant: _ios);

    testWidgets('sinov tugagan: oddiy ekran, rejalar darhol', (tester) async {
      await _pumpPremium(tester,
          user: User(
              id: 1,
              email: 'a@b.uz',
              trialUntil: DateTime.now().subtract(const Duration(days: 2))));
      final l = await _uz();
      expect(find.byKey(const ValueKey('iap-trial')), findsNothing);
      expect(find.byKey(const ValueKey('iap-trial-expand')), findsNothing);
      expect(find.text(l.premiumTagline), findsOneWidget);
      expect(find.byKey(const ValueKey('iap-plan-$_monthly')), findsOneWidget);
      expect(find.byKey(const ValueKey('iap-subscribe')), findsOneWidget);
    }, variant: _ios);

    testWidgets('to‘langan Premium (sinov ham bor): avvalgidek', (tester) async {
      await _pumpPremium(tester,
          user: User(
              id: 1,
              email: 'a@b.uz',
              premiumUntil: DateTime(2030, 1, 2, 12),
              trialUntil: DateTime.now().add(const Duration(days: 30))));
      final l = await _uz();
      expect(find.byKey(const ValueKey('iap-trial')), findsNothing);
      expect(find.text(l.premiumActive), findsOneWidget);
      expect(find.text(l.premiumUntil('02.01.2030')), findsOneWidget);
      expect(find.byKey(const ValueKey('iap-manage')), findsOneWidget);
      expect(find.byKey(const ValueKey('iap-subscribe')), findsNothing);
    }, variant: _ios);

    Future<void> pumpSettings(WidgetTester tester, User user) async {
      _tall(tester);
      final e = await _env(user: user);
      await e.c.read(iapConfigProvider.future);
      await tester.pumpWidget(_app(e.c, _router(e.c)));
      await settle(tester, frames: 8);
    }

    testWidgets('Sozlamalar: sinovda "Bepul sinov: N kun qoldi"',
        (tester) async {
      await pumpSettings(tester, _trialUser(30));
      final l = await _uz();
      expect(find.text(l.settingsPremium), findsOneWidget);
      expect(find.text(l.iapTrialSettings(30)), findsOneWidget);
    }, variant: _ios);

    testWidgets('Sozlamalar: sinovsiz — qo‘shimcha yozuv yo‘q', (tester) async {
      await pumpSettings(tester, testUser);
      final l = await _uz();
      expect(find.text(l.settingsPremium), findsOneWidget);
      expect(find.textContaining('kun qoldi'), findsNothing);
    }, variant: _ios);

    test('uch tilda kun soni va "to‘lash shart emas" ma’nosi', () async {
      for (final code in ['uz', 'ru', 'en']) {
        final l = await L.delegate.load(Locale(code));
        expect(l.iapTrialTitle(5), contains('5'), reason: code);
        expect(l.iapTrialSettings(21), contains('21'), reason: code);
        expect(l.iapTrialBody, isNotEmpty);
      }
    });
  });
}

class _FailingIap extends FakeIapRepository {
  @override
  Future<Result<IapConfig>> config() async =>
      const Err(AppError(AppErrorKind.offline));
}
