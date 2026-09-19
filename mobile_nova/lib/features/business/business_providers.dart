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
