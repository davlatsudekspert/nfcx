import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';
import '../models/models.dart';

/// Qidiruv va kashfiyot.
class DiscoverRepository {
  DiscoverRepository(this._api);
  final ApiClient _api;

  /// Odamlar va NFC ID'lar bo'yicha qidiruv.
  Future<Result<List<NfcId>>> searchPeople(String q) async {
    // `/api/people/search` — ijtimoiy ro'yxat: yangi ro'yxatdan
    // o'tganlar (avtomatik 8 xonali ID) ham topiladi. `/api/records/search`
    // saytdagi SOTUV katalogi edi va ularni ataylab yashirardi.
    final res =
        await _api.get<Map<String, dynamic>>('/api/people/search', query: {'q': q});
    return res.map((j) => parseList(j['records'] ?? j['items'], NfcId.fromJson));
  }

  /// BIZNES QIDIRUVI — ommaviy kompaniyalar ro'yxati ichidan.
  ///
  /// Ilgari `/api/companies/search` chaqirilardi. U kompaniyalarni EMAS,
  /// biznes turidagi NFC yozuvlarini `results` kalitida qaytaradi, ilova
  /// esa `companies` ni o'qirdi — ya'ni qidiruv HAR DOIM bo'sh edi.
  /// Endi `/api/companies` (200 tagacha faol kompaniya) nomi, ID'si,
  /// sohasi va shahri bo'yicha shu yerda saralanadi.
  Future<Result<List<Business>>> searchBusinesses(String q) async {
    final needle = q.trim().toLowerCase();
    final res = await companies();
    return res.map((list) => needle.isEmpty
        ? list
        : list
            .where((b) => [
                  b.displayName,
                  b.companyId,
                  b.category,
                  b.subcategory,
                  b.city,
                ].any((f) => f.toLowerCase().contains(needle)))
            .toList());
  }

  /// Ommaviy bizneslar — qidiruv BO'SH bo'lganda ko'rinadi.
  ///
  /// Ilgari Kashfiyotning "Bizneslar" bo'limi so'rovsiz holatda
  /// QATTIQ KODLANGAN bo'sh ro'yxat qaytarardi (`=> <Object>[]`),
  /// shuning uchun u har doim "Hozircha bo'sh" deb turardi —
  /// produksiyada yuzlab kompaniya bo'lsa ham. Hech qachon so'rov
  /// yuborilmagan.
  ///
  /// Server bu ro'yxatni allaqachon beradi: `status = 'active'` va
  /// egasi tirik bo'lgan kompaniyalar, 200 tagacha.
  Future<Result<List<Business>>> companies() async {
    final res = await _api.get<Map<String, dynamic>>('/api/companies');
    return res.map((j) => parseList(j['companies'] ?? j['items'], Business.fromJson));
  }

  /// Tavsiya etiladigan profillar — qidiruv BO'SH bo'lganda.
  ///
  /// ## NIMA UCHUN `/api/records/search` EMAS
  ///
  /// Ilgari bu yerda qidiruv endpointi `q: ''` bilan chaqirilardi.
  /// Server esa bo'sh so'rovni ATAYLAB rad etadi:
  ///
  ///     const q = String(url.searchParams.get('q') || '').trim()...;
  ///     if (q.length < 2) return json({ records: [] });
  ///
  /// Ya'ni javob HAR DOIM bo'sh ro'yxat edi va "Odamlar" bo'limi
  /// hech qachon hech kimni ko'rsatmasdi. Xato serverda emas:
  /// ilova KO'RIB CHIQISH uchun QIDIRUV yo'lini ishlatardi.
  ///
  /// `/api/records` — aynan ommaviy katalog ro'yxati. U bir xil
  /// ko'rinish filtrlarini qo'llaydi:
  ///
  ///     WHERE hidden_from_directory = 0
  ///       AND catalogVisibleSql(cards)   -- avtomatik/demo ID'lar
  ///       AND ownerAliveSql(cards)       -- egasi o'chirilganlar
  ///
  /// Shuning uchun yashirin, xususiy yoki demo profil bu yo'l
  /// orqali ham chiqmaydi — ro'yxat saytdagi katalog bilan BIR XIL.
  ///
  /// Javob shakli ham boshqacha: `/api/records` YALANG'OCH massiv
  /// qaytaradi (`json(rows.map(...))`), `search` esa
  /// `{records: [...]}`. `parseList` ikkalasini ham hazm qiladi.
  Future<Result<List<NfcId>>> suggested() async {
    // `/api/people` — egasi bor profillar. Ro'yxatda faqat ENG KO'P
    // KO'RILGAN 20 kishi (egasi, 2026-09-23: "ro'yxat uzun bo'lmasin,
    // qolgani qidiruvda chiqsin"). Hamma — shu jumladan yangi ro'yxatdan
    // o'tganlar — `searchPeople` orqali topiladi. Ilgari `/api/records`
    // (sotuv katalogi) ishlatilardi va yangi odamlar umuman chiqmasdi.
    final res = await _api
        .get<dynamic>('/api/people', query: {'limit': '20', 'sort': 'popular'});
    return res.map((j) => parseList(
          j is Map ? (j['records'] ?? j['items'] ?? j) : j,
          NfcId.fromJson,
        ).take(20).toList());
  }

  /// Tanlov katalogi — barcha faol bizneslarning mahsulot va xizmatlari.
  ///
  /// [kind] — mahsulot/xizmat, [category] — global kategoriya, [sub] —
  /// NFC sub-turi (faqat elektronika ichida). `null` = hammasi.
  Future<Result<CatalogFeedPage>> catalogFeed({
    int page = 1,
    int limit = 20,
    String q = '',
    ListingKind? kind,
    MarketCategory? category,
    NfcProductType? sub,
    CatalogSort sort = CatalogSort.newest,
  }) async {
    final res = await _api.get<Map<String, dynamic>>('/api/catalog/feed', query: {
      'page': page,
      'limit': limit,
      if (q.isNotEmpty) 'q': q,
      if (kind != null) 'kind': kind.name,
      if (category != null) 'category': category.name,
      if (sub != null) 'sub': sub.name,
      'sort': sort.wire,
    });
    return res.map(CatalogFeedPage.fromJson);
  }
}

// `trending()` OLIB TASHLANDI.
//
// U `/api/feed` ni o'qirdi — AYNAN `SocialRepository.feed()`
// qiladigan ish. Ikkinchi nusxa Tanlovdagi "Postlar" yorlig'i
// uchun yozilgan edi; yorliq olib tashlangach, ilovada uni
// chaqiradigan hech kim qolmadi.
//
// Ikki mijoz bitta endpointga qarab turishi jim xavf: biri
// tuzatilib, ikkinchisi unutiladi. Shuning uchun E2E ham endi
// ilova HAQIQATDAN ishlatadigan `feed()` ni sinaydi.

final discoverRepositoryProvider = Provider<DiscoverRepository>(
  (ref) => DiscoverRepository(ref.watch(apiProvider)),
);
