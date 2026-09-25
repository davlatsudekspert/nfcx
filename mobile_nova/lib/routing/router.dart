import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/repositories/nfc_repository.dart';
import '../design/motion/motion.dart';
import '../features/auth/forgot_password_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/profile_setup_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/auth/session.dart';
import '../features/auth/verify_screen.dart';
import '../data/models/models.dart';
import '../features/discover/discover_screen.dart';
import '../features/entry/splash_screen.dart';
import '../features/entry/welcome_screen.dart';
import '../features/home/home_screen.dart';
import '../features/nfc/nfc_center_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/activity/activity_screen.dart';
import '../features/business/business_forms.dart';
import '../features/business/business_screens.dart';
import '../features/business/store_catalog.dart';
import '../features/business/business_intro.dart';
import '../features/discover/catalog_view.dart';
import '../features/demo/demo_screens.dart';
import '../features/nfc/nfc_ids_screen.dart';
import '../features/nfc/nfc_misc_screens.dart';
import '../features/nfc/nfc_scan_screen.dart';
import '../features/nfc/nfc_write_screen.dart';
import '../features/social/featured_screen.dart';
import '../features/profile/follow_list_screen.dart';
import '../features/profile/profile_edit_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/settings/settings_subscreens.dart';
import '../features/shop/nfc_id_market.dart';
import '../features/shop/shop_screens.dart';
import '../features/social/post_screens.dart';
import '../features/social/reels_screen.dart';
import '../features/social/story_viewer.dart';
import 'routes.dart';
import 'shell.dart';
import '../features/nfc/gift_offers_screen.dart';

final _rootKey = GlobalKey<NavigatorState>();

/// Ilova marshrutlari.
///
/// `redirect` yagona qorovul: sessiya holati o'zgarganda (kirdi,
/// chiqdi, token eskirdi) barcha ekranlar avtomatik to'g'ri joyga
/// ko'chadi. Har ekranda "kirganmi?" deb tekshirish kerak emas.
///
/// ## ROUTER BIR MARTA YARATILADI
///
/// Ilgari bu provayder `ref.watch(sessionProvider)` qilardi. Sessiya
/// har yangilanganda (`refresh()` — profilni tortib yangilash, ID
/// qo'shish, profilni tahrirlash...) YANGI `GoRouter` yaratilardi:
/// barcha tablar, ochiq ekranlar va ularning holati noldan
/// qurilardi, ilova esa Splash orqali Home'ga qaytardi. Telefonda
/// bu "qotib qoldi" bo'lib ko'rinardi.
///
/// Endi router bitta. Sessiyaning faqat TURI (tekshirilmoqda /
/// anonim / faol) o'zgarganda `refreshListenable` orqali `redirect`
/// qayta hisoblanadi. Foydalanuvchi ma'lumoti yangilanishi routerga
/// umuman tegmaydi.
final routerProvider = Provider<GoRouter>((ref) {
  final kind = ValueNotifier<Type>(ref.read(sessionProvider).runtimeType);
  ref.listen<SessionState>(
    sessionProvider,
    (_, next) => kind.value = next.runtimeType,
  );

  // KUTILAYOTGAN MANZIL — deep link / NFC karta sessiya tiklanayotganda
  // (yoki kirilmagan paytda) kelsa, u shu yerda saqlanadi va sessiya
  // faol bo'lgach AYNAN o'sha joyga olib boriladi. Ilgari Splash ->
  // Home qayta yo'naltirishi asl manzilni yo'qotardi: kartani
  // tegizgan odam profil o'rniga bosh sahifani ko'rardi.
  String? pending;
  var wasActive = false;
  String takePending() {
    final p = pending;
    pending = null;
    return (p == null || p.isEmpty || p == Routes.splash) ? Routes.home : p;
  }

  final router = GoRouter(
    navigatorKey: _rootKey,
    initialLocation: Routes.splash,
    debugLogDiagnostics: false,
    refreshListenable: kind,
    redirect: (context, state) {
      final session = ref.read(sessionProvider);
      final loc = state.matchedLocation;
      // `/register/setup` — ro'yxatdan o'tgach FAOL sessiya bilan
      // ochiladi (profil sozlash, biznes tanlovi). U auth hududi
      // hisoblansa faol sessiya uni darhol Home'ga burardi va bu
      // ekran hech qachon ko'rinmasdi.
      final authArea = loc == Routes.splash ||
          loc == Routes.welcome ||
          loc.startsWith('/login') ||
          (loc.startsWith('/register') && loc != Routes.profileSetup);
      final card = _cardLinkTarget(state);

      // Chiqishdan (yoki sessiya tugashidan) keyin turgan ekran
      // "kutilayotgan manzil" bo'lmaydi — keyingi kirish Home'dan.
      final loggedOut = session is SessionAnonymous && wasActive;
      if (session is! SessionActive && !authArea && !loggedOut) {
        pending = card ?? _pathAndQuery(state.uri);
      }
      wasActive = session is SessionActive;

      return switch (session) {
        // Token tekshirilmoqda — Splash'dan boshqa joyga o'tkazmaymiz.
        SessionRestoring() => loc == Routes.splash ? null : Routes.splash,
        SessionAnonymous() => authArea && loc != Routes.splash
            ? null
            : Routes.welcome,
        SessionActive() => authArea ? takePending() : card,
      };
    },
    routes: [
      GoRoute(path: Routes.splash, builder: (_, __) => const SplashScreen()),
      GoRoute(path: Routes.welcome, builder: (_, __) => const WelcomeScreen()),
      GoRoute(path: Routes.login, builder: (_, __) => const LoginScreen()),
      GoRoute(
        path: Routes.forgotPassword,
        builder: (_, s) =>
            ForgotPasswordScreen(initialEmail: s.extra as String? ?? ''),
      ),
      GoRoute(
        path: Routes.loginVerify,
        builder: (_, s) => VerifyScreen(
          args: s.extra as VerifyArgs? ??
              const VerifyArgs(email: ''),
        ),
      ),
      GoRoute(path: Routes.register, builder: (_, __) => const RegisterScreen()),
      GoRoute(
        path: Routes.registerVerify,
        builder: (_, s) => VerifyScreen(
          args: s.extra as VerifyArgs? ??
              const VerifyArgs(email: ''),
        ),
      ),
      GoRoute(
        path: Routes.profileSetup,
        builder: (_, __) => const ProfileSetupScreen(),
      ),

      // ---- asosiy tablar --------------------------------------------------
      // TABLAR DARHOL ALMASHADI (Apple/Samsung kabi).
      //
      // `FadingBranchContainer` xuddi `IndexedStack` kabi har tabni
      // TIRIK saqlaydi (scroll va tarix yo'qolmaydi). Ilgarigi 200ms
      // shaffoflik telefonda qotish berardi — sababi `shell.dart` da.
      StatefulShellRoute(
        navigatorContainerBuilder: (_, shell, children) =>
            FadingBranchContainer(
          currentIndex: shell.currentIndex,
          children: children,
        ),
        builder: (_, __, shell) => HomeShell(navigationShell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: Routes.home, builder: (_, __) => const HomeScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
                path: Routes.discover, builder: (_, __) => const DiscoverScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: Routes.nfc, builder: (_, __) => const NfcCenterScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: Routes.reels, builder: (_, __) => const ReelsScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: Routes.profile, builder: (_, __) => const ProfileScreen()),
          ]),
        ],
      ),

      // ---- tab ustida ochiladigan ekranlar --------------------------------
      // Bular `StatefulShellRoute` DAN TASHQARIDA: to'liq ekranni egallaydi
      // va o'z "orqaga" tarixiga ega bo'ladi.
      GoRoute(path: Routes.profileEdit, builder: (_, __) => const ProfileEditScreen()),
      // NFC STIKER — `https://nfcstore.uz/t/<token>` (server shunday
      // yozadi). Token faqat SERVERDA profilga aylanadi.
      GoRoute(
        path: '/t/:token',
        redirect: (_, s) async {
          final res = await ref
              .read(nfcRepositoryProvider)
              .resolveChip(s.pathParameters['token'] ?? '');
          final chip = res.valueOrNull;
          if (chip == null || chip.code.isEmpty) return Routes.home;
          return chip.company
              ? Routes.storefront(chip.code)
              : Routes.user(chip.code);
        },
      ),
      GoRoute(
        path: '/u/:code',
        builder: (_, s) =>
            NavPage(child: ProfileScreen(code: s.pathParameters['code'])),
      ),
      // Profildagi "Obunachilar" / "Obunalar" raqami bosilganda.
      GoRoute(
        path: '/u/:code/followers',
        builder: (_, s) => NavPage(
            child: FollowListScreen(
                code: s.pathParameters['code'] ?? '', dir: 'followers')),
      ),
      GoRoute(
        path: '/u/:code/following',
        builder: (_, s) => NavPage(
            child: FollowListScreen(
                code: s.pathParameters['code'] ?? '', dir: 'following')),
      ),

      // NFC
      GoRoute(path: Routes.nfcIds, builder: (_, __) => const NfcIdsScreen()),
      // NFC ID BOZORI. Buyurtma yo'li `/:code` dan OLDIN turishi
      // shart — aks holda `order` so'zi kod deb o'qilardi va
      // `/nfc/market/order/12` umuman ochilmasdi.
      GoRoute(
        path: '/nfc/market/order/:id',
        builder: (_, st) =>
            NfcIdOrderScreen(orderId: int.tryParse(st.pathParameters['id'] ?? '') ?? 0),
      ),
      GoRoute(
        path: '/nfc/market/:code',
        builder: (_, st) =>
            NfcIdBuyScreen(code: st.pathParameters['code'] ?? ''),
      ),
      GoRoute(path: Routes.nfcMarket, builder: (_, __) => const NfcIdMarketScreen()),
      GoRoute(path: Routes.nfcScan, builder: (_, __) => const NfcScanScreen()),
      GoRoute(path: Routes.nfcWrite, builder: (_, __) => const NfcWriteScreen()),
      GoRoute(
        path: '/featured/:kind/:id',
        builder: (_, st) => FeaturedScreen(
          targetKind: st.pathParameters['kind'] ?? 'post',
          targetId: int.tryParse(st.pathParameters['id'] ?? '') ?? 0,
        ),
      ),
      GoRoute(path: Routes.nfcCards, builder: (_, __) => const NfcCardsScreen()),
      GoRoute(path: Routes.nfcHistory, builder: (_, __) => const NfcHistoryScreen()),
      GoRoute(
          path: Routes.nfcSecurity, builder: (_, __) => const NfcSecurityScreen()),
      GoRoute(
        path: '/nfc/id/:code',
        builder: (_, s) => NfcIdDetailScreen(code: s.pathParameters['code']!),
        routes: [
          GoRoute(
            path: 'edit',
            builder: (_, s) => NfcIdEditScreen(code: s.pathParameters['code']!),
          ),
          GoRoute(
            path: 'gift',
            builder: (_, s) => NfcGiftScreen(code: s.pathParameters['code']!),
          ),
        ],
      ),

      // Social
      GoRoute(
        path: Routes.postCreate,
        builder: (_, __) => const ComposerScreen(kind: ComposerKind.post),
      ),
      GoRoute(
        path: Routes.storyCreate,
        builder: (_, __) => const ComposerScreen(kind: ComposerKind.story),
      ),
      GoRoute(
        path: Routes.reelCreate,
        builder: (_, __) => const ComposerScreen(kind: ComposerKind.reel),
      ),
      GoRoute(
        path: Routes.giftOffers,
        builder: (_, __) => const GiftOffersScreen(),
      ),
      GoRoute(
        path: '/post/:id',
        builder: (_, s) {
          final code = s.uri.queryParameters['code'] ?? '';
          return demoWrap(
            code,
            PostScreen(
              id: int.tryParse(s.pathParameters['id'] ?? '') ?? 0,
              code: code,
              company: s.uri.queryParameters['company'] == '1',
            ),
          );
        },
      ),
      GoRoute(
        path: '/story/:code',
        builder: (_, s) {
          final code = s.pathParameters['code']!;
          // `?business=1` bo'lsa kompaniya istoryalari o'qiladi.
          final business = s.uri.queryParameters['business'] == '1';
          return demoWrap(
            code,
            StoryViewerScreen(code: code, isBusiness: business),
          );
        },
      ),

      // Biznes
      GoRoute(path: Routes.business, builder: (_, __) => const BusinessScreen()),
      GoRoute(
          path: Routes.businessIntro,
          builder: (_, __) => const BusinessIntroScreen()),
      GoRoute(
          path: Routes.businessOnboard,
          builder: (_, s) => BusinessOnboardScreen(
                custom: s.uri.queryParameters['mode'] == 'custom',
              )),
      GoRoute(
          path: Routes.businessDashboard,
          builder: (_, __) => const BusinessDashboardScreen()),
      GoRoute(
          path: Routes.businessEdit,
          builder: (_, __) => const BusinessEditScreen()),
      GoRoute(
        path: Routes.businessCatalog,
        builder: (_, __) => const BusinessCatalogScreen(),
        routes: [
          GoRoute(
            path: 'new',
            builder: (_, __) => const BusinessProductFormScreen(),
          ),
          GoRoute(
            path: ':itemId',
            builder: (_, s) => BusinessProductFormScreen(
              // Server id'si UUID — raqamga aylantirilmaydi.
              itemId: s.pathParameters['itemId'],
            ),
          ),
        ],
      ),
      GoRoute(
          path: Routes.businessAnalytics,
          builder: (_, __) => const BusinessAnalyticsScreen()),
      GoRoute(
        path: '/c/:companyId',
        builder: (_, s) => NavPage(
            child:
                StorefrontScreen(companyId: s.pathParameters['companyId']!)),
        routes: [
          // To'liq katalog — profildagi "Barchasini ko'rish".
          GoRoute(
            path: 'catalog',
            builder: (_, s) => NavPage(
              child: StoreCatalogScreen(
                companyId: s.pathParameters['companyId']!,
                initialCategory: s.uri.queryParameters['cat'] ?? 'all',
              ),
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/catalog/:companyId/:itemId',
        builder: (_, s) => NavPage(
          child: CatalogProductScreen(
            companyId: s.pathParameters['companyId']!,
            itemId: s.pathParameters['itemId']!,
            initial:
                s.extra is CatalogProduct ? s.extra as CatalogProduct : null,
          ),
        ),
      ),
      GoRoute(
        path: Routes.demoPersonal,
        builder: (_, __) => const DemoPersonalScreen(),
      ),
      GoRoute(
        path: Routes.demoBusiness,
        builder: (_, __) => const DemoBusinessScreen(),
      ),

      // Do'kon
      GoRoute(
        path: Routes.shop,
        builder: (_, __) => const ShopScreen(),
        routes: [
          GoRoute(
            path: 'checkout',
            builder: (_, s) => CheckoutScreen(product: s.extra as ShopProduct?),
          ),
          GoRoute(
            path: 'payment/:state',
            builder: (_, s) =>
                PaymentResultScreen(state: s.pathParameters['state']!),
          ),
          GoRoute(
            path: ':id',
            builder: (_, s) => ShopProductScreen(id: s.pathParameters['id']!),
          ),
        ],
      ),
      GoRoute(path: Routes.orders, builder: (_, __) => const OrdersScreen()),

      // Bildirishnomalar va sozlamalar
      GoRoute(path: Routes.activity, builder: (_, __) => const ActivityScreen()),
      GoRoute(
        path: Routes.settings,
        builder: (_, __) => const SettingsScreen(),
        routes: [
          GoRoute(
              path: 'security',
              builder: (_, __) => const SecuritySettingsScreen()),
          GoRoute(
              path: 'language',
              builder: (_, __) => const LanguageSettingsScreen()),
          GoRoute(path: 'theme', builder: (_, __) => const ThemeSettingsScreen()),
          GoRoute(
              path: 'notifications',
              builder: (_, __) => const NotificationsSettingsScreen()),
          GoRoute(
              path: 'privacy',
              builder: (_, __) => const PrivacySettingsScreen()),
          GoRoute(
            path: 'payment',
            builder: (_, __) => const PaymentHistoryScreen(),
            routes: [
              GoRoute(
                  path: 'history',
                  builder: (_, __) => const PaymentHistoryScreen()),
            ],
          ),
          GoRoute(path: 'referral', builder: (_, __) => const ReferralScreen()),
          GoRoute(path: 'premium', builder: (_, __) => const PremiumScreen()),
          GoRoute(path: 'support', builder: (_, __) => const SupportScreen()),
          GoRoute(path: 'about', builder: (_, __) => const AboutScreen()),
        ],
      ),
    ],
    errorBuilder: (context, state) => _RouteError(location: state.uri.toString()),
  );
  ref.onDispose(() {
    router.dispose();
    kind.dispose();
  });
  return router;
});

/// Noma'lum manzil. Ishlab chiqarishda ko'rinmasligi kerak, lekin
/// ko'rinsa — oq ekran emas, tushunarli holat va chiqish yo'li bo'lsin.
class _RouteError extends StatelessWidget {
  const _RouteError({required this.location});
  final String location;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.explore_off_rounded, size: 40),
                const SizedBox(height: 14),
                Text(location, textAlign: TextAlign.center),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: () => GoRouter.of(context).go(Routes.home),
                  child: const Text('Home'),
                ),
              ],
            ),
          ),
        ),
      );
}

/// Fade + scale o'tishi bilan sahifa — `MaterialPage` o'rniga.
CustomTransitionPage<T> fadeScalePage<T>({
  required Widget child,
  required GoRouterState state,
}) =>
    CustomTransitionPage<T>(
      key: state.pageKey,
      child: child,
      transitionDuration: Motion.med,
      transitionsBuilder: (_, animation, __, child) {
        final curved =
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
        return FadeTransition(
          opacity: curved,
          child: ScaleTransition(
            scale: Tween(begin: .97, end: 1.0).animate(curved),
            child: child,
          ),
        );
      },
    );

/// Manzilning yo'li va so'rovi (sxema/xost'siz) — `https://nfcstore.uz/u/X`
/// -> `/u/X`.
String _pathAndQuery(Uri u) =>
    Uri(path: u.path.isEmpty ? '/' : u.path, query: u.hasQuery ? u.query : null)
        .toString();

/// NFC KARTA HAVOLASI — `https://nfcstore.uz/<CODE>` (ilova o'zi shunday
/// yozadi) yoki jismoniy karta `/<CODE>?t=<token>`.
///
/// Alohida `/:code` marshruti QO'SHILMAYDI — u `/home`, `/shop` kabi
/// ilova yo'llarini "yutib" yuborardi. Faqat HECH BIR marshrut mos
/// kelmagan bitta bo'lakli yo'l profilga aylantiriladi.
String? _cardLinkTarget(GoRouterState s) {
  if (s.topRoute != null) return null;
  final seg = s.uri.pathSegments.where((e) => e.isNotEmpty).toList();
  if (seg.length == 1 && RegExp(r'^[A-Za-z0-9]{2,32}$').hasMatch(seg[0])) {
    return Routes.user(seg[0].toUpperCase());
  }
  return null;
}
