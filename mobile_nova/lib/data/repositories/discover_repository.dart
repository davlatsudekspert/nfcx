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
    final res =
        await _api.get<Map<String, dynamic>>('/api/records/search', query: {'q': q});
    return res.map((j) => parseList(j['records'] ?? j['items'], NfcId.fromJson));
  }

  Future<Result<List<Business>>> searchBusinesses(String q) async {
    final res =
        await _api.get<Map<String, dynamic>>('/api/companies/search', query: {'q': q});
    return res.map((j) => parseList(j['companies'] ?? j['items'], Business.fromJson));
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
    final res = await _api.get<dynamic>('/api/records');
    return res.map((j) => parseList(
          j is Map ? (j['records'] ?? j['items'] ?? j) : j,
          NfcId.fromJson,
        ).take(60).toList());
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
