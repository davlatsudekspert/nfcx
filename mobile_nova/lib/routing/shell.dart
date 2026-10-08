import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../design/widgets/bottom_nav.dart';
import '../features/profile/music_player.dart';
import '../l10n/gen/app_localizations.dart';
import '../app/providers.dart';
import 'routes.dart';
import '../core/update/app_update.dart';

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

/// REELS TOZA REJIMI — video bosilganda hamma belgilar, pastki panel
/// va telefonning tizim panellari yashiriladi, video butun ekranda
/// qoladi (egasi, 2026-09-24: "rolik bosilsa to'liq ekran, belgilarsiz").
/// Yana bosilsa yoki "orqaga" — qaytadi.
final reelsCleanProvider = StateProvider<bool>((_) => false);

/// Ko'rgazma tabining raqami (`HomeShell.tabRoutes`) — qora, butun
/// ekranli bo'lim (pastki panel video ustidagi uslubda).
const kShowcaseTab = 3;

/// REELS ENDI PASTKI MENYUDA YO'Q (2026-10: o'rnida Ko'rgazma).
/// `ReelsScreen` kodi saqlangan, lekin hech qayerdan ochilmaydi
/// (`/reels` -> `/showcase`). U o'z videosini faqat shu raqamli tab
/// faol bo'lganda o'ynatadi — u yerda endi Ko'rgazma turadi va
/// `ReelsScreen` umuman qurilmaydi.
const kReelsTab = kShowcaseTab;

/// "Asosiy" tugmasi Home'da turib qayta bosilgan — har bosishda
/// oshadi. Bosh sahifa buni eshitadi va tepaga suriladi.
final homeReselectProvider = StateProvider<int>((_) => 0);

/// Pastki navigatsiya elementlari — shell ham, tab ustidagi sahifalar
/// ham ([NavPage]) AYNAN shu ro'yxatni ishlatadi.
List<NavItem> navItems(L l) {
  return [
    // Faol emas — chiziqli, faol — to'la (bir xil vizual og'irlik).
    NavItem(
        icon: Icons.home_outlined,
        activeIcon: Icons.home_rounded,
        label: l.navHome,
        route: Routes.home),
    NavItem(
        icon: Icons.explore_outlined,
        activeIcon: Icons.explore_rounded,
        label: l.navDiscover,
        route: Routes.discover),
    NavItem(icon: Icons.nfc_rounded, label: l.navNfc, route: Routes.nfc),
    // KO'RGAZMA (Reels o'rnida) — rasmlar to'plami belgisi.
    NavItem(
        icon: Icons.collections_outlined,
        activeIcon: Icons.collections_rounded,
        label: l.navShowcase,
        route: Routes.showcase),
    NavItem(
        icon: Icons.person_outline_rounded,
        activeIcon: Icons.person_rounded,
        label: l.navProfile,
        route: Routes.profile),
];
}

class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();

  static const tabRoutes = [
    Routes.home,
    Routes.discover,
    Routes.nfc,
    Routes.showcase,
    Routes.profile,
  ];

}

class _HomeShellState extends ConsumerState<HomeShell> {
  /// Lenta pastga aylantirilsa panel kichrayadi (Instagram kabi).
  final _minimizer = NavMinimizer();

  @override
  void initState() {
    super.initState();
    // Yangi versiya bormi — Play'dan so'raladi (app_update.dart).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) AppUpdate.checkOnce(context);
    });
  }

  @override
  void dispose() {
    _minimizer.dispose();
    super.dispose();
  }

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
        // Boshqa bo'limga o'tildi (qaysi yo'l bilan bo'lsa ham) —
        // panel to'liq holiga qaytadi.
        _minimizer.expand();
      }
    });
    final items = navItems(l);
    // Ko'rgazma — qora, butun ekranli bo'lim: panel video uslubida
    // va kichraymaydi (vertikal sahifalar).
    final onReels = shell.currentIndex == kShowcaseTab;
    final clean = onReels && ref.watch(reelsCleanProvider);

    // ANDROID "ORQAGA" (audit 2026-10-06): Asosiy bo'lmagan tab ildizida
    // orqaga bosilsa ilova YOPILMAYDI — avval Asosiy tabga qaytadi;
    // ilovadan chiqish faqat Asosiy tabdan. Tab ichidagi ekranlar
    // (branch navigatori) avvalgidek o'z tarixi bo'yicha qaytadi —
    // PopScope faqat shell sahifasining o'zi yopilmoqchi bo'lganda
    // ishlaydi.
    return PopScope(
      canPop: shell.currentIndex == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop || shell.currentIndex == 0) return;
        ref.read(audioOwnerProvider).stopAll();
        shell.goBranch(0);
      },
      child: Scaffold(
      backgroundColor: Colors.transparent,
      extendBody: true,
      // Reels'da videolar vertikal aylanadi — u yerda panel doim to'liq.
      body: NotificationListener<ScrollNotification>(
        onNotification: (n) => onReels ? false : _minimizer.handle(n),
        child: shell,
      ),
      bottomNavigationBar: clean
          ? null
          : NavScrim(
        enabled: !onReels,
        child: SafeArea(
          top: false,
          // Faqat panel qayta chiziladi — tab kontenti emas.
          child: ValueListenableBuilder<bool>(
            valueListenable: _minimizer,
            builder: (context, compact, _) => NovaBottomNav(
              items: items,
              currentIndex: shell.currentIndex,
              onVideo: onReels,
              compact: compact,
              onSelect: (i) {
                _minimizer.expand();
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
        ),
      ),
      ),
    );
  }
}


/// Tab kontenti — har bir tab tirik, almashuv DARHOL.
///
/// ## NIMA UCHUN ANIMATSIYASIZ
///
/// Ilgari tablar 200ms shaffoflik bilan almashardi. Buning uchun
/// ikkala ekran (chiqayotgan va kirayotgan) har kadrda alohida
/// qatlamga (`saveLayer`) chizilardi — telefonda aynan shu payt
/// "qotib o'tyapti" hissini berardi (egasi, 2026-09: "profildan
/// asosiyga o'tganda qotib qolyapti"). Apple va Samsung ilovalarida
/// ham pastki menyu tablari darhol almashadi; animatsiya faqat
/// ekran ICHIGA kirganda bo'ladi.
///
/// `IndexedStack` bilan bir xil qoidalar:
///
///   * har tab o'z holatini saqlaydi (scroll, ochiq ekranlar);
///   * yashirin tab chizilmaydi va tegishni qabul qilmaydi (`Offstage`);
///   * uning animatsiyalari to'xtaydi (`TickerMode`) — fon, orb,
///     video kabi takrorlanuvchi harakatlar yashirin tabda yurmaydi;
///   * u ekran o'quvchisiga ko'rinmaydi.
class FadingBranchContainer extends ConsumerStatefulWidget {
  const FadingBranchContainer({
    super.key,
    required this.currentIndex,
    required this.children,
  });

  final int currentIndex;
  final List<Widget> children;

  /// Asosiy ma'lumoti kelmasa ham yashirin tablar shuncha vaqtdan keyin
  /// quriladi.
  static const warmupTimeout = Duration(seconds: 3);

  @override
  ConsumerState<FadingBranchContainer> createState() =>
      _FadingBranchContainerState();
}

/// YASHIRIN TABLAR — ASOSIY EKRANDAN KEYIN (o'lchov, build 304).
///
/// `preload` Tanlov, Reels va Profilni shell ochilgan KADRNING o'zida
/// qurardi: Asosiy bilan birga to'rtta ekran bitta kadrda yig'ilar
/// (emulyatorda 380–540 ms) va 12–15 ta API so'rovi bir vaqtda
/// ketardi. Server parallel yukda sekinlashib (lenta 1.1 s -> 2.2–4.9 s)
/// ba'zan 500 qaytarardi — ko'rinib turgan Asosiy lentasi yashirin
/// tablar bilan navbat talashardi.
///
/// Endi: faol tab darhol quriladi; qolgan oldindan tayyorlanadigan
/// tablar Asosiyning so'rovlari tugagach (tarmoq bo'shagach) yoki
/// [FadingBranchContainer.warmupTimeout] dan keyin quriladi. Tab undan
/// oldin bosilsa — o'sha zahoti quriladi (oldingi xulq).
class _FadingBranchContainerState extends ConsumerState<FadingBranchContainer> {
  final _built = <int>{};
  bool _warm = false;
  Timer? _timer;
  ValueNotifier<int>? _net;

  @override
  void initState() {
    super.initState();
    _timer = Timer(FadingBranchContainer.warmupTimeout, _warmUp);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _warm) return;
      _net = ref.read(apiProvider).inFlight..addListener(_onNet);
      _onNet();
    });
  }

  /// Tarmoq bo'shadi: Asosiyning so'rovlari tugadi (yoki birinchi
  /// kadrdan keyin umuman so'rov yo'q).
  void _onNet() {
    if ((_net?.value ?? 0) == 0) _warmUp();
  }

  void _warmUp() {
    if (_warm || !mounted) return;
    _timer?.cancel();
    _net?.removeListener(_onNet);
    _net = null;
    setState(() => _warm = true);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _net?.removeListener(_onNet);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _built.add(widget.currentIndex);
    final children = widget.children;
    return Stack(
      fit: StackFit.expand,
      children: [
        for (var i = 0; i < children.length; i++)
          _Branch(
            active: i == widget.currentIndex,
            child: _warm || _built.contains(i)
                ? children[i]
                : const SizedBox.shrink(),
          ),
      ],
    );
  }
}

class _Branch extends StatelessWidget {
  const _Branch({required this.active, required this.child});

  final bool active;
  final Widget child;

  @override
  Widget build(BuildContext context) => Offstage(
        offstage: !active,
        child: TickerMode(
          enabled: active,
          // Har tab o'z qatlamida: bir tabdagi o'zgarish qolganlarini
          // qayta chizdirmaydi.
          child: RepaintBoundary(child: child),
        ),
      );
}


/// TAB USTIDA OCHILADIGAN SAHIFA — PASTKI NAVIGATSIYA BILAN.
///
/// Boshqa odamning profili (`/u/:code`) va biznes vitrinasi (`/c/:id`)
/// shell'dan tashqarida ochiladi — ilgari u yerda pastki panel YO'Q
/// edi (egasi, 2026-09-24: "profilga kirib ko'rilganda pastdagi
/// ikonlar yo'q bo'lib qolyapti"). Endi shu sahifalarda ham o'sha
/// panel turadi: kelingan tab faol ko'rinadi, istalgan tab bosilsa
/// o'sha bo'limga qaytiladi.
class NavPage extends ConsumerStatefulWidget {
  const NavPage({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<NavPage> createState() => _NavPageState();
}

class _NavPageState extends ConsumerState<NavPage> {
  // Bu sahifalarda ham panel asosiy tablardagidek kichrayadi.
  final _minimizer = NavMinimizer();

  @override
  void dispose() {
    _minimizer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final current = ref.watch(activeTabProvider);
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBody: true,
      body: NotificationListener<ScrollNotification>(
        onNotification: _minimizer.handle,
        child: widget.child,
      ),
      bottomNavigationBar: NavScrim(
        child: SafeArea(
          top: false,
          child: ValueListenableBuilder<bool>(
            valueListenable: _minimizer,
            builder: (context, compact, _) => NovaBottomNav(
              items: navItems(l),
              currentIndex: current,
              compact: compact,
              onSelect: (i) {
                ref.read(audioOwnerProvider).stopAll();
                context.go(HomeShell.tabRoutes[i]);
              },
            ),
          ),
        ),
      ),
    );
  }
}
