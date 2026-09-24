import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../data/models/models.dart';
import '../../data/repositories/business_repository.dart';
import '../auth/session.dart';

/// Foydalanuvchining biznes hisoblari.
// RIVERPOD `dependencies` — DEMO DARAXTI UCHUN SHART.
//
// "NFC Mobile" demo ekranlari repozitoriylarni ichki
// `ProviderScope` da almashtiradi. Riverpod esa almashtirilgan
// provayderga TAYANADIGAN har bir provayderdan buni OLDINDAN
// e'lon qilishni talab qiladi — aks holda u ichki doirada qayta
// yaratilmaydi va "Tried to read ... from a place where one of
// its dependencies were overridden" xatosi chiqadi.
//
// Ishlab chiqarish xulqi O'ZGARMAYDI.
//
// SESSIYAGA BOG'LANGAN. Ro'yxat kirgan odamga tegishli, shuning uchun
// hisob almashganda (chiqish → boshqa hisob bilan kirish) yoki
// kirishdan OLDIN yuklanib xato eslab qolinganda qayta so'raladi.
// Ilgari u ilova ochilganda bir marta yuklanardi: kirish tugamasdan
// kelgan 401 abadiy eslab qolinib, "Biznes" tugmasi jim qolardi;
// boshqa hisobga o'tilganda esa oldingi odamning kompaniyalari
// ko'rinib turardi.
final myBusinessesProvider = FutureProvider<List<Business>>(dependencies: [businessRepositoryProvider, currentUserProvider], (ref) async {
  final userId = ref.watch(currentUserProvider.select((u) => u?.id));
  if (userId == null) return const <Business>[];
  final res = await ref.watch(businessRepositoryProvider).mine();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Joriy tanlangan biznes — birinchisi, agar boshqasi tanlanmagan bo'lsa.
final selectedBusinessProvider = StateProvider<String?>((ref) {
  try {
    return ref.watch(prefsProvider).selectedBusiness;
  } catch (_) {
    return null;
  }
});

/// Tanlangan kompaniyani eslab qolish (holat + telefon xotirasi).
///
/// `ref` faqat birinchi `await` gacha — `selectPersonal` dagi sabab bilan.
Future<void> rememberBusiness(WidgetRef ref, String companyId) async {
  final prefs = ref.read(prefsProvider);
  ref.read(selectedBusinessProvider.notifier).state = companyId;
  try {
    await prefs.setSelectedBusiness(companyId);
  } catch (_) {/* xotira yo'q — faqat shu sessiya */}
}

final activeBusinessProvider = Provider<Business?>((ref) {
  final list = ref.watch(myBusinessesProvider).valueOrNull ?? const <Business>[];
  if (list.isEmpty) return null;
  final id = ref.watch(selectedBusinessProvider);
  if (id == null) return list.first;
  return list.where((e) => e.companyId == id).firstOrNull ?? list.first;
});

final businessCatalogProvider =
    FutureProvider.autoDispose.family<List<CatalogItem>, String>(dependencies: [businessRepositoryProvider], (ref, id) async {
  final res = await ref.watch(businessRepositoryProvider).catalog(id);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

final storefrontProvider =
    FutureProvider.autoDispose.family<Business, String>(dependencies: [businessRepositoryProvider], (ref, id) async {
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
  dependencies: [businessRepositoryProvider],
  (ref, companyId) async {
    final res = await ref.watch(businessRepositoryProvider).stats(companyId);
    return res.when(ok: (v) => v, err: (e) => throw e);
  },
);
