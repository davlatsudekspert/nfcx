import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';
import '../../data/models/models.dart';
import '../../data/repositories/business_repository.dart';
import '../../data/repositories/social_repository.dart';
import '../profile/profile_repository.dart';

/// DEMO MA'LUMOT — "NFC Mobile" bo'limi uchun.
///
/// ## NIMA UCHUN ALOHIDA FAYL VA ALOHIDA REPOZITORIY
///
/// Demo mazmun HAQIQIY ma'lumot oqimiga UMUMAN tegmasligi kerak:
/// u "Mening ID'larim" ro'yxatiga qo'shilib ketmasligi, lentada
/// paydo bo'lmasligi va serverga hech narsa yozmasligi shart.
///
/// Shuning uchun demo ekranlar ODDIY ekranlarning o'zi, faqat
/// ular `ProviderScope` ichida ochiladi va o'sha SCOPE ICHIDA
/// repozitoriylar shu fayldagilar bilan almashtiriladi. Almashtirish
/// faqat o'sha daraxtda yashaydi — undan tashqarida ilova
/// avvalgidek serverdan o'qiydi.
///
/// Shu yo'l tufayli demo profil "ikkinchi profil ekrani" emas:
/// u AYNAN o'sha `ProfileScreen`, `StorefrontScreen` va
/// `StoryViewerScreen`. Ya'ni demo'da ko'ringan narsa haqiqiy
/// mahsulotda ham aynan shunday ko'rinadi.

/// Shaxsiy demo NFC kodi.
const kDemoPersonalCode = 'ZZZ777';

/// Biznes demo kompaniya identifikatori.
const kDemoBusinessId = 'NFVMARKET';

/// Demo rasmlar ILOVA ICHIDA saqlanadi.
///
/// Tarmoqdan olinsa, internet sekin bo'lganda reklama bo'limi
/// bo'sh kvadratlar ko'rsatardi — bu reklama emas, nuqson bo'lib
/// ko'rinadi. Nisbatlar ataylab har xil: kvadrat, tik va yotiq —
/// moslashuvchi quti aynan shu yerda ko'rinadi.
const _a = 'assets/demo';

final demoPersonalId = NfcId(
  code: kDemoPersonalCode,
  name: 'Zafar',
  role: 'Digital creator',
  bio: 'NFC kartani tegizib tanishamiz. Portfolio, aloqa va '
      'ijtimoiy tarmoqlar — bitta profilda.',
  avatarUrl: '$_a/p_avatar.jpg',
  coverUrl: '$_a/p_cover.jpg',
  primary: true,
  views: 2840,
  taps: 612,
  followers: 1240,
  following: 86,
  posts: 3,
  cardLinked: true,
);

final demoPersonalPosts = <Post>[
  Post(
    id: -101,
    code: kDemoPersonalCode,
    authorName: demoPersonalId.name,
    authorAvatar: demoPersonalId.avatarUrl,
    text: 'Yangi NFC kartam keldi — bitta tegizishda butun profil.',
    mediaUrls: const ['$_a/p_post1.jpg'],
    likes: 214,
    comments: 12,
    createdAt: DateTime(2026, 9, 14),
  ),
  Post(
    id: -102,
    code: kDemoPersonalCode,
    authorName: demoPersonalId.name,
    authorAvatar: demoPersonalId.avatarUrl,
    text: 'Tadbirda 40 ta yangi tanishuv. Qog\'oz vizitka kerak emas.',
    mediaUrls: const ['$_a/p_post2.jpg'],
    likes: 158,
    comments: 7,
    createdAt: DateTime(2026, 9, 9),
  ),
  Post(
    id: -103,
    code: kDemoPersonalCode,
    authorName: demoPersonalId.name,
    authorAvatar: demoPersonalId.avatarUrl,
    text: 'Profil dizayni yangilandi.',
    mediaUrls: const ['$_a/p_post3.jpg'],
    likes: 96,
    comments: 4,
    createdAt: DateTime(2026, 9, 3),
  ),
];

final demoPersonalStories = <StoryItem>[
  StoryItem(
    id: -201,
    code: kDemoPersonalCode,
    authorName: demoPersonalId.name,
    authorAvatar: demoPersonalId.avatarUrl,
    mediaUrl: '$_a/p_story1.jpg',
    caption: 'Karta tegizib tanishgansiz',
    createdAt: DateTime(2026, 9, 19),
  ),
  StoryItem(
    id: -202,
    code: kDemoPersonalCode,
    authorName: demoPersonalId.name,
    authorAvatar: demoPersonalId.avatarUrl,
    mediaUrl: '$_a/p_story2.jpg',
    caption: 'Bitta tegizish — butun profil',
    createdAt: DateTime(2026, 9, 18),
  ),
];

const demoBusiness = Business(
  companyId: kDemoBusinessId,
  displayName: 'NFV Market',
  category: 'shop',
  subcategory: 'Elektronika',
  city: 'Toshkent',
  address: 'Amir Temur ko\'chasi, 12',
  description: 'Katalog, aloqa va buyurtmalar — barchasi bitta NFC '
      'profil ichida. Mijoz kartani tegizadi va do\'koningiz '
      'ochiladi.',
  phone: '+998 90 000 00 00',
  telegram: 'nfvmarket',
  website: 'nfcstore.uz',
  logoUrl: '$_a/b_logo.jpg',
  coverUrl: '$_a/b_cover.jpg',
  status: 'active',
  followers: 3120,
  views: 18400,
);

const demoCatalog = <CatalogItem>[
  CatalogItem(
    id: -301,
    name: 'NFC vizitka — Klassik',
    description: 'PVC karta, oltin bosma. Profilga bitta tegizishda.',
    imageUrl: '$_a/b_item1.jpg',
    price: 149000,
    salePrice: 119000,
  ),
  CatalogItem(
    id: -302,
    name: 'NFC vizitka — Metall',
    description: 'To\'liq metall korpus, lazer o\'yma.',
    imageUrl: '$_a/b_item2.jpg',
    price: 390000,
  ),
  CatalogItem(
    id: -303,
    name: 'NFC stiker to\'plami',
    description: '5 ta stiker — stol, eshik yoki vitrina uchun.',
    imageUrl: '$_a/b_item3.jpg',
    price: 79000,
  ),
  CatalogItem(
    id: -304,
    name: 'Stol stendi + QR',
    description: 'Kafe va do\'konlar uchun: tegizish ham, QR ham.',
    imageUrl: '$_a/b_item4.jpg',
    price: 210000,
    isService: false,
  ),
];

final demoBusinessPosts = <Post>[
  Post(
    id: -401,
    code: kDemoBusinessId,
    authorName: demoBusiness.displayName,
    authorAvatar: demoBusiness.logoUrl,
    text: 'Yangi metall kartalar omborga keldi.',
    mediaUrls: const ['$_a/b_post1.jpg'],
    likes: 340,
    comments: 21,
    authorKind: 'company',
    createdAt: DateTime(2026, 9, 16),
  ),
  Post(
    id: -402,
    code: kDemoBusinessId,
    authorName: demoBusiness.displayName,
    authorAvatar: demoBusiness.logoUrl,
    text: 'Do\'konimizda NFC stend o\'rnatildi — mijoz tegizadi, '
        'katalog ochiladi.',
    mediaUrls: const ['$_a/b_post2.jpg'],
    likes: 187,
    comments: 9,
    authorKind: 'company',
    createdAt: DateTime(2026, 9, 11),
  ),
];

// ------------------------------------------------ demo repozitoriylari
//
// Hammasi FAQAT O'QIYDI. Yozuv metodlari ham muvaffaqiyat qaytaradi,
// lekin hech qayerga bormaydi: demo'da tugma bosilganda xato
// chiqishi ham, serverga so'rov ketishi ham noto'g'ri bo'lardi.

class DemoProfileRepository extends ProfileRepository {
  DemoProfileRepository() : super(ApiClient());

  @override
  Future<Result<NfcId>> byCode(String code) async => Ok(demoPersonalId);

  @override
  Future<Result<List<NfcId>>> followList(String code,
          {String type = 'followers'}) async =>
      const Ok([]);

  @override
  Future<Result<void>> follow(String code) async => const Ok(null);

  @override
  Future<Result<void>> unfollow(String code) async => const Ok(null);

  @override
  Future<Result<({int followers, int following})>> followStats(
          String code) async =>
      Ok((followers: demoPersonalId.followers, following: demoPersonalId.following));
}

class DemoSocialRepository extends SocialRepository {
  DemoSocialRepository() : super(ApiClient());

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      Ok(demoPersonalPosts);

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async =>
      Ok(demoPersonalStories);

  @override
  Future<Result<List<Post>>> feed({int page = 1}) async =>
      Ok(demoPersonalPosts);
}

class DemoBusinessRepository extends BusinessRepository {
  DemoBusinessRepository() : super(ApiClient());

  @override
  Future<Result<Business>> byId(String companyId) async => const Ok(demoBusiness);

  @override
  Future<Result<List<Business>>> mine() async => const Ok([]);

  @override
  Future<Result<List<CatalogItem>>> catalog(String companyId) async =>
      const Ok(demoCatalog);

  @override
  Future<Result<List<Post>>> posts(String companyId) async =>
      Ok(demoBusinessPosts);

  @override
  Future<Result<List<StoryItem>>> stories(String companyId) async =>
      const Ok([]);
}

/// Demo daraxtida ishlaydigan almashtirishlar.
///
/// `mine()` ATAYLAB bo'sh: demo kompaniya foydalanuvchining o'z
/// kompaniyalari ro'yxatiga qo'shilib ketmasligi kerak.
List<Override> demoOverrides() => [
      profileRepositoryProvider.overrideWithValue(DemoProfileRepository()),
      socialRepositoryProvider.overrideWithValue(DemoSocialRepository()),
      businessRepositoryProvider.overrideWithValue(DemoBusinessRepository()),
    ];
