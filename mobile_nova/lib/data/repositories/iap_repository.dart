import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';

/// APPLE IN-APP PURCHASE — SERVER TOMONI (`/api/iap/apple/*`).
///
/// ## ILOVA PREMIUMNI O'ZI YOQMAYDI
///
/// StoreKit bergan imzolangan tranzaksiya (JWS) serverga yuboriladi;
/// server uni Apple kaliti bilan tekshiradi, `appAccountToken` hisobga
/// mosligini ko'radi va Premium muddatini O'ZI yozadi. Ilova faqat
/// natijani o'qiydi va sessiyani yangilaydi.
///
/// ## KALIT (KILL SWITCH)
///
/// `config.enabled == false` yoki so'rov muvaffaqiyatsiz — ilovada
/// xarid haqida HECH NARSA ko'rinmaydi (ekran ham, kirish yo'li ham).
class IapRepository {
  IapRepository(this._api);
  final ApiClient _api;

  /// `GET /api/iap/apple/config` → `{enabled, products}`.
  Future<Result<IapConfig>> config() async {
    final res = await _api.get<Map<String, dynamic>>('/api/iap/apple/config');
    return res.map(IapConfig.fromJson);
  }

  /// `GET /api/iap/apple/account-token` → `{token: '<uuid>'}`.
  Future<Result<String>> accountToken() async {
    final res =
        await _api.get<Map<String, dynamic>>('/api/iap/apple/account-token');
    return res.map((j) => '${j['token'] ?? ''}');
  }

  /// `POST /api/iap/apple/verify` `{signedTransaction}`.
  ///
  /// 200 — `premium: true` (muddati bilan) yoki `premium: false`
  /// (`reason: expired | revoked`). Boshqasi — `Err`:
  ///   * YAKUNIY (tranzaksiya yopiladi): 422 `sandbox_not_allowed`,
  ///     `family_shared_not_supported`, `wrong_bundle`,
  ///     `unknown_product`, `wrong_type`, `bad_transaction`; 400
  ///     `invalid_signature` / `bad_request`;
  ///   * VAQTINCHA (ochiq qoladi): 403 `account_mismatch`, 409
  ///     `already_linked`, 429 `too_many_requests`, 503 `iap_disabled`,
  ///     tarmoq xatosi.
  Future<Result<IapVerifyResult>> verify(String signedTransaction) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/api/iap/apple/verify',
      {'signedTransaction': signedTransaction},
    );
    return res.map(IapVerifyResult.fromJson);
  }

  // ── KO'TARISH (post promotion) — Apple consumable ──────────────────

  /// `POST /api/iap/apple/boost-intent` → 201 `{intentId, productId,
  /// days, holdUntil}`. Joy 20 daqiqaga ushlab turiladi; o'sha post
  /// qayta bosilsa o'sha `intentId` qaytadi.
  Future<Result<BoostIntent>> boostIntent({
    required String targetKind,
    required int targetId,
    required int days,
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/api/iap/apple/boost-intent',
      {'targetKind': targetKind, 'targetId': targetId, 'days': days},
    );
    return res.map(BoostIntent.fromJson);
  }

  /// Consumable tranzaksiyasi — `intentId` bilan (xarid shu ekrandan
  /// bo'lsa) yoki usiz (ilova qayta ochilganda kelgan ochiq
  /// tranzaksiya: server uni KREDIT qiladi).
  Future<Result<BoostResult>> verifyBoost(String signedTransaction,
      {int? intentId}) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/api/iap/apple/verify',
      {
        'signedTransaction': signedTransaction,
        if (intentId != null) 'intentId': intentId,
      },
    );
    return res.map(BoostResult.fromJson);
  }

  /// Kreditni postga ishlatish → 200 `{boost: 'active', slot}`.
  Future<Result<BoostResult>> boostRedeem({
    required int creditId,
    required String targetKind,
    required int targetId,
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/api/iap/apple/boost-redeem',
      {'creditId': creditId, 'targetKind': targetKind, 'targetId': targetId},
    );
    return res.map(BoostResult.fromJson);
  }

  /// Ishlatilmagan kreditlar.
  Future<Result<List<BoostCredit>>> boostCredits() async {
    final res =
        await _api.get<Map<String, dynamic>>('/api/iap/apple/boost-credits');
    return res.map((j) {
      final raw = j['credits'];
      return raw is List
          ? raw
              .whereType<Map>()
              .map((e) => BoostCredit.fromJson(e.cast<String, dynamic>()))
              .where((c) => c.creditId > 0)
              .toList()
          : const <BoostCredit>[];
    });
  }
}

/// Server vaqti — ms (son) yoki ISO satr.
DateTime? iapTime(Object? v) {
  if (v is num && v > 0) {
    return DateTime.fromMillisecondsSinceEpoch(v.toInt(), isUtc: true);
  }
  if (v is String && v.isNotEmpty) {
    final n = int.tryParse(v);
    if (n != null && n > 0) {
      return DateTime.fromMillisecondsSinceEpoch(n, isUtc: true);
    }
    return DateTime.tryParse(v);
  }
  return null;
}

int _int(Object? v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;

/// Ko'tarish paketi — App Store mahsuloti va kun soni.
class BoostPackage {
  const BoostPackage({required this.productId, required this.days});
  final String productId;
  final int days;
}

/// `boost-intent` javobi.
class BoostIntent {
  const BoostIntent({
    required this.intentId,
    required this.productId,
    required this.days,
    this.holdUntil,
  });

  final int intentId;
  final String productId;
  final int days;
  final DateTime? holdUntil;

  factory BoostIntent.fromJson(Map<String, dynamic> j) => BoostIntent(
        intentId: _int(j['intentId']),
        productId: '${j['productId'] ?? ''}',
        days: _int(j['days']),
        holdUntil: iapTime(j['holdUntil']),
      );
}

enum BoostStatus { active, credited, revoked, unknown }

/// `verify` (consumable) va `boost-redeem` natijasi.
class BoostResult {
  const BoostResult({
    required this.status,
    this.slotId = 0,
    this.startsAt,
    this.endsAt,
    this.creditId = 0,
    this.days = 0,
  });

  final BoostStatus status;
  final int slotId;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final int creditId;
  final int days;

  factory BoostResult.fromJson(Map<String, dynamic> j) {
    final slot = j['slot'] is Map
        ? (j['slot'] as Map).cast<String, dynamic>()
        : const <String, dynamic>{};
    return BoostResult(
      status: switch ('${j['boost'] ?? ''}') {
        'active' => BoostStatus.active,
        'credited' => BoostStatus.credited,
        'revoked' => BoostStatus.revoked,
        _ => BoostStatus.unknown,
      },
      slotId: _int(slot['id']),
      startsAt: iapTime(slot['startsAt']),
      endsAt: iapTime(slot['endsAt']),
      creditId: _int(j['creditId']),
      days: _int(j['days']),
    );
  }
}

/// Ishlatilmagan ko'tarish krediti (to'langan, joy band bo'lgan).
class BoostCredit {
  const BoostCredit({
    required this.creditId,
    required this.days,
    this.productId = '',
    this.createdAt,
  });

  final int creditId;
  final int days;
  final String productId;
  final DateTime? createdAt;

  factory BoostCredit.fromJson(Map<String, dynamic> j) => BoostCredit(
        creditId: _int(j['creditId']),
        days: _int(j['days']),
        productId: '${j['productId'] ?? ''}',
        createdAt: iapTime(j['createdAt']),
      );
}

/// Server kaliti va sotuvdagi mahsulotlar.
class IapConfig {
  const IapConfig({
    this.enabled = false,
    this.products = const [],
    this.boostEnabled = false,
    this.boostProducts = const [],
  });

  /// O'chiq — hech qanday xarid UI yo'q.
  static const disabled = IapConfig();

  final bool enabled;

  /// App Store mahsulot identifikatorlari — tartibi ekrandagi tartib.
  final List<String> products;

  /// KO'TARISH (Apple consumable) kaliti — Premium kalitidan ALOHIDA.
  final bool boostEnabled;

  /// 1 / 3 / 6 kunlik paketlar (server tartibida).
  final List<BoostPackage> boostProducts;

  factory IapConfig.fromJson(Map<String, dynamic> j) {
    final raw = j['products'];
    final products = raw is List
        ? raw.map((e) => '$e').where((e) => e.isNotEmpty).toList()
        : const <String>[];
    final rawBoost = j['boostProducts'];
    final boost = rawBoost is List
        ? rawBoost
            .whereType<Map>()
            .map((e) => BoostPackage(
                productId: '${e['productId'] ?? ''}', days: _int(e['days'])))
            .where((b) => b.productId.isNotEmpty && b.days > 0)
            .toList()
        : const <BoostPackage>[];
    return IapConfig(
      // Mahsulotsiz yoqilgan kalit — sotadigan narsa yo'q, ya'ni o'chiq.
      enabled: j['enabled'] == true && products.isNotEmpty,
      products: products,
      boostEnabled: j['boostEnabled'] == true && boost.isNotEmpty,
      boostProducts: boost,
    );
  }
}

/// `verify` natijasi (HTTP 200).
class IapVerifyResult {
  const IapVerifyResult({
    required this.premium,
    this.expiresAt,
    this.productId = '',
    this.reason = '',
  });

  final bool premium;
  final DateTime? expiresAt;
  final String productId;

  /// `premium: false` bo'lganda: `expired` | `revoked`.
  final String reason;

  factory IapVerifyResult.fromJson(Map<String, dynamic> j) => IapVerifyResult(
        premium: j['premium'] == true,
        expiresAt: _date(j['premiumExpiresAt']),
        productId: '${j['productId'] ?? ''}',
        reason: '${j['reason'] ?? ''}',
      );

  static DateTime? _date(Object? v) {
    if (v is int) return DateTime.fromMillisecondsSinceEpoch(v, isUtc: true);
    if (v is String && v.isNotEmpty) return DateTime.tryParse(v);
    return null;
  }
}

final iapRepositoryProvider = Provider<IapRepository>(
  (ref) => IapRepository(ref.watch(apiProvider)),
);
