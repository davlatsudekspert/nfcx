import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../design/motion/motion.dart';
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
import '../features/nfc/nfc_ids_screen.dart';
import '../features/nfc/nfc_misc_screens.dart';
import '../features/nfc/nfc_scan_screen.dart';
import '../features/profile/profile_edit_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/settings/settings_subscreens.dart';
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
final routerProvider = Provider<GoRouter>((ref) {
  final session = ref.watch(sessionProvider);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: Routes.splash,
    debugLogDiagnostics: false,
    redirect: (context, state) {
      final loc = state.matchedLocation;
      final authArea = loc == Routes.splash ||
          loc == Routes.welcome ||
          loc.startsWith('/login') ||
          loc.startsWith('/register');

      return switch (session) {
        // Token tekshirilmoqda — Splash'dan boshqa joyga o'tkazmaymiz.
        SessionRestoring() => loc == Routes.splash ? null : Routes.splash,
        SessionAnonymous() => authArea && loc != Routes.splash
            ? null
            : Routes.welcome,
        SessionActive() => authArea ? Routes.home : null,
      };
    },
    routes: [
      GoRoute(path: Routes.splash, builder: (_, __) => const SplashScreen()),
      GoRoute(path: Routes.welcome, builder: (_, __) => const WelcomeScreen()),
      GoRoute(path: Routes.login, builder: (_, __) => const LoginScreen()),
      GoRoute(
        path: Routes.loginVerify,
        builder: (_, s) => VerifyScreen(
          args: s.extra as VerifyArgs? ??
              const VerifyArgs(email: '', purpose: VerifyPurpose.login),
        ),
      ),
      GoRoute(path: Routes.register, builder: (_, __) => const RegisterScreen()),
      GoRoute(
        path: Routes.registerVerify,
        builder: (_, s) => VerifyScreen(
          args: s.extra as VerifyArgs? ??
              const VerifyArgs(email: '', purpose: VerifyPurpose.register),
        ),
      ),
      GoRoute(
        path: Routes.profileSetup,
        builder: (_, __) => const ProfileSetupScreen(),
      ),

      // ---- asosiy tablar --------------------------------------------------
      StatefulShellRoute.indexedStack(
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
      GoRoute(
        path: '/u/:code',
        builder: (_, s) => ProfileScreen(code: s.pathParameters['code']),
      ),

      // NFC
      GoRoute(path: Routes.nfcIds, builder: (_, __) => const NfcIdsScreen()),
      GoRoute(path: Routes.nfcScan, builder: (_, __) => const NfcScanScreen()),
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
        builder: (_, s) => PostScreen(
          id: int.tryParse(s.pathParameters['id'] ?? '') ?? 0,
          code: s.uri.queryParameters['code'] ?? '',
        ),
      ),
      GoRoute(
        path: '/story/:code',
        builder: (_, s) => StoryViewerScreen(code: s.pathParameters['code']!),
      ),

      // Biznes
      GoRoute(path: Routes.business, builder: (_, __) => const BusinessScreen()),
      GoRoute(
          path: Routes.businessOnboard,
          builder: (_, __) => const BusinessOnboardScreen()),
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
              itemId: int.tryParse(s.pathParameters['itemId'] ?? ''),
            ),
          ),
        ],
      ),
      GoRoute(
          path: Routes.businessAnalytics,
          builder: (_, __) => const BusinessAnalyticsScreen()),
      GoRoute(
        path: '/c/:companyId',
        builder: (_, s) =>
            StorefrontScreen(companyId: s.pathParameters['companyId']!),
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
