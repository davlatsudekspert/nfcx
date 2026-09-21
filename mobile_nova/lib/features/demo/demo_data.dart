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
const kDemoBusinessId = 'NFCMARKET';

/// DEMO SURATLARI — HAMMASI HAQIQIY FOTO.
///
/// "NFC to'lqin" naqshli o'rin egallovchilar BUTUNLAY olib
/// tashlandi. Ularning o'rnida egasi bergan besh foto va ulardan
/// kesib olingan mahsulot ko'rinishlari turadi:
///
///   01_nfc_phones_card  → NFC texnologiya posti, mahsulot juftligi
///   02_zafar_rooftop    → portret va tomdagi post
///   03_zafar_cafe       → kafe posti
///   04_zafar_evening    → muqova va kechki post
///   05_nfc_market_showroom → do'kon hero'si; undan NFC kartalar,
///     stikerlar, QR stendi va telefonlar qatori ALOHIDA kesildi
///
/// Hammasi APK ichida — tarmoqqa chiqmaydi, offline ko'rinadi va
/// birortasi ikki marta ishlatilmaydi (buni test qo'riqlaydi).
const _a = 'assets/demo';

const kDemoPortrait = '$_a/z_portrait.jpg';
const kDemoStorefront = '$_a/m_hero.jpg';

final demoPersonalId = NfcId(
  code: kDemoPersonalCode,
  name: 'Zafar',
  role: 'Digital creator',
  bio: 'Brendlar uchun kontent yarataman. Tadbirda yoki uchrashuvda '
      'kartani tegizamiz — aloqa, portfolio va ijtimoiy tarmoqlar '
      'bir zumda qo\'lingizda bo\'ladi. Qog\'oz vizitka bilan '
      'xayrlashganimga ikki yil bo\'ldi.',
  avatarUrl: kDemoPortrait,
  coverUrl: '$_a/z_cover.jpg',
  primary: true,
  views: 2840,
  taps: 612,
  followers: 1240,
  following: 86,
  posts: 4,
  cardLinked: true,
);

Post _zafar(int id, String text, String media, DateTime at,
        {int likes = 0, int comments = 0}) =>
    Post(
      id: id,
      code: kDemoPersonalCode,
      authorName: demoPersonalId.name,
      authorAvatar: kDemoPortrait,
      text: text,
      mediaUrls: [media],
      likes: likes,
      comments: comments,
      createdAt: at,
    );

/// To'rtta post — to'rttasi ham BOSHQA foto va boshqa mavzu.
///
/// Birinchisi ataylab eng kuchlisi: profil ochilganda u KATTA
/// bo'lib chiziladi (`demo_grid.dart` ga qarang).
final demoPersonalPosts = <Post>[
  _zafar(-101, 'Tomdagi kechki uchrashuv. Bitta tegizish — aloqa '
      'saqlandi.', '$_a/z_post_rooftop.jpg',
      DateTime(2026, 9, 17), likes: 412, comments: 23),
  _zafar(-102, 'Ertalabki qahva va yangi loyiha rejasi.',
      '$_a/z_post_cafe.jpg', DateTime(2026, 9, 14), likes: 386, comments: 19),
  _zafar(-103, 'Yangi kartam keldi — telefonni tegizsangiz butun '
      'profil ochiladi.', '$_a/z_post_nfc.jpg',
      DateTime(2026, 9, 10), likes: 354, comments: 27),
  _zafar(-104, 'Shahar chiroqlari yonganda.', '$_a/z_post_evening.jpg',
      DateTime(2026, 9, 6), likes: 331, comments: 15),
];

final demoPersonalStories = <StoryItem>[
  StoryItem(
    id: -201,
    code: kDemoPersonalCode,
    authorName: demoPersonalId.name,
    authorAvatar: kDemoPortrait,
    mediaUrl: '$_a/z_post_rooftop.jpg',
    caption: 'Karta tegizib tanishgansiz',
    createdAt: DateTime(2026, 9, 19),
  ),
  StoryItem(
    id: -202,
    code: kDemoPersonalCode,
    authorName: demoPersonalId.name,
    authorAvatar: kDemoPortrait,
    mediaUrl: '$_a/z_post_nfc.jpg',
    caption: 'Bitta tegizish — butun profil',
    createdAt: DateTime(2026, 9, 18),
  ),
];

const demoBusiness = Business(
  companyId: kDemoBusinessId,
  displayName: 'NFC Market',
  category: 'shop',
  subcategory: 'Elektronika',
  city: 'Toshkent',
  address: 'Amir Temur ko\'chasi, 12',
  description: 'Texnologiya hayotni yaqinroq qiladi. Smartfonlar, '
      'NFC kartalar, stikerlar va stendlar — katalog, aloqa va '
      'buyurtmalar bitta NFC profil ichida. Mijoz kartani '
      'tegizadi va do\'koningiz ochiladi.',
  phone: '+998 90 000 00 00',
  telegram: 'nfcmarket',
  website: 'nfcstore.uz',
  logoUrl: '$_a/m_card_metal.jpg',
  coverUrl: kDemoStorefront,
  status: 'active',
  followers: 3120,
  views: 18400,
);

/// Katalog — HAR BIR mahsulotning O'Z fotosi.
///
/// NFC stiker va stol stendi uchun alohida foto yo'q edi; ular
/// showroom suratining ICHIDA turibdi, shuning uchun o'sha
/// suratdan aniq kesib olindi. Ya'ni nom ostidagi rasm haqiqatan
/// o'sha mahsulot.
const demoCatalog = <CatalogItem>[
  CatalogItem(
    id: -301,
    name: 'iPhone 18 Pro',
    description: 'Titan korpus, 256 GB. NFC bilan to\'liq mos.',
    imageUrl: '$_a/m_iphone.jpg',
    price: 15900000,
    salePrice: 14700000,
  ),
  CatalogItem(
    id: -302,
    name: 'Samsung Galaxy S26 Ultra',
    description: '512 GB, S Pen. Kartani tegizib ulashing.',
    imageUrl: '$_a/m_samsung.jpg',
    price: 13500000,
  ),
  CatalogItem(
    id: -303,
    name: 'NFC vizitka — Klassik',
    description: 'PVC karta, mat qoplama. Profilga bitta tegizishda.',
    imageUrl: '$_a/m_cards.jpg',
    price: 149000,
    salePrice: 119000,
  ),
  CatalogItem(
    id: -304,
    name: 'NFC vizitka — Metall',
    description: 'To\'liq metall korpus, oltin lazer o\'yma.',
    imageUrl: '$_a/m_card_metal.jpg',
    price: 390000,
  ),
  CatalogItem(
    id: -305,
    name: 'NFC stiker to\'plami',
    description: '5 ta stiker — stol, eshik yoki vitrina uchun.',
    imageUrl: '$_a/m_stickers.jpg',
    price: 79000,
  ),
  CatalogItem(
    id: -307,
    name: 'NFCSTORE sovg\'a to\'plami',
    description: 'Qutida karta, brelok, ruchka va vizitkadon — '
        'tayyor sovg\'a.',
    imageUrl: '$_a/m_gift_set.jpg',
    price: 690000,
  ),
  CatalogItem(
    id: -306,
    name: 'Stol stendi + QR',
    description: 'Kafe va do\'konlar uchun: tegizish ham, QR ham.',
    imageUrl: '$_a/m_stand.jpg',
    price: 210000,
  ),
];

Post _market(int id, String text, String media, DateTime at,
        {int likes = 0, int comments = 0}) =>
    Post(
      id: id,
      code: kDemoBusinessId,
      authorName: demoBusiness.displayName,
      authorAvatar: '$_a/m_card_metal.jpg',
      text: text,
      mediaUrls: [media],
      likes: likes,
      comments: comments,
      authorKind: 'company',
      createdAt: at,
    );

final demoBusinessPosts = <Post>[
  _market(-401, 'Yangi vitrina tayyor — mijoz tegizadi, katalog '
      'ochiladi.', kDemoStorefront,
      DateTime(2026, 9, 16), likes: 340, comments: 21),
  _market(-402, 'Yangi smartfonlar omborga keldi.',
      '$_a/m_product_duo.jpg', DateTime(2026, 9, 12), likes: 187, comments: 9),
  _market(-403, 'NFC kartalar va stikerlar — jonli ko\'rish mumkin.',
      '$_a/m_phones.jpg', DateTime(2026, 9, 8), likes: 221, comments: 14),
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
          {String dir = 'followers'}) async =>
      const Ok([]);

  @override
  Future<Result<void>> follow(String code) async => const Ok(null);

  @override
  Future<Result<void>> unfollow(String code) async => const Ok(null);

  @override
  Future<Result<FollowStats>> followStats(String code) async => Ok((
        followers: demoPersonalId.followers,
        following: demoPersonalId.following,
        // Demo hech qachon haqiqiy obunani ko'rsatmaydi.
        isFollowing: false,
      ));
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
