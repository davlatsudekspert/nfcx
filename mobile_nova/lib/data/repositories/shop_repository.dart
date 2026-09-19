import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/errors/app_error.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';
import '../models/models.dart';

/// To'lov provayderi — backend `/api/settings/payments-enabled` orqali
/// qaysilari YOQILGANINI aytadi. Ilova ro'yxatni o'zi to'qimaydi.
enum PayProvider { payme, click, paynet }

/// NFCSTORE do'koni, buyurtmalar va to'lovlar.
class ShopRepository {
  ShopRepository(this._api);
  final ApiClient _api;

  /// Sotuvdagi NFC ID narxlari — daraja (tier) bo'yicha.
  Future<Result<List<ShopProduct>>> products({String? category}) async {
    final res = await _api.get<Map<String, dynamic>>(
      '/api/settings/physical-nfc-pricing',
      query: {if (category != null) 'category': category},
    );
    return res.map((j) =>
        parseList(j['items'] ?? j['products'] ?? j['pricing'], ShopProduct.fromJson));
  }

  Future<Result<List<String>>> categories() async {
    final res = await _api.get<Map<String, dynamic>>('/api/categories');
    return res.map((j) {
      final raw = j['categories'] ?? j['items'];
      return raw is List ? raw.map((e) => '$e').toList() : <String>[];
    });
  }

  /// Jismoniy karta buyurtmasi.
  Future<Result<Order>> orderPhysicalCard({
    required String code,
    required Map<String, dynamic> body,
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
        '/api/records/$code/order-physical-card', body);
    return res.map(
        (j) => Order.fromJson(((j['order'] ?? j) as Map).cast<String, dynamic>()));
  }

  Future<Result<List<Order>>> orders() async {
    final res = await _api.get<Map<String, dynamic>>('/api/orders');
    return res.map((j) => parseList(j['orders'] ?? j['items'], Order.fromJson));
  }

  Future<Result<Order>> order(int id) async {
    final res = await _api.get<Map<String, dynamic>>('/api/orders/$id');
    return res
        .map((j) => Order.fromJson(((j['order'] ?? j) as Map).cast<String, dynamic>()));
  }

  Future<Result<List<Map<String, dynamic>>>> payments() async {
    final res = await _api.get<Map<String, dynamic>>('/api/payments');
    return res.map((j) {
      final raw = j['payments'] ?? j['items'];
      return raw is List
          ? raw.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
          : <Map<String, dynamic>>[];
    });
  }

  Future<Result<Map<String, dynamic>>> paymentStatus(int orderId) =>
      _api.get<Map<String, dynamic>>('/api/payments/$orderId');

  /// Qaysi to'lov tizimlari YOQILGAN.
  ///
  /// NIMA UCHUN MUHIM: agar hech biri yoqilmagan bo'lsa, ilova
  /// "to'lash" tugmasini ko'rsatib, keyin foydalanuvchini bo'sh
  /// ekranga olib borishi mumkin emas. Buning o'rniga CONFIG REQUIRED
  /// holati ko'rsatiladi.
  Future<Result<Set<PayProvider>>> enabledProviders() async {
    final res = await _api.get<Map<String, dynamic>>('/api/settings/payments-enabled');
    return res.map((j) {
      final out = <PayProvider>{};
      for (final p in PayProvider.values) {
        final v = j[p.name];
        if (v == true || v == 1 || v == 'true') out.add(p);
      }
      // Ro'yxat ko'rinishida kelgan variant.
      final list = j['providers'];
      if (list is List) {
        for (final e in list) {
          final m = PayProvider.values.where((p) => p.name == '$e');
          if (m.isNotEmpty) out.add(m.first);
        }
      }
      return out;
    });
  }

  /// To'lov sahifasiga o'tish havolasi.
  ///
  /// Provayder sozlanmagan bo'lsa bu yerda SOXTA muvaffaqiyat
  /// qaytarilmaydi — `AppErrorKind.endpointMissing` chiqadi va ekran
  /// CONFIG REQUIRED holatini ko'rsatadi.
  Future<Result<String>> startPayment({
    required PayProvider provider,
    required int orderId,
  }) async {
    final path = switch (provider) {
      PayProvider.payme => '/api/pay/payme',
      PayProvider.click => '/api/pay/click/prepare',
      PayProvider.paynet => '/api/pay/paynet/webhook',
    };
    final res = await _api.post<Map<String, dynamic>>(path, {'orderId': orderId});
    return switch (res) {
      Err(:final error) => Err(error),
      Ok(:final value) => () {
          final url = '${value['url'] ?? value['payUrl'] ?? value['checkoutUrl'] ?? ''}';
          if (url.isEmpty) {
            return const Err<String>(AppError(
              AppErrorKind.endpointMissing,
              code: 'payment_not_configured',
            ));
          }
          return Ok(url);
        }(),
    };
  }
}

final shopRepositoryProvider = Provider<ShopRepository>(
  (ref) => ShopRepository(ref.watch(apiProvider)),
);
