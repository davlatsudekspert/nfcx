import 'package:flutter/material.dart';

import '../core/theme.dart';
import 'discover_screen.dart';
import 'home_screen.dart';
import 'nfc_center_screen.dart';
import 'profile_screen.dart';
import 'reels_screen.dart';

class V2Shell extends StatefulWidget {
  const V2Shell({super.key});

  @override
  State<V2Shell> createState() => _V2ShellState();
}

class _V2ShellState extends State<V2Shell> {
  int _index = 0;

  void _select(int value) {
    if (value == _index) return;
    setState(() => _index = value);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final tabs = const [
      HomeScreen(),
      DiscoverScreen(),
      NfcCenterScreen(),
      ReelsScreen(),
      ProfileScreen(),
    ];

    return ShellScope(
      selectTab: _select,
      currentTab: _index,
      child: Scaffold(
        body: Stack(
          children: [
            IndexedStack(index: _index, children: tabs),
            Positioned(
              left: 14,
              right: 14,
              bottom: 10,
              child: SafeArea(
                top: false,
                child: Container(
                  height: 68,
                  decoration: BoxDecoration(
                    color: p.surface.withValues(alpha: .97),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: p.line),
                    boxShadow: [
                      BoxShadow(
                        color: p.shadow,
                        blurRadius: 28,
                        offset: const Offset(0, 12),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Expanded(child: _NavItem(index: 0, active: _index, icon: Icons.home_rounded, label: 'Asosiy', onTap: _select)),
                      Expanded(child: _NavItem(index: 1, active: _index, icon: Icons.search_rounded, label: 'Tanlov', onTap: _select)),
                      Expanded(
                        child: Center(
                          child: GestureDetector(
                            onTap: () => _select(2),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              width: 54,
                              height: 54,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: p.hero,
                                border: Border.all(color: p.accent.withValues(alpha: .65)),
                                boxShadow: [
                                  BoxShadow(
                                    color: p.shadow,
                                    blurRadius: 18,
                                    offset: const Offset(0, 7),
                                  ),
                                ],
                              ),
                              child: Icon(
                                Icons.contactless_rounded,
                                color: p.heroInk,
                                size: 28,
                              ),
                            ),
                          ),
                        ),
                      ),
                      Expanded(child: _NavItem(index: 3, active: _index, icon: Icons.play_circle_outline_rounded, label: 'Reels', onTap: _select)),
                      Expanded(child: _NavItem(index: 4, active: _index, icon: Icons.person_outline_rounded, label: 'Profil', onTap: _select)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.index,
    required this.active,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final int index;
  final int active;
  final IconData icon;
  final String label;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final selected = index == active;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => onTap(index),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 21, color: selected ? p.ink : p.ink2),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              color: selected ? p.ink : p.ink2,
              fontSize: 9.2,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
          const SizedBox(height: 3),
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: selected ? 18 : 0,
            height: 2,
            decoration: BoxDecoration(
              color: p.accent,
              borderRadius: BorderRadius.circular(9),
            ),
          ),
        ],
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
