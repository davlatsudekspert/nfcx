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

  /// Jismoniy kartani VAQTINCHA O'CHIRISH / QAYTA YOQISH.
  ///
  /// ## NIMA UCHUN "UZISH" EMAS
  ///
  /// Ilgari bu yerda `PUT {linkedCode: ''}` yuborilardi va izohda
  /// "bo'sh qiymat bog'lanishni uzadi" deb yozilgandi. Bu NOTO'G'RI:
  /// server bo'sh kodni ham tekshiruvdan o'tkazadi —
  ///
  ///     const code = String(b.linkedCode || '').toUpperCase();
  ///     if (!validCode(code)) return 422 { error: 'bad_code' };
  ///
  /// `validCode('')` — `false`. Ya'ni bo'sh qiymat bilan "uzish"
  /// HECH QACHON ishlamagan bo'lardi, faqat 422 qaytarardi.
  /// Undan oldin esa umuman `DELETE` chaqirilardi va u 404 berardi.
  ///
  /// Serverda qo'llab-quvvatlanadigan amal — `blocked`. Karta
  /// bloklanganda `/api/tap/:token` uni ochmaydi, ya'ni yo'qolgan
  /// kartani zararsizlantirish uchun aynan shu kerak. Bog'lanishni
  /// butunlay olib tashlash yo'li serverda yo'q va ilova uni
  /// bordek ko'rsatmaydi.
  Future<Result<void>> setDeviceBlocked(int id, bool blocked) =>
      _api.put<void>('/api/my/nfc-devices/$id', {'blocked': blocked});

  /// Kartani boshqa NFC ID ga bog'lash.
  ///
  /// Kod EGASINIKI bo'lishi shart — aks holda server 403
  /// `not_your_code` qaytaradi.
  Future<Result<void>> linkDevice(int id, String code) =>
      _api.put<void>('/api/my/nfc-devices/$id', {'linkedCode': code});

  /// Karta tegizilganda o'qilgan token bo'yicha profilni ochish.
  ///
  /// Bu endpoint kartadagi `chipToken` ni NFC ID kodiga aylantiradi —
  /// ilova tokendan kodni O'ZI hisoblab chiqara olmaydi va olmasligi ham
  /// kerak (aks holda kartani soxtalashtirish mumkin bo'lardi).
  ///
  /// Server javobi: `{found, active, linkedCode, linkedCompanyId}`
  /// (`hosting/worker.js`). Ilgari bu yerda `code` o'qilardi — server
  /// bunday maydon bermaydi, natija DOIM bo'sh edi va kartadagi
  /// token hech qachon profilga olib bormasdi.
  Future<Result<({String code, bool company})>> resolveChip(
      String chipToken) async {
    final res = await _api
        .get<Map<String, dynamic>>('/api/tap/${Uri.encodeComponent(chipToken)}');
    return res.map((j) {
      final company = '${j['linkedCompanyId'] ?? ''}';
      if (company.isNotEmpty) return (code: company, company: true);
      final code =
          '${j['linkedCode'] ?? j['code'] ?? j['record']?['code'] ?? ''}';
      return (code: code, company: false);
    });
  }

  // ---- sovg'a qilish ------------------------------------------------------

  /// SOVG'A TAKLIFI — qabul qiluvchi NFC ID'si bo'yicha.
  ///
  /// Server (`hosting/api/account.js`) va sayt (`src/lib/db.js`
  /// `dbGiftCard`) `toCode` kutadi. Ilgari ilova `email` yuborardi —
  /// server har safar `to_code_required` (422) qaytarar va ekranda
  /// "Nimadir noto'g'ri ketdi" chiqardi: sovg'a UMUMAN ishlamasdi.
  Future<Result<void>> gift({required String code, required String toCode}) =>
      _api.post<void>('/api/records/$code/gift', {'toCode': toCode});

  /// Sovg'a takliflari.
  ///
  /// Server `{ incoming: [...], outgoing: [...] }` qaytaradi
  /// (`listGiftOffers`). Ilgari bu yerda `offers` yoki `items`
  /// izlanardi — bunday kalitlar YO'Q, ya'ni ro'yxat HAR DOIM bo'sh
  /// chiqardi.
  ///
  /// Har bir element: `id`, `code`, `createdAt` va yo'nalishga qarab
  /// `fromEmail` (kelgan) yoki `toEmail` (yuborilgan).
  Future<Result<({List<GiftOffer> incoming, List<GiftOffer> outgoing})>>
      giftOffers() async {
    final res = await _api.get<Map<String, dynamic>>('/api/gift-offers');
    return res.map((j) => (
          incoming: _offers(j['incoming'], incoming: true),
          outgoing: _offers(j['outgoing'], incoming: false),
        ));
  }

  static List<GiftOffer> _offers(Object? raw, {required bool incoming}) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => GiftOffer.fromJson(e.cast<String, dynamic>(),
            incoming: incoming))
        .toList();
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
