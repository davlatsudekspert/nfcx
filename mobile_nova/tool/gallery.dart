// VIZUAL QA UCHUN KIRISH NUQTASI — ISHLAB CHIQARISHGA KIRMAYDI.
//
// `lib/main.dart` haqiqiy ilovani ishga tushiradi va HAMMA ma'lumotni
// backend'dan oladi. Bu fayl esa ekranlarni belgilangan kenglik, mavzu
// va tilda SURATGA OLISH uchun: sessiya, mavzu va til providerlari
// tashqaridan URL orqali beriladi.
//
// Bu yerdagi namunaviy foydalanuvchi ilovaga KIRMAYDI — u faqat shu
// faylda yashaydi va `flutter build apk` ga tushmaydi (build faqat
// `lib/main.dart` dan boshlanadi).
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/repositories/auth_repository.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/discover_repository.dart';
import 'package:nfcstore_nova/data/repositories/shop_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/features/activity/activity_screen.dart';
import 'package:nfcstore_nova/features/auth/login_screen.dart';
import 'package:nfcstore_nova/features/auth/register_screen.dart';
import 'package:nfcstore_nova/features/auth/verify_screen.dart';
import 'package:nfcstore_nova/features/business/business_forms.dart';
import 'package:nfcstore_nova/features/business/business_screens.dart';
import 'package:nfcstore_nova/features/discover/discover_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_ids_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_scan_screen.dart';
import 'package:nfcstore_nova/features/settings/settings_screen.dart';
import 'package:nfcstore_nova/features/settings/settings_subscreens.dart';
import 'package:nfcstore_nova/features/shop/shop_screens.dart';
import 'package:nfcstore_nova/features/social/post_screens.dart';
import 'package:nfcstore_nova/features/entry/splash_screen.dart';
import 'package:nfcstore_nova/features/entry/welcome_screen.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_center_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Gallereya serveri o'zi beradigan surat — tarmoqqa chiqmaydi.
///
/// Home orbdagi avatar mantiqini ko'rsatish uchun kerak. `?avatar=0`
/// berilsa bu qiymat bo'shatiladi va fallback (brend belgisi) ishlaydi.
const _sampleAvatar = 'http://127.0.0.1:8731/avatar.jpg';

/// Gallereya ko'rsatayotgan foydalanuvchi — `?avatar=0` bilan
/// almashtiriladi.
User _activeUser = _sampleUser;

const _sampleUser = User(
  id: 1,
  email: 'nova@nfcstore.uz',
  name: 'Nodira Rahimova',
  phone: '+998901234567',
  avatarUrl: _sampleAvatar,
);

const _sampleIds = [
  NfcId(
    code: '48210377',
    name: 'Nodira Rahimova',
    role: 'Product designer',
    primary: true,
    taps: 1284,
    views: 5320,
    followers: 842,
    following: 231,
    posts: 24,
  ),
  NfcId(
    code: 'NOVA',
    name: 'Nova Studio',
    role: 'Design studio',
    kind: NfcIdKind.business,
    taps: 612,
    views: 2140,
    followers: 1290,
    posts: 48,
  ),
];

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final q = Uri.base.queryParameters;
  final screen = q['screen'] ?? 'home';
  final themeId = q['theme'] ?? 'pearl';
  final lang = q['lang'] ?? 'uz';
  final signedIn = q['auth'] != 'out';

  _stories = switch (q['story']) {
    'seen' => _seenStories,
    'none' => _noOwnStories,
    _ => _sampleStories,
  };

  // `?avatar=0` — foydalanuvchida surat YO'Q holati: Home orb
  // fallback sifatida brend belgisini ko'rsatishi kerak.
  if (q['avatar'] == '0') {
    _activeUser = const User(
      id: 1,
      email: 'nova@nfcstore.uz',
      name: 'Nodira Rahimova',
      phone: '+998901234567',
    );
  }

  // `route` berilsa — HAQIQIY ilova (NovaApp) ishga tushadi va
  // marshrut orqali o'sha ekranga o'tiladi. Shunda `HomeShell` va
  // uning ichidagi `NovaBottomNav` ham chiziladi.
  //
  // `screen` rejimi esa bitta ekranni SHELLSIZ ko'rsatadi — u
  // marshrutga bog'lanmagan ekranlar (masalan `checkout`) uchun.
  final route = q['route'];

  // Mavzu va til SAQLANGAN sozlama sifatida beriladi: shunda haqiqiy
  // ilova ularni o'z providerlaridan o'qiydi va gallereya hech narsani
  // majburlamaydi.
  // ignore: invalid_use_of_visible_for_testing_member
  SharedPreferences.setMockInitialValues({
    'nova.theme': themeId,
    'nova.locale': lang,
  });
  final prefs = await Prefs.open();

  runApp(
    ProviderScope(
      overrides: [
        prefsProvider.overrideWithValue(prefs),
        if (signedIn)
          authRepositoryProvider.overrideWithValue(_GalleryAuth()),
        socialRepositoryProvider.overrideWithValue(_GallerySocial()),
        discoverRepositoryProvider.overrideWithValue(_GalleryDiscover()),
        businessRepositoryProvider.overrideWithValue(_GalleryBusiness()),
        shopRepositoryProvider.overrideWithValue(_GalleryShop()),
      ],
      child: route == null
          ? _Gallery(screen: screen, themeId: themeId, lang: lang)
          : _ShellGallery(route: route),
    ),
  );
}

/// HAQIQIY ilovani ishga tushirib, kerakli marshrutga o'tadi.
///
/// NIMA UCHUN KERAK: `_Gallery` ekranlarni to'g'ridan-to'g'ri mount
/// qiladi va shu sababli `HomeShell` ni — demak `NovaBottomNav` ni ham
/// chetlab o'tadi. Auditda esa pastki navigatsiya ko'rinishi SHART.
///
/// Bu yerda hech narsa taqlid qilinmaydi: `NovaApp`, `routerProvider`,
/// `HomeShell` va `NovaBottomNav` — hammasi ishlab chiqarish kodi.
class _ShellGallery extends ConsumerStatefulWidget {
  const _ShellGallery({required this.route});

  final String route;

  @override
  ConsumerState<_ShellGallery> createState() => _ShellGalleryState();
}

class _ShellGalleryState extends ConsumerState<_ShellGallery> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _openRoute());
  }

  Future<void> _openRoute() async {
    // Router `redirect` i sessiya tiklanguncha Splash'da ushlab turadi.
    // Shuning uchun avval sessiya faollashishini kutamiz.
    for (var i = 0; i < 60; i++) {
      if (ref.read(sessionProvider) is SessionActive) break;
      await Future<void>.delayed(const Duration(milliseconds: 50));
    }
    if (!mounted) return;
    ref.read(routerProvider).go(widget.route);
  }

  @override
  Widget build(BuildContext context) => const NovaApp();
}

// ---- tarmoqqa chiqmaydigan repositorylar --------------------------------
// Surat olayotganda so'rov kutib turish yoki xato paneli chiqishi
// KERAK EMAS: bu yerda tekshirilayotgan narsa MAKET, ma'lumot emas.

class _GalleryAuth extends AuthRepository {
  _GalleryAuth() : super(ApiClient());

  @override
  Future<Result<({User user, List<NfcId> ids})>> restore() async =>
      Ok((user: _activeUser, ids: _sampleIds));

  @override
  Future<Result<({User user, List<NfcId> ids})>> me() async =>
      Ok((user: _activeUser, ids: _sampleIds));
}

const _samplePosts = [
  Post(
    id: 1,
    code: '48210377',
    authorName: 'Nodira Rahimova',
    text: 'Yangi NFC kartalar bugun keldi — dizayni ajoyib chiqdi.',
    likes: 248,
    comments: 17,
  ),
  Post(
    id: 2,
    code: 'NOVA',
    authorName: 'Nova Studio',
    text: 'Studiya vitrinasi yangilandi. Katalogda 12 ta yangi xizmat bor.',
    likes: 96,
    comments: 5,
  ),
  Post(
    id: 3,
    code: '48210377',
    authorName: 'Nodira Rahimova',
    text: 'Konferensiyada 140 ta tegish. Qog\'oz vizitka kerak emas ekan.',
    likes: 512,
    comments: 41,
  ),
];

const _sampleStories = [
  StoryItem(id: 1, code: '48210377', authorName: 'Nodira'),
  StoryItem(id: 2, code: 'NOVA', authorName: 'Nova Studio'),
  StoryItem(id: 3, code: '48210377', authorName: 'Studio', seen: true),
];

/// Hammasi ko'rilgan — Home orbdagi halqa so'nik holatda.
const _seenStories = [
  StoryItem(id: 1, code: '48210377', authorName: 'Nodira', seen: true),
  StoryItem(id: 2, code: 'NOVA', authorName: 'Nova Studio'),
  StoryItem(id: 3, code: '48210377', authorName: 'Studio', seen: true),
];

/// Faol ID da story YO'Q — halqa umuman chizilmaydi.
const _noOwnStories = [
  StoryItem(id: 2, code: 'NOVA', authorName: 'Nova Studio'),
];

/// `?story=unseen|seen|none` — uchala holatni suratga olish uchun.
List<StoryItem> _stories = _sampleStories;

class _GallerySocial extends SocialRepository {
  _GallerySocial() : super(ApiClient());

  @override
  Future<Result<List<Post>>> feed({int page = 1}) async =>
      const Ok(_samplePosts);

  @override
  Future<Result<List<Post>>> postsOf(String code, {int page = 1}) async =>
      const Ok(_samplePosts);

  @override
  Future<Result<List<StoryItem>>> storiesOf(String code) async =>
      Ok(_stories);
}

const _sampleBusiness = Business(
  companyId: 'nova',
  displayName: 'Nova Studio',
  category: 'services',
  subcategory: 'Dizayn studiyasi',
  city: 'Toshkent',
  address: 'Amir Temur ko‘chasi 12',
  description: 'Brend, interfeys va NFC identity yechimlari.',
  phone: '+998901234567',
  telegram: '@novastudio',
  website: 'https://nova.uz',
  status: 'published',
  followers: 1290,
  views: 8420,
);

const _sampleCatalog = [
  CatalogItem(
    id: 1,
    name: 'Brend identifikatsiyasi',
    description: 'Logotip, rang tizimi va qo‘llanma.',
    price: 12000000,
    kind: ListingKind.service,
  ),
  CatalogItem(
    id: 2,
    name: 'NFC vizitka to‘plami',
    description: '50 ta shaxsiylashtirilgan karta.',
    price: 1800000,
    salePrice: 1450000,
  ),
  CatalogItem(
    id: 3,
    name: 'Vitrina sozlash',
    description: 'Katalog, narxlar va analitika.',
    price: 3200000,
    kind: ListingKind.service,
    available: false,
  ),
];

class _GalleryBusiness extends BusinessRepository {
  _GalleryBusiness() : super(ApiClient());

  @override
  Future<Result<List<Business>>> mine() async => const Ok([_sampleBusiness]);

  @override
  Future<Result<Business>> byId(String companyId) async =>
      const Ok(_sampleBusiness);

  @override
  Future<Result<List<CatalogItem>>> catalog(String companyId) async =>
      const Ok(_sampleCatalog);
}

const _sampleShop = [
  ShopProduct(
    id: 'nfc-black',
    name: 'NFC karta — Matte Black',
    description: 'PVC karta, lazer o‘yma, NTAG215 chip.',
    price: 149000,
    oldPrice: 189000,
    category: 'Kartalar',
    tier: 'Standart',
  ),
  ShopProduct(
    id: 'nfc-metal',
    name: 'NFC karta — Metal',
    description: 'Zanglamaydigan po‘lat, gravirovka.',
    price: 549000,
    category: 'Kartalar',
    tier: 'Premium',
  ),
  ShopProduct(
    id: 'id-4',
    name: '4 xonali NFC ID',
    description: 'Eng qisqa va eslab qolinadigan manzil.',
    price: 2400000,
    category: 'ID',
    tier: '4',
  ),
  ShopProduct(
    id: 'id-6',
    name: '6 xonali NFC ID',
    price: 390000,
    category: 'ID',
    tier: '6',
    inStock: false,
  ),
];

class _GalleryShop extends ShopRepository {
  _GalleryShop() : super(ApiClient());

  @override
  Future<Result<List<ShopProduct>>> products({String? category}) async =>
      const Ok(_sampleShop);

  @override
  Future<Result<List<Order>>> orders() async => const Ok([
        Order(id: 1042, status: 'paid', total: 149000, itemsText: 'NFC karta — Matte Black'),
        Order(id: 1038, status: 'pending', total: 2400000, itemsText: '4 xonali NFC ID'),
      ]);

  @override
  Future<Result<Set<PayProvider>>> enabledProviders() async =>
      const Ok({PayProvider.payme, PayProvider.click});
}

class _GalleryDiscover extends DiscoverRepository {
  _GalleryDiscover() : super(ApiClient());

  @override
  Future<Result<List<NfcId>>> suggested() async => const Ok(_sampleIds);

  @override
  Future<Result<List<NfcId>>> searchPeople(String q) async => const Ok(_sampleIds);
}

class _Gallery extends ConsumerWidget {
  const _Gallery({required this.screen, required this.themeId, required this.lang});

  final String screen;
  final String themeId;
  final String lang;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = NfcTokens.byId(themeId);
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildTheme(tokens),
      locale: Locale(lang),
      supportedLocales: LocaleController.supported,
      localizationsDelegates: const [
        L.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: _Frame(child: _screenFor(screen)),
    );
  }

  Widget _screenFor(String name) => switch (name) {
        'splash' => const SplashScreen(),
        'welcome' => const WelcomeScreen(),
        'login' => const LoginScreen(),
        'register' => const RegisterScreen(),
        'verify' => const VerifyScreen(
            args: VerifyArgs(
              email: 'nodira@nfcstore.uz',
              
            ),
          ),
        'discover' => const DiscoverScreen(),
        'nfc' => const NfcCenterScreen(),
        'nfcIds' => const NfcIdsScreen(),
        'nfcScan' => const NfcScanScreen(),
        'profile' => const ProfileScreen(),
        'settings' => const SettingsScreen(),
        'theme' => const ThemeSettingsScreen(),
        'language' => const LanguageSettingsScreen(),
        'business' => const BusinessScreen(),
        'bizOnboard' => const BusinessOnboardScreen(),
        'bizDashboard' => const BusinessDashboardScreen(),
        'bizCatalog' => const BusinessCatalogScreen(),
        'shop' => const ShopScreen(),
        'checkout' => const CheckoutScreen(),
        'paymentPending' => const PaymentResultScreen(state: 'pending'),
        'paymentSuccess' => const PaymentResultScreen(state: 'success'),
        'paymentFailed' => const PaymentResultScreen(state: 'failed'),
        'orders' => const OrdersScreen(),
        'activity' => const ActivityScreen(),
        'postCreate' => const ComposerScreen(kind: ComposerKind.post),
        _ => const HomeScreen(),
      };
}

/// Ekranni telefon o'lchamida, pastki navigatsiya bilan ko'rsatadi.
class _Frame extends StatelessWidget {
  const _Frame({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    // Brauzer oynasi kengligi telefon kengligi sifatida ishlatiladi,
    // shuning uchun 360/390/430 ni Playwright viewport bilan beramiz.
    final size = MediaQuery.sizeOf(context);
    return MediaQuery(
      data: MediaQuery.of(context).copyWith(
        size: size,
        devicePixelRatio: ui.PlatformDispatcher.instance.views.first.devicePixelRatio,
        padding: const EdgeInsets.only(top: 34, bottom: 12),
        viewPadding: const EdgeInsets.only(top: 34, bottom: 12),
      ),
      child: child,
    );
  }
}
