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
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/repositories/auth_repository.dart';
import 'package:nfcstore_nova/data/repositories/discover_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/discover/discover_screen.dart';
import 'package:nfcstore_nova/features/entry/splash_screen.dart';
import 'package:nfcstore_nova/features/entry/welcome_screen.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart';
import 'package:nfcstore_nova/features/nfc/nfc_center_screen.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _sampleUser = User(
  id: 1,
  email: 'nova@nfcstore.uz',
  name: 'Nodira Rahimova',
  phone: '+998901234567',
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
  // ignore: invalid_use_of_visible_for_testing_member
  SharedPreferences.setMockInitialValues({});
  final prefs = await Prefs.open();

  final q = Uri.base.queryParameters;
  final screen = q['screen'] ?? 'home';
  final themeId = q['theme'] ?? 'pearl';
  final lang = q['lang'] ?? 'uz';
  final signedIn = q['auth'] != 'out';

  runApp(
    ProviderScope(
      overrides: [
        prefsProvider.overrideWithValue(prefs),
        if (signedIn)
          authRepositoryProvider.overrideWithValue(_GalleryAuth()),
        socialRepositoryProvider.overrideWithValue(_GallerySocial()),
        discoverRepositoryProvider.overrideWithValue(_GalleryDiscover()),
      ],
      child: _Gallery(screen: screen, themeId: themeId, lang: lang),
    ),
  );
}

// ---- tarmoqqa chiqmaydigan repositorylar --------------------------------
// Surat olayotganda so'rov kutib turish yoki xato paneli chiqishi
// KERAK EMAS: bu yerda tekshirilayotgan narsa MAKET, ma'lumot emas.

class _GalleryAuth extends AuthRepository {
  _GalleryAuth() : super(ApiClient());

  @override
  Future<Result<({User user, List<NfcId> ids})>> restore() async =>
      const Ok((user: _sampleUser, ids: _sampleIds));

  @override
  Future<Result<({User user, List<NfcId> ids})>> me() async =>
      const Ok((user: _sampleUser, ids: _sampleIds));
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
      const Ok(_sampleStories);
}

class _GalleryDiscover extends DiscoverRepository {
  _GalleryDiscover() : super(ApiClient());

  @override
  Future<Result<List<NfcId>>> suggested() async => const Ok(_sampleIds);

  @override
  Future<Result<List<NfcId>>> searchPeople(String q) async => const Ok(_sampleIds);

  @override
  Future<Result<List<Post>>> trending() async => const Ok(_samplePosts);
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
        'discover' => const DiscoverScreen(),
        'nfc' => const NfcCenterScreen(),
        'profile' => const ProfileScreen(),
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
