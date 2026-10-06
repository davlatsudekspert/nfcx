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
  /// (`reason: expired | revoked`). Boshqasi — `Err`: 403
  /// `account_mismatch`, 409 `already_linked`, 503 `iap_disabled`,
  /// tarmoq xatosi.
  Future<Result<IapVerifyResult>> verify(String signedTransaction) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/api/iap/apple/verify',
      {'signedTransaction': signedTransaction},
    );
    return res.map(IapVerifyResult.fromJson);
  }
}

/// Server kaliti va sotuvdagi mahsulotlar.
class IapConfig {
  const IapConfig({this.enabled = false, this.products = const []});

  /// O'chiq — hech qanday xarid UI yo'q.
  static const disabled = IapConfig();

  final bool enabled;

  /// App Store mahsulot identifikatorlari — tartibi ekrandagi tartib.
  final List<String> products;

  factory IapConfig.fromJson(Map<String, dynamic> j) {
    final raw = j['products'];
    final products = raw is List
        ? raw.map((e) => '$e').where((e) => e.isNotEmpty).toList()
        : const <String>[];
    return IapConfig(
      // Mahsulotsiz yoqilgan kalit — sotadigan narsa yo'q, ya'ni o'chiq.
      enabled: j['enabled'] == true && products.isNotEmpty,
      products: products,
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
