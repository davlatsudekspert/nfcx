import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/models.dart';
import '../../data/repositories/business_repository.dart';

/// Foydalanuvchining biznes hisoblari.
final myBusinessesProvider = FutureProvider<List<Business>>((ref) async {
  final res = await ref.watch(businessRepositoryProvider).mine();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Joriy tanlangan biznes — birinchisi, agar boshqasi tanlanmagan bo'lsa.
final selectedBusinessProvider = StateProvider<String?>((_) => null);

final activeBusinessProvider = Provider<Business?>((ref) {
  final list = ref.watch(myBusinessesProvider).valueOrNull ?? const <Business>[];
  if (list.isEmpty) return null;
  final id = ref.watch(selectedBusinessProvider);
  if (id == null) return list.first;
  return list.where((e) => e.companyId == id).firstOrNull ?? list.first;
});

final businessCatalogProvider =
    FutureProvider.autoDispose.family<List<CatalogItem>, String>((ref, id) async {
  final res = await ref.watch(businessRepositoryProvider).catalog(id);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

final storefrontProvider =
    FutureProvider.autoDispose.family<Business, String>((ref, id) async {
  final res = await ref.watch(businessRepositoryProvider).byId(id);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// KOMPANIYA STATISTIKASI — `GET /api/companies/:id/stats`.
///
/// Ilgari analitika ekrani HECH QANDAY statistika endpointini
/// chaqirmasdi: u faqat kompaniya yozuvidagi `views`, obunachilar
/// soni va katalog elementlari sonini ko'rsatardi. Repozitoriyadagi
/// `analytics()` esa KARTA yo'liga borardi va 403 olardi.
final businessStatsProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
  (ref, companyId) async {
    final res = await ref.watch(businessRepositoryProvider).stats(companyId);
    return res.when(ok: (v) => v, err: (e) => throw e);
  },
);
