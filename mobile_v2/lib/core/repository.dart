import 'api.dart';
import 'models.dart';

class Repository {
  Repository(this.api);
  final ApiClient api;

  Map<String, dynamic> _map(dynamic raw) =>
      raw is Map ? raw.cast<String, dynamic>() : <String, dynamic>{};

  List<Map<String, dynamic>> _list(dynamic raw, [String? key]) {
    final value = key == null ? raw : (raw is Map ? raw[key] : null);
    return value is List
        ? value.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
        : const [];
  }

  Future<String> login(String login, String password) async {
    final response = await api.postAuth('/api/auth/login', {
      'login': login,
      'password': password,
    });
    final token = response.token;
    if (token.isEmpty) throw const ApiException('no_token');
    api.token = token;
    return token;
  }

  Future<String> requestRegisterCode({
    required String email,
    required String phone,
  }) async {
    final r = _map(await api.post('/api/auth/request-register-code', {
      'email': email,
      'phone': phone,
    }));
    return (r['channel'] ?? 'email').toString();
  }

  Future<String> register({
    required String email,
    required String phone,
    required String password,
    required String emailCode,
    String promoCode = '',
  }) async {
    final response = await api.postAuth('/api/auth/register', {
      'email': email,
      'phone': phone,
      'password': password,
      'emailCode': emailCode,
      'tosAccepted': true,
      if (promoCode.trim().isNotEmpty) 'promoCode': promoCode.trim().toUpperCase(),
    });
    final token = response.token;
    if (token.isNotEmpty) api.token = token;
    return token;
  }

  Future<void> requestPasswordReset(String email) =>
      api.post('/api/auth/request-password-reset', {'email': email});

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) =>
      api.post('/api/settings/change-password-direct', {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });

  Future<void> deleteAccount() => api.delete('/api/account');

  Future<void> resetPassword({
    required String email,
    required String code,
    required String password,
  }) =>
      api.post('/api/auth/reset-password', {
        'email': email,
        'code': code,
        'password': password,
      });


  Future<({AppUser? user, List<IdentityProfile> profiles})> me() async {
    final r = _map(await api.get('/api/auth/me'));
    final rawUser = r['user'];
    return (
      user: rawUser is Map ? AppUser.fromJson(rawUser.cast<String, dynamic>()) : null,
      profiles: _list(r, 'cards').map(IdentityProfile.fromJson).toList(),
    );
  }

  Future<List<Company>> myCompanies() async =>
      _list(await api.get('/api/companies/mine'), 'companies')
          .map(Company.fromJson)
          .toList();

  Future<void> logout() async {
    try {
      await api.post('/api/auth/logout');
    } finally {
      api.token = null;
    }
  }

  Future<IdentityProfile> profile(String code) async =>
      IdentityProfile.fromJson(_map(await api.get('/api/records/' + code)));

  Future<List<PostItem>> posts(String code) async =>
      _list(await api.get('/api/records/' + code + '/posts'), 'posts')
          .map(PostItem.fromJson)
          .toList();

  Future<List<StoryBubble>> storyFeed() async {
    try {
      return _list(await api.get('/api/stories/feed'), 'feed')
          .map(StoryBubble.fromJson)
          .toList();
    } catch (_) {
      return const [];
    }
  }

  Future<List<IdentityProfile>> catalog() async =>
      _list(await api.get('/api/records')).map(IdentityProfile.fromJson).toList();

  Future<List<IdentityProfile>> searchProfiles(String q) async =>
      _list(await api.get('/api/records/search', query: {'q': q}), 'records')
          .map(IdentityProfile.fromJson)
          .toList();

  Future<List<Company>> companies() async =>
      _list(await api.get('/api/companies'), 'companies')
          .map(Company.fromJson)
          .toList();

  Future<List<Company>> searchCompanies(String q) async =>
      _list(await api.get('/api/companies/search', query: {'q': q}), 'companies')
          .map(Company.fromJson)
          .toList();

  Future<Company> company(String id) async {
    final r = _map(await api.get('/api/companies/' + id));
    final raw = r['company'];
    return Company.fromJson(raw is Map ? raw.cast<String, dynamic>() : r);
  }

  Future<List<Product>> companyCatalog(String id) async =>
      _list(await api.get('/api/companies/' + id + '/catalog'), 'items')
          .map(Product.fromJson)
          .toList();

  Future<List<PostItem>> companyPosts(String id) async =>
      _list(await api.get('/api/companies/' + id + '/posts'), 'posts')
          .map(PostItem.fromJson)
          .toList();

  Future<Map<String, dynamic>> checkCompanyId(String id) async =>
      _map(await api.get('/api/companies/check', query: {'id': id}));

  Future<Map<String, dynamic>> createCompany(Map<String, dynamic> body) async =>
      _map(await api.post('/api/companies', body));

  Map<String, dynamic> _profilePayload(IdentityProfile p) => {
        'name': p.name,
        'role': p.role,
        'avatarUrl': p.avatarUrl ?? '',
        'bgUrl': p.coverUrl ?? '',
        'bgPattern': p.bgPattern,
        'accentColor': p.accentColor,
        'bgColor': p.bgColor,
        'bgAnimated': p.bgAnimated,
        'linksTransparent': p.linksTransparent,
        'linkStyle': p.linkStyle,
        'profileType': p.profileType,
        'city': p.city,
        'categorySlug': p.categorySlug,
        'address': p.address,
        'latitude': p.latitude,
        'longitude': p.longitude,
        'hiddenFromDirectory': p.hiddenFromDirectory,
        'leadCapture': p.leadCapture,
        'tg': p.tg,
        'phone': p.phone,
        'email': p.email,
        'linkedin': p.linkedin,
        'instagram': p.instagram,
        'about': p.about,
        'facebook': p.facebook,
        'twitter': p.twitter,
        'website': p.website,
        'cardNumber': p.cardNumber,
        'theme': p.theme,
        'hidePhone': p.hidePhone,
        'companyId': p.companyId,
        'hashtags': p.hashtags,
        'extraLinks': p.extraLinks,
        'musicUrls': p.musicUrls,
        'cardNumbers': p.cardNumbers,
        if (p.cardDesign != null) 'cardDesign': p.cardDesign,
      };

  Future<IdentityProfile> updateProfile(
    String code,
    Map<String, dynamic> body,
  ) async {
    // Backend profil PUT kontrakti to‘liq record yuborilishini kutadi.
    // Shuning uchun qisman tahrir boshqa, ko‘rinmayotgan maydonlarni
    // tasodifan bo‘shatib yubormasligi uchun avval joriy holat bilan
    // birlashtiriladi.
    final current = await profile(code);
    final merged = _profilePayload(current)..addAll(body);
    return IdentityProfile.fromJson(
      _map(await api.put('/api/records/' + code, merged)),
    );
  }



  Future<({bool following, int followers})> toggleCompanyFollow(
    String id,
  ) async {
    final r = _map(await api.post('/api/companies/' + id + '/follow'));
    final raw = r['followers'];
    return (
      following: r['following'] == true,
      followers:
          raw is num ? raw.round() : int.tryParse('$raw') ?? 0,
    );
  }


  Future<FollowStats> followStats(String code) async =>
      FollowStats.fromJson(_map(await api.get('/api/follow-stats/' + code)));

  Future<void> follow(String code) => api.post('/api/follow/' + code);
  Future<void> unfollow(String code) => api.post('/api/unfollow/' + code);

  Future<void> tap(String code) async {
    try {
      await api.post('/api/tap/' + code);
    } catch (_) {}
  }


  Future<({List<FeedItem> items, bool hasMore})> feed({int page = 1}) async {
    final r = _map(await api.get('/api/feed', query: {'page': page}));
    return (
      items: _list(r, 'feed').map(FeedItem.fromJson).toList(),
      hasMore: r['hasMore'] == true,
    );
  }

  Future<({bool liked, int count})> likePost(int id) async {
    final r = _map(await api.post('/api/posts/' + id.toString() + '/like'));
    final raw = r['count'];
    return (
      liked: r['liked'] == true,
      count: raw is num ? raw.round() : int.tryParse('$raw') ?? 0,
    );
  }

  Future<({bool liked, int count})> likeStory(int id) async {
    final r = _map(await api.post('/api/stories/' + id.toString() + '/like'));
    final raw = r['count'] ?? r['likeCount'];
    return (
      liked: r['liked'] == true,
      count: raw is num ? raw.round() : int.tryParse('$raw') ?? 0,
    );
  }

  Future<int> viewStory(int id) async {
    final r = _map(await api.post('/api/stories/' + id.toString() + '/view'));
    final raw = r['viewCount'];
    return raw is num ? raw.round() : int.tryParse('$raw') ?? 0;
  }

  Future<String> uploadMedia(
    List<int> bytes, {
    String contentType = 'image/jpeg',
  }) async {
    final r = _map(await api.upload('/api/upload-media', bytes, contentType: contentType));
    final url = (r['url'] ?? '').toString();
    if (url.isEmpty) throw const ApiException('bad_media');
    return url;
  }

  Future<String> uploadFile(
    List<int> bytes, {
    required String contentType,
  }) async {
    final r = _map(
      await api.upload('/api/upload-file', bytes, contentType: contentType),
    );
    final url = (r['url'] ?? '').toString();
    if (url.isEmpty) throw const ApiException('bad_file');
    return url;
  }

  Future<PostItem> addPost(
    String code, {
    String? imageUrl,
    String? videoUrl,
    String caption = '',
    required bool agreed,
  }) async {
    final r = _map(await api.post('/api/records/' + code + '/posts', {
      if (imageUrl != null) 'imageUrl': imageUrl,
      if (videoUrl != null) 'videoUrl': videoUrl,
      if (caption.isNotEmpty) 'caption': caption,
      'agreed': agreed,
    }));
    return PostItem.fromJson(r);
  }

  Future<void> addStory(
    String code, {
    String? imageUrl,
    String? videoUrl,
    String caption = '',
    required bool agreed,
  }) =>
      api.post('/api/records/' + code + '/stories', {
        if (imageUrl != null) 'imageUrl': imageUrl,
        if (videoUrl != null) 'videoUrl': videoUrl,
        if (caption.isNotEmpty) 'caption': caption,
        'agreed': agreed,
      });

  Future<void> deleteRecord(String code) =>
      api.delete('/api/records/' + code);

  Future<void> deletePost(int id) => api.delete('/api/posts/' + id.toString());
  Future<void> deleteStory(int id) => api.delete('/api/stories/' + id.toString());


  Future<({List<CommentItem> comments, bool hasMore, int total})> comments(
    String kind,
    int id, {
    int page = 1,
    int limit = 30,
  }) async {
    final r = _map(
      await api.get(
        '/api/comments/' + kind + '/' + id.toString(),
        query: {'page': page, 'limit': limit},
      ),
    );
    final rawTotal = r['total'];
    return (
      comments: _list(r, 'comments').map(CommentItem.fromJson).toList(),
      hasMore: r['hasMore'] == true,
      total: rawTotal is num
          ? rawTotal.round()
          : int.tryParse('$rawTotal') ?? 0,
    );
  }

  Future<({CommentItem comment, int total})> addComment(
    String kind,
    int id,
    String body, {
    int parentId = 0,
  }) async {
    final r = _map(
      await api.post('/api/comments/' + kind + '/' + id.toString(), {
        'body': body,
        if (parentId > 0) 'parentId': parentId,
      }),
    );
    final raw = r['comment'];
    final rawTotal = r['total'];
    return (
      comment: CommentItem.fromJson(
        raw is Map ? raw.cast<String, dynamic>() : r,
      ),
      total: rawTotal is num
          ? rawTotal.round()
          : int.tryParse('$rawTotal') ?? 0,
    );
  }

  Future<int> deleteComment(int id) async {
    final r = _map(await api.delete('/api/comments/' + id.toString()));
    final raw = r['total'];
    return raw is num ? raw.round() : int.tryParse('$raw') ?? 0;
  }

  Future<({bool liked, int count})> likeContent(
    String kind,
    int id,
  ) async {
    final r = _map(
      await api.post('/api/content-likes/' + kind + '/' + id.toString()),
    );
    final raw = r['count'];
    return (
      liked: r['liked'] == true,
      count: raw is num ? raw.round() : int.tryParse('$raw') ?? 0,
    );
  }

  Future<({bool liked, int count})> likeComment(int id) =>
      likeContent('comment', id);


  Future<void> report({
    required String targetKind,
    required String targetId,
    required String reason,
    String ownerCode = '',
    String note = '',
  }) =>
      api.post('/api/reports', {
        'targetKind': targetKind,
        'targetId': targetId,
        'reason': reason,
        if (ownerCode.isNotEmpty) 'ownerCode': ownerCode,
        if (note.isNotEmpty) 'note': note,
      });

  Future<void> block(String kind, String id) =>
      api.post('/api/blocks', {'kind': kind, 'id': id});

  Future<void> unblock(String kind, String id) =>
      api.delete('/api/blocks/' + kind + '/' + id);

}