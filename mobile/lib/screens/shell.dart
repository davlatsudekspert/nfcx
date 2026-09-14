import 'package:flutter/widgets.dart';
import '../design/components/nav_bar.dart';
import '../design/route_watch.dart';
import '../design/components/states.dart';
import '../design/tokens.dart';
import '../state/app_state.dart';
import 'discover/discover.dart';
import 'home/home.dart';
import 'content/reels.dart';
import 'identity/profile_tab.dart';
import 'nfc/nfc_center.dart';

/// To'rt tabli qobiq.
///
/// TABLAR HOLATINI SAQLAYDI (`IndexedStack`): Discover'da qidiruv
/// yozib, NFC ga o'tib qaytganda qidiruv joyida turishi kerak. Har
/// safar qaytadan qurish tarmoq so'rovini ham takrorlardi.
class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _tab = 0;

  /// Har tabning o'z `Navigator`i — ichki ekranlar tab almashganda
  /// yopilmaydi va pastki panel joyida qoladi.
  /// Tab soni NavBar'dan olinadi — ikki joyda ikki xil raqam
  /// qolib ketsa, beshinchi tab bosilganda ilova indeks
  /// chegarasidan chiqib yiqilardi.
  final _keys =
      List.generate(NavBar.tabs.length, (_) => GlobalKey<NavigatorState>());

  /// Tab ekranlari — tartibi `NavBar.tabs` bilan bir xil.
  static const _tabs = <Widget>[
    HomeScreen(),
    DiscoverScreen(),
    NfcCenterScreen(),
    ReelsScreen(),
    ProfileTab(),
  ];

  Future<bool> _onBack() async {
    final nav = _keys[_tab].currentState;
    if (nav != null && nav.canPop()) {
      nav.pop();
      return false;
    }
    // Ichki ekran yo'q va Home'da emasmiz — avval Home'ga qaytamiz.
    if (_tab != 0) {
      setState(() => _tab = 0);
      return false;
    }
    return true;
  }

  /// Bosh sahifaga qaytaradi — Reels'dagi qaytish tugmasi shuni
  /// chaqiradi. Android'ning "orqaga" tugmasi bilan BIR XIL yo'l:
  /// ikki xil xulq bo'lsa, odam qaysi biri nima qilishini
  /// bilmasdi.
  void _goHome() {
    final nav = _keys[_tab].currentState;
    if (nav != null && nav.canPop()) nav.popUntil((r) => r.isFirst);
    if (_tab != 0) setState(() => _tab = 0);
  }

  @override
  Widget build(BuildContext context) {
    return ShellScope(
      goHome: _goHome,
      child: PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _onBack() && context.mounted) {
          Navigator.of(context, rootNavigator: true).maybePop();
        }
      },
      child: ColoredBox(
        color: C.bg,
        // PANEL KONTENT USTIDA SUZADI.
        //
        // Dizaynda lenta va grid pastki panel ostidan o'tib ketadi
        // va uning gradientiga singiydi — shunda ekran to'liqroq
        // ko'rinadi. Shu sababli `Column` emas, `Stack`: panel
        // kontentdan joy olmaydi, ekranlar esa `NavBar.inset` qadar
        // bo'sh joy qoldiradi.
        child: Stack(
          children: [
            Column(
              children: [
                // OFFLINE CHIZIG'I — pastki panel USTIDA emas, tarkib
                // USTIDA: u ekranni bosib turmaydi, lekin nima uchun
                // ma'lumot yangilanmayotganini darhol tushuntiradi.
                const _OfflineWatch(),
                Expanded(
                  // TAB ALMASHISHI — 200ms xiralik. `IndexedStack`
                  // holatni saqlaydi (qidiruv matni, aylantirish
                  // joyi, yuklangan ma'lumot), lekin o'zi keskin
                  // almashadi. `AnimatedSwitcher` bilan o'rasak butun
                  // stek qayta quriladi va holat yo'qoladi — shuning
                  // uchun xiralik STEKNING O'ZIGA emas, uning
                  // indeksiga bog'langan yengil qatlam orqali
                  // beriladi.
                  child: _CrossFade(
                    index: _tab,
                    // KO'RINMAYOTGAN TAB — "TO'XTATILGAN".
                    //
                    // `IndexedStack` tanlanmagan tabni daraxtda
                    // QOLDIRADI (holati saqlanishi uchun) va u
                    // ishlashda davom etardi. Reels'da bu quloqqa
                    // eshitilardi: boshqa tabga o'tilsa ham video
                    // ovozi kelaverardi. `TickerMode` — Flutter'ning
                    // shu maqsaddagi standart belgisi.
                    child: IndexedStack(
                      index: _tab,
                      children: [
                        for (var i = 0; i < NavBar.tabs.length; i++)
                          TickerMode(
                            enabled: i == _tab,
                            child: _TabNavigator(
                              navKey: _keys[i],
                              child: _tabs[i],
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: NavBar(
                active: _tab,
                onSelect: (i) {
                  // Faol tabga qayta bosish — o'sha tabning ildiziga
                  // qaytaradi.
                  if (i == _tab) {
                    _keys[i].currentState?.popUntil((r) => r.isFirst);
                  } else {
                    setState(() => _tab = i);
                  }
                },
              ),
            ),
          ],
        ),
      ),
      ),
    );
  }
}

/// QOBIQQA MUROJAAT — ekranlar uchun.
///
/// Hozircha bitta amal bor: bosh sahifaga qaytish. U Reels'ga
/// kerak bo'ldi — Reels ILDIZ ekran, ya'ni `Navigator.pop` qiladigan
/// narsasi yo'q va oddiy "orqaga" tugmasi u yerda ishlamasdi.
/// Egasi shuni so'radi: "reelsda qaytish tugmasi bo'lsin".
class ShellScope extends InheritedWidget {
  const ShellScope({super.key, required this.goHome, required super.child});

  final VoidCallback goHome;

  static ShellScope? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<ShellScope>();

  @override
  bool updateShouldNotify(ShellScope old) => old.goHome != goHome;
}

/// Tarmoq signalini kuzatib, uzilganda chiziqni ochadi.
///
/// `ValueListenableBuilder` — faqat SHU chiziq qayta quriladi,
/// tab tarkibi emas.
class _OfflineWatch extends StatelessWidget {
  const _OfflineWatch();

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<bool>(
        valueListenable: AppScope.of(context).api.online,
        builder: (_, online, __) => AnimatedSize(
          duration: M.fade,
          curve: M.curve,
          alignment: Alignment.topCenter,
          child: online ? const SizedBox(width: double.infinity) : const OfflineBar(),
        ),
      );
}

class _TabNavigator extends StatefulWidget {
  const _TabNavigator({required this.navKey, required this.child});
  final GlobalKey<NavigatorState> navKey;
  final Widget child;

  @override
  State<_TabNavigator> createState() => _TabNavigatorState();
}

class _TabNavigatorState extends State<_TabNavigator> {
  /// SHU tabning kuzatuvchisi. Bitta nusxani bir nechta navigatorga
  /// ulab bo'lmaydi — izohi `route_watch.dart` da.
  final _observer = RouteObserver<ModalRoute<void>>();

  @override
  Widget build(BuildContext context) => Navigator(
        key: widget.navKey,
        // Tab ichida ekran ustiga ekran ochilsa — video to'xtasin.
        observers: [_observer],
        onGenerateRoute: (settings) => PageRouteBuilder(
          settings: settings,
          pageBuilder: (_, __, ___) =>
              RouteWatchScope(observer: _observer, child: widget.child),
          transitionDuration: Duration.zero,
        ),
      );
}

/// Tab almashganda tarkibni 200ms da xiralashtirib ko'rsatadi.
///
/// Bola HAR DOIM bitta (`IndexedStack`), shuning uchun holat
/// yo'qolmaydi: faqat shaffoflik animatsiya qilinadi.
class _CrossFade extends StatefulWidget {
  const _CrossFade({required this.index, required this.child});
  final int index;
  final Widget child;

  @override
  State<_CrossFade> createState() => _CrossFadeState();
}

class _CrossFadeState extends State<_CrossFade> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: M.fade,
    value: 1,
  );

  @override
  void didUpdateWidget(_CrossFade old) {
    super.didUpdateWidget(old);
    if (old.index != widget.index) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
        // 0.55 dan boshlanadi: to'liq shaffoflikdan chiqish "yonib
        // ketgandek" ko'rinadi va ko'zni charchatadi.
        opacity: Tween(begin: 0.55, end: 1.0).animate(
          CurvedAnimation(parent: _c, curve: Curves.easeOut),
        ),
        child: widget.child,
      );
}
