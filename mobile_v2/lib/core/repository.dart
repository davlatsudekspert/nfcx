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

  Future<String> requestRegisterCode(String email) async {
    final r = _map(await api.post('/api/auth/request-register-code', {
      'email': email,
      'phone': '',
    }));
    return (r['channel'] ?? 'email').toString();
  }

  Future<String> register({
    required String email,
    required String password,
    required String emailCode,
  }) async {
    final response = await api.postAuth('/api/auth/register', {
      'email': email,
      'password': password,
      'phone': '',
      'emailCode': emailCode,
      'tosAccepted': true,
    });
    final token = response.token;
    if (token.isNotEmpty) api.token = token;
    return token;
  }

  Future<void> requestPasswordReset(String email) =>
      api.post('/api/auth/request-password-reset', {'email': email});

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