import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';
import '../models/models.dart';

/// Bildirishnomalar.
///
/// PUSH HAQIDA: backend'da push ro'yxatdan o'tkazish endpointi hali
/// yo'q. Shuning uchun bu yerda faqat SO'RAB OLINADIGAN (pull) ro'yxat
/// bor. Soxta push ko'rsatilmaydi — `API_GAPS.md` ga qarang.
class ActivityRepository {
  ActivityRepository(this._api);
  final ApiClient _api;

  /// Foydalanuvchining barcha NFC ID'lari bo'yicha hodisalar.
  ///
  /// Backend har bir ID uchun alohida analitika beradi, umumiy lenta
  /// endpointi yo'q — shuning uchun ro'yxat shu yerda birlashtiriladi
  /// va sana bo'yicha saralanadi.
  Future<Result<List<ActivityEvent>>> feed(List<String> codes) async {
    final all = <ActivityEvent>[];
    for (final code in codes.take(5)) {
      final res = await _api.get<Map<String, dynamic>>('/api/records/$code/analytics');
      if (res case Ok(:final value)) {
        all.addAll(parseList(value['events'] ?? value['items'], ActivityEvent.fromJson));
      }
    }
    all.sort((a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)));
    return Ok(all);
  }

  /// Biznes uchun kelgan murojaatlar (lead).
  Future<Result<List<Map<String, dynamic>>>> leads(String code) async {
    final res = await _api.get<Map<String, dynamic>>('/api/records/$code/leads');
    return res.map((j) {
      final raw = j['leads'] ?? j['items'];
      return raw is List
          ? raw.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
          : <Map<String, dynamic>>[];
    });
  }

  Future<Result<List<Post>>> news() async {
    final res = await _api.get<Map<String, dynamic>>('/api/news');
    return res.map((j) => parseList(j['news'] ?? j['items'], Post.fromJson));
  }
}

final activityRepositoryProvider = Provider<ActivityRepository>(
  (ref) => ActivityRepository(ref.watch(apiProvider)),
);
