import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';
import '../models/models.dart';

/// Biznes hisobi va katalog (backend: Company Account v2).
class BusinessRepository {
  BusinessRepository(this._api);
  final ApiClient _api;

  Future<Result<List<Business>>> mine() async {
    final res = await _api.get<Map<String, dynamic>>('/api/companies/mine');
    return res.map((j) => parseList(j['companies'], Business.fromJson));
  }

  Future<Result<Business>> byId(String companyId) async {
    final res = await _api.get<Map<String, dynamic>>('/api/companies/$companyId');
    final v = res.valueOrNull;
    if (res case Err(:final error)) return Err(error);
    return Ok(Business.fromJson(
        ((v!['company'] ?? v) as Map).cast<String, dynamic>()));
  }

  /// Manzil bo'shmi va qanchaga tushadi.
  ///
  /// Narx backend'dagi `tier` dan keladi: qisqa manzil qimmatroq.
  /// Ilova narxni O'ZI hisoblamaydi.
  Future<Result<({bool valid, bool available, String tier, int price})>>
      checkId(String id) async {
    final res =
        await _api.get<Map<String, dynamic>>('/api/companies/check', query: {'id': id});
    return res.map((j) => (
          valid: j['valid'] == true,
          available: j['available'] == true,
          tier: '${j['tier'] ?? ''}',
          price: (j['price'] as num?)?.toInt() ?? 0,
        ));
  }

  Future<Result<Business>> create(Map<String, dynamic> body) async {
    final res = await _api.post<Map<String, dynamic>>('/api/companies', body);
    return res.map((j) =>
        Business.fromJson(((j['company'] ?? j) as Map).cast<String, dynamic>()));
  }

  /// Server bu yerda PATCH kutadi (`app.patch('/api/companies/:companyId')`).
  /// Ilgari PUT yuborilardi — server uni umuman qabul qilmasdi, ya'ni
  /// "saqlash" tugmasi hech qachon ishlamagan.
  Future<Result<void>> update(String companyId, Map<String, dynamic> body) =>
      _api.patch<void>('/api/companies/$companyId', body);

  /// Moderatsiyaga yuborish.
  Future<Result<void>> submit(String companyId) =>
      _api.post<void>('/api/companies/$companyId/submit');

  Future<Result<List<Business>>> search(String q) async {
    final res = await _api
        .get<Map<String, dynamic>>('/api/companies/search', query: {'q': q});
    return res.map((j) => parseList(j['companies'] ?? j['items'], Business.fromJson));
  }

  // ---- katalog ------------------------------------------------------------

  /// Kompaniya katalogi.
  ///
  /// `/api/companies/:id/catalog` da FAQAT yozish amallari bor (POST,
  /// PATCH, DELETE) — o'qish uchun alohida endpoint yo'q. Katalog
  /// kompaniyaning o'zi bilan birga keladi: `GET /api/companies/:id`
  /// javobidagi `company.catalog`. Ilgari bu yerda mavjud bo'lmagan
  /// GET chaqirilardi va katalog hech qachon yuklanmasdi.
  Future<Result<List<CatalogItem>>> catalog(String companyId) async {
    final res = await _api.get<Map<String, dynamic>>('/api/companies/$companyId');
    return res.map((j) {
      final company = (j['company'] ?? j) as Map;
      return parseList(company['catalog'], CatalogItem.fromJson);
    });
  }

  Future<Result<CatalogItem>> addItem(
          String companyId, Map<String, dynamic> body) async {
    final res = await _api
        .post<Map<String, dynamic>>('/api/companies/$companyId/catalog', body);
    return res.map((j) =>
        CatalogItem.fromJson(((j['item'] ?? j) as Map).cast<String, dynamic>()));
  }

  Future<Result<void>> updateItem(
          String companyId, int itemId, Map<String, dynamic> body) =>
      // Server PATCH kutadi, PUT emas.
      _api.patch<void>('/api/companies/$companyId/catalog/$itemId', body);

  Future<Result<void>> deleteItem(String companyId, int itemId) =>
      _api.delete<void>('/api/companies/$companyId/catalog/$itemId');

  // ---- NFC ID ostidagi katalog -------------------------------------------
  // Restoran menyusi, do'kon mahsulotlari va xizmatlar backend'da
  // NFC ID (record) ostida ham turadi. Bitta universal kirish nuqtasi.

  Future<Result<List<CatalogItem>>> recordCatalog(String code, CatalogKind kind) async {
    final res = await _api.get<Map<String, dynamic>>('/api/records/$code/${kind.path}');
    return res.map((j) =>
        parseList(j['items'] ?? j[kind.path] ?? j['products'], CatalogItem.fromJson));
  }

  Future<Result<List<CatalogCategory>>> recordCategories(
      String code, CatalogKind kind) async {
    final res =
        await _api.get<Map<String, dynamic>>('/api/records/$code/${kind.path}/categories');
    return res.map(
        (j) => parseList(j['categories'] ?? j['items'], CatalogCategory.fromJson));
  }

  Future<Result<CatalogItem>> addRecordItem(
      String code, CatalogKind kind, Map<String, dynamic> body) async {
    final res = await _api
        .post<Map<String, dynamic>>('/api/records/$code/${kind.path}/items', body);
    return res.map((j) =>
        CatalogItem.fromJson(((j['item'] ?? j) as Map).cast<String, dynamic>()));
  }

  Future<Result<void>> updateRecordItem(
          String code, CatalogKind kind, int id, Map<String, dynamic> body) =>
      _api.put<void>('/api/records/$code/${kind.path}/items/$id', body);

  Future<Result<void>> deleteRecordItem(String code, CatalogKind kind, int id) =>
      _api.delete<void>('/api/records/$code/${kind.path}/items/$id');

  /// Vitrina ko'rsatkichlari.
  Future<Result<Map<String, dynamic>>> analytics(String code) =>
      _api.get<Map<String, dynamic>>('/api/records/$code/analytics');
}

/// Backend uchta katalog turini alohida yo'lda saqlaydi.
enum CatalogKind {
  products('products'),
  services('services'),
  menu('menu');

  const CatalogKind(this.path);
  final String path;
}

final businessRepositoryProvider = Provider<BusinessRepository>(
  (ref) => BusinessRepository(ref.watch(apiProvider)),
);
