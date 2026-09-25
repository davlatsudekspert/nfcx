import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';
import '../models/models.dart';

/// NFCSTORE musiqa kutubxonasi (`GET /api/music`, hosting/api/music.js).
///
/// Faqat admin YOQGAN treklar keladi — huquqi bizda bo'lgan musiqa
/// (o'z kanalimiz yoki CC0 / public domain).
class MusicRepository {
  MusicRepository(this._api);
  final ApiClient _api;

  Future<Result<MusicLibrary>> library({String genre = '', String q = ''}) async {
    final res = await _api.get<Map<String, dynamic>>('/api/music', query: {
      if (genre.isNotEmpty) 'genre': genre,
      if (q.trim().isNotEmpty) 'q': q.trim(),
    });
    return res.map((j) => MusicLibrary(
          tracks: parseList(j['tracks'], MusicTrack.fromJson),
          genres: [
            for (final g in (j['genres'] as List? ?? const []))
              if (g is String && g.isNotEmpty) g,
          ],
        ));
  }
}

class MusicLibrary {
  const MusicLibrary({this.tracks = const [], this.genres = const []});
  final List<MusicTrack> tracks;
  final List<String> genres;
}

final musicRepositoryProvider = Provider<MusicRepository>(
  (ref) => MusicRepository(ref.watch(apiProvider)),
);
