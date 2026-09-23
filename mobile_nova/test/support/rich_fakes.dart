import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/discover_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/nfc/nfc_service.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/social/reels_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../helpers.dart';

/// BOY SOXTA KONTENT — suratlar (`test/shots/editorial_shot.dart`) va
/// emulyatordagi layout to'plami (`integration_test/e2e_layout_test.dart`)
/// uchun BITTA manba. Haqiqiy tarmoqqa chiqmaydi.

const richAssets = 'assets/demo';

const richMe = NfcId(
  code: 'VIP001',
  name: 'Muhammad Aliyev',
  role: 'Davlat sud eksperti',
  bio: 'NFC orqali bir tegishda tanishamiz. Toshkent · 2026',
  avatarUrl: '$richAssets/z_portrait.jpg',
  coverUrl: '$richAssets/z_cover.jpg',
  primary: true,
  views: 1284,
  followers: 9,
  following: 11,
  posts: 9,
  verified: true,
  tier: 'exclusive',
  musicUrls: [
    'https://nfcstore.uz/uploads/Yulduzlar_ostida.mp3',
    'https://nfcstore.uz/uploads/Toshkent-kechasi.mp3',
  ],
);

const richIds = [
  richMe,
  NfcId(code: 'UZD772', name: 'Oybek Ergashev', tier: 'gold', views: 312),
  NfcId(code: 'TTS075', name: 'Tohir Shop', tier: 'silver', views: 88),
];

const richPeople = [
  NfcId(
      code: 'PPP777',
      name: 'Mashrabboy',
      role: 'Yangi g‘oyalar sari',
      avatarUrl: '$richAssets/z_post_cafe.jpg',
      followers: 5,
      posts: 12,
      tier: 'premium'),
  NfcId(
      code: 'ALI000',
      name: 'Aliyorbek Toshtemirov',
      role: 'Hayot davom etadi',
      avatarUrl: '$richAssets/z_post_rooftop.jpg',
      followers: 7,
      posts: 1,
      tier: 'gold'),
  NfcId(
      code: 'MHR555',
      name: 'Mohira Mansurova',
      role: 'Dizayner · brending',
      followers: 23,
      posts: 31,
      tier: 'silver'),
  NfcId(
      code: '33932023',
      name: 'Shaxnoza',
      role: '',
      followers: 0,
      posts: 0),
];

const richImages = [
  '$richAssets/z_post_nfc.jpg',
  '$richAssets/m_card_metal.jpg',
  '$richAssets/z_post_cafe.jpg',
  '$richAssets/m_cards.jpg',
  '$richAssets/z_post_evening.jpg',
  '$richAssets/m_stickers.jpg',
  '$richAssets/z_post_rooftop.jpg',
  '$richAssets/m_gift_set.jpg',
  '$richAssets/m_hero.jpg',
];

class RichSocial extends SocialRepository {
  RichSocial() : super(ApiClient());

  static final _posts = [
    for (var i = 0; i < richImages.length; i++)
      Post(
        id: 100 + i,
        code: 'VIP001',
        authorName: 'Muhammad Aliyev',
        authorAvatar: '$richAssets/z_portrait.jpg',
        text: i == 0
            ? 'NFCSTORE jamoasi bilan yangi metall kartalar ustida ishlayapmiz.'
            : 'Yangi kun — yangi tanishuvlar.',
        mediaUrls: [richImages[i]],
        likes: 24 - i,
        comments: 5,
        createdAt: DateTime(2026, 9, 22, 12).subtract(Duration(hours: i * 7)),
      ),
  ];

  static final _stories = [
    StoryItem(id: 1, code: 'PPP777', authorName: 'Mashrabboy', authorAvatar: '$richAssets/z_post_cafe.jpg', likes: 3),
    StoryItem(id: 2, code: 'ALI000', authorName: 'Aliyorbek', authorAvatar: '$richAssets/z_post_rooftop.jpg', likes: 1),
    StoryItem(id: 3, code: 'MHR555', authorName: 'Mohira', likes: 0, seen: true),
  ];

  @override
  Future<Result<List<Post>>> feed({int page = 1}) async => Ok(_posts);

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      Ok(code == 'VIP001' ? _posts : const []);

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async => const Ok([]);

  @override
  Future<Result<List<StoryItem>>> followedStories() async => Ok(_stories);

  @override
  Future<Result<void>> markStorySeen(int id) async => const Ok(null);

  @override
  Future<Result<({List<Comment> items, bool hasMore, int total})>> comments(
          String kind, int id, {int page = 1}) async =>
      Ok((
        items: [
          Comment(
              id: 1,
              code: 'ALI000',
              authorName: 'Aliyorbek',
              authorAvatar: '$richAssets/z_post_rooftop.jpg',
              text: 'Juda chiroyli chiqibdi! Karta qayerdan olinadi?',
              likes: 4,
              createdAt: DateTime(2026, 9, 22, 20)),
          Comment(
              id: 2,
              code: 'MHR555',
              authorName: 'Mohira Mansurova',
              text: 'Dizayn zo‘r 👏',
              likes: 2,
              createdAt: DateTime(2026, 9, 22, 21)),
          Comment(
              id: 3,
              code: 'VIP001',
              authorName: 'Muhammad Aliyev',
              authorAvatar: '$richAssets/z_portrait.jpg',
              text: 'Rahmat! Profilimdagi havola orqali.',
              mine: true,
              createdAt: DateTime(2026, 9, 22, 22)),
        ],
        hasMore: false,
        total: 36,
      ));
}

final richReels = [
  Post(
    id: 301,
    code: 'PPP777',
    authorName: 'Mashrabboy',
    authorAvatar: '$richAssets/z_post_cafe.jpg',
    text: 'Kechki Toshkent — bir tegishda tanishuv. #nfcstore',
    mediaUrls: const ['https://nfcstore.uz/uploads/reel1.mp4'],
    isVideo: true,
    likes: 1284,
    comments: 36,
  ),
  Post(
    id: 302,
    code: 'NFCSTORE',
    authorName: 'NFCSTORE',
    authorKind: 'company',
    text: 'Yangi metall kartalar',
    mediaUrls: const ['https://nfcstore.uz/uploads/reel2.mp4'],
    isVideo: true,
    likes: 312,
    comments: 12,
  ),
];

class RichNfc extends NfcService {
  RichNfc(this.a);
  final NfcAvailability a;
  @override
  Future<NfcAvailability> check() async => a;
}

/// Suratda NFC holati: `true` — apparati bor.
bool richNfcPresent = true;

class RichProfile extends ProfileRepository {
  RichProfile() : super(ApiClient());

  @override
  Future<Result<FollowStats>> followStats(String code) async => const Ok(
      (followers: 9, following: 11, isFollowing: false));
}

/// UMUMIY KATALOG namunasi: NFC — bitta sotuvchi/kategoriya, xolos;
/// yonida ovqat, kiyim, elektronika, go'zallik va ta'lim xizmatlari.
const richProducts = [
  CatalogProduct(
      id: 'p1', companyId: 'NFCSTORE', name: 'Metall NFC karta',
      imageUrl: '$richAssets/m_card_metal.jpg',
      images: ['$richAssets/m_card_metal.jpg', '$richAssets/m_cards.jpg', '$richAssets/m_hero.jpg'],
      price: 293000, promotionPrice: 249000,
      marketCategory: MarketCategory.electronics, sub: NfcProductType.card,
      section: 'NFC karta', companyName: 'NFCSTORE', companyCity: 'Toshkent',
      companyAddress: 'Amir Temur ko‘chasi, 15', companyPhone: '+998901234567',
      companyTelegram: '@nfcstore_uz', companyWhatsapp: '+998901234567'),
  CatalogProduct(
      id: 'p2', companyId: 'MILLIYTAOM', name: 'Qahva va desert seti',
      imageUrl: '$richAssets/z_post_cafe.jpg', price: 65000,
      marketCategory: MarketCategory.food, section: 'Ichimliklar',
      companyName: 'Milliy Taom', companyCity: 'Toshkent',
      companyPhone: '+998712000000'),
  CatalogProduct(
      id: 'p3', companyId: 'TECHSHOP', name: 'iPhone 15 Pro 256 GB',
      imageUrl: '$richAssets/m_iphone.jpg', price: 13900000, promotionPrice: 12900000,
      marketCategory: MarketCategory.electronics, section: 'Smartfonlar',
      companyName: 'Tech Shop', companyCity: 'Samarqand'),
  CatalogProduct(
      id: 'p4', companyId: 'GOZALSALON', name: 'Soch turmagi va styling',
      kind: ListingKind.service, marketCategory: MarketCategory.beauty,
      priceOnRequest: true, section: 'Sartaroshlik',
      companyName: 'Go‘zal Salon', companyCity: 'Toshkent',
      companyTelegram: '@gozal_salon'),
  CatalogProduct(
      id: 'p5', companyId: 'LINGVO', name: 'Ingliz tili · 3 oylik kurs',
      kind: ListingKind.service, marketCategory: MarketCategory.education,
      price: 1200000, section: 'Kurslar',
      companyName: 'Lingvo Markaz', companyCity: 'Buxoro'),
  CatalogProduct(
      id: 'p6', companyId: 'NFCSTORE', name: 'NFC stiker · 5 dona',
      imageUrl: '$richAssets/m_stickers.jpg', price: 89000,
      marketCategory: MarketCategory.electronics, sub: NfcProductType.sticker,
      section: 'NFC stiker', companyName: 'NFCSTORE'),
  CatalogProduct(
      id: 'p7', companyId: 'MODAUZ', name: 'Kuzgi palto',
      price: 890000, available: false,
      marketCategory: MarketCategory.fashion, section: 'Ustki kiyim',
      companyName: 'Moda Uz'),
  CatalogProduct(
      id: 'p8', companyId: 'TECHSHOP', name: 'Samsung Galaxy S24',
      imageUrl: '$richAssets/m_samsung.jpg', price: 9800000,
      marketCategory: MarketCategory.electronics, section: 'Smartfonlar',
      companyName: 'Tech Shop'),
];

/// Server `counts` qoidasi bilan bir xil: faqat qidiruv qo'llangan sonlar.
Map<String, int> catalogCountsOf(List<CatalogProduct> list) {
  final c = <String, int>{'all': list.length};
  for (final p in list) {
    c[p.kind.name] = (c[p.kind.name] ?? 0) + 1;
    c[p.marketCategory.name] = (c[p.marketCategory.name] ?? 0) + 1;
    if (p.sub != null) c[p.sub!.name] = (c[p.sub!.name] ?? 0) + 1;
  }
  return c;
}

class RichDiscover extends FakeDiscoverRepository {
  @override
  Future<Result<CatalogFeedPage>> catalogFeed({
    int page = 1,
    int limit = 20,
    String q = '',
    ListingKind? kind,
    MarketCategory? category,
    NfcProductType? sub,
    CatalogSort sort = CatalogSort.newest,
  }) async {
    final list = richProducts
        .where((p) =>
            (kind == null || p.kind == kind) &&
            (category == null || p.marketCategory == category) &&
            (sub == null || p.sub == sub))
        .toList();
    return Ok(CatalogFeedPage(
      items: list,
      total: list.length,
      counts: catalogCountsOf(richProducts),
    ));
  }

  @override
  Future<Result<List<NfcId>>> suggested() async => const Ok(richPeople);

  @override
  Future<Result<List<NfcId>>> searchPeople(String q) async => const Ok(richPeople);
}

Future<List<Override>> richOverrides() async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await Prefs.open();
  return [
    prefsProvider.overrideWithValue(prefs),
    authRepositoryProvider.overrideWithValue(FakeAuthRepository(ids: richIds)),
    socialRepositoryProvider.overrideWithValue(RichSocial()),
    discoverRepositoryProvider.overrideWithValue(RichDiscover()),
    profileRepositoryProvider.overrideWithValue(RichProfile()),
    reelsProvider.overrideWith((ref) async => richReels),
    nfcServiceProvider.overrideWithValue(RichNfc(
        richNfcPresent ? NfcAvailability.ready : NfcAvailability.unsupported)),
  ];
}

