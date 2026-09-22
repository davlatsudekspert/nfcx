String _s(dynamic v) => v == null ? '' : '$v';
int _i(dynamic v) => v is num ? v.round() : int.tryParse('$v') ?? 0;
bool _b(dynamic v) => v == true || v == 1 || '$v'.toLowerCase() == 'true';

String? absoluteUrl(dynamic raw) {
  final v = _s(raw).trim();
  if (v.isEmpty) return null;
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:')) return v;
  return v.startsWith('/') ? 'https://nfcstore.uz$v' : 'https://nfcstore.uz/$v';
}

class AppUser {
  const AppUser({required this.id, required this.email, this.phone = ''});
  final int id;
  final String email;
  final String phone;

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: _i(j['id']),
        email: _s(j['email']),
        phone: _s(j['phone']),
      );
}

class IdentityProfile {
  const IdentityProfile({
    required this.code,
    required this.name,
    this.role = '',
    this.avatarUrl,
    this.coverUrl,
    this.about = '',
    this.views = 0,
    this.verified = false,
    this.isPrimary = false,
  });

  final String code;
  final String name;
  final String role;
  final String? avatarUrl;
  final String? coverUrl;
  final String about;
  final int views;
  final bool verified;
  final bool isPrimary;

  factory IdentityProfile.fromJson(Map<String, dynamic> j) => IdentityProfile(
        code: _s(j['code']).toUpperCase(),
        name: _s(j['name'] ?? j['displayName']),
        role: _s(j['role'] ?? j['title']),
        avatarUrl: absoluteUrl(j['avatarUrl'] ?? j['avatar']),
        coverUrl: absoluteUrl(j['bgUrl'] ?? j['coverUrl']),
        about: _s(j['about']),
        views: _i(j['views']),
        verified: _b(j['verified']),
        isPrimary: _b(j['isPrimary']),
      );
}

class Company {
  const Company({
    required this.id,
    required this.name,
    this.logoUrl,
    this.about = '',
    this.city = '',
    this.followers = 0,
    this.views = 0,
    this.verified = false,
  });

  final String id;
  final String name;
  final String? logoUrl;
  final String about;
  final String city;
  final int followers;
  final int views;
  final bool verified;

  factory Company.fromJson(Map<String, dynamic> j) => Company(
        id: _s(j['companyId'] ?? j['id']).toUpperCase(),
        name: _s(j['displayName'] ?? j['name']),
        logoUrl: absoluteUrl(j['logoUrl']),
        about: _s(j['about'] ?? j['description']),
        city: _s(j['city']),
        followers: _i(j['followers']),
        views: _i(j['views']),
        verified: _b(j['verified']),
      );
}

class FollowStats {
  const FollowStats({this.followers = 0, this.following = 0, this.isFollowing = false});
  final int followers;
  final int following;
  final bool isFollowing;

  factory FollowStats.fromJson(Map<String, dynamic> j) => FollowStats(
        followers: _i(j['followers']),
        following: _i(j['following']),
        isFollowing: _b(j['isFollowing'] ?? j['following_by_me']),
      );
}

class StoryBubble {
  const StoryBubble({
    required this.code,
    required this.name,
    this.avatarUrl,
    this.storyIds = const [],
  });

  final String code;
  final String name;
  final String? avatarUrl;
  final List<int> storyIds;

  factory StoryBubble.fromJson(Map<String, dynamic> j) {
    final stories = j['stories'];
    return StoryBubble(
      code: _s(j['code']).toUpperCase(),
      name: _s(j['name']),
      avatarUrl: absoluteUrl(j['avatarUrl']),
      storyIds: stories is List
          ? stories.whereType<Map>().map((e) => _i(e['id'])).where((id) => id > 0).toList()
          : const [],
    );
  }
}

class PostItem {
  const PostItem({
    required this.id,
    this.caption = '',
    this.imageUrl,
    this.videoUrl,
    this.likes = 0,
    this.views = 0,
  });

  final int id;
  final String caption;
  final String? imageUrl;
  final String? videoUrl;
  final int likes;
  final int views;

  factory PostItem.fromJson(Map<String, dynamic> j) {
    String? image;
    final images = j['images'];
    if (images is List && images.isNotEmpty) {
      final first = images.first;
      image = absoluteUrl(first is Map ? first['url'] : first);
    }
    image ??= absoluteUrl(j['imageUrl'] ?? j['mediaUrl'] ?? j['url']);
    return PostItem(
      id: _i(j['id']),
      caption: _s(j['caption'] ?? j['text']),
      imageUrl: image,
      videoUrl: absoluteUrl(j['videoUrl']),
      likes: _i(j['likes'] ?? j['likeCount']),
      views: _i(j['views'] ?? j['viewCount']),
    );
  }
}

class FeedItem {
  const FeedItem({
    required this.kind,
    required this.id,
    required this.code,
    required this.name,
    this.authorKind = 'card',
    this.avatarUrl,
    this.imageUrl,
    this.videoUrl,
    this.caption = '',
    this.likeCount = 0,
    this.liked = false,
    this.likeable = false,
  });

  final String kind;
  final int id;
  final String code;
  final String name;
  final String authorKind;
  final String? avatarUrl;
  final String? imageUrl;
  final String? videoUrl;
  final String caption;
  final int likeCount;
  final bool liked;
  final bool likeable;

  bool get isStory => kind == 'story';
  bool get isCompany => authorKind == 'company';

  factory FeedItem.fromJson(Map<String, dynamic> j) => FeedItem(
        kind: _s(j['kind']).isEmpty ? 'post' : _s(j['kind']),
        id: _i(j['id']),
        code: _s(j['code']).toUpperCase(),
        name: _s(j['name']),
        authorKind: _s(j['authorKind']).isEmpty ? 'card' : _s(j['authorKind']),
        avatarUrl: absoluteUrl(j['avatarUrl']),
        imageUrl: absoluteUrl(j['imageUrl']),
        videoUrl: absoluteUrl(j['videoUrl']),
        caption: _s(j['caption']),
        likeCount: _i(j['likeCount']),
        liked: _b(j['liked']),
        likeable: _b(j['likeable']),
      );

  FeedItem copyWith({int? likeCount, bool? liked}) => FeedItem(
        kind: kind,
        id: id,
        code: code,
        name: name,
        authorKind: authorKind,
        avatarUrl: avatarUrl,
        imageUrl: imageUrl,
        videoUrl: videoUrl,
        caption: caption,
        likeCount: likeCount ?? this.likeCount,
        liked: liked ?? this.liked,
        likeable: likeable,
      );
}
