import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/errors/app_error.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/media_url.dart';
import '../../core/utils/result.dart';
import '../../data/models/models.dart';

/// Profil (backend atamasi: `record`) bilan ishlash.
///
/// Backend'da "profil" alohida obyekt emas: har bir NFC ID ning O'ZI
/// profil. Shuning uchun bu yerdagi metodlar `code` bilan ishlaydi.
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
    if (bio != null) body['bio'] = bio;
    if (role != null) body['role'] = role;
    // `storageUrl` — o'qishdagi `mediaUrl` ning teskarisi. Ekranga
    // to'liq manzil boradi, bazaga esa AYNAN o'sha nisbiy shakl
    // qaytadi. Aks holda yozuv domenga bog'lanib qolardi.
    if (avatarUrl != null) body['avatarUrl'] = storageUrl(avatarUrl);
    if (coverUrl != null) body['bgUrl'] = storageUrl(coverUrl);
    if (musicUrls != null) {
      body['musicUrls'] = musicUrls.map(storageUrl).toList();
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
    final bytes = await File(filePath).readAsBytes();
    final res = await _api.uploadBinary(
      '/api/upload-file',
      bytes,
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

  Future<Result<({int followers, int following})>> followStats(String code) async {
    final res = await _api.get<Map<String, dynamic>>('/api/follow-stats/$code');
    return res.map((j) => (
          followers: (j['followers'] as num?)?.toInt() ?? 0,
          following: (j['following'] as num?)?.toInt() ?? 0,
        ));
  }

  Future<Result<List<NfcId>>> followList(String code, {String type = 'followers'}) async {
    final res = await _api
        .get<Map<String, dynamic>>('/api/follow-list/$code', query: {'type': type});
    return res.map((j) => parseList(j['items'] ?? j['users'], NfcId.fromJson));
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
    final bytes = await File(filePath).readAsBytes();
    final lower = filePath.toLowerCase();
    final type = lower.endsWith('.webm') ? 'video/webm' : 'video/mp4';
    final res = await _api.uploadBinary(
        '/api/upload-card-video', bytes, type,
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

  Future<Result<void>> changePassword({
    required String currentPassword,
    required String newPassword,
    required String code,
  }) =>
      _api.post<void>('/api/settings/change-password', {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
        'code': code,
      });

  Future<Result<void>> requestPasswordCode() =>
      _api.post<void>('/api/settings/request-password-code');

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

  Future<Result<void>> requestPremium() => _api.post<void>('/api/premium/request');
}

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
final publicProfileProvider =
    FutureProvider.family<NfcId, String>((ref, code) async {
  final res = await ref.watch(profileRepositoryProvider).byCode(code);
  return res.when(ok: (v) => v, err: (e) => throw e);
});
