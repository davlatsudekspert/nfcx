import 'package:flutter/widgets.dart';
import '../design/components/nav_bar.dart';
import '../design/tokens.dart';
import 'discover/discover.dart';
import 'home/home.dart';
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
  final _keys = List.generate(4, (_) => GlobalKey<NavigatorState>());

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
            Expanded(
              child: IndexedStack(
                index: _tab,
                children: [
                  _TabNavigator(navKey: _keys[0], child: const HomeScreen()),
                  _TabNavigator(navKey: _keys[1], child: const DiscoverScreen()),
                  _TabNavigator(navKey: _keys[2], child: const NfcCenterScreen()),
                  _TabNavigator(navKey: _keys[3], child: const ProfileTab()),
                ],
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
