import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';
import '../models/models.dart';

/// NFCSTORE do'koni, buyurtmalar va to'lovlar.
class ShopRepository {
  ShopRepository(this._api);
  final ApiClient _api;

  /// JISMONIY NFC KARTA — do'kondagi yagona mahsulot.
  ///
  /// `/api/settings/physical-nfc-pricing` mahsulot RO'YXATI BERMAYDI:
  ///
  ///     { tiers: [{minQty, maxQty, pricePerUnit}],
  ///       delivery: {minDays, maxDays}, physicalCardFee }
  ///
  /// Ilgari bu yerda `items`/`products` o'qilardi — server ularni hech
  /// qachon yubormagan, do'kon DOIM bo'sh edi. Endi bitta mahsulot
  /// quriladi: narxi — `physicalCardFee` (karta buyurtmasidagi bilan
  /// bitta manba), `tiers` — ko'p dona narxlari, `delivery` — muddat.
  /// Hech narsa ilovada yozilmaydi.
  Future<Result<List<ShopProduct>>> products() async {
    final res = await _api
        .get<Map<String, dynamic>>('/api/settings/physical-nfc-pricing');
    return res.map(physicalProductsFromPricing);
  }

  /// Narx javobidan mahsulot(lar) — testda tarmoqsiz sinaladi.
  static List<ShopProduct> physicalProductsFromPricing(Map<String, dynamic> j) {
    final tiers = parseList(j['tiers'], PriceTier.fromJson)
        .where((t) => t.pricePerUnit > 0)
        .toList()
      ..sort((a, b) => a.minQty.compareTo(b.minQty));
    final fee = j['physicalCardFee'];
    final price = fee is num && fee > 0
        ? fee.toInt()
        : (tiers.isEmpty ? 0 : tiers.first.pricePerUnit);
    if (price <= 0) return const [];
    final d = j['delivery'];
    int? day(Object? v) => v is num && v > 0 ? v.toInt() : null;
    return [
      ShopProduct(
        id: kPhysicalCardId,
        price: price,
        priceTiers: tiers,
        deliveryMinDays: d is Map ? day(d['minDays']) : null,
        deliveryMaxDays: d is Map ? day(d['maxDays']) : null,
      ),
    ];
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

  // ═══════════════════════════════════════════════════════════════
  // SHAXSIY NFC ID XARIDI
  //
  // Bu yerda ILOVA UCHUN ALOHIDA katalog, alohida narx jadvali yoki
  // alohida to'lov backendi YO'Q. Hammasi saytning O'SHA
  // endpointlaridan — `hosting/worker.js`:
  //
  //   GET  /api/settings/id-pricing     darajalar va narxlar
  //   GET  /api/records/:code/quote     kod bo'shmi, narxi qancha
  //   POST /api/records/:code           buyurtma (narxni SERVER qo'yadi)
  //   GET  /api/orders/:id              holat
  //   GET  /api/orders                  to'lovlar tarixi
  //
  // Narx hech qachon ilovada yozilmaydi va klientdan yuborilmaydi.
  // ═══════════════════════════════════════════════════════════════

  /// Daraja narxlari — katalog shu ro'yxatdan chiziladi.
  Future<Result<List<IdTier>>> idPricing() async {
    final res = await _api.get<Map<String, dynamic>>('/api/settings/id-pricing');
    return res.map((j) => parseList(j['tiers'], IdTier.fromJson));
  }

  /// Kod holati — BAND QILMAYDI, faqat o'qiydi.
  Future<Result<IdQuote>> idQuote(String code) async {
    final res = await _api
        .get<Map<String, dynamic>>('/api/records/${code.toUpperCase()}/quote');
    return res.map(IdQuote.fromJson);
  }

  /// Buyurtma yaratish.
  ///
  /// SUMMA YUBORILMAYDI. Server uni `personalPurchaseQuote()` bilan
  /// o'zi hisoblaydi; klient yuborgan narx e'tiborga olinmaydi
  /// (`scripts/test-nova-id-purchase.mjs` shuni tekshiradi). Shu
  /// sabab bu yerda `price` parametri ATAYLAB yo'q — bo'lsa, kimdir
  /// uni "tezlik uchun" yuborib qo'yishi va ikkala tomonda ikki xil
  /// summa paydo bo'lishi mumkin edi.
  Future<Result<IdOrderDraft>> buyId({
    required String code,
    required String name,
    String role = '',
    String phone = '',
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/api/records/${code.toUpperCase()}',
      {
        'name': name,
        if (role.isNotEmpty) 'role': role,
        if (phone.isNotEmpty) 'phone': phone,
      },
    );
    return res.map(IdOrderDraft.fromJson);
  }
}

final shopRepositoryProvider = Provider<ShopRepository>(
  (ref) => ShopRepository(ref.watch(apiProvider)),
);
