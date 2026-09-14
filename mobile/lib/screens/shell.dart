import 'package:flutter/widgets.dart';
import '../design/components/nav_bar.dart';
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

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _onBack() && context.mounted) {
          Navigator.of(context, rootNavigator: true).maybePop();
        }
      },
      child: ColoredBox(
        color: C.obsidian,
        child: Column(
          children: [
            // OFFLINE CHIZIG'I — pastki panel USTIDA emas, tarkib
            // USTIDA: u ekranni bosib turmaydi, lekin nima uchun
            // ma'lumot yangilanmayotganini darhol tushuntiradi.
            const _OfflineWatch(),
            Expanded(
              // TAB ALMASHISHI — 200ms xiralik (handoff harakat
              // jadvali). `IndexedStack` holatni saqlaydi (qidiruv
              // matni, aylantirish joyi, yuklangan ma'lumot), lekin
              // o'zi keskin almashadi. `AnimatedSwitcher` bilan
              // o'rasak butun stek qayta quriladi va holat yo'qoladi —
              // shuning uchun xiralik STEKNING O'ZIGA emas, uning
              // indeksiga bog'langan yengil qatlam orqali beriladi.
              child: _CrossFade(
                index: _tab,
                child: IndexedStack(
                index: _tab,
                children: [
                  _TabNavigator(navKey: _keys[0], child: const HomeScreen()),
                  _TabNavigator(navKey: _keys[1], child: const DiscoverScreen()),
                  _TabNavigator(navKey: _keys[2], child: const NfcCenterScreen()),
                  _TabNavigator(navKey: _keys[3], child: const ReelsScreen()),
                  _TabNavigator(navKey: _keys[4], child: const ProfileTab()),
                ],
                ),
              ),
            ),
            NavBar(
              active: _tab,
              onSelect: (i) {
                // Faol tabga qayta bosish — o'sha tabning ildiziga qaytaradi.
                if (i == _tab) {
                  _keys[i].currentState?.popUntil((r) => r.isFirst);
                } else {
                  setState(() => _tab = i);
                }
              },
            ),
          ],
        ),
      ),
    );
  }
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

class _TabNavigator extends StatelessWidget {
  const _TabNavigator({required this.navKey, required this.child});
  final GlobalKey<NavigatorState> navKey;
  final Widget child;

  @override
  Widget build(BuildContext context) => Navigator(
        key: navKey,
        onGenerateRoute: (settings) => PageRouteBuilder(
          settings: settings,
          pageBuilder: (_, __, ___) => child,
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
