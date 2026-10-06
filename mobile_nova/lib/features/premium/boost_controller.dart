import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/app_error.dart';
import '../../core/utils/result.dart';
import '../../data/models/models.dart';
import '../../data/repositories/featured_repository.dart';
import '../../data/repositories/iap_repository.dart';
import '../auth/session.dart';
import '../shop/store_policy.dart' show isAppStoreBuild;
import 'iap_controller.dart';
import 'iap_store.dart';

// ═══════════════════════════════════════════════════════════════════
// "KO'TARISH" — POSTNI LENTADA KO'TARISH, APPLE CONSUMABLE (iPHONE)
//
// Oqim:
//   1. `boost-intent` — joy 20 daqiqaga ushlab turiladi (`intentId`).
//      Band / ochilmagan / allaqachon ko'tarilgan — xarid oynasi
//      OCHILMAYDI, sabab ko'rsatiladi.
//   2. `account-token` -> StoreKit consumable xaridi (`appAccountToken`).
//   3. JWS + `intentId` -> `verify`: `active` (slot yondi), `credited`
//      (to'lov KREDIT bo'lib saqlandi) yoki `revoked`.
//   4. 200 dan keyin `completePurchase` HAR DOIM (consumable yopilmasa
//      StoreKit uni abadiy qayta beradi). 400 / 422 — yakuniy, ham
//      yopiladi. 403 / 409 / 429 / 503 / tarmoq — OCHIQ qoladi.
//   5. Ilova ochilganda kelgan ochiq tranzaksiya — `intentId` siz
//      tekshiriladi, server uni kredit qiladi (yo'qolmaydi).
//
// Faqat iPhone va server kaliti `boostEnabled`. Android va kalit
// o'chiq — UI umuman yo'q (Android'da eski sayt oqimi o'zgarmaydi).
// ═══════════════════════════════════════════════════════════════════

/// Ko'tarish UI ko'rsatilsinmi — iPhone VA `config.boostEnabled`.
final iapBoostEnabledProvider = Provider<bool>((ref) {
  if (!isAppStoreBuild) return false;
  return ref.watch(iapConfigProvider).valueOrNull?.boostEnabled ?? false;
});

/// Ko'tariladigan kontent.
class BoostTarget {
  const BoostTarget({
    required this.kind,
    required this.id,
    this.mediaUrl = '',
    this.isVideo = false,
  });

  /// `post` yoki `company_post`.
  final String kind;
  final int id;
  final String mediaUrl;
  final bool isVideo;

  factory BoostTarget.of(Post p) => BoostTarget(
        kind: p.isCompany ? 'company_post' : 'post',
        id: p.id,
        mediaUrl: p.mediaUrls.isEmpty ? '' : p.mediaUrls.first,
        isVideo: p.isVideo,
      );

  @override
  bool operator ==(Object other) =>
      other is BoostTarget && other.kind == kind && other.id == id;

  @override
  int get hashCode => Object.hash(kind, id);
}

/// Nima uchun hozir ko'tarib bo'lmaydi (tugmalar o'chiq).
enum BoostBlockKind {
  soldOut,
  notOpen,
  priorityWindow,
  alreadyFeatured,
  tooManyActive,
  scheduled,
}

class BoostBlock {
  const BoostBlock(this.kind, {this.at, this.max});
  final BoostBlockKind kind;

  /// `sold_out` — `nextFreeAt`; `priority_window` — `endsAt`;
  /// `already_featured` — slot tugashi; `sales_not_open` — `openAt`.
  final DateTime? at;
  final int? max;
}

enum BoostFailure {
  network,
  server,
  store,
  disabled,
  rateLimited,
  forbidden,
  notFound,
  alreadyLinked,
  inProgress,
  intentForbidden,
  rejected,
  creditUsed,
  creditRevoked,
  creditNotFound,
  unavailable,
}

/// Paket + App Store narxi (`null` — do'kon bermadi).
typedef BoostOption = ({BoostPackage pkg, IapProduct? product});

class BoostState {
  const BoostState({
    this.target,
    this.loading = false,
    this.options = const [],
    this.buyingDays,
    this.verifying = false,
    this.block,
    this.result,
    this.failure,
  });

  final BoostTarget? target;
  final bool loading;
  final List<BoostOption> options;
  final int? buyingDays;
  final bool verifying;
  final BoostBlock? block;
  final BoostResult? result;
  final BoostFailure? failure;

  bool get busy => buyingDays != null || verifying;

  BoostState copyWith({
    bool? loading,
    List<BoostOption>? options,
    int? Function()? buyingDays,
    bool? verifying,
    BoostBlock? Function()? block,
    BoostResult? Function()? result,
    BoostFailure? Function()? failure,
  }) =>
      BoostState(
        target: target,
        loading: loading ?? this.loading,
        options: options ?? this.options,
        buyingDays: buyingDays == null ? this.buyingDays : buyingDays(),
        verifying: verifying ?? this.verifying,
        block: block == null ? this.block : block(),
        result: result == null ? this.result : result(),
        failure: failure == null ? this.failure : failure(),
      );
}

/// Ishlatilmagan kreditlar. Kalit o'chiq / iPhone emas — bo'sh.
final boostCreditsProvider =
    FutureProvider.autoDispose<List<BoostCredit>>((ref) async {
  if (!ref.watch(iapBoostEnabledProvider)) return const [];
  final res = await ref.watch(iapRepositoryProvider).boostCredits();
  return res.valueOrNull ?? const [];
});

class BoostController extends StateNotifier<BoostState> {
  BoostController(this._ref) : super(const BoostState());

  final Ref _ref;
  StreamSubscription<List<IapPurchase>>? _sub;
  final Map<String, IapProduct> _products = {};

  /// Shu ekrandan boshlangan xaridlar: mahsulot -> `intentId`.
  final Map<String, int> _intents = {};
  final Map<String, Future<void>> _inFlight = {};

  IapStore get _store => _ref.read(iapStoreProvider);
  IapRepository get _repo => _ref.read(iapRepositoryProvider);

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

  /// Varaq ochildi — paketlar, narxlar va post holati.
  Future<void> open(BoostTarget target) async {
    if (state.busy && state.target == target) return;
    state = BoostState(target: target, loading: true);
    final cfg = await _ref.read(iapConfigProvider.future);
    if (!mounted || state.target != target) return;
    if (!cfg.boostEnabled) {
      state = state.copyWith(
          loading: false, failure: () => BoostFailure.disabled);
      return;
    }
    attach();

    final missing = cfg.boostProducts
        .map((b) => b.productId)
        .where((id) => !_products.containsKey(id))
        .toSet();
    if (missing.isNotEmpty) {
      try {
        if (await _store.isAvailable()) {
          for (final p in await _store.products(missing)) {
            _products[p.id] = p;
          }
        }
      } catch (_) {/* narxsiz paket o'chiq ko'rinadi */}
    }

    // Bu post hozir ko'tarilganmi — xarid oynasini ochishdan OLDIN.
    final active = await _activeSlotEnd(target);
    if (!mounted || state.target != target) return;

    final options = [
      for (final b in cfg.boostProducts) (pkg: b, product: _products[b.productId]),
    ];
    state = state.copyWith(
      loading: false,
      options: options,
      block: () => active == null
          ? null
          : BoostBlock(BoostBlockKind.alreadyFeatured, at: active),
      failure: () => options.every((o) => o.product == null)
          ? BoostFailure.unavailable
          : null,
    );
  }

  /// Paket tanlandi: intent -> token -> StoreKit.
  Future<void> buy(BoostPackage pkg) async {
    final target = state.target;
    if (target == null || state.busy || state.block != null) return;
    state = state.copyWith(
      buyingDays: () => pkg.days,
      result: () => null,
      failure: () => null,
    );

    final intent = await _repo.boostIntent(
        targetKind: target.kind, targetId: target.id, days: pkg.days);
    if (!mounted) return;
    final BoostIntent it;
    switch (intent) {
      case Ok(:final value):
        it = value;
      case Err(:final error):
        await _applyError(error, target);
        return;
    }

    final token = await _repo.accountToken();
    if (!mounted) return;
    final tok = token.valueOrNull ?? '';
    if (tok.isEmpty) {
      state = state.copyWith(
        buyingDays: () => null,
        failure: () => token.errorOrNull == null
            ? BoostFailure.server
            : _failureOf(token.errorOrNull!),
      );
      return;
    }

    final productId = it.productId.isNotEmpty ? it.productId : pkg.productId;
    _intents[productId] = it.intentId;
    attach();
    try {
      await _store.buyConsumable(productId, accountToken: tok);
    } catch (_) {
      _intents.remove(productId);
      if (!mounted) return;
      state = state.copyWith(
          buyingDays: () => null, failure: () => BoostFailure.store);
      return;
    }
    if (mounted && state.buyingDays == pkg.days && !state.verifying) {
      state = state.copyWith(buyingDays: () => null);
    }
  }

  /// Kreditni postga ishlatish. Muvaffaqiyatda natija, aks holda `null`
  /// (sabab — [state] da).
  Future<BoostResult?> redeem(BoostCredit credit, BoostTarget target) async {
    state = BoostState(target: target, verifying: true);
    final res = await _repo.boostRedeem(
        creditId: credit.creditId,
        targetKind: target.kind,
        targetId: target.id);
    if (!mounted) return null;
    _ref.invalidate(boostCreditsProvider);
    switch (res) {
      case Ok(:final value):
        state = state.copyWith(verifying: false, result: () => value);
        return value;
      case Err(:final error):
        state = state.copyWith(verifying: false);
        await _applyError(error, target);
        return null;
    }
  }

  Future<void> _onPurchases(List<IapPurchase> list) async {
    final cfg = _ref.read(iapConfigProvider).valueOrNull;
    for (final p in list) {
      if (!mounted) return;
      if (!isBoostProductId(p.productId, cfg)) continue;
      switch (p.status) {
        case IapPurchaseStatus.pending:
          state = state.copyWith(buyingDays: () => null);
        case IapPurchaseStatus.canceled:
          _intents.remove(p.productId);
          state = state.copyWith(buyingDays: () => null);
        case IapPurchaseStatus.error:
          _intents.remove(p.productId);
          state = state.copyWith(
              buyingDays: () => null, failure: () => BoostFailure.store);
        case IapPurchaseStatus.purchased:
        case IapPurchaseStatus.restored:
          await _deliver(p);
      }
    }
  }

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
          buyingDays: () => null, failure: () => BoostFailure.store);
      return;
    }
    final intentId = _intents[p.productId];
    state = state.copyWith(buyingDays: () => null, verifying: true);
    final res = await _repo.verifyBoost(p.signedTransaction, intentId: intentId);
    if (!mounted) return;

    switch (res) {
      case Ok(:final value):
        // CONSUMABLE — 200 dan keyin HAR DOIM yopiladi.
        _intents.remove(p.productId);
        await _complete(p);
        if (value.status == BoostStatus.credited) {
          _ref.invalidate(boostCreditsProvider);
        }
        if (!mounted) return;
        state = state.copyWith(
          verifying: _inFlight.length > 1,
          result: () => value,
          failure: () => null,
        );
      case Err(:final error) when _isTerminal(error):
        // 400 / 422 (`days_mismatch`, `bad_transaction`...) — server bu
        // tranzaksiyani hech qachon qabul qilmaydi: yopiladi.
        _intents.remove(p.productId);
        await _complete(p);
        if (!mounted) return;
        state = state.copyWith(
          verifying: _inFlight.length > 1,
          failure: () => BoostFailure.rejected,
        );
      case Err(:final error):
        // 403 `intent_forbidden`, 409 `already_linked` / `in_progress`,
        // 429, 503, tarmoq — OCHIQ qoladi, StoreKit qayta beradi.
        state = state.copyWith(
          verifying: _inFlight.length > 1,
          failure: () => _failureOf(error),
        );
    }
  }

  Future<void> _complete(IapPurchase p) async {
    try {
      await _store.complete(p);
    } catch (_) {/* keyingi ochilishda qayta keladi */}
  }

  /// Intent / redeem xatosi: sabab qatori (tugmalar o'chadi) yoki xato.
  Future<void> _applyError(AppError e, BoostTarget target) async {
    final data = e.data ?? const <String, dynamic>{};
    int? asInt(Object? v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}');
    BoostBlock? block = switch (e.code) {
      'sold_out' =>
        BoostBlock(BoostBlockKind.soldOut, at: iapTime(data['nextFreeAt'])),
      'sales_not_open' =>
        BoostBlock(BoostBlockKind.notOpen, at: iapTime(data['openAt'])),
      'priority_window' => BoostBlock(BoostBlockKind.priorityWindow,
          at: iapTime(data['endsAt'])),
      'too_many_active' =>
        BoostBlock(BoostBlockKind.tooManyActive, max: asInt(data['max'])),
      'post_scheduled' => const BoostBlock(BoostBlockKind.scheduled),
      _ => null,
    };
    if (e.code == 'already_featured') {
      final end = await _activeSlotEnd(target, slotId: asInt(data['slotId']));
      block = BoostBlock(BoostBlockKind.alreadyFeatured, at: end);
    }
    if (!mounted) return;
    state = state.copyWith(
      buyingDays: () => null,
      block: block == null ? null : () => block,
      failure: () => block == null ? _failureOf(e) : null,
    );
  }

  /// Faol slot tugash vaqti (`/api/featured/mine`) — bo'lmasa `null`.
  Future<DateTime?> _activeSlotEnd(BoostTarget t, {int? slotId}) async {
    final res = await _ref.read(featuredRepositoryProvider).mine();
    final now = DateTime.now();
    for (final s in res.valueOrNull ?? const <FeaturedSlot>[]) {
      final match = slotId != null
          ? s.id == slotId
          : s.targetKind == t.kind && s.targetId == t.id;
      final end = s.endsAt;
      if (match && s.isActive && end != null && end.isAfter(now)) return end;
    }
    return null;
  }

  static bool _isTerminal(AppError e) => e.status == 400 || e.status == 422;

  static BoostFailure _failureOf(AppError e) => switch (e.code) {
        'iap_disabled' || 'payments_disabled' => BoostFailure.disabled,
        'forbidden' || 'banned' || 'not_owner' => BoostFailure.forbidden,
        'not_found' => BoostFailure.notFound,
        'already_linked' => BoostFailure.alreadyLinked,
        'in_progress' => BoostFailure.inProgress,
        'intent_forbidden' => BoostFailure.intentForbidden,
        'credit_used' => BoostFailure.creditUsed,
        'credit_revoked' => BoostFailure.creditRevoked,
        'credit_not_found' => BoostFailure.creditNotFound,
        _ when e.status == 400 || e.status == 422 || e.status == 413 =>
          BoostFailure.rejected,
        _ => switch (e.kind) {
            AppErrorKind.offline ||
            AppErrorKind.timeout =>
              BoostFailure.network,
            AppErrorKind.rateLimited => BoostFailure.rateLimited,
            AppErrorKind.notFound => BoostFailure.notFound,
            _ => BoostFailure.server,
          },
      };
}

final boostControllerProvider =
    StateNotifierProvider<BoostController, BoostState>(
        (ref) => BoostController(ref));

/// Ochiq ko'tarish tranzaksiyalari ilova ochilishidan tinglanadi
/// (iPhone + kirgan + `boostEnabled`): `intentId` siz tekshiriladi va
/// server ularni kredit qiladi.
final boostWatcherProvider = Provider<void>((ref) {
  if (!isAppStoreBuild) return;
  final signedIn =
      ref.watch(sessionProvider.select((s) => s is SessionActive));
  if (!signedIn || !ref.watch(iapBoostEnabledProvider)) return;
  final c = ref.read(boostControllerProvider.notifier);
  c.attach();
  ref.onDispose(c.detach);
});
