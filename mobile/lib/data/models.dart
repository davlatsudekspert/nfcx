import '../design/tokens.dart';
import 'api_client.dart';

/// Xavfsiz o'qish yordamchilari.
///
/// Backend JSON'i vaqt o'tishi bilan o'zgaradi (yangi maydon qo'shiladi,
/// eskisi `null` bo'lib qoladi). Model to'g'ridan-to'g'ri `map['x'] as
/// String` yozsa, bitta kutilmagan `null` butun ekranni yiqitadi.
String _s(dynamic v) => v == null ? '' : '$v';
int _i(dynamic v) => v is num ? v.round() : int.tryParse('$v') ?? 0;
bool _b(dynamic v) => v == true || v == 1 || v == '1';

/// Sana. Server IKKI SHAKLDA beradi: millisekund (raqam) yoki ISO
/// satr. Ikkalasi ham qabul qilinadi — aks holda bitta endpoint
/// almashganda sana jimgina yo'qolardi.
DateTime? _ts(dynamic v) {
  if (v is num) return DateTime.fromMillisecondsSinceEpoch(v.round());
  final raw = _s(v);
  if (raw.isEmpty) return null;
  final millis = int.tryParse(raw);
  if (millis != null) return DateTime.fromMillisecondsSinceEpoch(millis);
  return DateTime.tryParse(raw);
}
List<Map<String, dynamic>> _list(dynamic v) => v is List
    ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
    : const [];

/// Hisob egasi.
class AppUser {
  AppUser({required this.id, required this.email, this.phone = '', this.isPremium = false});

  final int id;
  final String email;
  final String phone;
  final bool isPremium;

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: _i(j['id']),
        email: _s(j['email']),
        phone: _s(j['phone']),
        isPremium: _b(j['isPremium']),
      );

  /// Emailni niqoblash: `aziz@gmail.com` -> `a***@gmail.com`.
  /// Tasdiqlash ekranida to'liq manzil ko'rsatilmaydi.
  static String mask(String email) {
    final at = email.indexOf('@');
    if (at < 1) return email;
    return '${email[0]}***${email.substring(at)}';
  }
}

/// Shaxsiy profil / NFC ID (`cards` jadvali).
class Record {
  Record({
    required this.code,
    required this.name,
    this.role = '',
    this.avatarUrl,
    this.bgUrl,
    this.about = '',
    this.city = '',
    this.phone = '',
    this.tg = '',
    this.instagram = '',
    this.website = '',
    this.email = '',
    this.address = '',
    this.profileType = 'personal',
    this.categorySlug = '',
    this.verified = false,
    this.isPrimary = false,
    this.price = 0,
    this.views = 0,
    this.tierOverride = '',
    this.serverTier = '',
    this.companyId = '',
    this.isGift = false,
    this.notForSale = false,
    this.extraLinks = const [],
  });

  final String code;
  final String name;
  final String role;
  final String? avatarUrl;
  final String? bgUrl;
  final String about;
  final String city;
  final String phone;
  final String tg;
  final String instagram;
  final String website;
  final String email;
  final String address;
  final String profileType;
  final String categorySlug;
  final bool verified;
  final bool isPrimary;
  final int price;
  final int views;
  final String tierOverride;

  /// Serverdan kelgan tarif. BO'SH BO'LISHI MUMKIN — eski javoblarda
  /// bu maydon yo'q edi.
  final String serverTier;
  final String companyId;
  final bool isGift;
  final bool notForSale;
  final List<Map<String, dynamic>> extraLinks;

  bool get isBusiness => profileType == 'business';
  bool get isExpert => profileType == 'expert';

  /// Tarif.
  ///
  /// BIRINCHI NAVBATDA SERVERDAN. Server `personalIdTierD1` ni
  /// hisoblab yuboradi va bu yagona to'g'ri manba: sovg'a qilingan
  /// yoki narxi 0 bo'lgan ID'ni narxdan taxmin qilib bo'lmaydi —
  /// VIP001 shu sababli ekranda "Free" bo'lib ko'rinardi.
  ///
  /// Quyidagi taxmin FAQAT ZAXIRA: katalog ro'yxati (`/api/records`)
  /// tarif maydonini qaytarmaydi va u yerda har karta uchun alohida
  /// so'rov yuborish ro'yxatni sekinlashtirardi.
  Tier get tier {
    if (serverTier.isNotEmpty) return TierStyle.parse(serverTier);
    if (tierOverride.isNotEmpty) return TierStyle.parse(tierOverride);
    if (isGift) return Tier.exclusive;
    final c = code.toUpperCase();
    if (RegExp(r'^[A-Z]+$').hasMatch(c)) return Tier.exclusive;
    if (c.length != 6) return Tier.free;
    // Narx oralig'i — katalogdagi tarif narxlari bilan bir xil.
    if (price >= 490000) return Tier.exclusive;
    if (price >= 199000) return Tier.premium;
    if (price >= 149000) return Tier.gold;
    if (price >= 99000) return Tier.silver;
    if (price >= 49000) return Tier.bronze;
    return Tier.free;
  }

  factory Record.fromJson(Map<String, dynamic> j) => Record(
        code: _s(j['code']).toUpperCase(),
        name: _s(j['name']),
        role: _s(j['role']),
        avatarUrl: absUrl(_s(j['avatarUrl'])),
        bgUrl: absUrl(_s(j['bgUrl'])),
        about: _s(j['about']),
        city: _s(j['city']),
        phone: _s(j['phone']),
        tg: _s(j['tg']),
        instagram: _s(j['instagram']),
        website: _s(j['website']),
        email: _s(j['email']),
        address: _s(j['address']),
        profileType: _s(j['profileType']).isEmpty ? 'personal' : _s(j['profileType']),
        categorySlug: _s(j['categorySlug']),
        verified: _b(j['verified']),
        isPrimary: _b(j['isPrimary']),
        price: _i(j['price']),
        views: _i(j['views']),
        tierOverride: _s(j['tierOverride']),
        serverTier: _s(j['tier']),
        companyId: _s(j['companyId']),
        isGift: _b(j['isGift']),
        notForSale: _b(j['notForSale']),
        extraLinks: _list(j['extraLinks']),
      );
}

/// Biznes profil (`companies` jadvali).
class Company {
  Company({
    required this.id,
    required this.name,
    this.logoUrl,
    this.coverUrl,
    this.about = '',
    this.city = '',
    this.address = '',
    this.phone = '',
    this.tg = '',
    this.instagram = '',
    this.website = '',
    this.status = '',
    this.tier = '',
    this.category = '',
    this.verified = false,
    this.ordersEnabled = false,
    this.isOpen,
    this.hoursLabel = '',
    this.hours = const [],
    this.gallery = const [],
    this.followers = 0,
    this.views = 0,
    this.itemCount = 0,
    this.following = false,
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
  final String tg;
  final String instagram;
  final String website;
  final String status;
  final String tier;

  /// Soha — serverdagi `subcategory` (bo'lmasa `category`).
  /// Biznes profilining meta qatorida birinchi turadi: odam avval
  /// "bu nima?" degan savolga javob oladi.
  final String category;

  final bool verified;
  final bool ordersEnabled;

  /// `null` — ish vaqti kiritilmagan, "Ochiq/Yopiq" ko'rsatilmaydi.
  final bool? isOpen;
  final String hoursLabel;

  /// Haftaning yetti kuni — `[{closed, open, close}]`.
  ///
  /// Server HAR DOIM 7 ta element qaytaradi (`normalizeHoursD1`),
  /// shuning uchun indeks bo'yicha murojaat xavfsiz. Bo'sh bo'lsa
  /// ish vaqti umuman kiritilmagan.
  final List<DayHours> hours;

  /// Fotogalereya — 12 tagacha to'liq manzil.
  final List<String> gallery;
  final int followers;
  final int views;
  final int itemCount;
  final bool following;
  final List<Product> items;

  factory Company.fromJson(Map<String, dynamic> j) {
    final items = _list(j['items'] ?? j['catalog']).map(Product.fromJson).toList();
    return Company(
      id: _s(j['companyId'] ?? j['id']).toUpperCase(),
      name: _s(j['displayName'] ?? j['name']),
      logoUrl: absUrl(_s(j['logoUrl'])),
      coverUrl: absUrl(_s(j['coverUrl'])),
      about: _s(j['about'] ?? j['description']),
      city: _s(j['city']),
      address: _s(j['address']),
      phone: _s(j['phone']),
      tg: _s(j['tg'] ?? j['telegram']),
      instagram: _s(j['instagram']),
      website: _s(j['website']),
      status: _s(j['status']),
      tier: _s(j['tier']),
      // Soha: aniqrog'i (`subcategory`) bo'lsa o'sha, bo'lmasa
      // umumiy toifa.
      category: _s(j['subcategory']).isNotEmpty
          ? _s(j['subcategory'])
          : _s(j['category']),
      verified: _b(j['verified']),
      ordersEnabled: _b(j['ordersEnabled']),
      isOpen: j['isOpen'] is bool ? j['isOpen'] as bool : null,
      hoursLabel: _s(j['hoursLabel']),
      hours: (j['hours'] is List)
          ? (j['hours'] as List)
              .whereType<Map>()
              .map((d) => DayHours.fromJson(d.cast<String, dynamic>()))
              .toList()
          : const [],
      gallery: (j['gallery'] is List)
          ? (j['gallery'] as List)
              .map((g) => absUrl('$g'))
              .whereType<String>()
              .toList()
          : const [],
      followers: _i(j['followers']),
      views: _i(j['views']),
      itemCount: j['itemCount'] != null ? _i(j['itemCount']) : items.length,
      following: _b(j['following']),
      items: items,
    );
  }
}

/// Katalog mahsuloti yoki xizmati.
class Product {
  Product({
    required this.id,
    required this.name,
    this.description = '',
    this.price = 0,
    this.salePrice,
    this.imageUrl,
    this.images = const [],
    this.categoryName = '',
  });

  final String id;
  final String name;
  final String description;
  final int price;

  /// Chegirma narxi. `null` — chegirma yo'q.
  final int? salePrice;
  final String? imageUrl;
  final List<String> images;
  final String categoryName;

  /// To'lanadigan narx.
  int get effectivePrice => salePrice ?? price;

  /// Chegirma foizi — faqat haqiqiy chegirmada.
  int? get discountPct {
    final sp = salePrice;
    if (sp == null || price <= 0 || sp >= price) return null;
    return (((price - sp) / price) * 100).round();
  }

  factory Product.fromJson(Map<String, dynamic> j) {
    final imgs = <String>[];
    final raw = j['images'];
    if (raw is List) {
      for (final e in raw) {
        final u = absUrl(_s(e));
        if (u != null) imgs.add(u);
      }
    }
    final main = absUrl(_s(j['imageUrl'] ?? j['image']));
    if (main != null && !imgs.contains(main)) imgs.insert(0, main);
    final sale = j['promotionPrice'] ?? j['salePrice'];
    return Product(
      id: _s(j['id']),
      name: _s(j['name']),
      description: _s(j['description'] ?? j['about']),
      price: _i(j['price']),
      salePrice: sale == null ? null : _i(sale),
      imageUrl: imgs.isEmpty ? null : imgs.first,
      images: imgs,
      categoryName: _s(j['categoryName'] ?? j['category']),
    );
  }
}

/// Post yoki story.
class Post {
  Post({
    required this.id,
    this.caption = '',
    this.images = const [],
    this.videoUrl,
    this.createdAt,
    this.likes = 0,
    this.views = 0,
    this.liked = false,
    this.authorName = '',
    this.authorAvatar,
    this.authorCode = '',
  });

  final String id;
  final String caption;
  final List<String> images;

  /// VIDEO manzili. Server 2026-09 dan beri story va post uchun
  /// `videoUrl` qaytaradi; modelda u O'QILMAS edi va video yozuv
  /// ekranda QORA bo'lib chiqardi (rasm ro'yxati bo'sh, video esa
  /// tashlab yuborilgan).
  final String? videoUrl;
  final DateTime? createdAt;
  final int likes;
  final int views;
  final bool liked;
  final String authorName;
  final String? authorAvatar;
  final String authorCode;

  /// Faqat o'zgaradigan maydonlar — yurak va ko'rishlar hisobi.
  ///
  /// Istorya ko'ruvchisida yurak bosilishi BILAN ko'rinishi kerak
  /// (server javobini kutmasdan), keyin server tasdig'i ustiga
  /// yoziladi. Usiz yurak yarim soniya kechikib yonardi.
  Post copyWith({bool? liked, int? likes, int? views}) => Post(
        id: id,
        caption: caption,
        images: images,
        videoUrl: videoUrl,
        createdAt: createdAt,
        likes: likes ?? this.likes,
        views: views ?? this.views,
        liked: liked ?? this.liked,
        authorName: authorName,
        authorAvatar: authorAvatar,
        authorCode: authorCode,
      );

  factory Post.fromJson(Map<String, dynamic> j) {
    final imgs = <String>[];
    for (final key in ['images', 'media', 'photos']) {
      final raw = j[key];
      if (raw is List) {
        for (final e in raw) {
          final u = absUrl(e is Map ? _s(e['url']) : _s(e));
          if (u != null && !imgs.contains(u)) imgs.add(u);
        }
      }
    }
    final single = absUrl(_s(j['imageUrl'] ?? j['url'] ?? j['mediaUrl']));
    if (single != null && !imgs.contains(single)) imgs.insert(0, single);
    return Post(
      id: _s(j['id']),
      caption: _s(j['caption'] ?? j['text'] ?? j['body']),
      images: imgs,
      videoUrl: absUrl(_s(j['videoUrl'] ?? j['video_url'])),
      // MILLISEKUND HAM, ISO HAM. Post endpointlari vaqtni son
      // qilib qaytaradi (`postRowToJson`), istorya endpointlari esa
      // ISO satr. Ilgari bu yerda faqat `DateTime.tryParse` turardi
      // va sonli vaqt JIMGINA `null` bo'lib qolardi — post ostida
      // "4 soat oldin" umuman chiqmasdi.
      createdAt: _ts(j['createdAt'] ?? j['created_at'] ?? j['ts']),
      likes: _i(j['likes'] ?? j['likeCount']),
      views: _i(j['views'] ?? j['viewCount']),
      liked: _b(j['liked']),
      authorName: _s(j['authorName'] ?? j['name']),
      authorAvatar: absUrl(_s(j['authorAvatar'] ?? j['avatarUrl'])),
      authorCode: _s(j['code'] ?? j['authorCode']).toUpperCase(),
    );
  }
}

/// Buyurtma (`web_orders` — ID/karta xaridi).
class Order {
  Order({
    required this.id,
    required this.code,
    required this.price,
    required this.status,
    this.kind = '',
    this.createdAt,
    this.payLink,
    this.payLinks = const {},
    this.expiresAtMs,
  });

  final int id;
  final String code;
  final int price;
  final String status;
  final String kind;
  final DateTime? createdAt;

  /// Kutilayotgan buyurtmani DAVOM ETTIRISH havolasi (Payme).
  ///
  /// ESKI MAYDON — joyida qoldi: eski serverda faqat shu bor.
  final String? payLink;

  /// HAR BIR TO'LOV TIZIMI UCHUN ALOHIDA HAVOLA: `payme`, `click`.
  ///
  /// Server qaysi tizim yoqilgan bo'lsa, o'shanikini qo'yadi. Tizim
  /// o'chiq bo'lsa kaliti umuman bo'lmaydi — interfeys tugmani
  /// o'chiq ko'rsatadi va odam "nega ishlamadi" degan holatga
  /// tushmaydi.
  final Map<String, String> payLinks;

  final int? expiresAtMs;

  /// Tanlangan tizim uchun havola. Yangi maydonda bo'lmasa, Payme
  /// uchun eski `payLink` ishlatiladi.
  String? linkFor(String provider) {
    final v = payLinks[provider];
    if (v != null && v.isNotEmpty) return v;
    return provider == 'payme' ? payLink : null;
  }

  bool get isPending => status == 'pending';
  bool get isPaid => status == 'paid';

  factory Order.fromJson(Map<String, dynamic> j) => Order(
        id: _i(j['id']),
        code: _s(j['code']).toUpperCase(),
        price: _i(j['price']),
        status: _s(j['status']),
        kind: _s(j['kind']),
        createdAt: DateTime.tryParse(_s(j['createdAt'])),
        payLink: _s(j['payLink']).isEmpty ? null : _s(j['payLink']),
        payLinks: () {
          final raw = j['payLinks'];
          if (raw is! Map) return const <String, String>{};
          final out = <String, String>{};
          raw.forEach((k, v) {
            final link = _s(v);
            if (link.isNotEmpty) out['$k'] = link;
          });
          return out;
        }(),
        expiresAtMs: j['expiresAtMs'] == null ? null : _i(j['expiresAtMs']),
      );
}

/// Obunachilar/obunalar ro'yxatidagi bitta qator.
///
/// Odam KOMPANIYA nomidan obuna bo'lishi mumkin — u holda ro'yxatda
/// kompaniya yuzi (logotip va nom) ko'rinadi, lekin backend orqasidagi
/// SHAXSNI ham qaytaradi: odam kompaniya ortiga butunlay yashirinib
/// olmasligi kerak.
class FollowEntry {
  const FollowEntry({
    required this.code,
    required this.name,
    this.avatarUrl,
    this.verified = false,
    this.isCompany = false,
    this.personCode = '',
    this.personName = '',
  });

  final String code;
  final String name;
  final String? avatarUrl;
  final bool verified;
  final bool isCompany;
  final String personCode;
  final String personName;

  factory FollowEntry.fromJson(Map<String, dynamic> j) => FollowEntry(
        code: _s(j['code']).toUpperCase(),
        name: _s(j['name']),
        avatarUrl: absUrl(_s(j['avatarUrl'])),
        verified: _b(j['verified']),
        isCompany: _s(j['kind']) == 'company',
        personCode: _s(j['personCode']).toUpperCase(),
        personName: _s(j['personName']),
      );
}

/// Obuna raqamlari.
class FollowStats {
  const FollowStats({this.followers = 0, this.following = 0, this.isFollowing = false});

  final int followers;
  final int following;
  final bool isFollowing;

  factory FollowStats.fromJson(Map<String, dynamic> j) => FollowStats(
        followers: _i(j['followers']),
        following: _i(j['following']),
        isFollowing: _b(j['isFollowing'] ?? j['following_by_me'] ?? j['followed']),
      );
}

/// STORY LENTASIDAGI BITTA ODAM.
///
/// `GET /api/stories/feed` obuna bo'lingan odamlarning muddati
/// o'tmagan istoryalarini BITTA dumaloqcha qilib guruhlab beradi.
///
/// NIMA UCHUN ALOHIDA MODEL: bu FOYDALANUVCHINING O'Z ID'lari emas,
/// boshqa odamlarning yangi kontenti. Ikkalasini bitta ro'yxatda
/// ko'rsatish — lentani soxta ko'rsatish bo'lardi.
class StoryFeedEntry {
  const StoryFeedEntry({
    required this.code,
    required this.name,
    this.avatarUrl,
    this.ids = const [],
  });

  final String code;
  final String name;
  final String? avatarUrl;

  /// SHU ODAMNING FAOL ISTORYA ID'LARI.
  ///
  /// Ilgari bu yerda faqat SONI saqlanardi. Son bilan "bu odamning
  /// istoryasini ko'rganmisiz" degan savolga javob berib bo'lmaydi:
  /// bittasini ko'rib, keyin u yana bitta qo'ysa, son ham 1 bo'lib
  /// qolaveradi. ID'lar esa aniq: qaysi biri ko'rilgani yozib
  /// boriladi (`SeenStories`) va halqa shunga qarab so'nadi.
  final List<int> ids;

  /// Halqa segmentlari va "nechta yangi" hisobi uchun.
  int get count => ids.length;

  factory StoryFeedEntry.fromJson(Map<String, dynamic> j) {
    final stories = j['stories'];
    return StoryFeedEntry(
      code: _s(j['code']).toUpperCase(),
      name: _s(j['name']),
      avatarUrl: absUrl(_s(j['avatarUrl'])),
      ids: stories is List
          ? stories
              .whereType<Map>()
              .map((e) => _i(e['id']))
              .where((id) => id > 0)
              .toList()
          : const [],
    );
  }
}

/// UMUMIY LENTA YOZUVI — postlar va istoryalar bir oqimda.
///
/// NIMA UCHUN BITTA MODEL: ekranda ular AYNAN bir xil ko'rinadi —
/// to'liq ekran rasm, muallif, izoh. Farqi faqat manbada va
/// yashash muddatida (istorya 24 soat). Ikkita model yasash
/// ekranda ikkita bir xil kod yo'lini yaratardi.
class FeedEntry {
  const FeedEntry({
    required this.kind,
    required this.id,
    required this.code,
    required this.authorKind,
    required this.name,
    this.avatarUrl,
    this.imageUrl,
    this.videoUrl,
    this.caption = '',
    this.createdAt,
    this.likeCount = 0,
    this.liked = false,
    this.likeable = false,
    this.commentKind = '',
    this.commentCount = 0,
  });

  /// `post` yoki `story`.
  final String kind;
  final int id;

  /// Muallif profili kodi — bosilganda o'sha profil ochiladi.
  final String code;

  /// `card` yoki `company`.
  final String authorKind;
  final String name;
  final String? avatarUrl;
  final String? imageUrl;
  final String? videoUrl;
  final String caption;
  final DateTime? createdAt;
  final int likeCount;
  final bool liked;

  /// Yoqtirish MUMKINMI. Kompaniya postida server tomonda
  /// yoqtirish jadvali yo'q — bunda tugma umuman ko'rsatilmaydi.
  final bool likeable;

  /// IZOH JADVALIDAGI TUR: `post`, `company_post`, `story`,
  /// `company_story`. Server beradi, chunki lentadagi id'lar
  /// manbalar bo'yicha takrorlanadi (5-post va 5-istorya — ikki xil
  /// narsa) va ularni faqat tur bilan birga ajratish mumkin.
  ///
  /// Eski serverdan bo'sh kelsa — turdan o'zimiz yig'amiz, ya'ni
  /// ilova yangilanmagan server bilan ham ishlayveradi.
  final String commentKind;
  final int commentCount;

  /// Izoh so'rovlari uchun tur — server bermasa ham to'g'ri qiymat.
  String get commentTarget {
    if (commentKind.isNotEmpty) return commentKind;
    if (isStory) return isCompany ? 'company_story' : 'story';
    return isCompany ? 'company_post' : 'post';
  }

  bool get isStory => kind == 'story';
  bool get isCompany => authorKind == 'company';

  factory FeedEntry.fromJson(Map<String, dynamic> j) => FeedEntry(
        kind: _s(j['kind']),
        id: _i(j['id']),
        code: _s(j['code']).toUpperCase(),
        authorKind: _s(j['authorKind']),
        name: _s(j['name']),
        avatarUrl: absUrl(_s(j['avatarUrl'])),
        imageUrl: absUrl(_s(j['imageUrl'])),
        videoUrl: absUrl(_s(j['videoUrl'])),
        caption: _s(j['caption']),
        createdAt: _ts(j['createdAt']),
        likeCount: _i(j['likeCount']),
        liked: _b(j['liked']),
        likeable: _b(j['likeable']),
        commentKind: _s(j['commentKind']),
        commentCount: _i(j['commentCount']),
      );

  FeedEntry copyWith({int? likeCount, bool? liked, int? commentCount}) => FeedEntry(
        kind: kind,
        id: id,
        code: code,
        authorKind: authorKind,
        name: name,
        avatarUrl: avatarUrl,
        imageUrl: imageUrl,
        videoUrl: videoUrl,
        caption: caption,
        createdAt: createdAt,
        likeCount: likeCount ?? this.likeCount,
        liked: liked ?? this.liked,
        likeable: likeable,
        commentKind: commentKind,
        commentCount: commentCount ?? this.commentCount,
      );
}

/// IZOH.
///
/// Lentadagi va Reels'dagi kontent ostida turadigan yozuv. Muallif
/// nomi va rasmi SERVERDAN keladi (izoh yozilgandan keyin odam
/// ismini o'zgartirsa, eski ism qolib ketmasin).
class Comment {
  const Comment({
    required this.id,
    required this.body,
    required this.name,
    this.code = '',
    this.avatarUrl,
    this.createdAt,
    this.mine = false,
  });

  final int id;
  final String body;

  /// Muallifning ko'rsatiladigan nomi.
  final String name;

  /// Muallif profili kodi — bosilganda o'sha profil ochiladi.
  /// Bo'sh bo'lishi mumkin: hali kartasi yo'q foydalanuvchi.
  final String code;
  final String? avatarUrl;
  final DateTime? createdAt;

  /// O'chirish tugmasi shu bayroqqa qarab ko'rsatiladi. Huquqni
  /// BARIBIR server tekshiradi — bu faqat ko'rinish uchun.
  final bool mine;

  factory Comment.fromJson(Map<String, dynamic> j) => Comment(
        id: _i(j['id']),
        body: _s(j['body']),
        name: _s(j['name']),
        code: _s(j['code']).toUpperCase(),
        avatarUrl: absUrl(_s(j['avatarUrl'])),
        createdAt: _ts(j['createdAt']),
        mine: _b(j['mine']),
      );
}

/// SOVG'A TAKLIFI.
///
/// ID sovg'a qilinganda darhol o'tmaydi: server `pending` taklif
/// yaratadi va OLUVCHI uni tasdiqlashi kerak. Shu sababli bu model
/// ikki tomondan ham ishlatiladi — menga kelgan (`incoming`) va
/// men yuborgan (`outgoing`) takliflar.
class GiftOffer {
  const GiftOffer({
    required this.id,
    required this.code,
    required this.incoming,
    this.email = '',
    this.createdAt = '',
  });

  final int id;
  final String code;

  /// `true` — menga sovg'a qilinyapti (qabul/rad qilaman).
  /// `false` — men yubordim (faqat qaytarib olishim mumkin).
  final bool incoming;

  /// Kiruvchida — yuboruvchi, chiquvchida — oluvchi.
  final String email;
  final String createdAt;

  factory GiftOffer.fromJson(Map<String, dynamic> j, {required bool incoming}) => GiftOffer(
        id: _i(j['id']),
        code: _s(j['code']).toUpperCase(),
        incoming: incoming,
        email: _s(incoming ? j['fromEmail'] : j['toEmail']),
        createdAt: _s(j['createdAt']),
      );
}

/// TO'LOV TARIXIDAGI BITTA YOZUV.
///
/// `kind` — buyurtma turi (ID sotib olish, jismoniy karta, premium).
/// `status` — `pending` / `paid` / `cancelled` / `failed`.
class PaymentEntry {
  const PaymentEntry({
    required this.id,
    required this.kind,
    required this.code,
    required this.price,
    required this.status,
    this.createdAt = '',
    this.paymentProvider = '',
  });

  final int id;
  final String kind;
  final String code;
  final int price;
  final String status;
  final String createdAt;

  /// To'langan bo'lsa server tranzaksiyadan aniqlaydi. Pending buyurtma
  /// hali ikkala checkout usulidan biri bilan yakunlanishi mumkinligi
  /// uchun bo'sh qoladi.
  final String paymentProvider;

  bool get isPaid => status == 'paid';
  bool get isPending => status == 'pending';
  bool get isCancelled => status == 'cancelled' || status == 'failed';

  factory PaymentEntry.fromJson(Map<String, dynamic> j) => PaymentEntry(
        id: _i(j['id']),
        kind: _s(j['kind']),
        code: _s(j['code']).toUpperCase(),
        price: _i(j['price']),
        status: _s(j['status']),
        createdAt: _s(j['createdAt']),
        paymentProvider: _s(j['paymentProvider']).toLowerCase(),
      );
}

/// QO'LLAB-QUVVATLASH MUROJAATI.
///
/// `reply` bo'sh bo'lsa — hali javob berilmagan.
class SupportMessage {
  const SupportMessage({
    required this.id,
    required this.message,
    this.reply = '',
    this.status = 'pending',
    this.createdAt = '',
    this.repliedAt = '',
  });

  final int id;
  final String message;
  final String reply;
  final String status;
  final String createdAt;
  final String repliedAt;

  bool get answered => reply.trim().isNotEmpty;

  factory SupportMessage.fromJson(Map<String, dynamic> j) => SupportMessage(
        id: _i(j['id']),
        message: _s(j['message']),
        reply: _s(j['reply']),
        status: _s(j['status']),
        createdAt: _s(j['createdAt']),
        repliedAt: _s(j['repliedAt']),
      );
}

/// BITTA KUNNING ISH VAQTI.
///
/// `closed` — dam olish kuni. Server ochilish yoki yopilish vaqti
/// bo'sh bo'lsa ham kunni YOPIQ deb belgilaydi, shuning uchun
/// "ochiq, lekin vaqtsiz" degan holat umuman bo'lmaydi.
class DayHours {
  const DayHours({this.closed = true, this.open = '', this.close = ''});

  final bool closed;

  /// `HH:MM`.
  final String open;
  final String close;

  factory DayHours.fromJson(Map<String, dynamic> j) => DayHours(
        closed: _b(j['closed']) || _s(j['open']).isEmpty || _s(j['close']).isEmpty,
        open: _s(j['open']),
        close: _s(j['close']),
      );

  Map<String, dynamic> toJson() =>
      {'closed': closed, 'open': closed ? '' : open, 'close': closed ? '' : close};

  DayHours copyWith({bool? closed, String? open, String? close}) => DayHours(
        closed: closed ?? this.closed,
        open: open ?? this.open,
        close: close ?? this.close,
      );
}
