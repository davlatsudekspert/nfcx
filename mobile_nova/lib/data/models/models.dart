/// Backend javoblarining Dart ko'rinishi.
///
/// QOIDA: har bir `fromJson` HIMOYALANGAN — maydon yo'q bo'lsa yoki
/// turi kutilganidan boshqa bo'lsa, ilova qulamaydi, standart qiymat
/// oladi. Server bitta maydonni o'zgartirsa butun ekran oq bo'lib
/// qolmasligi uchun.
library;

import '../../core/utils/media_url.dart';

/// `dynamic` dan xavfsiz o'qish yordamchilari.
String _s(dynamic v, [String d = '']) => v == null ? d : '$v';

/// MEDIA MANZILI uchun `_s`.
///
/// Backend yuklangan fayllarni NISBIY yo'l bilan qaytaradi
/// (`/uploads/...`). Saytda bu ishlaydi — u o'sha domenda turadi —
/// ilovada esa yo'q. Shuning uchun har bir manzil maydoni AYNAN shu
/// yordamchidan o'tadi: bitta joyda, modelning chegarasida. Ekran
/// va vidjetlar tayyor, to'liq manzil oladi va hech biri buni
/// o'zi eslab qolishi shart emas.
String _u(dynamic v) => mediaUrl(_s(v));
int _i(dynamic v, [int d = 0]) =>
    v is int ? v : int.tryParse('${v ?? ''}') ?? d;
bool _b(dynamic v, [bool d = false]) =>
    v is bool ? v : (v == 1 || v == '1' || v == 'true' ? true : d);
DateTime? _dt(dynamic v) => v == null ? null : DateTime.tryParse('$v');
List<Map<String, dynamic>> _list(dynamic v) => v is List
    ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
    : const [];

class User {
  const User({
    required this.id,
    required this.email,
    this.name = '',
    this.phone = '',
    this.avatarUrl = '',
    this.emailVerified = false,
    this.promoCode = '',
    this.premium = false,
    this.premiumUntil,
    this.trialUntil,
  });

  final int id;
  final String email;
  final String name;
  final String phone;
  final String avatarUrl;
  final bool emailVerified;
  final String promoCode;
  final bool premium;

  /// Premium OBUNA tugash sanasi.
  ///
  /// Server `isPremium` ni ikki yo'l bilan hisoblaydi: eski, bir
  /// martalik to'lov qilganlarda `is_premium = 1` (MUDDATSIZ), yangi
  /// obunachilarda esa `premium_expires_at > hozir`. Ikkinchisida
  /// sana bor, birinchisida YO'Q — shuning uchun bu maydon `null`
  /// bo'lishi MUDDATSIZ degani, "premium emas" degani emas.
  ///
  /// Ilgari bu maydon o'qilmasdi: server yuborardi, model tashlab
  /// yuborardi. Natijada obuna qachon tugashini ilova ayta olmasdi.
  final DateTime? premiumUntil;

  /// Sinov muddati tugash sanasi — u ham premium darajasini beradi.
  final DateTime? trialUntil;

  /// Premium HOZIR faolmi.
  bool get premiumActive =>
      premium ||
      (premiumUntil?.isAfter(DateTime.now()) ?? false) ||
      trialActive;

  /// Sinov muddati hozir ketyaptimi.
  bool get trialActive => trialUntil?.isAfter(DateTime.now()) ?? false;

  /// Ism bo'lmasa email'ning `@` gacha qismi ishlatiladi — profil
  /// hech qachon "bo'sh nom" bilan ko'rinmaydi.
  String get displayName =>
      name.trim().isNotEmpty ? name.trim() : email.split('@').first;

  /// Avatar o'rnidagi harflar.
  String get initials {
    final parts = displayName.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2 && parts[1].isNotEmpty) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    final d = displayName.trim();
    return (d.length >= 2 ? d.substring(0, 2) : d).toUpperCase();
  }

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: _i(j['id']),
        email: _s(j['email']),
        name: _s(j['name'] ?? j['fullName'] ?? j['displayName']),
        phone: _s(j['phone']),
        avatarUrl: _u(j['avatarUrl'] ?? j['avatar']),
        emailVerified: _b(j['emailVerified'] ?? j['email_verified']),
        promoCode: _s(j['promoCode'] ?? j['promo_code']),
        premium: _b(j['premium'] ?? j['isPremium']),
        premiumUntil: _dt(j['premiumExpiresAt'] ?? j['premium_expires_at']),
        trialUntil: _dt(j['trialExpiresAt'] ?? j['trial_expires_at']),
      );
}

/// NFC ID — backend'da `record` deb ataladi va `code` uning kalitidir.
///
/// MUHIM: kod formati BACKEND'niki. Ro'yxatdan o'tganda avtomatik
/// 8 xonali kod beriladi, do'kondan qisqaroq (qimmatroq) kodlarni
/// sotib olish mumkin. Ilova formatni O'ZI to'qimaydi va tekshirmaydi.
class NfcId {
  const NfcId({
    required this.code,
    this.name = '',
    this.role = '',
    this.avatarUrl = '',
    this.coverUrl = '',
    this.bio = '',
    this.primary = false,
    this.active = true,
    this.views = 0,
    this.taps = 0,
    this.followers = 0,
    this.following = 0,
    this.posts = 0,
    this.kind = NfcIdKind.personal,
    this.cardLinked = false,
    this.musicUrls = const [],
    this.hiddenFromDirectory = false,
    this.createdAt,
  });

  final String code;
  final String name;
  final String role;
  final String avatarUrl;
  final String coverUrl;
  final String bio;
  final bool primary;
  final bool active;
  final int views;
  final int taps;
  final int followers;
  final int following;
  final int posts;
  final NfcIdKind kind;

  /// Jismoniy karta ulanganmi.
  final bool cardLinked;

  /// Profil musiqasi — backend'da `cards.music_url` ustuni.
  ///
  /// Server uni JSON massiv sifatida saqlaydi (ko'pi bilan 5 ta) va
  /// `musicUrls` bo'lib qaytaradi; eski yozuvlarda bitta `musicUrl`
  /// bo'lishi mumkin. Qiymat tashqi havola YOKI serverga yuklangan
  /// `/uploads/...` fayli.
  ///
  /// MUHIM: backend'da qo'shiq NOMI yoki IJROCHISI uchun maydon
  /// YO'Q — faqat manzil. Shuning uchun ilova ularni o'zidan
  /// to'qimaydi.
  final List<String> musicUrls;

  /// Profil ommaviy katalogdan YASHIRILGANMI.
  ///
  /// Backend'da `cards.hidden_from_directory` ustuni. `true` bo'lsa
  /// yozuv "Tanlov" ro'yxatiga, biznes katalogiga va ommaviy
  /// sovg'alar devoriga TUSHMAYDI (`worker.js` dagi barcha katalog
  /// so'rovlari `hidden_from_directory = 0` bilan filtrlaydi).
  ///
  /// Server buni ANCHADAN BERI qaytarardi va qabul qilardi, lekin
  /// model uni tashlab yuborar edi — shuning uchun Maxfiylik
  /// ekranidagi tugma hech narsaga ulanmagan edi.
  final bool hiddenFromDirectory;

  final DateTime? createdAt;

  /// Ommaviy profil manzili — QR va "ulashish" uchun.
  String publicUrl(String base) => '$base/${Uri.encodeComponent(code)}';

  factory NfcId.fromJson(Map<String, dynamic> j) => NfcId(
        code: _s(j['code']),
        name: _s(j['name'] ?? j['title']),
        role: _s(j['role']),
        avatarUrl: _u(j['avatarUrl'] ?? j['avatar']),
        coverUrl: _u(j['bgUrl'] ?? j['coverUrl']),
        bio: _s(j['bio'] ?? j['about']),
        primary: _b(j['isPrimary'] ?? j['primary']),
        active: _b(j['active'] ?? j['isActive'], true),
        views: _i(j['views']),
        taps: _i(j['taps'] ?? j['scans']),
        followers: _i(j['followers']),
        following: _i(j['following']),
        posts: _i(j['posts']),
        // TUR — SERVER `profileType` YUBORADI.
        //
        // Ilgari bu yerda faqat `type` va `isCompany` o'qilardi.
        // Karta serializeri (`rowToRecord`) ularning BIRORTASINI
        // yubormaydi — u `profileType: 'personal'|'expert'|'business'`
        // yuboradi. Ya'ni foydalanuvchining biznes turidagi kartasi
        // ham DOIM shaxsiy bo'lib o'qilardi va NFC ro'yxatida
        // noto'g'ri rang/belgi bilan chizilardi.
        //
        // `expert` — shaxsiy profilning bir ko'rinishi, shuning uchun
        // u shaxsiy bo'lib qoladi.
        kind: _s(j['profileType']) == 'business' ||
                _s(j['type']) == 'business' ||
                _b(j['isCompany'])
            ? NfcIdKind.business
            : NfcIdKind.personal,
        cardLinked: _b(j['cardLinked'] ?? j['hasCard']) ||
            _s(j['chipToken']).isNotEmpty,
        musicUrls: _musicUrls(j),
        hiddenFromDirectory: _b(j['hiddenFromDirectory'] ??
            j['hidden_from_directory']),
        createdAt: _dt(j['createdAt'] ?? j['created_at']),
      );
}

/// `musicUrls` ro'yxatini o'qish.
///
/// Server yangi yozuvlarda ro'yxat, eskilarida bitta `musicUrl`
/// qaytaradi — ikkalasi ham qabul qilinadi.
List<String> _musicUrls(Map<String, dynamic> j) {
  final raw = j['musicUrls'];
  if (raw is List) {
    return raw
        .map((e) => e is String ? mediaUrl(e) : '')
        .where((e) => e.isNotEmpty)
        .take(5)
        .toList(growable: false);
  }
  final one = _u(j['musicUrl']);
  return one.isEmpty ? const [] : [one];
}

enum NfcIdKind { personal, business }

/// Jismoniy NFC karta (`/api/my/nfc-devices`).
class NfcDevice {
  const NfcDevice({
    required this.id,
    this.label = '',
    this.code = '',
    this.lastSeen,
    this.active = true,
    this.blockedByOwner = false,
  });

  final int id;
  final String label;

  /// Qaysi NFC ID'ga bog'langan.
  final String code;
  final DateTime? lastSeen;
  final bool active;

  /// Egasi kartani vaqtincha o'chirib qo'yganmi.
  ///
  /// Bloklangan karta tegizilganda profil OCHILMAYDI. Bu yo'qolgan
  /// kartani zararsizlantirishning yagona qo'llab-quvvatlanadigan
  /// yo'li — serverda "bog'lanishni uzish" degan amal yo'q.
  final bool blockedByOwner;

  /// Server `listPhysicalCardsByOwner` shaklida qaytaradi:
  ///
  ///     { id, tokenTail, linkedCode, linkedName, active,
  ///       blockedByOwner, status, createdAt }
  ///
  /// `label` uchun avval bog'langan profil NOMI olinadi, u bo'sh
  /// bo'lsa chip tokenining oxirgi 4 belgisi — foydalanuvchi ikki
  /// kartani shundan ajratadi.
  factory NfcDevice.fromJson(Map<String, dynamic> j) {
    final tail = _s(j['tokenTail']);
    return NfcDevice(
      id: _i(j['id']),
      label: _s(j['linkedName'] ?? j['label'] ?? j['name'],
          tail.isEmpty ? 'NFC' : '•••• $tail'),
      code: _s(j['linkedCode'] ?? j['code'] ?? j['recordCode']),
      lastSeen: _dt(j['lastSeen'] ?? j['updatedAt'] ?? j['createdAt']),
      active: _b(j['active'], true),
      blockedByOwner: _b(j['blockedByOwner']),
    );
  }
}

/// Biznes hisobi (`/api/companies`).
class Business {
  const Business({
    required this.companyId,
    this.displayName = '',
    this.category = 'other',
    this.subcategory = '',
    this.city = '',
    this.address = '',
    this.description = '',
    this.phone = '',
    this.telegram = '',
    this.whatsapp = '',
    this.website = '',
    this.logoUrl = '',
    this.coverUrl = '',
    this.status = 'draft',
    this.followers = 0,
    this.views = 0,
  });

  /// `nfcstore.uz/c/<companyId>` — vitrinaning ommaviy manzili.
  final String companyId;
  final String displayName;
  final String category;
  final String subcategory;
  final String city;
  final String address;
  final String description;
  final String phone;
  final String telegram;
  final String whatsapp;
  final String website;
  final String logoUrl;
  final String coverUrl;

  /// `draft` · `pending` · `published`.
  final String status;
  final int followers;
  final int views;

  bool get isPublished => status == 'published' || status == 'active';

  factory Business.fromJson(Map<String, dynamic> j) => Business(
        companyId: _s(j['companyId'] ?? j['id']),
        displayName: _s(j['displayName'] ?? j['name']),
        category: _s(j['category'], 'other'),
        subcategory: _s(j['subcategory']),
        city: _s(j['city']),
        address: _s(j['address']),
        description: _s(j['description']),
        phone: _s(j['phone']),
        telegram: _s(j['telegram']),
        whatsapp: _s(j['whatsapp']),
        website: _s(j['website']),
        logoUrl: _u(j['logoUrl']),
        coverUrl: _u(j['coverUrl']),
        status: _s(j['status'], 'draft'),
        followers: _i(j['followers']),
        views: _i(j['views']),
      );
}

/// Katalog elementi — mahsulot yoki xizmat.
class CatalogItem {
  const CatalogItem({
    required this.id,
    this.name = '',
    this.description = '',
    this.imageUrl = '',
    this.price = 0,
    this.salePrice,
    this.currency = 'UZS',
    this.available = true,
    this.categoryId,
    this.isService = false,
  });

  final int id;
  final String name;
  final String description;
  final String imageUrl;
  final int price;
  final int? salePrice;
  final String currency;
  final bool available;
  final int? categoryId;
  final bool isService;

  /// Chegirma bo'lsa u, bo'lmasa oddiy narx.
  int get effectivePrice =>
      (salePrice != null && salePrice! > 0 && salePrice! < price)
          ? salePrice!
          : price;

  bool get hasDiscount => effectivePrice < price;

  factory CatalogItem.fromJson(Map<String, dynamic> j) => CatalogItem(
        id: _i(j['id']),
        name: _s(j['name'] ?? j['title']),
        description: _s(j['description'] ?? j['desc']),
        imageUrl: _u(j['imageUrl'] ?? j['image'] ?? j['photoUrl']),
        price: _i(j['price']),
        salePrice: j['salePrice'] == null ? null : _i(j['salePrice']),
        currency: _s(j['currency'], 'UZS'),
        available: _b(j['available'] ?? j['inStock'], true),
        categoryId: j['categoryId'] == null ? null : _i(j['categoryId']),
        isService: _s(j['type']) == 'service' || _b(j['isService']),
      );
}

class CatalogCategory {
  const CatalogCategory({required this.id, this.name = '', this.count = 0});

  final int id;
  final String name;
  final int count;

  factory CatalogCategory.fromJson(Map<String, dynamic> j) => CatalogCategory(
        id: _i(j['id']),
        name: _s(j['name'] ?? j['title']),
        count: _i(j['count'] ?? j['itemCount']),
      );
}

/// Do'kon mahsuloti — NFC karta va ID paketlari.
class ShopProduct {
  const ShopProduct({
    required this.id,
    this.name = '',
    this.description = '',
    this.imageUrl = '',
    this.price = 0,
    this.oldPrice,
    this.currency = 'UZS',
    this.category = '',
    this.inStock = true,
    this.tier = '',
  });

  final String id;
  final String name;
  final String description;
  final String imageUrl;
  final int price;
  final int? oldPrice;
  final String currency;
  final String category;
  final bool inStock;

  /// ID uzunligi darajasi (backend `tier`) — narx shundan kelib chiqadi.
  final String tier;

  bool get hasDiscount => oldPrice != null && oldPrice! > price;

  factory ShopProduct.fromJson(Map<String, dynamic> j) => ShopProduct(
        id: _s(j['id'] ?? j['code'] ?? j['sku']),
        name: _s(j['name'] ?? j['title']),
        description: _s(j['description']),
        imageUrl: _u(j['imageUrl'] ?? j['image']),
        price: _i(j['price']),
        oldPrice: j['oldPrice'] == null ? null : _i(j['oldPrice']),
        currency: _s(j['currency'], 'UZS'),
        category: _s(j['category']),
        inStock: _b(j['inStock'] ?? j['available'], true),
        tier: _s(j['tier']),
      );
}

class Order {
  const Order({
    required this.id,
    this.status = 'new',
    this.total = 0,
    this.currency = 'UZS',
    this.createdAt,
    this.itemsText = '',
    this.paymentProvider = '',
  });

  final int id;
  final String status;
  final int total;
  final String currency;
  final DateTime? createdAt;
  final String itemsText;
  final String paymentProvider;

  factory Order.fromJson(Map<String, dynamic> j) => Order(
        id: _i(j['id']),
        status: _s(j['status'], 'new'),
        total: _i(j['total'] ?? j['amount']),
        currency: _s(j['currency'], 'UZS'),
        createdAt: _dt(j['createdAt'] ?? j['created_at']),
        itemsText: _s(j['items'] ?? j['title']),
        paymentProvider: _s(j['provider'] ?? j['paymentProvider']),
      );
}

class Post {
  const Post({
    required this.id,
    this.code = '',
    this.authorName = '',
    this.authorAvatar = '',
    this.text = '',
    this.mediaUrls = const [],
    this.likes = 0,
    this.comments = 0,
    this.liked = false,
    this.saved = false,
    this.createdAt,
    this.isVideo = false,
    this.kind = 'post',
    this.authorKind = 'card',
  });

  final int id;

  /// Muallifning NFC ID kodi — profilga o'tish uchun.
  final String code;
  final String authorName;
  final String authorAvatar;
  final String text;
  final List<String> mediaUrls;
  final int likes;
  final int comments;
  final bool liked;
  final bool saved;
  final DateTime? createdAt;
  final bool isVideo;

  /// `post` yoki `story` — `/api/feed` ikkalasini birga beradi.
  final String kind;

  /// `card` (shaxsiy) yoki `company` (biznes).
  final String authorKind;

  /// Lentadagi `id` lar manbalar bo'yicha ALOHIDA sanaladi:
  /// 5-raqamli shaxsiy post va 5-raqamli kompaniya posti ikki xil
  /// narsa. Shuning uchun tafsilotga o'tishda tur bilinishi shart.
  bool get isStory => kind == 'story';
  bool get isCompany => authorKind == 'company';

  /// Manba turini belgilaydi.
  ///
  /// Kompaniya postlari `/api/companies/:id/posts` dan keladi va u
  /// yerda `authorKind` maydoni YO'Q — lekin tafsilotga o'tishda
  /// shaxsiy postdan ajratish SHART, chunki `id` lar alohida
  /// sanaladi.
  Post copyWithKind({String? kind, String? authorKind}) => Post(
        id: id,
        code: code,
        authorName: authorName,
        authorAvatar: authorAvatar,
        text: text,
        mediaUrls: mediaUrls,
        likes: likes,
        comments: comments,
        liked: liked,
        saved: saved,
        createdAt: createdAt,
        isVideo: isVideo,
        kind: kind ?? this.kind,
        authorKind: authorKind ?? this.authorKind,
      );

  Post copyWith({int? likes, bool? liked, bool? saved, int? comments}) => Post(
        id: id,
        code: code,
        authorName: authorName,
        authorAvatar: authorAvatar,
        text: text,
        mediaUrls: mediaUrls,
        likes: likes ?? this.likes,
        comments: comments ?? this.comments,
        liked: liked ?? this.liked,
        saved: saved ?? this.saved,
        createdAt: createdAt,
        isVideo: isVideo,
        kind: kind,
        authorKind: authorKind,
      );

  factory Post.fromJson(Map<String, dynamic> j) {
    final media = <String>[];
    final raw = j['media'] ?? j['images'] ?? j['mediaUrls'];
    if (raw is List) {
      for (final e in raw) {
        if (e is String && e.isNotEmpty) media.add(mediaUrl(e));
        if (e is Map && e['url'] != null) media.add(_u(e['url']));
      }
    }
    // BO'SH SATR — `null` EMAS.
    //
    // Server video post uchun `{"imageUrl": "", "videoUrl":
    // "/uploads/cardvid_....mp4"}` qaytaradi. Ilgari bu yerda
    //
    //     j['imageUrl'] ?? j['videoUrl'] ?? j['url']
    //
    // turardi. `??` FAQAT `null` da keyingisiga o'tadi, bo'sh
    // satrda esa o'tmaydi — shuning uchun `videoUrl` ga HECH
    // QACHON yetib borilmasdi va video postda `mediaUrls` bo'sh
    // qolardi.
    //
    // Oqibati ikkita edi va ikkalasi ham telefonda ko'rindi:
    // Reels filtri `isVideo && mediaUrls.isNotEmpty` ga qaraydi,
    // shuning uchun bo'lim "Hozircha reels yo'q" deb turardi; profil
    // panjarasi esa `mediaUrls.isEmpty` shoxiga tushib, video
    // o'rniga MATN katakchasini chizardi.
    //
    // `StoryItem.fromJson` buni allaqachon to'g'ri qilardi — aynan
    // shuning uchun video ISTORYA ishlab, video POST ishlamasdi.
    final single = _u([j['imageUrl'], j['videoUrl'], j['url']]
        .map(_s)
        .firstWhere((e) => e.isNotEmpty, orElse: () => ''));
    if (media.isEmpty && single.isNotEmpty) media.add(single);
    return Post(
      id: _i(j['id']),
      code: _s(j['code'] ?? j['recordCode'] ?? j['authorCode']),
      authorName: _s(j['authorName'] ?? j['name']),
      authorAvatar: _u(j['authorAvatar'] ?? j['avatarUrl']),
      text: _s(j['text'] ?? j['caption'] ?? j['body']),
      mediaUrls: media,
      likes: _i(j['likes'] ?? j['likeCount']),
      comments: _i(j['comments'] ?? j['commentCount']),
      liked: _b(j['liked'] ?? j['isLiked']),
      saved: _b(j['saved'] ?? j['isSaved']),
      createdAt: _dt(j['createdAt'] ?? j['created_at']),
      isVideo: _b(j['isVideo']) ||
          _s(j['videoUrl']).isNotEmpty ||
          _s(j['type']) == 'video' ||
          _s(j['type']) == 'reel',
      kind: _s(j['kind'], 'post'),
      authorKind: _s(j['authorKind'], 'card'),
    );
  }
}

class StoryItem {
  const StoryItem({
    required this.id,
    this.code = '',
    this.authorName = '',
    this.authorAvatar = '',
    this.mediaUrl = '',
    this.isVideo = false,
    this.caption = '',
    this.seen = false,
    this.createdAt,
    this.likes = 0,
    this.liked = false,
  });

  final int id;
  final String code;
  final String authorName;
  final String authorAvatar;
  final String mediaUrl;
  final bool isVideo;

  /// Istorya izohi. Server buni HAR DOIM qaytaradi
  /// (`caption: r.caption || ''`), model esa tashlab yuborardi —
  /// shuning uchun ekranda hech qachon ko'rinmasdi.
  final String caption;
  final bool seen;
  final DateTime? createdAt;

  /// LAYKLAR. Server `listStoriesD1` va `/api/stories/feed` da
  /// `likeCount` va `liked` ni HAR DOIM qaytaradi (yuqoridagi
  /// izohda ham shunday yozilgan), lekin model ularni TASHLAB
  /// YUBORARDI — xuddi `caption` kabi. Natijada istorya ostida
  /// layk soni ko'rsatilmasdi va "men bosganmanmi" degani ham
  /// bilinmasdi.
  final int likes;
  final bool liked;

  StoryItem copyWith({int? likes, bool? liked, bool? seen}) => StoryItem(
        id: id,
        code: code,
        authorName: authorName,
        authorAvatar: authorAvatar,
        mediaUrl: mediaUrl,
        isVideo: isVideo,
        caption: caption,
        seen: seen ?? this.seen,
        createdAt: createdAt,
        likes: likes ?? this.likes,
        liked: liked ?? this.liked,
      );

  /// `listStoriesD1` quyidagini qaytaradi:
  ///
  ///     { id, imageUrl, videoUrl, caption, createdAt, expiresAt,
  ///       likeCount, liked, viewCount }
  ///
  /// Ya'ni media IKKI alohida maydonda va qaysi biri to'lganidan
  /// video ekani bilinadi — `type` degan maydon umuman yo'q.
  /// Ilgari bu yerda faqat `mediaUrl`/`url` o'qilardi va video
  /// istoryalar bo'sh chiqardi.
  ///
  /// `seen` — serverda `viewCount` bor, lekin u BARCHA ko'rishlarni
  /// sanaydi, "men ko'rdimmi" degani emas. Shuning uchun ko'rilgan
  /// holati faqat server aniq `seen`/`viewed` bergan joyda
  /// ishonchli; aks holda `false` bo'lib qoladi va halqa "yangi"
  /// ko'rinadi. To'qib chiqarilmaydi.
  factory StoryItem.fromJson(Map<String, dynamic> j) {
    final video = _u(j['videoUrl']);
    final image = _u(j['imageUrl']);
    return StoryItem(
      id: _i(j['id']),
      code: _s(j['code'] ?? j['recordCode'] ?? j['ownerId']),
      authorName: _s(j['authorName'] ?? j['name']),
      authorAvatar: _u(j['authorAvatar'] ?? j['avatarUrl']),
      mediaUrl: video.isNotEmpty
          ? video
          : (image.isNotEmpty ? image : _u(j['mediaUrl'] ?? j['url'])),
      isVideo: video.isNotEmpty ||
          _b(j['isVideo']) ||
          _s(j['type']) == 'video',
      caption: _s(j['caption']),
      seen: _b(j['seen'] ?? j['viewed']),
      createdAt: _dt(j['createdAt']),
      likes: _i(j['likeCount'] ?? j['likes']),
      liked: _b(j['liked'] ?? j['isLiked']),
    );
  }
}

/// NFC ID sovg'a taklifi — `/api/gift-offers`.
class GiftOffer {
  const GiftOffer({
    required this.id,
    required this.code,
    required this.incoming,
    this.email = '',
    this.createdAt,
  });

  final int id;

  /// Sovg'a qilinayotgan NFC ID.
  final String code;

  /// `true` — menga kelgan, `false` — men yuborgan.
  final bool incoming;

  /// Kelganda yuboruvchining, yuborilganda qabul qiluvchining emaili.
  final String email;

  final DateTime? createdAt;

  factory GiftOffer.fromJson(Map<String, dynamic> j,
          {required bool incoming}) =>
      GiftOffer(
        id: _i(j['id']),
        code: _s(j['code']),
        incoming: incoming,
        email: _s(incoming ? j['fromEmail'] : j['toEmail']),
        createdAt: _dt(j['createdAt']),
      );
}

class Comment {
  const Comment({
    required this.id,
    this.code = '',
    this.authorName = '',
    this.authorAvatar = '',
    this.text = '',
    this.mine = false,
    this.createdAt,
  });

  final int id;

  /// Muallifning NFC kodi — profiliga o'tish uchun.
  final String code;
  final String authorName;
  final String authorAvatar;
  final String text;

  /// O'chirish tugmasi shu bayroqqa qarab ko'rsatiladi. Huquqni
  /// BARIBIR server tekshiradi — bu faqat ko'rinish uchun.
  final bool mine;

  final DateTime? createdAt;

  factory Comment.fromJson(Map<String, dynamic> j) => Comment(
        id: _i(j['id']),
        code: _s(j['code']),
        authorName: _s(j['authorName'] ?? j['name']),
        authorAvatar: _u(j['authorAvatar'] ?? j['avatarUrl']),
        text: _s(j['text'] ?? j['body']),
        mine: _b(j['mine']),
        createdAt: _dt(j['createdAt']),
      );
}

enum ActivityKind { like, follow, comment, scan, order, payment, system, security, business }

class ActivityEvent {
  const ActivityEvent({
    required this.id,
    required this.kind,
    this.title = '',
    this.subtitle = '',
    this.avatarUrl = '',
    this.read = false,
    this.createdAt,
    this.targetCode = '',
  });

  final int id;
  final ActivityKind kind;
  final String title;
  final String subtitle;
  final String avatarUrl;
  final bool read;
  final DateTime? createdAt;
  final String targetCode;

  factory ActivityEvent.fromJson(Map<String, dynamic> j) => ActivityEvent(
        id: _i(j['id']),
        kind: switch (_s(j['type'] ?? j['kind'])) {
          'like' => ActivityKind.like,
          'follow' => ActivityKind.follow,
          'comment' => ActivityKind.comment,
          'scan' || 'tap' || 'view' => ActivityKind.scan,
          'order' => ActivityKind.order,
          'payment' => ActivityKind.payment,
          'security' => ActivityKind.security,
          'business' || 'company' => ActivityKind.business,
          _ => ActivityKind.system,
        },
        title: _s(j['title'] ?? j['text']),
        subtitle: _s(j['subtitle'] ?? j['detail']),
        avatarUrl: _u(j['avatarUrl'] ?? j['avatar']),
        read: _b(j['read'] ?? j['isRead']),
        createdAt: _dt(j['createdAt'] ?? j['created_at']),
        targetCode: _s(j['code'] ?? j['targetCode']),
      );
}

/// `fromJson` uchun ro'yxat yordamchisi — repository'larda takrorlanmasin.
List<T> parseList<T>(dynamic raw, T Function(Map<String, dynamic>) f) =>
    _list(raw is Map ? (raw['items'] ?? raw['data'] ?? raw['rows']) : raw)
        .map(f)
        .toList();
