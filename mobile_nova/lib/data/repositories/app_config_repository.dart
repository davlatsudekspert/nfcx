import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';

/// SERVER KALITLARI (feature flags) — `GET /api/app/config`.
///
///     { "flags": { "reelsHidden": false, "videoUploadsBlocked": false,
///                  "videosHidden": false, "showcase": true } }
///
/// HAMMASI SUKUT BO'YICHA O'CHIQ (`false`): javob kelmasa, buzuq
/// kelsa yoki maydon yo'q bo'lsa — ilova bugungi xulqida qoladi.
/// Faqat aniq `true` (yoki "1"/"true") yoqadi.
class AppFlags {
  const AppFlags({
    this.reelsHidden = false,
    this.videoUploadsBlocked = false,
    this.videosHidden = false,
    this.showcase = false,
  });

  /// Hammasi o'chiq — xato yoki birinchi ochilish.
  static const off = AppFlags();

  final bool reelsHidden;
  final bool videoUploadsBlocked;
  final bool videosHidden;
  final bool showcase;

  static bool _flag(Object? v) =>
      v == true || v == 1 || v == '1' || v == 'true';

  /// `{flags: {...}}` yoki to'g'ridan-to'g'ri `{...}`.
  factory AppFlags.fromJson(Map<String, dynamic> j) {
    final raw = j['flags'];
    final f = raw is Map ? raw : j;
    return AppFlags(
      reelsHidden: _flag(f['reelsHidden']),
      videoUploadsBlocked: _flag(f['videoUploadsBlocked']),
      videosHidden: _flag(f['videosHidden']),
      showcase: _flag(f['showcase']),
    );
  }

  Map<String, dynamic> toJson() => {
        'flags': {
          'reelsHidden': reelsHidden,
          'videoUploadsBlocked': videoUploadsBlocked,
          'videosHidden': videosHidden,
          'showcase': showcase,
        },
      };

  /// Prefs keshidan. Buzuq yoki yo'q — `null`.
  static AppFlags? tryDecode(String? s) {
    if (s == null || s.isEmpty) return null;
    try {
      final j = jsonDecode(s);
      return j is Map ? AppFlags.fromJson(j.cast<String, dynamic>()) : null;
    } catch (_) {
      return null;
    }
  }

  String encode() => jsonEncode(toJson());

  @override
  bool operator ==(Object other) =>
      other is AppFlags &&
      other.reelsHidden == reelsHidden &&
      other.videoUploadsBlocked == videoUploadsBlocked &&
      other.videosHidden == videosHidden &&
      other.showcase == showcase;

  @override
  int get hashCode =>
      Object.hash(reelsHidden, videoUploadsBlocked, videosHidden, showcase);

  @override
  String toString() => 'AppFlags(${toJson()['flags']})';
}

class AppConfigRepository {
  AppConfigRepository(this._api);
  final ApiClient _api;

  /// Ochiq manzil — kirish shart emas.
  Future<Result<AppFlags>> config() async {
    final res = await _api.get<Map<String, dynamic>>('/api/app/config');
    return res.map(AppFlags.fromJson);
  }
}

final appConfigRepositoryProvider = Provider<AppConfigRepository>(
  (ref) => AppConfigRepository(ref.watch(apiProvider)),
);
