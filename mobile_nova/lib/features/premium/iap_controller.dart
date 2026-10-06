import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/app_error.dart';
import '../../core/utils/result.dart';
import '../../data/repositories/iap_repository.dart';
import '../auth/session.dart';
import '../shop/store_policy.dart' show isAppStoreBuild;
import 'iap_store.dart';

export 'premium_access.dart';

// ═══════════════════════════════════════════════════════════════════
// PREMIUM — APPLE IN-APP PURCHASE (FAQAT iPHONE)
//
// Oqim:
//   1. `GET /api/iap/apple/config` — kalit. O'chiq yoki xato bo'lsa
//      ilovada xarid haqida hech narsa ko'rinmaydi.
//   2. Xarid: `account-token` (UUID) -> StoreKit 2 `appAccountToken`.
//   3. `purchaseStream` dan kelgan JWS -> `POST /api/iap/apple/verify`.
//   4. `completePurchase` — server QAROR berganda: 200 (faol yoki faol
//      emas) yoki yakuniy rad etish (400 / 422: test xaridi ruxsat
//      etilmagan, Family Sharing, noto'g'ri tranzaksiya...). Tarmoq,
//      403, 409, 429, 503 da tranzaksiya OCHIQ qoladi va StoreKit uni
//      keyingi ishga tushirishda qayta beradi (`Transaction.updates`).
//   5. Sessiya yangilanadi — Premium holati butun ilovada o'zgaradi.
//
// ANDROID: `iapConfigProvider` tarmoqqa chiqmay o'chiq qaytaradi,
// StoreKit esa umuman chaqirilmaydi. Android xulqi o'zgarmaydi.
// ═══════════════════════════════════════════════════════════════════

final iapStoreProvider = Provider<IapStore>((_) => StoreKitIapStore());

/// Server kaliti. iPhone bo'lmasa — tarmoqsiz o'chiq.
final iapConfigProvider = FutureProvider<IapConfig>((ref) async {
  if (!isAppStoreBuild) return IapConfig.disabled;
  final res = await ref.watch(iapRepositoryProvider).config();
  return res.valueOrNull ?? IapConfig.disabled;
});

/// Xarid UI ko'rsatilsinmi — iPhone VA server kaliti yoqilgan.
///
/// Javob hali kelmagan bo'lsa ham `false`: kirish yo'li faqat kalit
/// aniq yoqilganda paydo bo'ladi.
final iapEnabledProvider = Provider<bool>((ref) {
  if (!isAppStoreBuild) return false;
  return ref.watch(iapConfigProvider).valueOrNull?.enabled ?? false;
});

/// Ekranda ko'rsatiladigan natija.
enum IapNotice {
  /// Server tasdiqladi — Premium faol.
  activated,

  /// Xarid tasdiq kutmoqda (Ask to Buy / SCA).
  pending,

  /// Server: obuna faol emas (`expired` / `revoked`).
  inactive,

  /// Tiklashda faol obuna topilmadi.
  nothingToRestore,
}

enum IapFailure {
  network,
  accountMismatch,
  alreadyLinked,
  disabled,
  server,
  store,

  /// 429 — vaqtincha; tranzaksiya ochiq qoladi.
  rateLimited,

  /// 422 `sandbox_not_allowed` — YAKUNIY (tranzaksiya yopiladi).
  sandboxNotAllowed,

  /// 422 `family_shared_not_supported` — YAKUNIY.
  familyShared,

  /// Boshqa 400 / 422 (`wrong_bundle`, `unknown_product`, `wrong_type`,
  /// `bad_transaction`, `invalid_signature`, `bad_request`) — YAKUNIY.
  rejected,

  /// App Store narxlarni bermadi yoki qurilmada xarid taqiqlangan.
  unavailable,
}

class IapState {
  const IapState({
    this.loading = false,
    this.loaded = false,
    this.products = const [],
    this.buyingId,
    this.restoring = false,
    this.verifying = false,
    this.notice,
    this.failure,
  });

  final bool loading;
  final bool loaded;
  final List<IapProduct> products;

  /// Xarid oynasi ochilgan mahsulot.
  final String? buyingId;
  final bool restoring;

  /// Server tekshiruvi ketmoqda.
  final bool verifying;
  final IapNotice? notice;
  final IapFailure? failure;

  bool get busy => buyingId != null || restoring || verifying;

  IapState copyWith({
    bool? loading,
    bool? loaded,
    List<IapProduct>? products,
    String? Function()? buyingId,
    bool? restoring,
    bool? verifying,
    IapNotice? Function()? notice,
    IapFailure? Function()? failure,
  }) =>
      IapState(
        loading: loading ?? this.loading,
        loaded: loaded ?? this.loaded,
        products: products ?? this.products,
        buyingId: buyingId == null ? this.buyingId : buyingId(),
        restoring: restoring ?? this.restoring,
        verifying: verifying ?? this.verifying,
        notice: notice == null ? this.notice : notice(),
        failure: failure == null ? this.failure : failure(),
      );
}

class IapController extends StateNotifier<IapState> {
  IapController(this._ref) : super(const IapState());

  final Ref _ref;
  StreamSubscription<List<IapPurchase>>? _sub;

  /// Hozir serverda tekshirilayotgan tranzaksiyalar — bir tranzaksiya
  /// ikki marta kelsa (yangilanish + tiklash) ikki marta yuborilmaydi.
  final Map<String, Future<void>> _inFlight = {};
  int _restoredSeen = 0;

  IapStore get _store => _ref.read(iapStoreProvider);
  IapRepository get _repo => _ref.read(iapRepositoryProvider);

  /// `purchaseStream` ga ulanadi (bir marta). Ilova ochilganda
  /// [iapWatcherProvider] chaqiradi — ochiq qolgan tranzaksiyalar
  /// shu yerdan keladi.
  void attach() {
    _sub ??= _store.purchases.listen(_onPurchases, onError: (_) {});
  }

  void detach() {
    _sub?.cancel();
    _sub = null;
  }

  @override
  void dispose() {
    detach();
    super.dispose();
  }

  /// Narxlarni App Store'dan oladi (ekran ochilganda).
  Future<void> load({bool force = false}) async {
    if (state.loading || (state.loaded && !force)) return;
    final cfg = await _ref.read(iapConfigProvider.future);
    if (!mounted || !cfg.enabled) return;
    attach();
    state = state.copyWith(loading: true, failure: () => null);
    List<IapProduct> list = const [];
    try {
      if (await _store.isAvailable()) {
        list = await _store.products(cfg.products.toSet());
      }
    } catch (_) {
      list = const [];
    }
    if (!mounted) return;
    // Server bergan tartib (oylik, yillik).
    int rank(IapProduct p) {
      final i = cfg.products.indexOf(p.id);
      return i < 0 ? cfg.products.length : i;
    }

    list = [...list]..sort((a, b) => rank(a).compareTo(rank(b)));
    state = state.copyWith(
      loading: false,
      loaded: list.isNotEmpty,
      products: list,
      failure: () => list.isEmpty ? IapFailure.unavailable : null,
    );
  }

  /// Obuna xaridi.
  Future<void> buy(IapProduct product) async {
    if (state.busy) return;
    attach();
    state = state.copyWith(
      buyingId: () => product.id,
      notice: () => null,
      failure: () => null,
    );
    final token = await _repo.accountToken();
    if (!mounted) return;
    final value = token.valueOrNull ?? '';
    if (value.isEmpty) {
      state = state.copyWith(
        buyingId: () => null,
        failure: () => token.errorOrNull == null
            ? IapFailure.server
            : _failureOf(token.errorOrNull!),
      );
      return;
    }
    try {
      await _store.buy(product.id, accountToken: value);
    } catch (_) {
      if (!mounted) return;
      state = state.copyWith(
          buyingId: () => null, failure: () => IapFailure.store);
      return;
    }
    // StoreKit 2: oyna yopilganda natija oqimga allaqachon yuborilgan.
    if (mounted && state.buyingId == product.id) {
      state = state.copyWith(buyingId: () => null);
    }
  }

  /// "Xaridlarni tiklash" — faol obunalar oqim orqali qaytadi.
  Future<void> restore() async {
    if (state.busy) return;
    attach();
    _restoredSeen = 0;
    state = state.copyWith(
      restoring: true,
      notice: () => null,
      failure: () => null,
    );
    var failed = false;
    try {
      await _store.restore();
    } catch (_) {
      failed = true;
    }
    // Oqimdagi yangilanishlar yetib kelsin, tekshiruvlar tugasin.
    await Future<void>.delayed(Duration.zero);
    await Future.wait(_inFlight.values.toList());
    if (!mounted) return;
    state = state.copyWith(
      restoring: false,
      failure: failed ? () => IapFailure.store : null,
      notice: !failed && _restoredSeen == 0 && state.failure == null
          ? () => IapNotice.nothingToRestore
          : null,
    );
  }

  Future<void> _onPurchases(List<IapPurchase> list) async {
    for (final p in list) {
      if (!mounted) return;
      switch (p.status) {
        case IapPurchaseStatus.pending:
          state = state.copyWith(
              buyingId: () => null, notice: () => IapNotice.pending);
        case IapPurchaseStatus.canceled:
          state = state.copyWith(buyingId: () => null);
        case IapPurchaseStatus.error:
          state = state.copyWith(
              buyingId: () => null, failure: () => IapFailure.store);
        case IapPurchaseStatus.purchased:
        case IapPurchaseStatus.restored:
          if (p.status == IapPurchaseStatus.restored) _restoredSeen++;
          await _deliver(p);
      }
    }
  }

  /// JWS ni serverga beradi; 200 bo'lsagina tranzaksiyani yopadi.
  Future<void> _deliver(IapPurchase p) {
    final key = p.purchaseId ?? p.signedTransaction;
    final running = _inFlight[key];
    if (running != null) return running;
    final f = _verify(p).whenComplete(() => _inFlight.remove(key));
    _inFlight[key] = f;
    return f;
  }

  Future<void> _verify(IapPurchase p) async {
    if (p.signedTransaction.isEmpty) {
      state = state.copyWith(
          buyingId: () => null, failure: () => IapFailure.store);
      return;
    }
    state = state.copyWith(buyingId: () => null, verifying: true);
    final res = await _repo.verify(p.signedTransaction);
    if (!mounted) return;

    switch (res) {
      case Ok(:final value):
        // Server qarorini berdi (faol yoki faol emas) — tranzaksiya
        // yopiladi, StoreKit uni boshqa qayta bermaydi.
        if (p.needsCompletion) {
          try {
            await _store.complete(p);
          } catch (_) {/* keyingi ishga tushirishda qayta keladi */}
        }
        await _ref.read(sessionProvider.notifier).refresh();
        if (!mounted) return;
        final activated = value.premium || state.notice == IapNotice.activated;
        state = state.copyWith(
          verifying: _inFlight.length > 1,
          notice: () => activated ? IapNotice.activated : IapNotice.inactive,
          failure: () => null,
        );
      case Err(:final error) when _isTerminal(error):
        // YAKUNIY RAD ETISH (400 / 422): server bu tranzaksiyani hech
        // qachon qabul qilmaydi. Ochiq qoldirilsa StoreKit uni har
        // ochilishda abadiy qayta berardi — shuning uchun yopiladi.
        if (p.needsCompletion) {
          try {
            await _store.complete(p);
          } catch (_) {/* keyingi ishga tushirishda qayta keladi */}
        }
        if (!mounted) return;
        state = state.copyWith(
          verifying: _inFlight.length > 1,
          failure: () => _failureOf(error),
        );
      case Err(:final error):
        // TRANZAKSIYA OCHIQ QOLADI — `completePurchase` YO'Q (tarmoq,
        // 403, 409, 429, 503). Server hali yozmagan: StoreKit uni
        // keyingi ochilishda qayta beradi va tekshiruv takrorlanadi.
        state = state.copyWith(
          verifying: _inFlight.length > 1,
          failure: () => _failureOf(error),
        );
    }
  }

  /// Server tranzaksiyani BUTUNLAY rad etdimi (400 / 422).
  static bool _isTerminal(AppError e) => e.status == 400 || e.status == 422;

  static IapFailure _failureOf(AppError e) => switch (e.code) {
        'account_mismatch' => IapFailure.accountMismatch,
        'already_linked' => IapFailure.alreadyLinked,
        'iap_disabled' => IapFailure.disabled,
        'sandbox_not_allowed' => IapFailure.sandboxNotAllowed,
        'family_shared_not_supported' => IapFailure.familyShared,
        _ when _isTerminal(e) => IapFailure.rejected,
        _ => switch (e.kind) {
            AppErrorKind.offline || AppErrorKind.timeout => IapFailure.network,
            AppErrorKind.rateLimited => IapFailure.rateLimited,
            _ => IapFailure.server,
          },
      };
}

final iapControllerProvider =
    StateNotifierProvider<IapController, IapState>((ref) => IapController(ref));

/// OCHIQ TRANZAKSIYALARNI ILOVA OCHILISHIDAN TINGLAYDI.
///
/// Kirgan foydalanuvchi + iPhone + kalit yoqilgan bo'lsa
/// `purchaseStream` ga ulanadi. Avvalgi safar tarmoq uzilib serverga
/// yetmagan xarid StoreKit tomonidan shu yerga qayta beriladi va
/// tekshiruv takrorlanadi. Chiqishda uziladi.
final iapWatcherProvider = Provider<void>((ref) {
  if (!isAppStoreBuild) return;
  final signedIn =
      ref.watch(sessionProvider.select((s) => s is SessionActive));
  if (!signedIn || !ref.watch(iapEnabledProvider)) return;
  final c = ref.read(iapControllerProvider.notifier);
  c.attach();
  ref.onDispose(c.detach);
});
