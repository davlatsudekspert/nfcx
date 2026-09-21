import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/errors/app_error.dart';
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

  // `recordCategories` OLIB TASHLANDI.
  //
  // U `GET /api/records/:code/:kind/categories` ga murojaat
  // qilardi — server esa bu yo'lni faqat POST/PUT/DELETE bilan
  // biladi (`hosting/api/catalog.js`), GET umuman yo'q. Ya'ni
  // metod chaqirilganda DOIM 404 qaytarardi.
  //
  // Ilovada uni hech kim chaqirmasdi, shuning uchun sezilmagan.
  // Yangi qo'riqchi (`scripts/test-nova-api-parity.mjs`) topdi.
  //
  // Serverga GET qo'shilmadi: kategoriyalar allaqachon
  // `recordCatalog()` javobi bilan birga keladi (har bir
  // kategoriya o'z elementlari bilan). Hech kim chaqirmaydigan
  // metod uchun yangi endpoint yozish — bo'lmagan ishni
  // o'ylab topish.

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
  /// Kompaniya posti YARATISH.
  ///
  /// Shaxsiy post bilan bir xil shakl (`imageUrl`/`videoUrl`,
  /// `caption`, `agreed`), lekin BOSHQA manzil. Ilgari biznes
  /// rejimida ham shaxsiy yo'l chaqirilardi — ya'ni biznes
  /// profilida turib yaratilgan post SHAXSIY profilga tushardi.
  Future<Result<void>> createPost({
    required String companyId,
    String caption = '',
    String imageUrl = '',
    String videoUrl = '',
  }) {
    if (imageUrl.isEmpty && videoUrl.isEmpty) {
      return Future.value(const Err(AppError(
        AppErrorKind.validation,
        code: 'bad_image',
        detail: 'post uchun rasm yoki video majburiy',
      )));
    }
    return _api.post<void>('/api/companies/$companyId/posts', {
      if (imageUrl.isNotEmpty) 'imageUrl': imageUrl,
      if (videoUrl.isNotEmpty) 'videoUrl': videoUrl,
      'caption': caption,
      'agreed': true,
    });
  }

  /// Kompaniya istoryasi yaratish.
  Future<Result<void>> createStory({
    required String companyId,
    String imageUrl = '',
    String videoUrl = '',
    String caption = '',
  }) {
    if (imageUrl.isEmpty && videoUrl.isEmpty) {
      return Future.value(const Err(AppError(
        AppErrorKind.validation,
        code: 'bad_image',
        detail: 'istorya uchun rasm yoki video majburiy',
      )));
    }
    return _api.post<void>('/api/companies/$companyId/stories', {
      if (imageUrl.isNotEmpty) 'imageUrl': imageUrl,
      if (videoUrl.isNotEmpty) 'videoUrl': videoUrl,
      'caption': caption,
      'agreed': true,
    });
  }

  /// Kompaniya postlari — `/api/companies/:id/posts`.
  ///
  /// Javob shakli `Post.fromJson` ga TO'G'RIDAN-TO'G'RI mos keladi:
  /// `{id, code, authorName, authorAvatar, imageUrl, videoUrl,
  /// caption, createdAt, likeCount, liked}`.
  Future<Result<List<Post>>> posts(String companyId) async {
    final res = await _api
        .get<Map<String, dynamic>>('/api/companies/$companyId/posts');
    return res.map((j) => parseList(j['posts'] ?? j['items'], Post.fromJson)
        .map((p) => p.copyWithKind(authorKind: 'company'))
        .toList());
  }

  /// Kompaniya istoryalari — `/api/companies/:id/stories`.
  Future<Result<List<StoryItem>>> stories(String companyId) async {
    final res = await _api
        .get<Map<String, dynamic>>('/api/companies/$companyId/stories');
    return res.map((j) => parseList(j['stories'] ?? j['items'], StoryItem.fromJson));
  }

  /// KOMPANIYA STATISTIKASI — haqiqiy endpoint.
  ///
  /// ## NIMA UCHUN `/api/records/:code/analytics` EMAS
  ///
  /// U yo'l KARTA (NFC yozuvi) uchun yozilgan: `ownerOnly(code)` +
  /// `cardEventStats(code)`. Kompaniya karta emas, shuning uchun
  /// har safar 403 `forbidden` qaytarardi va E2E buni PARTIAL deb
  /// ko'rsatardi.
  ///
  /// Haqiqiy yo'l serverda ALLAQACHON bor va u boshqacha nomlangan
  /// — `stats`, `analytics` emas:
  ///
  ///     GET /api/companies/:id/stats?days=30
  ///
  /// U `company_stats` jadvalidan o'qiydi (kun bo'yicha yig'ilgan
  /// `view`/`action`/`item` hodisalari) va quyidagini qaytaradi:
  /// `views`, `taps`, `orders`, kunlik `series`, eng ko'p bosilgan
  /// `actions` va `items`. Egalik `requireCompanyOwner` bilan
  /// tekshiriladi, ya'ni begona kompaniya statistikasi ko'rinmaydi.
  ///
  /// Server `days` ni 7..90 oralig'iga qisadi.
  Future<Result<Map<String, dynamic>>> stats(
    String companyId, {
    int days = 30,
  }) =>
      _api.get<Map<String, dynamic>>(
        '/api/companies/$companyId/stats',
        query: {'days': days},
      );
}

/// Backend uchta katalog turini alohida yo'lda saqlaydi.
enum CatalogKind {
  products('products'),
  services('services'),
  menu('menu');

  const CatalogKind(this.path);
  final String path;

  /// BIZNES YO'NALISHIGA MOS KATALOG TURI.
  ///
  /// Qoida SERVERDAN ko'chirilgan — `hosting/api/catalog.js`
  /// dagi `businessModule()`:
  ///
  ///     food*   -> menyu
  ///     retail* -> mahsulotlar
  ///     qolgan  -> xizmatlar
  ///
  /// NIMA UCHUN KERAK. Server noto'g'ri turga yozishni RAD ETADI
  /// (403 `not_business` / `not_restaurant` /
  /// `not_service_business`). Ya'ni restoran profiliga "mahsulot"
  /// qo'shib bo'lmaydi — va bu to'g'ri qoida.
  ///
  /// E2E sinovi aynan shu yerda yiqilardi: u DOIM `products`
  /// so'rardi va hisobdagi biznes yozuvi xizmat yo'nalishida
  /// bo'lgani uchun server 403 qaytarardi. Sinov buni
  /// ilovaning kamchiligi deb yozardi, aslida esa SINOV noto'g'ri
  /// turni so'rayotgan edi.
  ///
  /// SERVER QOIDASI YUMSHATILMADI — mijoz to'g'ri turni
  /// so'raydigan qilindi.
  static CatalogKind forCategory(String slug) {
    final s = slug.toLowerCase();
    if (s == 'food' || s.startsWith('food-')) return CatalogKind.menu;
    if (s == 'retail' || s.startsWith('retail-')) return CatalogKind.products;
    return CatalogKind.services;
  }
}

final businessRepositoryProvider = Provider<BusinessRepository>(
  (ref) => BusinessRepository(ref.watch(apiProvider)),
);
