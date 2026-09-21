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

  /// BILDIRISHNOMALAR — SAYT BILAN BITTA MANBADAN.
  ///
  /// Ilgari bu yerda har bir NFC ID uchun
  /// `/api/records/:code/analytics` so'ralar va javobdan `events`
  /// kaliti o'qilardi. Server esa uni HECH QACHON yubormaydi — o'sha
  /// endpoint faqat yig'ma statistika beradi (`totalViews`, `byDay`,
  /// `byRef`). Ya'ni ro'yxat DOIM bo'sh edi va E2E buni "0 ta
  /// hodisa" deb yozib turardi.
  ///
  /// Endi haqiqiy manba: `GET /api/notifications`. O'sha jadvalni
  /// sayt ham o'qiydi, shuning uchun telefonda o'qilgan xabar saytda
  /// ham o'qilgan bo'lib ko'rinadi.
  ///
  /// `/api/records/:code/analytics` O'Z O'RNIDA QOLADI — u analitika
  /// uchun va bildirishnoma uning o'rnini bosmaydi. Ko'rish va bosish
  /// statistikasi bildirishnomaga aylantirilmaydi: Activity — odamga
  /// tegishli hodisalar, analitika esa raqamlar.
  Future<Result<NotificationPage>> list({int cursor = 0}) async {
    final q = cursor > 0 ? '?cursor=$cursor' : '';
    final res = await _api.get<Map<String, dynamic>>('/api/notifications$q');
    return res.map(NotificationPage.fromJson);
  }

  /// Bittasini o'qilgan deb belgilash. Server aniq sanoqni qaytaradi.
  Future<Result<int>> markRead(int id) async {
    final res = await _api.post<Map<String, dynamic>>('/api/notifications/$id/read');
    return res.map((j) => (j['unreadCount'] as num?)?.toInt() ?? 0);
  }

  Future<Result<int>> markAllRead() async {
    final res = await _api.post<Map<String, dynamic>>('/api/notifications/read-all');
    return res.map((j) => (j['unreadCount'] as num?)?.toInt() ?? 0);
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
