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
/// "NFC to'lqin" naqshli o'rin egallovchilar OLIB TASHLANDI.
/// Ularning o'rnida NFCSTORE'ning O'Z materiallari turadi:
///
///   * do'kon interyeri va mahsulot renderlari
///     (`public/business-assets/`);
///   * shahar grafikalari (`public/card-backgrounds/`) — ular
///     karta fonlari sifatida chizilgan, ya'ni brend tilida;
///   * oltin sovg'a va qora NFC karta fotosi.
///
/// Hammasi APK ichida — tarmoqqa chiqmaydi, offline ko'rinadi.
/// Birorta surat ikki marta ishlatilmaydi.
const _a = 'assets/demo';

const kDemoPortrait = '$_a/z_portrait.jpg';
const kDemoStorefront = '$_a/m_hero.jpg';

final demoPersonalId = NfcId(
  code: kDemoPersonalCode,
  name: 'Zafar',
  role: 'Digital creator',
  bio: 'Brendlar uchun kontent yarataman. Tadbirda yoki uchrashuvda '
      'kartani tegizamiz — aloqa, portfolio va ijtimoiy tarmoqlar '
      'bir zumda qo\'lingizda bo\'ladi.',
  avatarUrl: kDemoPortrait,
  coverUrl: '$_a/z_cover.jpg',
  primary: true,
  views: 2840,
  taps: 612,
  followers: 1240,
  following: 86,
  posts: 5,
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

/// Beshta post — beshta BOSHQA surat va boshqa mavzu.
///
/// Ilgari uchta post ham bir xil naqsh edi va profil "bo'sh"
/// bo'lib ko'rinardi. Demo'ning butun maqsadi shu yerda: odam
/// shaxsiy NFC profil qanday to'ldirilishini ko'rsin.
final demoPersonalPosts = <Post>[
  _zafar(-101, 'Dubaydagi tadbirda 40 ta yangi tanishuv. Qog\'oz '
      'vizitka bitta ham ishlatilmadi.', '$_a/z_post_city.jpg',
      DateTime(2026, 9, 17), likes: 412, comments: 23),
  _zafar(-102, 'Yangi metall kartam keldi — bitta tegizishda butun '
      'profil ochiladi.', '$_a/z_post_nfc.jpg',
      DateTime(2026, 9, 14), likes: 386, comments: 19),
  _zafar(-103, 'Mijoz bilan uchrashuv. Aloqani saqlash uchun telefon '
      'raqami ham kerak bo\'lmadi.', '$_a/z_post_meeting.jpg',
      DateTime(2026, 9, 10), likes: 254, comments: 12),
  _zafar(-104, 'Parij. Kechki yurish va yangi suratlar.',
      '$_a/z_post_evening.jpg', DateTime(2026, 9, 6), likes: 331, comments: 15),
  _zafar(-105, 'Samarqand — keyingi loyiha shu yerda boshlanadi.',
      '$_a/z_post_travel.jpg', DateTime(2026, 9, 2), likes: 297, comments: 11),
];

final demoPersonalStories = <StoryItem>[
  StoryItem(
    id: -201,
    code: kDemoPersonalCode,
    authorName: demoPersonalId.name,
    authorAvatar: kDemoPortrait,
    mediaUrl: '$_a/z_post_city.jpg',
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
      'NFC kartalar va aksessuarlar — katalog, aloqa va '
      'buyurtmalar bitta NFC profil ichida. Mijoz kartani '
      'tegizadi va do\'koningiz ochiladi.',
  phone: '+998 90 000 00 00',
  telegram: 'nfcmarket',
  website: 'nfcstore.uz',
  logoUrl: '$_a/m_card.jpg',
  coverUrl: kDemoStorefront,
  status: 'active',
  followers: 3120,
  views: 18400,
);

/// Katalog — har bir mahsulotning O'Z fotosi.
///
/// MUHIM: bu yerda faqat loyihada HAQIQIY fotosi bor mahsulotlar
/// turadi. "NFC stiker to'plami" va "Stol stendi + QR" uchun
/// materiallarda surat yo'q edi, shuning uchun ular boshqa
/// mahsulotning rasmi bilan ATAYLAB to'ldirilmadi: noto'g'ri
/// surat ostidagi nom reklamani buzadi. Surat berilganda ro'yxatga
/// bitta qator qo'shiladi.
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
    name: 'Galaxy Z Fold',
    description: 'Buklanadigan ekran, ikki rejim.',
    imageUrl: '$_a/m_fold.jpg',
    price: 18200000,
  ),
  CatalogItem(
    id: -304,
    name: 'NFC vizitka — Klassik',
    description: 'Qora PVC karta, oltin bosma. Profilga bitta '
        'tegizishda.',
    imageUrl: '$_a/m_card.jpg',
    price: 149000,
    salePrice: 119000,
  ),
  CatalogItem(
    id: -305,
    name: 'NFCSTORE sovg\'a to\'plami',
    description: 'Qutida NFC karta va oltin lenta — tayyor sovg\'a.',
    imageUrl: '$_a/m_gift.jpg',
    price: 290000,
  ),
  CatalogItem(
    id: -306,
    name: 'Google Pixel',
    description: 'Toza Android, kamera va NFC.',
    imageUrl: '$_a/m_pixel.jpg',
    price: 9800000,
  ),
];

Post _market(int id, String text, String media, DateTime at,
        {int likes = 0, int comments = 0}) =>
    Post(
      id: id,
      code: kDemoBusinessId,
      authorName: demoBusiness.displayName,
      authorAvatar: '$_a/m_card.jpg',
      text: text,
      mediaUrls: [media],
      likes: likes,
      comments: comments,
      authorKind: 'company',
      createdAt: at,
    );

final demoBusinessPosts = <Post>[
  _market(-401, 'Do\'konimizda NFC stend o\'rnatildi — mijoz tegizadi, '
      'katalog ochiladi.', kDemoStorefront,
      DateTime(2026, 9, 16), likes: 340, comments: 21),
  _market(-402, 'Yangi smartfonlar omborga keldi.', '$_a/m_lifestyle.jpg',
      DateTime(2026, 9, 12), likes: 187, comments: 9),
  _market(-403, 'Sovg\'a to\'plamlari cheklangan miqdorda.',
      '$_a/m_gift.jpg', DateTime(2026, 9, 8), likes: 221, comments: 14),
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
