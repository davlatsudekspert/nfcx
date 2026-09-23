import 'package:flutter/material.dart';

import '../core/theme.dart';
import 'account_profile_screen.dart';
import 'discover_screen.dart';
import 'home_screen.dart';
import 'nfc_center_screen.dart';
import 'reels_screen.dart';

class V2Shell extends StatefulWidget {
  const V2Shell({super.key});

  @override
  State<V2Shell> createState() => _V2ShellState();
}

class _V2ShellState extends State<V2Shell> {
  int _index = 0;

  void _select(int value) {
    if (value < 0 || value > 4) return;
    if (value == _index) return;
    setState(() => _index = value);
  }

  @override
  Widget build(BuildContext context) {
    final tabs = const [
      HomeScreen(),
      DiscoverScreen(),
      NfcCenterScreen(),
      ReelsScreen(),
      AccountProfileScreen(),
    ];

    return ShellScope(
      selectTab: _select,
      currentTab: _index,
      child: PopScope(
        canPop: _index == 0,
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop && _index != 0) _select(0);
        },
        child: Scaffold(
          extendBody: _index == 3,
          body: IndexedStack(index: _index, children: tabs),
          bottomNavigationBar: _PremiumBottomNav(
            currentIndex: _index,
            onTap: _select,
            darkSurface: _index == 3,
          ),
        ),
      ),
    );
  }
}

class _PremiumBottomNav extends StatelessWidget {
  const _PremiumBottomNav({
    required this.currentIndex,
    required this.onTap,
    required this.darkSurface,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;
  final bool darkSurface;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final bg = darkSurface
        ? const Color(0xEA090909)
        : p.surface.withValues(alpha: .985);
    final active = darkSurface ? Colors.white : p.ink;
    final inactive = darkSurface
        ? Colors.white.withValues(alpha: .48)
        : p.ink2;

    return SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Container(
        height: 70,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(25),
          border: Border.all(
            color: darkSurface
                ? Colors.white.withValues(alpha: .12)
                : p.line.withValues(alpha: .9),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: darkSurface ? .32 : .12),
              blurRadius: 28,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Row(
          children: [
            _NavButton(
              index: 0,
              current: currentIndex,
              icon: Icons.home_rounded,
              label: 'Asosiy',
              activeColor: active,
              inactiveColor: inactive,
              onTap: onTap,
            ),
            _NavButton(
              index: 1,
              current: currentIndex,
              icon: Icons.explore_outlined,
              label: 'Kashf',
              activeColor: active,
              inactiveColor: inactive,
              onTap: onTap,
            ),
            Expanded(
              child: Center(
                child: GestureDetector(
                  key: const ValueKey('nav-2'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onTap(2),
                  child: AnimatedScale(
                    duration: const Duration(milliseconds: 180),
                    scale: currentIndex == 2 ? 1.06 : 1,
                    child: Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.black,
                        border: Border.all(
                          color: p.accent.withValues(alpha: .7),
                          width: 1.2,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: .28),
                            blurRadius: 16,
                            offset: const Offset(0, 7),
                          ),
                        ],
                      ),
                      child: ClipOval(
                        child: Image.asset(
                          'assets/images/nfcstore_logo_mark.png',
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            _NavButton(
              index: 3,
              current: currentIndex,
              icon: Icons.play_circle_outline_rounded,
              label: 'Reels',
              activeColor: active,
              inactiveColor: inactive,
              onTap: onTap,
            ),
            _NavButton(
              index: 4,
              current: currentIndex,
              icon: Icons.person_outline_rounded,
              label: 'Profil',
              activeColor: active,
              inactiveColor: inactive,
              onTap: onTap,
            ),
          ],
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.index,
    required this.current,
    required this.icon,
    required this.label,
    required this.activeColor,
    required this.inactiveColor,
    required this.onTap,
  });

  final int index;
  final int current;
  final IconData icon;
  final String label;
  final Color activeColor;
  final Color inactiveColor;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final selected = index == current;
    return Expanded(
      child: InkWell(
        key: ValueKey('nav-' + index.toString()),
        borderRadius: BorderRadius.circular(22),
        onTap: () => onTap(index),
        child: SizedBox.expand(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedScale(
                duration: const Duration(milliseconds: 160),
                scale: selected ? 1.08 : 1,
                child: Icon(
                  icon,
                  size: 21,
                  color: selected ? activeColor : inactiveColor,
                ),
              ),
              const SizedBox(height: 4),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 160),
                style: TextStyle(
                  color: selected ? activeColor : inactiveColor,
                  fontSize: 9.3,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  letterSpacing: -.1,
                ),
                child: Text(label),
              ),
              const SizedBox(height: 3),
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                width: selected ? 16 : 0,
                height: 2,
                decoration: BoxDecoration(
                  color: selected ? activeColor : Colors.transparent,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ShellScope extends InheritedWidget {
  const ShellScope({
    super.key,
    required this.selectTab,
    required this.currentTab,
    required super.child,
  });

  final ValueChanged<int> selectTab;
  final int currentTab;

  static ShellScope of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<ShellScope>()!;

  @override
  bool updateShouldNotify(ShellScope oldWidget) =>
      oldWidget.currentTab != currentTab || oldWidget.selectTab != selectTab;
}