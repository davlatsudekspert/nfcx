import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../design/widgets/bottom_nav.dart';
import '../l10n/gen/app_localizations.dart';
import 'routes.dart';

/// Beshta asosiy tabni ushlab turuvchi karkas.
///
/// `StatefulShellRoute` ishlatiladi: har tabning O'Z navigatsiya tarixi
/// bo'ladi va tab almashganda scroll holati saqlanadi. Oddiy
/// `IndexedStack` bilan orqaga tugmasi butun ilovani yopardi.
class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const tabRoutes = [
    Routes.home,
    Routes.discover,
    Routes.nfc,
    Routes.reels,
    Routes.profile,
  ];

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final items = [
      NavItem(icon: Icons.home_rounded, label: l.navHome, route: Routes.home),
      NavItem(icon: Icons.explore_rounded, label: l.navDiscover, route: Routes.discover),
      NavItem(icon: Icons.nfc_rounded, label: l.navNfc, route: Routes.nfc),
      NavItem(
          icon: Icons.play_circle_outline_rounded,
          label: l.navReels,
          route: Routes.reels),
      NavItem(icon: Icons.person_rounded, label: l.navProfile, route: Routes.profile),
    ];

    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBody: true,
      body: navigationShell,
      bottomNavigationBar: SafeArea(
        top: false,
        child: NovaBottomNav(
          items: items,
          currentIndex: navigationShell.currentIndex,
          onSelect: (i) => navigationShell.goBranch(
            i,
            // Faol tabga qayta bosilsa uning ildiziga qaytadi — bu
            // odatiy mobil xatti-harakat.
            initialLocation: i == navigationShell.currentIndex,
          ),
        ),
      ),
    );
  }
}
