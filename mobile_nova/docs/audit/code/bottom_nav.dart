import 'dart:ui';

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';
import 'surfaces.dart';

class NavItem {
  const NavItem({required this.icon, required this.label, required this.route});
  final IconData icon;
  final String label;
  final String route;
}

/// Suzuvchi pastki navigatsiya — markazda ko'tarilgan NFC tugmasi.
///
/// Concept B'da nav ekran tubiga yopishmaydi, u ustida SUZADI va
/// orqasidan kontent xiralashib ko'rinadi. `extendBody: true` bilan
/// birga ishlaydi.
class NovaBottomNav extends StatelessWidget {
  const NovaBottomNav({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onSelect,
    this.centerIndex = 2,
  });

  final List<NavItem> items;
  final int currentIndex;
  final ValueChanged<int> onSelect;

  /// Qaysi element ko'tarilgan dumaloq tugma bo'lishi.
  final int centerIndex;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.lg, 0, Gap.lg, Gap.md),
      child: ClipRRect(
        borderRadius: R.pill,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
          child: AnimatedContainer(
            duration: Motion.theme,
            curve: Motion.smooth,
            height: 64,
            decoration: BoxDecoration(
              color: t.surface,
              borderRadius: R.pill,
              border: Border.all(color: t.border2),
              boxShadow: t.shadowFloat,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                for (var i = 0; i < items.length; i++)
                  Expanded(
                    child: _NavButton(
                      item: items[i],
                      selected: i == currentIndex,
                      center: i == centerIndex,
                      onTap: () => onSelect(i),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.item,
    required this.selected,
    required this.center,
    required this.onTap,
  });

  final NavItem item;
  final bool selected;
  final bool center;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;

    if (center) {
      return Semantics(
        button: true,
        selected: selected,
        label: item.label,
        child: PressableScale(
          onTap: onTap,
          scale: .9,
          child: Center(
            child: AnimatedContainer(
              duration: Motion.theme,
              // Navdan yuqoriga chiqadi — eng muhim amal ekani shundan bilinadi.
              transform: Matrix4.translationValues(0, -14, 0),
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                gradient: t.accentGradient,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: t.glow, blurRadius: 24, offset: const Offset(0, 10)),
                ],
              ),
              child: Icon(item.icon, size: 23, color: t.onAccent),
            ),
          ),
        ),
      );
    }

    final color = selected ? t.accent2 : t.text3;
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: PressableScale(
        onTap: onTap,
        child: SizedBox(
          height: 64,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedScale(
                scale: selected ? 1.1 : 1,
                duration: Motion.fast,
                curve: Motion.spring,
                child: Icon(item.icon, size: 21, color: color),
              ),
              const SizedBox(height: 3),
              AnimatedDefaultTextStyle(
                duration: Motion.fast,
                style: TextStyle(
                  fontFamily: 'Manrope',
                  fontSize: 9.5,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  color: color,
                ),
                child: Text(
                  item.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
