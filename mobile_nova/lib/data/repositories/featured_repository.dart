import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';
import '../models/models.dart';

/// NFCSTORE FEATURED — postni pul evaziga lentaning boshiga qo'yish.
///
/// ## NARXNI ILOVA HISOBLAMAYDI
///
/// So'rovda FAQAT `days` yuboriladi. Narx serverda, paketlar
/// jadvalidan olinadi. Ilova narx yuborsa ham u e'tiborsiz
/// qoladi — aks holda so'rovni qo'lda yuborgan odam 6 kunlik
/// slotni 1 so'mga olardi.
///
/// ## SLOTNI ILOVA YOQMAYDI
///
/// `buy()` faqat KUTILAYOTGAN buyurtma ochadi va to'lov
/// havolasini qaytaradi. Slot Payme yoki Click tasdiqlagandan
/// keyin, SERVERDA yonadi. Ilovada "to'landi" deb belgilash
/// imkoniyati umuman yo'q.
class FeaturedRepository {
  FeaturedRepository(this._api);
  final ApiClient _api;

  /// Sotuvdagi paketlar (1 / 3 / 6 kun) va to'lovlar yoqilganmi.
  Future<Result<FeaturedOffer>> packages() async {
    final res = await _api.get<Map<String, dynamic>>('/api/featured/packages');
    return res.map((j) => FeaturedOffer(
          packages: parseList(j['packages'], FeaturedPackage.fromJson),
          enabled: j['enabled'] == true,
        ));
  }

  /// Mening slotlarim — kutilayotgani ham, faoli ham.
  Future<Result<List<FeaturedSlot>>> mine() async {
    final res = await _api.get<Map<String, dynamic>>('/api/featured/mine');
    return res.map((j) => parseList(j['slots'], FeaturedSlot.fromJson));
  }

  /// Slot sotib olish — KUTILAYOTGAN buyurtma ochadi.
  Future<Result<FeaturedPurchase>> buy({
    required String targetKind,
    required int targetId,
    required int days,
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/api/featured',
      // NARX YUBORILMAYDI — faqat kun soni. Serverda hisoblanadi.
      {'targetKind': targetKind, 'targetId': targetId, 'days': days},
    );
    return res.map((j) => FeaturedPurchase(
          slot: FeaturedSlot.fromJson(
              (j['slot'] as Map?)?.cast<String, dynamic>() ?? const {}),
          orderId: j['orderId'] is int ? j['orderId'] as int : 0,
          payme: '${(j['payLinks'] as Map?)?['payme'] ?? ''}',
          click: '${(j['payLinks'] as Map?)?['click'] ?? ''}',
        ));
  }

  /// To'lanmagan slotni bekor qilish.
  ///
  /// TO'LANGANINI bekor qilib bo'lmaydi: pul olingan va e'lon
  /// ko'rsatilgan. Pulni qaytarish — moliyaviy qaror, u admin
  /// qo'lida (server 409 qaytaradi).
  Future<Result<void>> cancel(int slotId) =>
      _api.post<void>('/api/featured/$slotId/cancel');
}

/// Paketlar + to'lov holati.
class FeaturedOffer {
  const FeaturedOffer({this.packages = const [], this.enabled = false});
  final List<FeaturedPackage> packages;

  /// To'lovlar butunlay o'chirilgan bo'lsa, ilova tugmani
  /// ko'rsatmaydi — bosilgach 503 chiqishidan ko'ra yaxshiroq.
  final bool enabled;
}

/// Sotib olish natijasi — to'lov havolalari bilan.
class FeaturedPurchase {
  const FeaturedPurchase({
    required this.slot,
    this.orderId = 0,
    this.payme = '',
    this.click = '',
  });

  final FeaturedSlot slot;
  final int orderId;
  final String payme;
  final String click;

  bool get hasLink => payme.isNotEmpty || click.isNotEmpty;
}

final featuredRepositoryProvider = Provider<FeaturedRepository>(
  (ref) => FeaturedRepository(ref.watch(apiProvider)),
);

/// Sotuvdagi paketlar.
final featuredPackagesProvider =
    FutureProvider.autoDispose<FeaturedOffer>((ref) async {
  final res = await ref.watch(featuredRepositoryProvider).packages();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Mening slotlarim.
final myFeaturedProvider =
    FutureProvider.autoDispose<List<FeaturedSlot>>((ref) async {
  final res = await ref.watch(featuredRepositoryProvider).mine();
  return res.when(ok: (v) => v, err: (e) => throw e);
});
