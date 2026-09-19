import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';
import '../models/models.dart';

/// NFC ID va jismoniy kartalar.
///
/// NFC ID FORMATI BU YERDA TO'QILMAYDI. Backend ro'yxatdan o'tganda
/// avtomatik 8 xonali kod beradi, qisqaroq kodlar esa do'kondan sotib
/// olinadi. Ilova kodni faqat uzatadi va ko'rsatadi.
class NfcRepository {
  NfcRepository(this._api);
  final ApiClient _api;

  /// Foydalanuvchining barcha NFC ID'lari.
  ///
  /// `/api/auth/me` javobidagi `cards` bilan bir xil manba — shuning
  /// uchun sessiya yangilanganda bu ro'yxat ham yangilanadi.
  Future<Result<List<NfcId>>> myIds() async {
    final res = await _api.get<Map<String, dynamic>>('/api/auth/me');
    return res.map((j) => parseList(j['cards'], NfcId.fromJson));
  }

  Future<Result<NfcId>> byCode(String code) async {
    final res = await _api.get<Map<String, dynamic>>('/api/records/$code');
    final raw = res.valueOrNull;
    if (res case Err(:final error)) return Err(error);
    final map = raw!['record'] ?? raw['card'] ?? raw;
    return Ok(NfcId.fromJson((map as Map).cast<String, dynamic>()));
  }

  /// Asosiy ID'ni belgilash — QR va ulashishda shu ishlatiladi.
  Future<Result<void>> setPrimary(String code) =>
      _api.post<void>('/api/records/$code/set-primary');

  Future<Result<void>> deleteId(String code) => _api.delete<void>('/api/records/$code');

  /// Skanerlash/ko'rish tarixi.
  Future<Result<List<ActivityEvent>>> history(String code) async {
    final res = await _api.get<Map<String, dynamic>>('/api/records/$code/analytics');
    return res.map((j) => parseList(j['events'] ?? j['items'], ActivityEvent.fromJson));
  }

  /// Jismoniy NFC kartalar ro'yxati.
  Future<Result<List<NfcDevice>>> devices() async {
    final res = await _api.get<Map<String, dynamic>>('/api/my/nfc-devices');
    return res.map((j) => parseList(j['devices'] ?? j['items'], NfcDevice.fromJson));
  }

  Future<Result<void>> unlinkDevice(int id) =>
      _api.delete<void>('/api/my/nfc-devices/$id');

  /// Karta tegizilganda o'qilgan token bo'yicha profilni ochish.
  ///
  /// Bu endpoint kartadagi `chipToken` ni NFC ID kodiga aylantiradi —
  /// ilova tokendan kodni O'ZI hisoblab chiqara olmaydi va olmasligi ham
  /// kerak (aks holda kartani soxtalashtirish mumkin bo'lardi).
  Future<Result<String>> resolveChip(String chipToken) async {
    final res = await _api.get<Map<String, dynamic>>('/api/tap/$chipToken');
    return res.map((j) => '${j['code'] ?? j['record']?['code'] ?? ''}');
  }

  // ---- sovg'a qilish ------------------------------------------------------

  Future<Result<void>> gift({required String code, required String email}) =>
      _api.post<void>('/api/records/$code/gift', {'email': email});

  Future<Result<List<Map<String, dynamic>>>> giftOffers() async {
    final res = await _api.get<Map<String, dynamic>>('/api/gift-offers');
    return res.map((j) {
      final raw = j['offers'] ?? j['items'];
      return raw is List
          ? raw.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
          : <Map<String, dynamic>>[];
    });
  }

  Future<Result<void>> acceptGift(int id) =>
      _api.post<void>('/api/gift-offers/$id/accept');

  Future<Result<void>> rejectGift(int id) =>
      _api.post<void>('/api/gift-offers/$id/reject');

  Future<Result<void>> cancelGift(int id) =>
      _api.post<void>('/api/gift-offers/$id/cancel');
}

final nfcRepositoryProvider = Provider<NfcRepository>(
  (ref) => NfcRepository(ref.watch(apiProvider)),
);
