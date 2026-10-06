import 'dart:async';

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
import 'package:nfcstore_nova/data/repositories/featured_repository.dart';
import 'package:nfcstore_nova/data/repositories/iap_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/premium/boost_controller.dart';
import 'package:nfcstore_nova/features/premium/boost_sheet.dart';
import 'package:nfcstore_nova/features/premium/iap_controller.dart';
import 'package:nfcstore_nova/features/premium/iap_store.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/settings/settings_screen.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/routing/routes.dart';
import 'package:nfcstore_nova/routing/shell.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';

import 'helpers.dart';
import 'support/fake_video_platform.dart';

/// "KO'TARISH" — postni lentada ko'tarish, Apple consumable (iPhone).

const _p1 = 'uz.nfcstore.nova.boost.1d';
const _p3 = 'uz.nfcstore.nova.boost.3d';
const _p6 = 'uz.nfcstore.nova.boost.6d';
const _pkgs = [
  BoostPackage(productId: _p1, days: 1),
  BoostPackage(productId: _p3, days: 3),
  BoostPackage(productId: _p6, days: 6),
];
const _on = IapConfig(boostEnabled: true, boostProducts: _pkgs);
const _tok = '6f1c2a7e-0d3b-4e4f-9a51-2b8c7d6e5f40';
const _me = '48210377';

final _ios = TargetPlatformVariant.only(TargetPlatform.iOS);
final _log = <String>[];

final _ends = DateTime.utc(2026, 10, 9, 14, 30);

class _Store implements IapStore {
  final _ctrl = StreamController<List<IapPurchase>>.broadcast();
  bool listened = false;
  IapPurchase Function(String id)? onBuy;

  void emit(List<IapPurchase> l) => _ctrl.add(l);

  @override
  Future<bool> isAvailable() async => true;

  @override
  Future<List<IapProduct>> products(Set<String> ids) async => [
        for (final (id, price) in [
          (_p1, '15 000 soʻm'),
          (_p3, '39 000 soʻm'),
          (_p6, '69 000 soʻm'),
        ])
          if (ids.contains(id)) IapProduct(id: id, title: id, price: price),
      ];

  @override
  Future<void> buy(String productId, {String? accountToken}) async =>
      _log.add('buy-sub:$productId');

  @override
  Future<void> buyConsumable(String productId, {String? accountToken}) async {
    _log.add('buy:$productId:$accountToken');
    final r = onBuy?.call(productId);
    if (r != null) emit([r]);
  }

  @override
  Future<void> restore() async => _log.add('restore');

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
  _Iap({super.cfg = _on});

  Result<BoostIntent> intent =
      const Ok(BoostIntent(intentId: 42, productId: _p3, days: 3));
  Result<BoostResult> verified = Ok(BoostResult(
      status: BoostStatus.active,
      slotId: 42,
      startsAt: DateTime.utc(2026, 10, 6, 14, 30),
      endsAt: _ends));
  Result<BoostResult> redeemed =
      Ok(BoostResult(status: BoostStatus.active, slotId: 50, endsAt: _ends));
  List<BoostCredit> credits = const [];

  @override
  Future<Result<String>> accountToken() async {
    _log.add('token');
    return const Ok(_tok);
  }

  @override
  Future<Result<IapVerifyResult>> verify(String signedTransaction) async {
    _log.add('premium-verify:$signedTransaction');
    return const Ok(IapVerifyResult(premium: true));
  }

  @override
  Future<Result<BoostIntent>> boostIntent(
      {required String targetKind,
      required int targetId,
      required int days}) async {
    _log.add('intent:$targetKind:$targetId:$days');
    return intent;
  }

  @override
  Future<Result<BoostResult>> verifyBoost(String signedTransaction,
      {int? intentId}) async {
    _log.add('verify:$signedTransaction:$intentId');
    return verified;
  }

  @override
  Future<Result<BoostResult>> boostRedeem(
      {required int creditId,
      required String targetKind,
      required int targetId}) async {
    _log.add('redeem:$creditId:$targetKind:$targetId');
    return redeemed;
  }

  @override
  Future<Result<List<BoostCredit>>> boostCredits() async => Ok(credits);
}

class _Featured extends FeaturedRepository {
  _Featured([this.slots = const []]) : super(ApiClient());
  final List<FeaturedSlot> slots;
  @override
  Future<Result<List<FeaturedSlot>>> mine() async => Ok(slots);
}

class _Biz extends BusinessRepository {
  _Biz() : super(ApiClient());
  @override
  Future<Result<List<Business>>> mine() async => const Ok([]);
}

class _Social extends FakeSocialRepository {
  _Social([this.post = const Post(id: 5, code: _me)]);
  final Post post;

  @override
  Future<Result<Post>> postIn(String code, int id,
          {bool company = false}) async =>
      Ok(post);

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      Ok(code == _me ? [post] : const []);

  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
          String kind, int id, {int page = 1}) async =>
      const Ok((items: <Comment>[], hasMore: false, total: 0));
}

class _Profile extends ProfileRepository {
  _Profile() : super(ApiClient());
  @override
  Future<Result<FollowStats>> followStats(String code) async =>
      const Ok((followers: 0, following: 0, isFollowing: false));
  @override
  Future<Result<List<NfcId>>> followList(String code,
          {String dir = 'followers'}) async =>
      const Ok([]);
}

IapPurchase _tx(String id, {String jws = 'JWS-B', String txId = '3000000777'}) =>
    IapPurchase(
      productId: id,
      status: IapPurchaseStatus.purchased,
      purchaseId: txId,
      signedTransaction: jws,
      needsCompletion: true,
    );

const _target = BoostTarget(kind: 'post', id: 5);

class _Env {
  _Env(this.c, this.store, this.iap);
  final ProviderContainer c;
  final _Store store;
  final _Iap iap;
  BoostController get ctl => c.read(boostControllerProvider.notifier);
  BoostState get s => c.read(boostControllerProvider);
}

Future<List<Override>> _overrides(_Store store, _Iap iap,
    {List<FeaturedSlot> slots = const [], Post? post}) async {
  final base = await testOverrides();
  return [
    ...base.where((o) => !identical(o, base[2]) && !identical(o, base.last)),
    socialRepositoryProvider.overrideWithValue(_Social(post ?? const Post(id: 5, code: _me))),
    businessRepositoryProvider.overrideWithValue(_Biz()),
    profileRepositoryProvider.overrideWithValue(_Profile()),
    iapRepositoryProvider.overrideWithValue(iap),
    iapStoreProvider.overrideWithValue(store),
    featuredRepositoryProvider.overrideWithValue(_Featured(slots)),
  ];
}

Future<_Env> _env(
    {IapConfig cfg = _on, List<FeaturedSlot> slots = const []}) async {
  _log.clear();
  final store = _Store();
  final iap = _Iap(cfg: cfg);
  final c = ProviderContainer(
      overrides: await _overrides(store, iap, slots: slots));
  addTearDown(c.dispose);
  await c.read(iapConfigProvider.future);
  return _Env(c, store, iap);
}

/// Oqim hodisalari va asinxron zanjir tugashi.
Future<void> _drain(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 10));
  }
}

Future<void> _openAndBuy(WidgetTester tester, _Env e, {int days = 3}) async {
  await e.ctl.open(_target);
  e.store.onBuy = (id) => _tx(id);
  await e.ctl.buy(_pkgs.firstWhere((p) => p.days == days));
  await _drain(tester);
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

Future<L> _uz() => L.delegate.load(const Locale('uz'));

void main() {
  group('config', () {
    test('boostEnabled + boostProducts o‘qiladi; Premium kalitidan alohida', () {
      final c = IapConfig.fromJson(const {
        'enabled': false,
        'products': [],
        'boostEnabled': true,
        'boostProducts': [
          {'productId': _p1, 'days': 1},
          {'productId': _p3, 'days': 3},
          {'productId': _p6, 'days': 6},
        ],
      });
      expect(c.enabled, isFalse);
      expect(c.boostEnabled, isTrue);
      expect(c.boostProducts.map((b) => b.days), [1, 3, 6]);
      expect(
          IapConfig.fromJson(const {'boostEnabled': true, 'boostProducts': []})
              .boostEnabled,
          isFalse,
          reason: 'paketsiz kalit — o‘chiq');
    });

    testWidgets('Android: o‘chiq', (tester) async {
      final e = await _env();
      expect(e.c.read(iapBoostEnabledProvider), isFalse);
      e.c.read(boostWatcherProvider);
      expect(e.store.listened, isFalse);
    });

    testWidgets('iPhone + kalit: yoqilgan', (tester) async {
      final e = await _env();
      expect(e.c.read(iapBoostEnabledProvider), isTrue);
    }, variant: _ios);
  });

  group('xarid oqimi', () {
    testWidgets('muvaffaqiyat: intent -> token -> consumable -> verify(intentId) '
        '-> complete', (tester) async {
      final e = await _env();
      await e.ctl.open(_target);
      expect(e.s.options.map((o) => o.product?.price),
          ['15 000 soʻm', '39 000 soʻm', '69 000 soʻm'],
          reason: 'narx App Store’dan');
      e.store.onBuy = (id) => _tx(id);
      await e.ctl.buy(_pkgs[1]);
      await _drain(tester);
      expect(_log, [
        'intent:post:5:3',
        'token',
        'buy:$_p3:$_tok',
        'verify:JWS-B:42',
        'complete:3000000777',
      ]);
      expect(e.s.result?.status, BoostStatus.active);
      expect(e.s.result?.endsAt, _ends);
      expect(e.s.busy, isFalse);
    }, variant: _ios);

    testWidgets('kredit: to‘lov saqlandi, tranzaksiya yopildi', (tester) async {
      final e = await _env();
      e.iap.verified =
          const Ok(BoostResult(status: BoostStatus.credited, creditId: 7, days: 3));
      await _openAndBuy(tester, e);
      expect(_log, contains('complete:3000000777'));
      expect(e.s.result?.status, BoostStatus.credited);
      expect(e.s.result?.creditId, 7);
    }, variant: _ios);

    for (final r in [
      const BoostResult(status: BoostStatus.active),
      const BoostResult(status: BoostStatus.credited, creditId: 1, days: 1),
      const BoostResult(status: BoostStatus.revoked),
    ]) {
      testWidgets('200 ${r.status.name}: consumable HAR DOIM bir marta yopiladi',
          (tester) async {
        final e = await _env();
        e.iap.verified = Ok(r);
        await _openAndBuy(tester, e);
        expect(_log.where((s) => s.startsWith('complete')).length, 1);
      }, variant: _ios);
    }

    final verifyCases = <(String, AppError, bool)>[
      ('422 days_mismatch',
          const AppError(AppErrorKind.validation,
              code: 'days_mismatch', status: 422),
          true),
      ('400 bad_request',
          const AppError(AppErrorKind.unknown, code: 'bad_request', status: 400),
          true),
      ('403 intent_forbidden',
          const AppError(AppErrorKind.forbidden,
              code: 'intent_forbidden', status: 403),
          false),
      ('409 already_linked',
          const AppError(AppErrorKind.conflict,
              code: 'already_linked', status: 409),
          false),
      ('409 in_progress',
          const AppError(AppErrorKind.conflict, code: 'in_progress', status: 409),
          false),
      ('429',
          const AppError(AppErrorKind.rateLimited,
              code: 'too_many_requests', status: 429),
          false),
      ('503 iap_disabled',
          const AppError(AppErrorKind.server, code: 'iap_disabled', status: 503),
          false),
      ('tarmoq', const AppError(AppErrorKind.offline), false),
    ];
    for (final (name, err, terminal) in verifyCases) {
      testWidgets(
          'verify $name: ${terminal ? 'yakuniy — yopiladi' : 'ochiq qoladi'}',
          (tester) async {
        final e = await _env();
        e.iap.verified = Err(err);
        await _openAndBuy(tester, e);
        expect(_log, contains('verify:JWS-B:42'));
        expect(_log.where((s) => s.startsWith('complete')).length,
            terminal ? 1 : 0);
        expect(e.s.failure, isNotNull);
        expect(e.s.busy, isFalse);
      }, variant: _ios);
    }

    final intentCases = <(String, AppError, Object)>[
      ('sold_out',
          AppError(AppErrorKind.conflict, code: 'sold_out', status: 409, data: {
            'error': 'sold_out',
            'max': 10,
            'active': 10,
            'nextFreeAt': _ends.millisecondsSinceEpoch,
          }),
          BoostBlockKind.soldOut),
      ('sales_not_open',
          const AppError(AppErrorKind.conflict,
              code: 'sales_not_open', status: 409),
          BoostBlockKind.notOpen),
      ('priority_window',
          AppError(AppErrorKind.conflict,
              code: 'priority_window',
              status: 409,
              data: {'endsAt': _ends.millisecondsSinceEpoch}),
          BoostBlockKind.priorityWindow),
      ('already_featured',
          const AppError(AppErrorKind.conflict,
              code: 'already_featured', status: 409, data: {'slotId': 9}),
          BoostBlockKind.alreadyFeatured),
      ('too_many_active',
          const AppError(AppErrorKind.conflict,
              code: 'too_many_active', status: 409, data: {'max': 3}),
          BoostBlockKind.tooManyActive),
      ('post_scheduled',
          const AppError(AppErrorKind.conflict,
              code: 'post_scheduled', status: 409),
          BoostBlockKind.scheduled),
      ('iap_disabled',
          const AppError(AppErrorKind.server, code: 'iap_disabled', status: 503),
          BoostFailure.disabled),
      ('payments_disabled',
          const AppError(AppErrorKind.server,
              code: 'payments_disabled', status: 503),
          BoostFailure.disabled),
      ('429',
          const AppError(AppErrorKind.rateLimited, status: 429),
          BoostFailure.rateLimited),
      ('forbidden',
          const AppError(AppErrorKind.forbidden, code: 'forbidden', status: 403),
          BoostFailure.forbidden),
      ('banned',
          const AppError(AppErrorKind.forbidden, code: 'banned', status: 403),
          BoostFailure.forbidden),
      ('not_found',
          const AppError(AppErrorKind.notFound, code: 'not_found', status: 404),
          BoostFailure.notFound),
      ('bad_package',
          const AppError(AppErrorKind.validation,
              code: 'bad_package', status: 422),
          BoostFailure.rejected),
      ('413',
          const AppError(AppErrorKind.unknown, status: 413),
          BoostFailure.rejected),
      ('tarmoq', const AppError(AppErrorKind.offline), BoostFailure.network),
    ];
    for (final (code, err, want) in intentCases) {
      testWidgets('intent $code: xarid oynasi ochilmaydi, sabab — $want',
          (tester) async {
        final e = await _env(slots: [
          FeaturedSlot(id: 9, status: 'active', endsAt: _ends),
        ]);
        e.iap.intent = Err(err);
        await e.ctl.open(_target);
        await e.ctl.buy(_pkgs[0]);
        expect(_log, ['intent:post:5:1']);
        if (want is BoostBlockKind) {
          expect(e.s.block?.kind, want);
          expect(e.s.failure, isNull);
        } else {
          expect(e.s.failure, want);
          expect(e.s.block, isNull);
        }
        expect(e.s.busy, isFalse);
        if (code == 'sold_out' ||
            code == 'already_featured' ||
            code == 'priority_window') {
          expect(e.s.block?.at, _ends);
        }
        if (code == 'too_many_active') expect(e.s.block?.max, 3);
        // Sabab bor — keyingi bosish ham xarid boshlamaydi.
        if (want is BoostBlockKind) {
          await e.ctl.buy(_pkgs[0]);
          expect(_log.length, 1);
        }
      }, variant: _ios);
    }

    testWidgets('post allaqachon ko‘tarilgan — varaq ochilishida ko‘rinadi',
        (tester) async {
      final e = await _env(slots: [
        FeaturedSlot(
            id: 3, targetKind: 'post', targetId: 5, status: 'active', endsAt: _ends),
      ]);
      await e.ctl.open(_target);
      expect(e.s.block?.kind, BoostBlockKind.alreadyFeatured);
      expect(e.s.block?.at, _ends);
      await e.ctl.buy(_pkgs[0]);
      expect(_log, isEmpty, reason: 'intent ham ketmaydi');
    }, variant: _ios);

    testWidgets('bekor qilindi — xato yo‘q, verify yo‘q', (tester) async {
      final e = await _env();
      await e.ctl.open(_target);
      e.store.onBuy = (id) =>
          IapPurchase(productId: id, status: IapPurchaseStatus.canceled);
      await e.ctl.buy(_pkgs[0]);
      await _drain(tester);
      expect(_log.where((s) => s.startsWith('verify')), isEmpty);
      expect(e.s.failure, isNull);
      expect(e.s.busy, isFalse);
    }, variant: _ios);
  });

  group('ilova ochilishida ochiq consumable', () {
    testWidgets('intentId siz tekshiriladi -> kredit, yopiladi', (tester) async {
      final e = await _env();
      e.iap.verified =
          const Ok(BoostResult(status: BoostStatus.credited, creditId: 11, days: 6));
      e.c.listen(boostWatcherProvider, (_, __) {});
      await tester.pump(const Duration(milliseconds: 30));
      expect(e.store.listened, isTrue);
      e.store.emit([_tx(_p6, jws: 'JWS-OLD', txId: '99')]);
      await _drain(tester);
      expect(_log, ['verify:JWS-OLD:null', 'complete:99']);
      expect(e.s.result?.status, BoostStatus.credited);
    }, variant: _ios);

    testWidgets('Premium oqimi ko‘tarish xaridiga tegmaydi', (tester) async {
      final e = await _env(
          cfg: const IapConfig(
              enabled: true,
              products: ['uz.nfcstore.nova.premium.monthly'],
              boostEnabled: true,
              boostProducts: _pkgs));
      e.c.listen(iapWatcherProvider, (_, __) {});
      e.c.listen(boostWatcherProvider, (_, __) {});
      await tester.pump(const Duration(milliseconds: 30));
      e.store.emit([_tx(_p1)]);
      await _drain(tester);
      expect(_log.where((s) => s.startsWith('premium-verify')), isEmpty);
      expect(_log, contains('verify:JWS-B:null'));
      expect(_log.where((s) => s.startsWith('complete')).length, 1,
          reason: 'faqat bir marta — ikki oqim ikki marta yopmaydi');
    }, variant: _ios);
  });

  group('kreditni ishlatish', () {
    const credit = BoostCredit(creditId: 7, days: 3);

    testWidgets('redeem -> faol slot', (tester) async {
      final e = await _env();
      final r = await e.ctl.redeem(credit, _target);
      await _drain(tester);
      expect(_log, ['redeem:7:post:5']);
      expect(r?.status, BoostStatus.active);
      expect(r?.endsAt, _ends);
    }, variant: _ios);

    for (final (code, want) in [
      ('credit_used', BoostFailure.creditUsed),
      ('credit_revoked', BoostFailure.creditRevoked),
      ('credit_not_found', BoostFailure.creditNotFound),
    ]) {
      testWidgets('redeem $code', (tester) async {
        final e = await _env();
        e.iap.redeemed = Err(AppError(
            code == 'credit_not_found'
                ? AppErrorKind.notFound
                : AppErrorKind.conflict,
            code: code,
            status: code == 'credit_not_found' ? 404 : 409));
        final r = await e.ctl.redeem(credit, _target);
        await _drain(tester);
        expect(r, isNull);
        expect(e.s.failure, want);
      }, variant: _ios);
    }

    testWidgets('redeem sold_out — sabab qatori', (tester) async {
      final e = await _env();
      e.iap.redeemed = const Err(
          AppError(AppErrorKind.conflict, code: 'sold_out', status: 409));
      expect(await e.ctl.redeem(credit, _target), isNull);
      await _drain(tester);
      expect(e.s.block?.kind, BoostBlockKind.soldOut);
    }, variant: _ios);
  });

  // ─────────────────────────────── UI: kirish yo'li va varaq
  group('post ekrani: kirish yo‘li', () {
    Future<_Env> pumpPost(WidgetTester tester,
        {IapConfig cfg = _on, Post post = const Post(id: 5, code: _me)}) async {
      tester.view.physicalSize = const Size(390 * 3, 1400 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      _log.clear();
      final store = _Store();
      final iap = _Iap(cfg: cfg);
      final c = ProviderContainer(
          overrides: await _overrides(store, iap, post: post));
      addTearDown(c.dispose);
      await c.read(iapConfigProvider.future);
      final router = GoRouter(routes: [
        GoRoute(path: '/', builder: (_, __) => const Scaffold(body: Text('BOSH'))),
        GoRoute(
            path: '/p',
            builder: (_, __) => PostScreen(id: post.id, code: post.code)),
        GoRoute(
            path: Routes.boostCredits,
            builder: (_, __) => const BoostCreditsScreen()),
      ]);
      await tester.pumpWidget(_app(c, router));
      router.push('/p');
      await settle(tester, frames: 8);
      return _Env(c, store, iap);
    }

    testWidgets('o‘z postim + iPhone + kalit: «Ko‘tarish» bor -> varaq',
        (tester) async {
      final e = await pumpPost(tester);
      final l = await _uz();
      final btn = find.byKey(const ValueKey('post-boost'));
      expect(btn, findsOneWidget);
      await tester.tap(btn);
      await settle(tester, frames: 10);
      expect(find.byKey(const ValueKey('boost-sheet')), findsOneWidget);
      expect(find.text(l.boostExplain), findsOneWidget);
      expect(find.text(l.boostDays(1)), findsOneWidget);
      expect(find.text(l.boostDays(3)), findsOneWidget);
      expect(find.text(l.boostDays(6)), findsOneWidget);
      expect(find.text('39 000 soʻm'), findsOneWidget);
      // Saytga yo'l / sayt narxi yo'q.
      expect(find.textContaining('nfcstore.uz'), findsNothing);
      expect(find.textContaining('Payme'), findsNothing);

      e.store.onBuy = (id) => _tx(id);
      await tester.tap(find.byKey(const ValueKey('boost-option-3')));
      await settle(tester, frames: 10);
      expect(_log, contains('complete:3000000777'));
      expect(find.byKey(const ValueKey('boost-result-active')), findsOneWidget);
      expect(find.text(l.boostActiveDone(3)), findsOneWidget);
      expect(find.text(l.boostEndsAt(boostTime(_ends))), findsOneWidget);
    }, variant: _ios);

    testWidgets('kredit natijasi -> «Kreditlarga o‘tish»', (tester) async {
      final e = await pumpPost(tester);
      final l = await _uz();
      e.iap.verified =
          const Ok(BoostResult(status: BoostStatus.credited, creditId: 7, days: 3));
      e.iap.credits = const [BoostCredit(creditId: 7, days: 3)];
      await tester.tap(find.byKey(const ValueKey('post-boost')));
      await settle(tester, frames: 10);
      e.store.onBuy = (id) => _tx(id);
      await tester.tap(find.byKey(const ValueKey('boost-option-3')));
      await settle(tester, frames: 10);
      expect(find.text(l.boostCredited), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('boost-open-credits')));
      await settle(tester, frames: 10);
      expect(find.byType(BoostCreditsScreen), findsOneWidget);
      expect(find.byKey(const ValueKey('boost-credit-7')), findsOneWidget);
    }, variant: _ios);

    testWidgets('joylar band: sabab qatori, tugmalar o‘chadi', (tester) async {
      final e = await pumpPost(tester);
      final l = await _uz();
      e.iap.intent = Err(AppError(AppErrorKind.conflict,
          code: 'sold_out',
          status: 409,
          data: {'nextFreeAt': _ends.millisecondsSinceEpoch}));
      await tester.tap(find.byKey(const ValueKey('post-boost')));
      await settle(tester, frames: 10);
      await tester.tap(find.byKey(const ValueKey('boost-option-1')));
      await settle(tester, frames: 8);
      expect(find.text(l.boostSoldOut(boostTime(_ends))), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('boost-option-6')));
      await settle(tester, frames: 4);
      expect(_log.where((s) => s.startsWith('intent')).length, 1);
      expect(_log.where((s) => s.startsWith('buy')), isEmpty);
    }, variant: _ios);

    testWidgets('begona post: «Ko‘tarish» yo‘q', (tester) async {
      await pumpPost(tester, post: const Post(id: 5, code: 'BOSHQA1'));
      expect(find.byKey(const ValueKey('post-boost')), findsNothing);
    }, variant: _ios);

    testWidgets('iPhone, kalit o‘chiq: yo‘q', (tester) async {
      await pumpPost(tester, cfg: IapConfig.disabled);
      expect(find.byKey(const ValueKey('post-boost')), findsNothing);
    }, variant: _ios);

    testWidgets('Android: yo‘q (eski sayt oqimi o‘zgarmaydi)', (tester) async {
      await pumpPost(tester);
      expect(find.byKey(const ValueKey('post-boost')), findsNothing);
    });
  });

  group('Reels «•••» menyusi', () {
    Future<void> pumpReels(WidgetTester tester, String code,
        {IapConfig cfg = _on}) async {
      VideoPlayerPlatform.instance = FakeVideoPlatform();
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      _log.clear();
      final reel = Post(
        id: 70,
        code: code,
        authorName: 'Men',
        mediaUrls: const ['https://nfcstore.uz/uploads/a.mp4'],
        isVideo: true,
      );
      final c = ProviderContainer(overrides: [
        ...await _overrides(_Store(), _Iap(cfg: cfg)),
        reelsProvider.overrideWith((ref) async => [reel]),
        activeTabProvider.overrideWith((ref) => 3),
      ]);
      addTearDown(c.dispose);
      await c.read(iapConfigProvider.future);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: c,
        child: wrapScreen(const ReelsScreen()),
      ));
      await settle(tester, frames: 10);
      await tester.tap(find.byKey(const ValueKey('reel-more')).first);
      await settle(tester, frames: 10);
    }

    testWidgets('o‘z reelim + iPhone + kalit: «Ko‘tarish» bor', (tester) async {
      await pumpReels(tester, _me);
      final l = await _uz();
      expect(find.byKey(const ValueKey('reel-boost')), findsOneWidget);
      expect(find.text(l.boostAction), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('reel-boost')));
      await settle(tester, frames: 10);
      expect(find.byKey(const ValueKey('boost-sheet')), findsOneWidget);
    }, variant: _ios);

    testWidgets('begona reel: yo‘q', (tester) async {
      await pumpReels(tester, 'PPP777');
      expect(find.byKey(const ValueKey('reel-boost')), findsNothing);
    }, variant: _ios);

    testWidgets('kalit o‘chiq: yo‘q', (tester) async {
      await pumpReels(tester, _me, cfg: IapConfig.disabled);
      expect(find.byKey(const ValueKey('reel-boost')), findsNothing);
    }, variant: _ios);

    testWidgets('Android: yo‘q', (tester) async {
      await pumpReels(tester, _me);
      expect(find.byKey(const ValueKey('reel-boost')), findsNothing);
    });
  });

  group('kreditlar ekrani va Sozlamalar', () {
    Future<_Env> pumpSettings(WidgetTester tester, List<BoostCredit> credits,
        {IapConfig cfg = _on}) async {
      tester.view.physicalSize = const Size(393 * 3, 2000 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      _log.clear();
      final store = _Store();
      final iap = _Iap(cfg: cfg)..credits = credits;
      final c = ProviderContainer(overrides: await _overrides(store, iap));
      addTearDown(c.dispose);
      await c.read(iapConfigProvider.future);
      final router = GoRouter(routes: [
        GoRoute(path: '/', builder: (_, __) => const SettingsScreen()),
        GoRoute(
            path: Routes.boostCredits,
            builder: (_, __) => const BoostCreditsScreen()),
      ]);
      await tester.pumpWidget(_app(c, router));
      await settle(tester, frames: 10);
      return _Env(c, store, iap);
    }

    testWidgets('kredit bor: Sozlamalarda qator -> ishlatish -> post tanlash '
        '-> redeem', (tester) async {
      await pumpSettings(tester, const [BoostCredit(creditId: 7, days: 3)]);
      final l = await _uz();
      expect(find.text(l.boostCredits), findsOneWidget);
      await tester.tap(find.text(l.boostCredits));
      await settle(tester, frames: 10);
      expect(find.byKey(const ValueKey('boost-credit-7')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('boost-use-7')));
      await settle(tester, frames: 10);
      expect(find.text(l.boostPickPost), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('boost-pick-p-5')));
      await settle(tester, frames: 10);
      expect(_log, ['redeem:7:post:5']);
      expect(find.textContaining(l.boostActiveDone(3)), findsOneWidget);
    }, variant: _ios);

    testWidgets('kredit yo‘q: Sozlamalarda qator yo‘q', (tester) async {
      await pumpSettings(tester, const []);
      final l = await _uz();
      expect(find.text(l.boostCredits), findsNothing);
    }, variant: _ios);

    testWidgets('kalit o‘chiq: kredit bo‘lsa ham qator yo‘q', (tester) async {
      await pumpSettings(tester, const [BoostCredit(creditId: 7, days: 3)],
          cfg: IapConfig.disabled);
      final l = await _uz();
      expect(find.text(l.boostCredits), findsNothing);
    }, variant: _ios);

    testWidgets('Android: qator yo‘q', (tester) async {
      await pumpSettings(tester, const [BoostCredit(creditId: 7, days: 3)]);
      final l = await _uz();
      expect(find.text(l.boostCredits), findsNothing);
    });
  });
}
