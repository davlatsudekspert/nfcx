import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Profil musiqasi havolasining TURI.
///
/// Saytdagi `src/lib/music.js` (`parseMusicSource`) bilan bir xil
/// qoidalar: profil egasi musiqaga mp3 fayl emas, YouTube yoki
/// Yandex Music havolasini ham qo'yishi mumkin. Bunday havolani
/// `video_player` ijro eta olmaydi — u sahifa, audio oqim emas —
/// va pleyer "Qo'shiqni ochib bo'lmadi" der edi (2026-10-05,
/// PPP777 profili: ikki YouTube + bitta Yandex havola).
///
/// Ilovada YouTube/Yandex ichki vidjeti yo'q, shuning uchun bunday
/// trek o'sha xizmatning o'z ilovasida (yoki brauzerda) ochiladi.
enum MusicKind { audio, youtube, yandex }

@immutable
class MusicSource {
  const MusicSource._(this.kind, this.url, [this.id = '']);

  final MusicKind kind;

  /// Asl havola — tashqi ilovada aynan shu ochiladi.
  final String url;

  /// YouTube video ID si (faqat `youtube` uchun).
  final String id;

  bool get isExternal => kind != MusicKind.audio;

  /// Xizmat nomi — sarlavha topilmaguncha shu ko'rsatiladi.
  String get serviceName => switch (kind) {
    MusicKind.youtube => 'YouTube',
    MusicKind.yandex => 'Yandex Music',
    MusicKind.audio => '',
  };

  static final _yt = RegExp(
    r'(?:youtube\.com/(?:watch\?(?:[^ ]*&)?v=|embed/|shorts/|live/|v/)|youtu\.be/)([A-Za-z0-9_-]{11})',
    caseSensitive: false,
  );
  static final _ytMusic = RegExp(r'[?&]v=([A-Za-z0-9_-]{11})');
  static final _yandex = RegExp(
    r'music\.yandex\.[a-z.]+',
    caseSensitive: false,
  );

  static MusicSource parse(String raw) {
    final s = raw.trim();
    final m = _yt.firstMatch(s);
    if (m != null) return MusicSource._(MusicKind.youtube, s, m.group(1)!);
    if (s.toLowerCase().contains('music.youtube.com')) {
      final v = _ytMusic.firstMatch(s);
      if (v != null) return MusicSource._(MusicKind.youtube, s, v.group(1)!);
    }
    if (_yandex.hasMatch(s)) return MusicSource._(MusicKind.yandex, s);
    return MusicSource._(MusicKind.audio, s);
  }
}

/// YouTube sarlavhasi — RASMIY oEmbed metama'lumoti.
///
/// Sayt ham xuddi shunday qiladi (`fetchYoutubeTitle`). Faqat nom
/// so'raladi; audio oqimi olinmaydi. Tarmoq yo'q yoki xato bo'lsa
/// `null` — chaqiruvchi xizmat nomini ko'rsatib qoladi.
final Map<String, Future<String?>> _ytTitles = {};

@visibleForTesting
Future<String?> Function(String id)? youtubeTitleOverride;

Future<String?> youtubeTitle(String id) {
  if (id.isEmpty) return Future.value(null);
  final o = youtubeTitleOverride;
  if (o != null) return o(id);
  return _ytTitles.putIfAbsent(id, () async {
    try {
      final r =
          await Dio(
            BaseOptions(
              connectTimeout: const Duration(seconds: 6),
              receiveTimeout: const Duration(seconds: 6),
            ),
          ).get<Map<String, dynamic>>(
            'https://www.youtube.com/oembed',
            queryParameters: {
              'url': 'https://www.youtube.com/watch?v=$id',
              'format': 'json',
            },
          );
      final t = r.data?['title'];
      return t is String && t.trim().isNotEmpty ? t.trim() : null;
    } catch (_) {
      // Keyingi ochilishda qayta urinib ko'rilsin.
      _ytTitles.remove(id);
      return null;
    }
  });
}
