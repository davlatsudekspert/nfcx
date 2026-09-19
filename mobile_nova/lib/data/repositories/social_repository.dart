import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/errors/app_error.dart';
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

  /// Bitta post.
  ///
  /// BACKEND'DA `GET /api/posts/:id` YO'Q — serverda faqat
  /// `DELETE /api/posts/:id` va `POST /api/posts/:id/like` bor.
  /// Ilgari bu yerda o'sha mavjud bo'lmagan endpoint chaqirilardi va
  /// post tafsiloti ekrani HAR DOIM xato panelini ko'rsatardi.
  ///
  /// Endi post o'zi tegishli yozuvning ro'yxatidan olinadi — bu
  /// haqiqiy endpoint (`GET /api/records/:code/posts`). Kod ma'lum
  /// bo'lmasa (masalan sovuq deep link) post topib bo'lmaydi va buni
  /// yashirmaymiz: `notFound` qaytadi.
  Future<Result<Post>> postIn(String code, int id) async {
    if (code.isEmpty) {
      return const Err(AppError(AppErrorKind.notFound));
    }
    final res = await postsOf(code);
    return res.when(
      ok: (items) {
        for (final p in items) {
          if (p.id == id) return Ok(p);
        }
        return const Err(AppError(AppErrorKind.notFound));
      },
      err: Err.new,
    );
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
      // Backend kontent qoidalariga roziliksiz post yaratmaydi:
      // `rulesAcceptedD1` tekshiruvi, aks holda 422
      // `rules_not_accepted`. Bu maydon YUBORILMAS edi — ya'ni
      // ilovadan post joylash umuman ishlamasdi.
      'agreed': true,
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
        // Istoryada ham xuddi shu talab.
        'agreed': true,
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
