import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/errors/app_error.dart';
import '../../core/network/api_client.dart';
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

  Future<Result<void>> updateProfile({
    required String code,
    String? name,
    String? bio,
    String? role,
    String? avatarUrl,
    String? coverUrl,
    Map<String, dynamic>? links,
  }) =>
      _api.put<void>('/api/records/$code', {
        if (name != null) 'name': name,
        if (bio != null) 'bio': bio,
        if (role != null) 'role': role,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
        if (coverUrl != null) 'bgUrl': coverUrl,
        if (links != null) ...links,
      });

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
