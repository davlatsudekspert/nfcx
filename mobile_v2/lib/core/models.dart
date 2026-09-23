String _s(dynamic v) => v == null ? '' : '$v';
int _i(dynamic v) => v is num ? v.round() : int.tryParse('$v') ?? 0;
bool _b(dynamic v) => v == true || v == 1 || '$v'.toLowerCase() == 'true';
double? _d(dynamic v) => v == null || '$v'.trim().isEmpty
    ? null
    : (v is num ? v.toDouble() : double.tryParse('$v'));

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
    this.city = '',
    this.phone = '',
    this.tg = '',
    this.instagram = '',
    this.website = '',
    this.email = '',
    this.address = '',
    this.companyId = '',
    this.profileType = 'personal',
    this.categorySlug = '',
    this.linkedin = '',
    this.facebook = '',
    this.twitter = '',
    this.cardNumber = '',
    this.theme = 'classic',
    this.linkStyle = 'standard',
    this.accentColor = '',
    this.bgColor = '',
    this.musicUrls = const [],
    this.extraLinks = const [],
    this.cardNumbers = const [],
    this.hashtags = const [],
    this.cardDesign,
    this.latitude,
    this.longitude,
    this.bgPattern = true,
    this.bgAnimated = true,
    this.linksTransparent = false,
    this.hidePhone = false,
    this.hiddenFromDirectory = false,
    this.leadCapture = false,
    this.views = 0,
    this.price = 0,
    this.verified = false,
    this.isPrimary = false,
  });

  final String code;
  final String name;
  final String role;
  final String? avatarUrl;
  final String? coverUrl;
  final String about;
  final String city;
  final String phone;
  final String tg;
  final String instagram;
  final String website;
  final String email;
  final String address;
  final String companyId;
  final String profileType;
  final String categorySlug;
  final String linkedin;
  final String facebook;
  final String twitter;
  final String cardNumber;
  final String theme;
  final String linkStyle;
  final String accentColor;
  final String bgColor;
  final List<String> musicUrls;
  final List<Map<String, dynamic>> extraLinks;
  final List<Map<String, dynamic>> cardNumbers;
  final List<String> hashtags;
  final Map<String, dynamic>? cardDesign;
  final double? latitude;
  final double? longitude;
  final bool bgPattern;
  final bool bgAnimated;
  final bool linksTransparent;
  final bool hidePhone;
  final bool hiddenFromDirectory;
  final bool leadCapture;
  final int views;
  final int price;
  final bool verified;
  final bool isPrimary;

  factory IdentityProfile.fromJson(Map<String, dynamic> j) => IdentityProfile(
        code: _s(j['code']).toUpperCase(),
        name: _s(j['name'] ?? j['displayName']),
        role: _s(j['role'] ?? j['title']),
        avatarUrl: absoluteUrl(j['avatarUrl'] ?? j['avatar']),
        coverUrl: absoluteUrl(j['bgUrl'] ?? j['coverUrl']),
        about: _s(j['about']),
        city: _s(j['city']),
        phone: _s(j['phone']),
        tg: _s(j['tg']),
        instagram: _s(j['instagram']),
        website: _s(j['website']),
        email: _s(j['email']),
        address: _s(j['address']),
        companyId: _s(j['companyId']).toUpperCase(),
        profileType:
            _s(j['profileType']).isEmpty ? 'personal' : _s(j['profileType']),
        categorySlug: _s(j['categorySlug']),
        linkedin: _s(j['linkedin']),
        facebook: _s(j['facebook']),
        twitter: _s(j['twitter']),
        cardNumber: _s(j['cardNumber']),
        theme: _s(j['theme']).isEmpty ? 'classic' : _s(j['theme']),
        linkStyle:
            _s(j['linkStyle']).isEmpty ? 'standard' : _s(j['linkStyle']),
        accentColor: _s(j['accentColor']),
        bgColor: _s(j['bgColor']),
        musicUrls: j['musicUrls'] is List
            ? (j['musicUrls'] as List)
                .map((e) => absoluteUrl(e))
                .whereType<String>()
                .toList()
            : [
                if (absoluteUrl(j['musicUrl']) case final String u) u,
              ],
        extraLinks: j['extraLinks'] is List
            ? (j['extraLinks'] as List)
                .whereType<Map>()
                .map((e) => e.cast<String, dynamic>())
                .toList()
            : const [],
        cardNumbers: j['cardNumbers'] is List
            ? (j['cardNumbers'] as List)
                .whereType<Map>()
                .map((e) => e.cast<String, dynamic>())
                .toList()
            : const [],
        hashtags: j['hashtags'] is List
            ? (j['hashtags'] as List).map((e) => '$e').toList()
            : const [],
        cardDesign: j['cardDesign'] is Map
            ? (j['cardDesign'] as Map).cast<String, dynamic>()
            : null,
        latitude: _d(j['latitude']),
        longitude: _d(j['longitude']),
        bgPattern: j.containsKey('bgPattern') ? _b(j['bgPattern']) : true,
        bgAnimated: j.containsKey('bgAnimated') ? _b(j['bgAnimated']) : true,
        linksTransparent: _b(j['linksTransparent']),
        hidePhone: _b(j['hidePhone']),
        hiddenFromDirectory: _b(j['hiddenFromDirectory']),
        leadCapture: _b(j['leadCapture']),
        views: _i(j['views']),
        price: _i(j['price']),
        verified: _b(j['verified']),
        isPrimary: _b(j['isPrimary']),
      );
}

class Company {
  const Company({
    required this.id,
    required this.name,
    this.logoUrl,
    this.coverUrl,
    this.about = '',
    this.city = '',
    this.address = '',
    this.phone = '',
    this.telegram = '',
    this.instagram = '',
    this.website = '',
    this.followers = 0,
    this.views = 0,
    this.following = false,
    this.verified = false,
    this.isOpen,
    this.hoursLabel = '',
    this.items = const [],
  });

  final String id;
  final String name;
  final String? logoUrl;
  final String? coverUrl;
  final String about;
  final String city;
  final String address;
  final String phone;
  final String telegram;
  final String instagram;
  final String website;
  final int followers;
  final int views;
  final bool following;
  final bool verified;
  final bool? isOpen;
  final String hoursLabel;
  final List<Product> items;

  factory Company.fromJson(Map<String, dynamic> j) {
    final raw = j['items'] ?? j['catalog'];
    final products = raw is List
        ? raw.whereType<Map>().map((e) => Product.fromJson(e.cast<String, dynamic>())).toList()
        : const <Product>[];
    return Company(
      id: _s(j['companyId'] ?? j['id']).toUpperCase(),
      name: _s(j['displayName'] ?? j['name']),
      logoUrl: absoluteUrl(j['logoUrl']),
      coverUrl: absoluteUrl(j['coverUrl']),
      about: _s(j['about'] ?? j['description']),
      city: _s(j['city']),
      address: _s(j['address']),
      phone: _s(j['phone']),
      telegram: _s(j['tg'] ?? j['telegram']),
      instagram: _s(j['instagram']),
      website: _s(j['website']),
      followers: _i(j['followers']),
      views: _i(j['views']),
      following: _b(j['following'] ?? j['isFollowing']),
      verified: _b(j['verified']),
      isOpen: j['isOpen'] is bool ? j['isOpen'] as bool : null,
      hoursLabel: _s(j['hoursLabel']),
      items: products,
    );
  }
}

class Product {
  const Product({
    required this.id,
    required this.name,
    this.description = '',
    this.price = 0,
    this.salePrice,
    this.imageUrl,
  });

  final String id;
  final String name;
  final String description;
  final int price;
  final int? salePrice;
  final String? imageUrl;

  int get effectivePrice => salePrice ?? price;

  factory Product.fromJson(Map<String, dynamic> j) {
    final rawSale = j['promotionPrice'] ?? j['salePrice'];
    return Product(
      id: _s(j['id']),
      name: _s(j['name']),
      description: _s(j['description'] ?? j['about']),
      price: _i(j['price']),
      salePrice: rawSale == null ? null : _i(rawSale),
      imageUrl: absoluteUrl(j['imageUrl'] ?? j['image']),
    );
  }
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
    this.commentCount = 0,
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
  final int commentCount;
  final bool liked;
  final bool likeable;

  bool get isStory => kind.toLowerCase().contains('story');
  bool get isCompany =>
      authorKind == 'company' || kind.toLowerCase().startsWith('company_');

  String get targetKind {
    final k = kind.toLowerCase();
    if (k == 'company_post' || k == 'company_story') return k;
    if (isCompany) return isStory ? 'company_story' : 'company_post';
    return isStory ? 'story' : 'post';
  }

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
        commentCount: _i(j['commentCount']),
        liked: _b(j['liked']),
        likeable: _b(j['likeable']),
      );

  FeedItem copyWith({int? likeCount, int? commentCount, bool? liked}) => FeedItem(
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
        commentCount: commentCount ?? this.commentCount,
        liked: liked ?? this.liked,
        likeable: likeable,
      );
}

class CommentItem {
  const CommentItem({
    required this.id,
    required this.targetKind,
    required this.targetId,
    required this.code,
    required this.name,
    required this.body,
    this.avatarUrl,
    this.createdAtMs = 0,
    this.mine = false,
    this.parentId = 0,
    this.likes = 0,
    this.liked = false,
  });

  final int id;
  final String targetKind;
  final int targetId;
  final String code;
  final String name;
  final String body;
  final String? avatarUrl;
  final int createdAtMs;
  final bool mine;
  final int parentId;
  final int likes;
  final bool liked;

  factory CommentItem.fromJson(Map<String, dynamic> j) => CommentItem(
        id: _i(j['id']),
        targetKind: _s(j['targetKind']),
        targetId: _i(j['targetId']),
        code: _s(j['code'] ?? j['authorCode']).toUpperCase(),
        name: _s(j['name'] ?? j['authorName']),
        body: _s(j['body']),
        avatarUrl: absoluteUrl(j['avatarUrl'] ?? j['authorAvatar']),
        createdAtMs: _i(j['createdAtMs'] ?? j['createdAt']),
        mine: _b(j['mine']),
        parentId: _i(j['parentId'] ?? j['parent_id']),
        likes: _i(j['likes']),
        liked: _b(j['liked']),
      );

  CommentItem copyWith({int? likes, bool? liked}) => CommentItem(
        id: id,
        targetKind: targetKind,
        targetId: targetId,
        code: code,
        name: name,
        body: body,
        avatarUrl: avatarUrl,
        createdAtMs: createdAtMs,
        mine: mine,
        parentId: parentId,
        likes: likes ?? this.likes,
        liked: liked ?? this.liked,
      );
}

class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    this.actorCode = '',
    this.avatarUrl,
    this.targetType = '',
    this.targetId = '',
    this.code = '',
    this.read = false,
    this.createdAt = '',
  });

  final int id;
  final String type;
  final String title;
  final String actorCode;
  final String? avatarUrl;
  final String targetType;
  final String targetId;
  final String code;
  final bool read;
  final String createdAt;

  factory NotificationItem.fromJson(Map<String, dynamic> j) =>
      NotificationItem(
        id: _i(j['id']),
        type: _s(j['type']),
        title: _s(j['title']),
        actorCode: _s(j['actorCode']).toUpperCase(),
        avatarUrl: absoluteUrl(j['avatarUrl']),
        targetType: _s(j['targetType']),
        targetId: _s(j['targetId']),
        code: _s(j['code']).toUpperCase(),
        read: _b(j['read']),
        createdAt: _s(j['createdAt']),
      );

  NotificationItem copyWith({bool? read}) => NotificationItem(
        id: id,
        type: type,
        title: title,
        actorCode: actorCode,
        avatarUrl: avatarUrl,
        targetType: targetType,
        targetId: targetId,
        code: code,
        read: read ?? this.read,
        createdAt: createdAt,
      );
}
