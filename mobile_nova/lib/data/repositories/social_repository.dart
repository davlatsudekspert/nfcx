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

  /// POSTGA LAYK — bosilganda holat teskarisiga o'giriladi.
  ///
  /// Server `{ liked, count }` qaytaradi, lekin bu metod ilgari
  /// `Result<void>` edi va javobni TASHLAB YUBORARDI. Natijada
  /// ilova sanoqni o'zi taxmin qilishga majbur bo'lardi va ikki
  /// qurilmadan bosilganda son chalkashardi.
  Future<Result<({bool liked, int count})>> like(int id) async {
    final res =
        await _api.post<Map<String, dynamic>>('/api/posts/$id/like', const {});
    return res.map((j) => (
          liked: j['liked'] == true,
          count: (j['count'] as num?)?.toInt() ?? 0,
        ));
  }

  Future<Result<void>> deletePost(int id) => _api.delete<void>('/api/posts/$id');

  /// Post yaratish.
  ///
  /// ## SERVER KUTADIGAN SHAKL — TAXMIN EMAS, O'QILGAN
  ///
  ///     const imageUrl = String(body?.imageUrl || '');
  ///     const videoUrl = String(body?.videoUrl || '');
  ///     const caption  = String(body?.caption  || '').slice(0, 600);
  ///     const okImg = imageUrl.startsWith('/uploads/') && ...
  ///     const okVid = videoUrl.startsWith('/uploads/') && /\.(mp4|webm)$/i...
  ///     if (!okImg && !okVid) return json({ error: 'bad_image' }, 422);
  ///
  /// Ilgari bu yerdan `text` va `media: []` yuborilardi. Server
  /// bunday maydonlarni umuman o'qimaydi, shuning uchun HAR BIR post
  /// 422 `bad_image` bilan tugardi — ya'ni ilovadan post joylash
  /// UMUMAN ishlamasdi. Buni haqiqiy hisobdagi E2E ko'rsatdi:
  ///
  ///     POST /api/records/VIP001/posts
  ///     {"text":"...","media":[],"agreed":true}  ->  422 bad_image
  ///
  /// MEDIA MAJBURIY: serverda rasm ham, video ham bo'lmasa post
  /// yaratilmaydi. Shuning uchun [imageUrl] yoki [videoUrl] dan
  /// kamida bittasi bo'lishi shart va UI ham shuni talab qiladi —
  /// foydalanuvchi "joylash" tugmasini bosib 422 olmasin.
  Future<Result<Post>> createPost({
    required String code,
    String caption = '',
    String imageUrl = '',
    String videoUrl = '',
  }) async {
    if (imageUrl.isEmpty && videoUrl.isEmpty) {
      return const Err(AppError(
        AppErrorKind.validation,
        code: 'bad_image',
        detail: 'post uchun rasm yoki video majburiy',
      ));
    }
    final res = await _api.post<Map<String, dynamic>>('/api/records/$code/posts', {
      if (imageUrl.isNotEmpty) 'imageUrl': imageUrl,
      if (videoUrl.isNotEmpty) 'videoUrl': videoUrl,
      'caption': caption,
      // Backend kontent qoidalariga roziliksiz post yaratmaydi:
      // `rulesAcceptedD1` tekshiruvi, aks holda 422
      // `rules_not_accepted`.
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

  // ── ISTORYA ──────────────────────────────────────────────────
  //
  // MUHIM TUZATISH: bu yerda ilgari `/api/records/:code/gallery`
  // ishlatilardi. U MAVJUD endpoint, lekin BUTUNLAY BOSHQA narsa —
  // `hosting/api/media.js` dagi KARTA GALEREYASI (biznes yozuvlari
  // uchun statik rasmlar to'plami, `card_gallery` jadvali). Istorya
  // esa `stories` jadvalida va boshqa manzilda turadi:
  //
  //     GET    /api/records/:code/stories   -> { stories: [...] }
  //     POST   /api/records/:code/stories   -> 201
  //     DELETE /api/stories/:id
  //     POST   /api/stories/:id/view        -> ko'rildi
  //
  // Natijada ilova istoryani noto'g'ri joydan o'qirdi (shuning uchun
  // ro'yxat doim bo'sh edi) va yaratishga urinish gallereyaga borib,
  // u yerda "faqat biznes" sharti bilan rad etilardi.

  Future<Result<List<StoryItem>>> storiesOf(String code) async {
    final res = await _api.get<Map<String, dynamic>>('/api/records/$code/stories');
    return res.map((j) => parseList(j['stories'] ?? j['items'], StoryItem.fromJson));
  }

  /// OBUNA BO'LGANLARNING FAOL ISTORYALARI.
  ///
  /// `GET /api/stories/feed` serverda ALLAQACHON bor edi, lekin
  /// ilovada uni chaqiradigan joy YO'Q edi: bosh ekrandagi istorya
  /// qatori faqat O'Z profilingni ko'rsatardi. Ya'ni obuna
  /// bo'lganing odam istorya qo'ysa, sen uni ilovada umuman
  /// ko'rmasding.
  ///
  /// Server javobi ODAM BO'YICHA guruhlangan:
  ///
  ///     { feed: [ { code, name, avatarUrl, stories: [...] } ] }
  ///
  /// Bu yerda u yassilanadi va har bir istoryaga egasining kodi,
  /// ismi va surati yoziladi — qator uchun aynan shular kerak.
  /// Server allaqachon `expires_at > now` bo'yicha filtrlaydi,
  /// shuning uchun bu yerda muddati o'tganini qayta tekshirish
  /// shart emas.
  Future<Result<List<StoryItem>>> followedStories() async {
    final res = await _api.get<Map<String, dynamic>>('/api/stories/feed');
    return res.map((j) {
      final groups = j['feed'];
      if (groups is! List) return const <StoryItem>[];
      final out = <StoryItem>[];
      for (final g in groups) {
        if (g is! Map) continue;
        final code = '${g['code'] ?? ''}';
        final name = '${g['name'] ?? ''}';
        final avatar = '${g['avatarUrl'] ?? ''}';
        final list = g['stories'];
        if (list is! List) continue;
        for (final raw in list) {
          if (raw is! Map) continue;
          final item = StoryItem.fromJson({
            ...raw.cast<String, dynamic>(),
            'code': code,
            'authorName': name,
            'authorAvatar': avatar,
          });
          out.add(item);
        }
      }
      return out;
    });
  }

  /// ISTORYAGA LAYK — bosilganda holat teskarisiga o'giriladi.
  ///
  /// `POST /api/stories/:id/like` serverda ALLAQACHON bor edi va
  /// `{ liked, likeCount }` qaytaradi, lekin ilovada uni
  /// chaqiradigan joy YO'Q edi: istorya ko'ruvchisida layk tugmasi
  /// umuman chizilmagan.
  ///
  /// Server QAYTARGAN qiymat o'qiladi — mahalliy sanoq bilan
  /// taxmin qilinmaydi: ikki qurilmadan bosilsa sanoq chalkashardi.
  Future<Result<({bool liked, int likeCount})>> likeStory(int id) async {
    final res =
        await _api.post<Map<String, dynamic>>('/api/stories/$id/like', const {});
    return res.map((j) => (
          liked: j['liked'] == true,
          likeCount: (j['likeCount'] as num?)?.toInt() ?? 0,
        ));
  }

  /// Istoryani o'chirish — manzil KODSIZ, faqat `id` bo'yicha.
  Future<Result<void>> deleteStory(int id) =>
      _api.delete<void>('/api/stories/$id');

  /// Ko'rilgan deb belgilash.
  ///
  /// Bu endpoint BOR — `FINAL_GAPS.md` da xato ravishda "BACKEND
  /// REQUIRED" deb yozilgan edi. Ya'ni Home orbidagi halqa
  /// "ko'rilgan" holatini haqiqatan yangilay oladi.
  Future<Result<void>> markStorySeen(int id) =>
      _api.post<void>('/api/stories/$id/view');

  Future<Result<void>> createStory({
    required String code,
    String imageUrl = '',
    String videoUrl = '',
    String caption = '',
  }) {
    if (imageUrl.isEmpty && videoUrl.isEmpty) {
      return Future.value(const Err(AppError(
        AppErrorKind.validation,
        code: 'bad_image',
        detail: 'istorya uchun rasm yoki video majburiy',
      )));
    }
    return _api.post<void>('/api/records/$code/stories', {
      if (imageUrl.isNotEmpty) 'imageUrl': imageUrl,
      if (videoUrl.isNotEmpty) 'videoUrl': videoUrl,
      'caption': caption,
      // Istoryada ham xuddi shu talab.
      'agreed': true,
    });
  }

  // ── IZOHLAR ──────────────────────────────────────────────────
  //
  // Backend: `hosting/api/comments.js`. Bitta jadval, to'rt xil
  // kontent: `:kind` = post | company_post | story | company_story.
  //
  // DIQQAT: `API_GAPS.md` da bu endpointlar `/api/posts/:id/comments`
  // deb taxmin qilingan edi — u XATO taxmin. Haqiqiy manzil
  // `/api/comments/:kind/:id`.

  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
    String kind,
    int id, {
    int page = 1,
  }) async {
    final res = await _api.get<Map<String, dynamic>>(
      '/api/comments/$kind/$id',
      query: {'page': page},
    );
    return res.map((j) => (
          items: parseList(j['comments'], Comment.fromJson),
          hasMore: j['hasMore'] == true,
          total: j['total'] is int ? j['total'] as int : 0,
        ));
  }

  /// Izoh yozish. Server uzunlikni 1000 belgi bilan cheklaydi va
  /// daqiqasiga 10 tadan ortiq izohni rad etadi.
  /// Izoh yoki JAVOB yozish.
  ///
  /// `parentId` berilsa — javob. Server uni tekshiradi: ota izoh
  /// AYNAN shu kontentga tegishli bo'lishi va o'zi javob bo'lmasligi
  /// shart (bir qavat). Ya'ni bu yerdan zanjir cho'zib bo'lmaydi.
  Future<Result<Comment>> addComment(
    String kind,
    int id,
    String body, {
    int parentId = 0,
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/api/comments/$kind/$id',
      {'body': body, if (parentId > 0) 'parentId': parentId},
    );
    return res.map((j) =>
        Comment.fromJson(((j['comment'] ?? j) as Map).cast<String, dynamic>()));
  }

  /// Izohni o'chirish.
  ///
  /// Huquq ikki tomonlama: izoh muallifi ham, kontent egasi ham
  /// o'chira oladi. Buni server tekshiradi.
  Future<Result<void>> deleteComment(int commentId) =>
      _api.delete<void>('/api/comments/$commentId');

  /// Izohga like — bosilsa qo'yadi, qayta bosilsa oladi.
  ///
  /// Kontent like'lari bilan BIR XIL yo'l va bir xil jadval
  /// (`content_likes`), faqat turi `comment`. Alohida tizim
  /// yaratilmadi: sanoq, takrorlanmaslik va tezlik cheklovi
  /// o'sha joyda allaqachon yozilgan.
  Future<Result<({bool liked, int count})>> toggleCommentLike(int id) async {
    final res = await _api
        .post<Map<String, dynamic>>('/api/content-likes/comment/$id', const {});
    return res.map((j) => (
          liked: j['liked'] == true,
          count: (j['count'] as num?)?.toInt() ?? 0,
        ));
  }

  /// Kashfiyot lentasi — barcha ommaviy postlar.
  /// Asosiy ekrandagi lenta — HAQIQIY postlar.
  ///
  /// Ilgari `/api/news` (admin e'lonlari) o'qilardi, ya'ni Asosiy
  /// ekran ham, Kashfiyot ham foydalanuvchi postlarini umuman
  /// ko'rsatmasdi. Endi ikkalasi ham BITTA manbadan — `/api/feed` —
  /// oladi, shuning uchun bir joyda rasm ko'rinib boshqasida
  /// yo'qolib qolmaydi.
  Future<Result<List<Post>>> feed({int page = 1}) async {
    final res = await _api.get<Map<String, dynamic>>(
        '/api/feed', query: {'page': page, 'limit': 15});
    return res.map((j) => parseList(j['feed'] ?? j['items'], Post.fromJson)
        .where((p) => !p.isStory)
        .toList());
  }

  Future<Result<void>> likeNews(int id) => _api.post<void>('/api/news/$id/like');
}

final socialRepositoryProvider = Provider<SocialRepository>(
  (ref) => SocialRepository(ref.watch(apiProvider)),
);
