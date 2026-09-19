import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';
import '../models/models.dart';

/// Postlar, storylar va reels.
class SocialRepository {
  SocialRepository(this._api);
  final ApiClient _api;

  /// NFC ID ga tegishli postlar.
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async {
    final res = await _api.get<Map<String, dynamic>>(
      '/api/records/$code/posts',
      query: {'page': page},
    );
    return res.map((j) => parseList(j['posts'] ?? j['items'], Post.fromJson));
  }

  Future<Result<Post>> post(int id) async {
    final res = await _api.get<Map<String, dynamic>>('/api/posts/$id');
    final v = res.valueOrNull;
    if (res case Err(:final error)) return Err(error);
    final map = v!['post'] ?? v;
    return Ok(Post.fromJson((map as Map).cast<String, dynamic>()));
  }

  Future<Result<void>> like(int id) => _api.post<void>('/api/posts/$id/like');

  Future<Result<void>> deletePost(int id) => _api.delete<void>('/api/posts/$id');

  Future<Result<Post>> createPost({
    required String code,
    required String text,
    List<String> mediaUrls = const [],
    bool isVideo = false,
  }) async {
    final res = await _api.post<Map<String, dynamic>>('/api/records/$code/posts', {
      'text': text,
      'media': mediaUrls,
      if (isVideo) 'type': 'reel',
    });
    return res.map((j) =>
        Post.fromJson(((j['post'] ?? j) as Map).cast<String, dynamic>()));
  }

  /// Videolar — backend'da `videos` alohida turadi va Reels shundan quriladi.
  Future<Result<List<Post>>> videosOf(String code) async {
    final res = await _api.get<Map<String, dynamic>>('/api/records/$code/videos');
    return res.map((j) => parseList(j['videos'] ?? j['items'], Post.fromJson));
  }

  Future<Result<void>> deleteVideo(String code, int id) =>
      _api.delete<void>('/api/records/$code/videos/$id');

  /// Story — backend'da `gallery` sifatida saqlanadi.
  Future<Result<List<StoryItem>>> storiesOf(String code) async {
    final res = await _api.get<Map<String, dynamic>>('/api/records/$code/gallery');
    return res.map((j) => parseList(j['gallery'] ?? j['items'], StoryItem.fromJson));
  }

  Future<Result<void>> deleteStory(String code, int id) =>
      _api.delete<void>('/api/records/$code/gallery/$id');

  Future<Result<void>> createStory({
    required String code,
    required String mediaUrl,
    bool isVideo = false,
  }) =>
      _api.post<void>('/api/records/$code/gallery', {
        'url': mediaUrl,
        if (isVideo) 'type': 'video',
      });

  /// Kashfiyot lentasi — barcha ommaviy postlar.
  Future<Result<List<Post>>> feed({int page = 1}) async {
    final res = await _api
        .get<Map<String, dynamic>>('/api/news', query: {'page': page});
    return res.map((j) => parseList(j['news'] ?? j['items'], Post.fromJson));
  }

  Future<Result<void>> likeNews(int id) => _api.post<void>('/api/news/$id/like');
}

final socialRepositoryProvider = Provider<SocialRepository>(
  (ref) => SocialRepository(ref.watch(apiProvider)),
);
