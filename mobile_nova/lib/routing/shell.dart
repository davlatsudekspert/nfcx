import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../design/widgets/bottom_nav.dart';
import '../features/profile/music_player.dart';
import '../l10n/gen/app_localizations.dart';
import 'routes.dart';

/// Beshta asosiy tabni ushlab turuvchi karkas.
///
/// `StatefulShellRoute` ishlatiladi: har tabning O'Z navigatsiya tarixi
/// bo'ladi va tab almashganda scroll holati saqlanadi. Oddiy
/// `IndexedStack` bilan orqaga tugmasi butun ilovani yopardi.
/// FAOL TAB RAQAMI.
///
/// `StatefulShellRoute.indexedStack` tablarni O'CHIRMAYDI — faqat
/// berkitadi. Ya'ni Reels'dan Profilga o'tganda Reels ekrani TIRIK
/// qoladi, `dispose()` chaqirilmaydi va video ijro davom etaveradi:
/// odam boshqa bo'limda turib Reels ovozini eshitardi.
///
/// Ekranlar ko'rinayotgan-ko'rinmayotganini shu yerdan biladi.
final activeTabProvider = StateProvider<int>((_) => 0);

/// "Asosiy" tugmasi Home'da turib qayta bosilgan — har bosishda
/// oshadi. Bosh sahifa buni eshitadi va tepaga suriladi.
final homeReselectProvider = StateProvider<int>((_) => 0);

class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();

  static const tabRoutes = [
    Routes.home,
    Routes.discover,
    Routes.nfc,
    Routes.reels,
    Routes.profile,
  ];

}

class _HomeShellState extends ConsumerState<HomeShell> {
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final shell = widget.navigationShell;

    // Qaysi tab ko'rinayotganini e'lon qilamiz. `build` paytida
    // holatni o'zgartirib bo'lmaydi, shuning uchun kadrdan keyin.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final cur = ref.read(activeTabProvider);
      if (cur != shell.currentIndex) {
        ref.read(activeTabProvider.notifier).state = shell.currentIndex;
      }
    });
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
      body: shell,
      bottomNavigationBar: SafeArea(
        top: false,
        child: NovaBottomNav(
          items: items,
          currentIndex: shell.currentIndex,
          onSelect: (i) {
            // Tab almashganda ovoz DARHOL to'xtaydi — `dispose()`
            // kelishini kutmasdan, chunki u umuman kelmaydi.
            if (i != shell.currentIndex) {
              ref.read(audioOwnerProvider).stopAll();
            }
            // ASOSIY TABGA QAYTA BOSISH — TEPAGA QAYTARADI.
            //
            // Boshqa tabdan bosilganda shunchaki Home'ga o'tadi
            // (pastdagi `goBranch`). Home'da turib bosilganda esa
            // ro'yxat animatsiya bilan eng tepaga qaytadi — bu
            // odatiy mobil xulq va odam uni kutadi.
            //
            // Signal sanoqchi orqali: `bool` bo'lsa ketma-ket
            // ikkinchi bosish "o'zgarish yo'q" bo'lib ketardi.
            if (i == 0 && shell.currentIndex == 0) {
              ref.read(homeReselectProvider.notifier).state++;
            }
            shell.goBranch(
              i,
              // Faol tabga qayta bosilsa uning ildiziga qaytadi — bu
              // odatiy mobil xatti-harakat.
              initialLocation: i == shell.currentIndex,
            );
          },
        ),
      ),
    );
  }
}


/// Tab kontenti — har bir tab tirik, almashuv 200ms shaffoflik bilan.
///
/// `IndexedStack` dan farqi: faol bo'lmagan tab darhol yashirinmaydi,
/// 200ms ichida xiralashadi, yangisi esa paydo bo'ladi. Qolgani bir xil:
///
///   * har tab o'z holatini saqlaydi (scroll, ochiq ekranlar);
///   * faol bo'lmagan tab TEGISHNI qabul qilmaydi (`IgnorePointer`);
///   * uning animatsiyalari to'xtaydi (`TickerMode`) — fon, orb,
///     video kabi takrorlanuvchi harakatlar yashirin tabda yurmaydi;
///   * u ekran o'quvchisiga ko'rinmaydi (`ExcludeSemantics`).
///
/// "Harakatni kamaytirish" yoqilgan bo'lsa almashuv bir zumda.
class FadingBranchContainer extends StatelessWidget {
  const FadingBranchContainer({
    super.key,
    required this.currentIndex,
    required this.children,
  });

  final int currentIndex;
  final List<Widget> children;

  /// 180–240ms oralig'ining o'rtasi.
  static const duration = Duration(milliseconds: 200);

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    return Stack(
      fit: StackFit.expand,
      children: [
        for (var i = 0; i < children.length; i++)
          _Branch(
            active: i == currentIndex,
            duration: still ? Duration.zero : duration,
            child: children[i],
          ),
      ],
    );
  }
}

class _Branch extends StatelessWidget {
  const _Branch({
    required this.active,
    required this.duration,
    required this.child,
  });

  final bool active;
  final Duration duration;
  final Widget child;

  @override
  Widget build(BuildContext context) => IgnorePointer(
        ignoring: !active,
        child: ExcludeSemantics(
          excluding: !active,
          child: TickerMode(
            enabled: active,
            child: AnimatedOpacity(
              opacity: active ? 1 : 0,
              duration: duration,
              curve: Curves.easeOutCubic,
              child: child,
            ),
          ),
        ),
      );
}
