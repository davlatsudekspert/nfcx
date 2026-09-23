import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/errors/app_error.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/media_url.dart';
import '../../core/utils/result.dart';
import '../../data/models/models.dart';

/// Server yuklash chegarasi — `hosting/worker.js` `UPLOAD_MAX_BYTES`.
const kUploadMaxBytes = 100 * 1024 * 1024;

/// Profil (backend atamasi: `record`) bilan ishlash.
///
/// Backend'da "profil" alohida obyekt emas: har bir NFC ID ning O'ZI
/// profil. Shuning uchun bu yerdagi metodlar `code` bilan ishlaydi.
/// Profil ostidagi uchta raqam va tashrifchining obuna holati.
///
/// `/api/records/:code` da `followers`/`following` maydoni UMUMAN
/// YO'Q — o'lchab tekshirilgan. Shuning uchun bu sonlar faqat
/// `/api/follow-stats/:code` dan keladi.
typedef FollowStats = ({int followers, int following, bool isFollowing});

class ProfileRepository {
  ProfileRepository(this._api);
  final ApiClient _api;

  Future<Result<NfcId>> byCode(String code) async {
    final res = await _api.get<Map<String, dynamic>>('/api/records/$code');
    return res.map((j) => NfcId.fromJson(
        (j['record'] ?? j['card'] ?? j) is Map
            ? ((j['record'] ?? j['card'] ?? j) as Map).cast<String, dynamic>()
            : j));
  }

  /// PROFILNI SAQLASH — AVVAL O'QIB, KEYIN YOZADI.
  ///
  /// ## NIMA UCHUN SHUNDAY
  ///
  /// `PUT /api/records/:code` yozuvni QISMAN yangilamaydi — u
  /// butun yozuvni QAYTA QURADI (`validateRecordBody`), `updateRecord`
  /// esa natijadagi HAR BIR ustunni yozadi. Ya'ni tanada bo'lmagan
  /// maydon bo'shatiladi.
  ///
  /// Ilgari bu yerda faqat o'zgargan maydonlar yuborilardi. Natijada
  /// odam ismini yoki avatarini tahrirlasa, uning MUSIQASI,
  /// hashteglari, qo'shimcha havolalari, karta raqamlari, Telegrami
  /// va telefoni JIMGINA O'CHIB ketardi.
  ///
  /// Endi avval yozuvning O'ZI o'qiladi, o'zgarishlar ustiga
  /// qo'yiladi va TO'LIQ yozuv qaytariladi. Ilova hech narsa
  /// o'ylab topmaydi — serverdan kelgan qiymatlarni aynan
  /// qaytaradi.
  Future<Result<void>> updateProfile({
    required String code,
    String? name,
    String? bio,
    String? role,
    String? avatarUrl,
    String? coverUrl,
    List<String>? musicUrls,
    bool? hiddenFromDirectory,
    Map<String, dynamic>? links,
  }) async {
    final cur =
        await _api.get<Map<String, dynamic>>('/api/records/$code');
    if (cur case Err(:final error)) return Err(error);

    final raw = (cur as Ok<Map<String, dynamic>>).value;
    final inner = raw['record'] ?? raw['card'] ?? raw;
    final body = <String, dynamic>{
      if (inner is Map) ...inner.cast<String, dynamic>(),
    };

    if (name != null) body['name'] = name;
    // SERVER `about` NI O'QIYDI (`hosting/worker.js` validateRecordBody).
    // Ilgari bu yerda `bio` turardi: yangi matn serverga yetib
    // bormas, eski `about` esa GET'dan o'zgarmay qaytardi — odam
    // "saqladim" deb o'ylardi, matn esa jimgina yo'qolardi.
    if (bio != null) {
      body['about'] = bio;
      body.remove('bio');
    }
    if (role != null) body['role'] = role;
    // `storageUrl` — o'qishdagi `mediaUrl` ning teskarisi. Ekranga
    // to'liq manzil boradi, bazaga esa AYNAN o'sha nisbiy shakl
    // qaytadi. Aks holda yozuv domenga bog'lanib qolardi.
    if (avatarUrl != null) body['avatarUrl'] = storageUrl(avatarUrl);
    if (coverUrl != null) body['bgUrl'] = storageUrl(coverUrl);
    if (musicUrls != null) {
      body['musicUrls'] = musicUrls.map(storageUrl).toList();
    }
    // Server buni `body` da BOOLEAN kutadi (`=== true` bilan
    // tekshiradi) va `hidden_from_directory` ustuniga yozadi.
    if (hiddenFromDirectory != null) {
      body['hiddenFromDirectory'] = hiddenFromDirectory;
    }
    if (links != null) body.addAll(links);

    return _api.put<void>('/api/records/$code', body);
  }

  /// MUSIQA FAYLINI YUKLASH.
  ///
  /// `/api/upload-file` OQIM bilan yuboradi. Eski `/api/upload-audio`
  /// base64 kutadi va serverdagi izohda aytilganidek, base64 hajmni
  /// ~33% oshirib Worker xotirasiga sig'masdi — shuning uchun musiqa
  /// uchun aynan oqimli yo'l ishlatiladi.
  ///
  /// Qaytadigan manzil NISBIY (`/uploads/file_....mp3`) — server
  /// yozuvni shu shaklda saqlaydi.
  Future<Result<String>> uploadAudio(
    String filePath, {
    void Function(int sent, int total)? onProgress,
  }) async {
    if (await File(filePath).length() > kUploadMaxBytes) {
      return const Err(AppError(AppErrorKind.validation, code: 'too_large'));
    }
    final res = await _api.uploadBinary(
      '/api/upload-file',
      filePath,
      _audioType(filePath),
      onProgress: onProgress,
    );
    return res.map((j) => '${j['url'] ?? j['path'] ?? ''}');
  }

  /// Kengaytmadan MIME turi. Server `accept: ['audio/', ...]` bo'yicha
  /// tekshiradi va faylning SEHRLI BAYTLARIDAN haqiqiy turni o'zi
  /// aniqlaydi, shuning uchun bu yerda taxminiy tur yetarli.
  static String _audioType(String path) {
    final p = path.toLowerCase();
    if (p.endsWith('.m4a') || p.endsWith('.mp4')) return 'audio/mp4';
    if (p.endsWith('.ogg')) return 'audio/ogg';
    if (p.endsWith('.wav')) return 'audio/wav';
    if (p.endsWith('.webm')) return 'audio/webm';
    return 'audio/mpeg';
  }

  /// Ko'rish hodisasi — profil analitikasi uchun.
  ///
  /// Natijasi KUTILMAYDI va xatosi yutiladi: bu yordamchi signal,
  /// uning tufayli ekran ochilishi kechikmasligi kerak.
  void trackView(String code) {
    _api.post<void>('/api/records/$code/view');
  }

  Future<Result<void>> follow(String code) => _api.post<void>('/api/follow/$code');

  Future<Result<void>> unfollow(String code) =>
      _api.post<void>('/api/unfollow/$code');

  /// KOMPANIYAGA OBUNA — boshqa endpoint.
  ///
  /// `/api/follow/:code` faqat NFC yozuvini (shaxsiy ID) taniydi.
  /// Kompaniya uchun server `POST /api/companies/:id/follow` beradi va
  /// u holatni TESKARIGA o'giradi; javobdagi `following` — yangi holat.
  Future<Result<bool>> toggleCompanyFollow(String companyId) async {
    final res = await _api.post<Map<String, dynamic>>(
        '/api/companies/$companyId/follow', const {});
    return res.map((j) => j['following'] == true);
  }

  /// Obuna ko'rsatkichlari — VA tashrifchi obunami.
  ///
  /// `isFollowing` ni server O'ZI hisoblaydi (tashrifchi sessiyasi
  /// bo'yicha), shuning uchun tugmaning holati uchun ENG ISHONCHLI
  /// manba shu. Ilgari u umuman o'qilmasdi.
  Future<Result<FollowStats>> followStats(String code) async {
    final res = await _api.get<Map<String, dynamic>>('/api/follow-stats/$code');
    return res.map((j) => (
          followers: (j['followers'] as num?)?.toInt() ?? 0,
          following: (j['following'] as num?)?.toInt() ?? 0,
          isFollowing: j['isFollowing'] == true,
        ));
  }

  /// Obunachilar yoki obunalar ro'yxati.
  ///
  /// IKKITA KONTRAKT XATOSI SHU YERDA EDI (2026-09, qurilmada
  /// topildi):
  ///
  ///   1. Ilova `?type=following` yuborardi, server esa `?dir=` ni
  ///      o'qiydi (`hosting/worker.js`, `followApi`). Ya'ni server
  ///      DOIM obunachilarni qaytarardi — hech qachon obunalarni.
  ///   2. Server `{list: [...]}` beradi, ilova esa
  ///      `j['items'] ?? j['users']` ni o'qirdi — ikkalasi ham yo'q,
  ///      demak ro'yxat DOIM bo'sh edi.
  ///
  /// Oqibati zanjir bo'lib ketardi: "men kimga obunaman" to'plami
  /// doim bo'sh -> obuna tugmasi doim "Kuzatish" -> bosilganda
  /// server 409 ALREADY_FOLLOWING qaytarardi -> ilova uni
  /// `errConflict` ("Bu ma'lumot allaqachon band") deb ko'rsatib,
  /// optimistik ✓ ni orqaga qaytarardi. Foydalanuvchi buni
  /// "kuzatish ishlamayapti" deb ko'rardi, aslida obuna BAZAGA
  /// YOZILGAN edi.
  ///
  /// `dir` nomi serverdagi nom bilan ATAYLAB bir xil.
  Future<Result<List<NfcId>>> followList(String code,
      {String dir = 'followers'}) async {
    final res = await _api
        .get<Map<String, dynamic>>('/api/follow-list/$code', query: {'dir': dir});
    return res.map((j) => parseList(j['list'], NfcId.fromJson));
  }

  /// Rasm yuklash — avatar, muqova, post va istorya uchun bitta endpoint.
  ///
  /// Server `data:` URL kutadi, multipart EMAS — batafsil sabab
  /// `ApiClient.uploadDataUrl` izohida. Ilgari bu yerda multipart
  /// yuborilardi va HAR BIR rasm yuklash 422 `bad_image` bilan
  /// tugardi.
  ///
  /// [kind] `'cover'` bo'lganda server chegarasi 20 MB, aks holda
  /// 700 KB (gif uchun 3 MB).
  Future<Result<String>> uploadImage(
    String filePath, {
    String? kind,
    void Function(int, int)? onProgress,
  }) async {
    final file = File(filePath);
    final bytes = await file.readAsBytes();
    final mime = _imageMime(filePath, bytes);
    if (mime == null) {
      return const Err(AppError(
        AppErrorKind.validation,
        code: 'bad_image',
        detail: 'png, jpg, webp yoki gif bo\'lishi kerak',
      ));
    }
    final res = await _api.uploadDataUrl('/api/upload', bytes, mime,
        kind: kind, onProgress: onProgress);
    return res.map((j) => '${j['url'] ?? j['path'] ?? ''}');
  }

  /// Video yuklash — xom binar, alohida endpoint.
  Future<Result<String>> uploadVideo(
    String filePath, {
    void Function(int, int)? onProgress,
  }) async {
    // Server chegarasi (`UPLOAD_MAX_BYTES`, 100 MB) OLDINDAN tekshiriladi:
    // aks holda odam butun faylni yuklab bo'lgach 413 olardi.
    if (await File(filePath).length() > kUploadMaxBytes) {
      return const Err(AppError(AppErrorKind.validation, code: 'too_large'));
    }
    final lower = filePath.toLowerCase();
    final type = lower.endsWith('.webm') ? 'video/webm' : 'video/mp4';
    final res = await _api.uploadBinary(
        '/api/upload-card-video', filePath, type,
        onProgress: onProgress);
    return res.map((j) => '${j['url'] ?? j['path'] ?? ''}');
  }

  /// MIME ni BAYTLARDAN aniqlaydi, kengaytmadan emas.
  ///
  /// Galereyadan kelgan fayl nomi `.jpg` bo'lib, ichi aslida HEIC
  /// bo'lishi mumkin — server esa sarlavhani o'qiydi va
  /// `bad_image` qaytaradi. Sehrli baytlar yolg'on gapirmaydi.
  static String? _imageMime(String path, List<int> b) {
    bool at(int i, List<int> sig) {
      if (b.length < i + sig.length) return false;
      for (var k = 0; k < sig.length; k++) {
        if (b[i + k] != sig[k]) return false;
      }
      return true;
    }

    if (at(0, [0x89, 0x50, 0x4E, 0x47])) return 'image/png';
    if (at(0, [0xFF, 0xD8, 0xFF])) return 'image/jpeg';
    if (at(0, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
    // WEBP: "RIFF" .... "WEBP"
    if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) {
      return 'image/webp';
    }
    return null;
  }

  /// Parolni almashtirish — JORIY PAROL bilan, kodsiz.
  ///
  /// ## NIMA UCHUN `change-password` EMAS
  ///
  /// Serverda ikkita yo'l bor (`hosting/api/account.js`):
  ///
  ///     POST /api/settings/change-password-direct {currentPassword,newPassword}
  ///     POST /api/settings/change-password        {code,newPassword}
  ///
  /// Ilova ikkinchisini chaqirardi — u emailga (yoki Telegramga)
  /// yuborilgan 6 xonali kodni talab qiladi. Server email xizmati
  /// o'chiq bo'lsa `request-password-code` kod YUBORMAYDI, ya'ni
  /// odam parolini umuman o'zgartira olmasdi: kod maydoni bo'shligicha
  /// qolardi va yagona yo'l shu edi.
  ///
  /// Birinchi yo'l esa aynan kutilgan narsani qiladi va u ham
  /// XAVFSIZ: server joriy parolni `verifyPassword` bilan tekshiradi
  /// va tezlik cheklovi qo'yadi. Ya'ni bu qoidani yumshatish emas —
  /// serverning o'zida turgan, tasdiqlash uchun kodga muhtoj
  /// bo'lmagan yo'lni ishlatish.
  Future<Result<void>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) =>
      _api.post<void>('/api/settings/change-password-direct', {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });

  /// HISOBNI O'CHIRISH — `DELETE /api/account` (hosting/api/account.js).
  ///
  /// Server hisobni o'chirilgan deb belgilaydi va BARCHA sessiyalarni
  /// yopadi: profillar va kontent saytdan ham, ilovadan ham darhol
  /// yo'qoladi, odam qayta kira olmaydi. Google Play talabi: o'chirish
  /// ilova ICHIDA bo'lishi kerak (faqat "murojaat" emas).
  Future<Result<void>> deleteAccount() => _api.delete<void>('/api/account');

  Future<Result<void>> support(String message) =>
      _api.post<void>('/api/support', {'message': message});

  Future<Result<List<Map<String, dynamic>>>> referrals() async {
    final res = await _api.get<Map<String, dynamic>>('/api/referrals');
    return res.map((j) {
      final raw = j['items'] ?? j['referrals'];
      return raw is List
          ? raw.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
          : <Map<String, dynamic>>[];
    });
  }

  /// PREMIUM OBUNA BUYURTMASI — natijada TO'LOV HAVOLASI bor.
  ///
  /// Ilgari bu yerda `_api.post<void>` turardi, ya'ni server
  /// qaytargan javob BUTUNLAY TASHLAB YUBORILARDI. Javobda esa eng
  /// muhim narsa bor: `payLinks` — Payme va Click checkout
  /// manzillari. Ularsiz ilovada premiumni sotib olishning HECH
  /// QANDAY yo'li yo'q edi: buyurtma serverda yaratilar, ekran
  /// "yuborildi" deb yozar, odam esa hech qayerga bormasdi.
  ///
  /// Server 201 (yangi buyurtma) yoki 200 (`reused: true` — avval
  /// boshlangan, hali to'lanmagan buyurtma) qaytaradi. Ikkalasida
  /// ham tana bir xil, shuning uchun ilova ularni ajratmaydi:
  /// muhimi — to'lanmagan bitta buyurtma va uning havolasi.
  Future<Result<PremiumOffer>> requestPremium() async {
    final res =
        await _api.post<Map<String, dynamic>>('/api/premium/request');
    return res.map(PremiumOffer.fromJson);
  }
}

/// Premium buyurtmasi va uning to'lov havolalari.
///
/// Havolalarda MAXFIY narsa yo'q: merchant identifikatori har bir
/// checkout manzilida ochiq turadi, buyurtma esa allaqachon shu
/// foydalanuvchiniki (server so'rovni `user_id` bo'yicha filtrlaydi).
class PremiumOffer {
  const PremiumOffer({
    required this.orderId,
    required this.amount,
    this.payme = '',
    this.click = '',
  });

  final int orderId;

  /// So'mda. Server `PROFILE_PREMIUM_FEE` ni qaytaradi — ilova
  /// narxni O'ZI YOZIB QO'YMAYDI, aks holda saytda narx o'zgarsa
  /// ilova eski summani ko'rsatib turardi.
  final int amount;

  final String payme;
  final String click;

  /// Hech bo'lmasa bitta to'lov yo'li bormi.
  ///
  /// Bo'sh bo'lsa ilova "to'lash" tugmasini KO'RSATMAYDI: odamni
  /// bo'sh sahifaga olib borish "ishlamadi" degan tuyg'u beradi.
  bool get payable => payme.isNotEmpty || click.isNotEmpty;

  factory PremiumOffer.fromJson(Map<String, dynamic> j) {
    final links = j['payLinks'];
    final m = links is Map ? links.cast<String, dynamic>() : const {};
    return PremiumOffer(
      orderId: _int(j['orderId'] ?? j['id']),
      amount: _int(j['amount'] ?? j['price']),
      // `payLink` — eski, bitta havolali shakl. U DOIM Payme.
      payme: '${m['payme'] ?? j['payLink'] ?? ''}',
      click: '${m['click'] ?? ''}',
    );
  }
}

int _int(dynamic v) =>
    v is int ? v : (v is num ? v.toInt() : (int.tryParse('$v') ?? 0));

final profileRepositoryProvider = Provider<ProfileRepository>(
  (ref) => ProfileRepository(ref.watch(apiProvider)),
);

/// OMMAVIY PROFIL — begona odamning NFC yozuvi.
///
/// `byCode()` repozitoriyda ANCHADAN BERI bor edi, lekin uni
/// chaqiradigan joy YO'Q edi. `ProfileScreen` begona kodni FAQAT
/// o'zimning ID larim orasidan qidirardi:
///
///     ids.where((e) => e.code == code).firstOrNull
///
/// Begona odamning kodi u yerda hech qachon bo'lmaydi, shuning
/// uchun natija doim `null` edi va ekran serverga UMUMAN murojaat
/// qilmasdi. Oqibat: Kashfiyotdan qaysi odamni tanlasangiz ham
/// bir xil BO'SH panel ochilardi — 0 post, 0 obunachi va
/// "Do'kondan karta oling yoki ID yarating" yozuvi bilan.
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
final publicProfileProvider =
    FutureProvider.family<NfcId, String>(dependencies: [profileRepositoryProvider], (ref, code) async {
  final res = await ref.watch(profileRepositoryProvider).byCode(code);
  return res.when(ok: (v) => v, err: (e) => throw e);
});
