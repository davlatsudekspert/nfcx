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
  ///
  /// `found`/`active` HAM qaytariladi (2026-09-26). Ilgari ular
  /// tashlab yuborilardi va natijada:
  ///   * egasi O'CHIRIB QO'YGAN stiker ilovada baribir profilni ochardi
  ///     (sayt esa "o'chirilgan" deydi);
  ///   * hali ULANMAGAN (sotilgan, lekin faollashtirilmagan) stiker
  ///     bosh sahifaga tashlab yuborardi — faollashtirishga emas.
  Future<Result<ChipLookup>> resolveChip(String chipToken) async {
    final res = await _api
        .get<Map<String, dynamic>>('/api/tap/${Uri.encodeComponent(chipToken)}');
    return res.map(ChipLookup.fromJson);
  }

  // ---- sotib olingan stikerni faollashtirish -----------------------------
  //
  // Sayt bilan AYNAN bir xil server oqimi (`hosting/api/marketplace.js`,
  // sayt: `src/pages/ActivatePage.jsx`). Ilovada alohida mantiq yo'q —
  // hamma tekshiruv (kod, egalik, stiker bandligi) serverda.

  /// Kodni tekshirish — hech narsa o'zgarmaydi. Kirish shart emas.
  Future<Result<ActivationCheck>> activationCheck(String code) async {
    final res = await _api.post<Map<String, dynamic>>(
        '/api/activate/check', {'code': code});
    return res.map(ActivationCheck.fromJson);
  }

  /// Tanlash uchun o'z profillari: shaxsiy ID'lar va kompaniyalar.
  Future<Result<ActivationOptions>> activationOptions() async {
    final res = await _api.get<Map<String, dynamic>>('/api/activate/options');
    return res.map(ActivationOptions.fromJson);
  }

  /// FAOLLASHTIRISH — haqiqiy kodni SARFLAYDI (bir martalik).
  ///
  /// `deviceToken` — odam tekkizgan stiker (`/t/<token>`): u bo'lsa
  /// stiker shu yerning o'zida bog'lanadi. Shaxsiy profilda
  /// `profileCode` bo'sh bo'lsa server yangi bepul ID ajratadi.
  Future<Result<ActivationResult>> activateSticker({
    required String code,
    required bool business,
    String profileCode = '',
    String companyId = '',
    String deviceToken = '',
  }) async {
    final res = await _api.post<Map<String, dynamic>>('/api/activate', {
      'code': code,
      'profileKind': business ? 'business' : 'personal',
      if (!business && profileCode.isNotEmpty) 'profileCode': profileCode,
      if (business) 'companyId': companyId,
      if (deviceToken.isNotEmpty) 'deviceToken': deviceToken,
    });
    return res.map((j) => ActivationResult.fromJson(
        (j['result'] as Map?)?.cast<String, dynamic>() ?? const {}));
  }

  /// Faollashtirilgan kodga KEYIN tekkizilgan stikerni bog'lash
  /// (QR orqali faollashtirilgan bo'lsa). 7 kun ichida.
  Future<Result<ActivationResult>> attachSticker({
    required String deviceToken,
    String code = '',
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
        '/api/activate/attach-sticker', {
      'deviceToken': deviceToken,
      if (code.isNotEmpty) 'code': code,
    });
    return res.map((j) => ActivationResult(
          profileKind: '${j['profileKind'] ?? ''}',
          profileCode: '${j['profileCode'] ?? ''}',
          deviceBound: true,
        ));
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

/// `/api/tap/<token>` natijasi.
class ChipLookup {
  const ChipLookup({
    required this.found,
    required this.active,
    required this.code,
    required this.company,
  });

  /// Stiker bazada bormi (noma'lum token — `false`).
  final bool found;

  /// Egasi o'chirib qo'ymaganmi.
  final bool active;

  /// Bog'langan NFC ID yoki kompaniya ID. Bo'sh — hali ulanmagan.
  final String code;
  final bool company;

  /// Sotilgan, lekin hali faollashtirilmagan stiker.
  bool get unlinked => found && code.isEmpty;

  /// `GET /api/tap/<token>` javobi (`hosting/worker.js`):
  /// `{found, active, linkedCode, linkedCompanyId}`.
  factory ChipLookup.fromJson(Map<String, dynamic> j) {
    final company = '${j['linkedCompanyId'] ?? ''}';
    final code = company.isNotEmpty
        ? company
        : '${j['linkedCode'] ?? j['code'] ?? j['record']?['code'] ?? ''}';
    return ChipLookup(
      // Eski server `found` bermasdi — bog'langan kod bo'lsa topilgan.
      found: j['found'] is bool ? j['found'] as bool : code.isNotEmpty,
      active: j['active'] is bool ? j['active'] as bool : true,
      code: code,
      company: company.isNotEmpty,
    );
  }
}

/// Kod tekshiruvi (`POST /api/activate/check`).
class ActivationCheck {
  const ActivationCheck({this.productName = '', this.already});

  final String productName;

  /// Kodni SHU odam avval faollashtirgan bo'lsa — natija.
  final ActivationResult? already;

  factory ActivationCheck.fromJson(Map<String, dynamic> j) {
    final product = (j['product'] as Map?)?.cast<String, dynamic>();
    final result = (j['result'] as Map?)?.cast<String, dynamic>();
    return ActivationCheck(
      productName: '${product?['name'] ?? result?['productName'] ?? ''}',
      already: j['alreadyActivated'] == true && result != null
          ? ActivationResult.fromJson(result)
          : null,
    );
  }
}

/// Faollashtirish uchun tanlanadigan profillar.
class ActivationOptions {
  const ActivationOptions({this.personal = const [], this.business = const []});

  final List<({String code, String name, bool isPrimary})> personal;
  final List<({String companyId, String name})> business;

  factory ActivationOptions.fromJson(Map<String, dynamic> j) =>
      ActivationOptions(
        personal: [
          for (final e in (j['personal'] as List? ?? const []).whereType<Map>())
            (
              code: '${e['code'] ?? ''}',
              name: '${e['name'] ?? ''}',
              isPrimary: e['isPrimary'] == true,
            ),
        ].where((e) => e.code.isNotEmpty).toList(),
        business: [
          for (final e in (j['business'] as List? ?? const []).whereType<Map>())
            (
              companyId: '${e['companyId'] ?? ''}',
              name: '${e['displayName'] ?? ''}',
            ),
        ].where((e) => e.companyId.isNotEmpty).toList(),
      );
}

/// Faollashtirish natijasi.
class ActivationResult {
  const ActivationResult({
    this.profileKind = '',
    this.profileCode = '',
    this.productName = '',
    this.deviceBound = false,
  });

  final String profileKind;
  final String profileCode;
  final String productName;

  /// Stiker SHU amalda bog'landimi. `false` — endi stikerga tekkizish
  /// kerak (QR bilan kelgan odam).
  final bool deviceBound;

  bool get business => profileKind == 'business';

  factory ActivationResult.fromJson(Map<String, dynamic> j) => ActivationResult(
        profileKind: '${j['profileKind'] ?? ''}',
        profileCode: '${j['profileCode'] ?? ''}',
        productName: '${j['productName'] ?? ''}',
        deviceBound: j['deviceBound'] == true,
      );
}

final nfcRepositoryProvider = Provider<NfcRepository>(
  (ref) => NfcRepository(ref.watch(apiProvider)),
);
