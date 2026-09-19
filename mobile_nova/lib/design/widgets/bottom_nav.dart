import 'dart:ui';

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';
import 'brand_logo.dart';
import 'surfaces.dart';

class NavItem {
  const NavItem({required this.icon, required this.label, required this.route});
  final IconData icon;
  final String label;
  final String route;
}

/// Nav pillining balandligi.
const double kNavHeight = 64;

/// Markaziy NFC tugmasining diametri.
const double kNavCenterSize = 54;

/// Markaziy tugma pill QIRRASIDAN qancha yuqoriga chiqishi.
///
/// Ataylab pill markaziga emas, QIRRASIGA nisbatan o'lchanadi: ko'z
/// aynan shu masofani ko'radi. Markazga nisbatan o'lchansa, tugma
/// diametri o'zgarganda ko'rinadigan ko'tarilish ham beixtiyor
/// o'zgarib ketardi.
const double kNavCenterLift = 12;

/// Suzuvchi pastki navigatsiya — markazda ko'tarilgan NFC tugmasi.
///
/// Concept B'da nav ekran tubiga yopishmaydi, u ustida SUZADI va
/// orqasidan kontent xiralashib ko'rinadi. `extendBody: true` bilan
/// birga ishlaydi.
///
/// ## Nima uchun ikki qatlam
///
/// Avval hammasi bitta `ClipRRect` ichida edi: blur, pill va beshala
/// tugma. Markaziy tugma esa `Matrix4.translationValues(0, -14, 0)`
/// bilan yuqoriga chiqarilardi — ya'ni u o'zini o'rab turgan
/// CLIPDAN TASHQARIGA chiqmoqchi bo'lardi. `ClipRRect` esa aynan
/// shuni qilishga yo'l qo'ymaydi: tugmaning yuqori qismi va uning
/// nuri qirqilib, tugma dumaloq emas, kesilgandek ko'rinardi.
///
/// Endi ikki qatlam bor:
///
/// 1. **Pill** — `ClipRRect` + `BackdropFilter`. Blur va yumaloq
///    burchak faqat shu yerda. Markaziy joy BO'SH qoldiriladi,
///    lekin kengligi saqlanadi, shuning uchun qolgan to'rtta yorliq
///    o'z joyida turadi.
/// 2. **Markaziy tugma** — clipdan TASHQARIDA, `Stack` ning ustki
///    qatlamida. Endi uni hech narsa kesmaydi.
///
/// `Stack` o'lchamini pill belgilaydi (`kNavHeight`), shuning uchun
/// tugma yuqoriga chiqsa ham LAYOUT o'zgarmaydi — `navSafeBottom`
/// hisobi va safe-area o'z holicha qoladi.
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
      child: Stack(
        // Tugma pill qirrasidan yuqoriga chiqadi — bu ataylab.
        clipBehavior: Clip.none,
        children: [
          // 1-QATLAM: pill. Blur va clip FAQAT shu yerda.
          ClipRRect(
            borderRadius: R.pill,
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
              child: AnimatedContainer(
                duration: Motion.theme,
                curve: Motion.smooth,
                height: kNavHeight,
                decoration: BoxDecoration(
                  color: t.surface,
                  borderRadius: R.pill,
                  border: Border.all(color: t.border2),
                  boxShadow: t.shadowFloat,
                ),
                child: Row(
                  children: [
                    for (var i = 0; i < items.length; i++)
                      Expanded(
                        child: i == centerIndex
                            // Joy band qilinadi, lekin bo'sh: tugma
                            // ustki qatlamda chiziladi.
                            ? const SizedBox.expand()
                            : _NavButton(
                                item: items[i],
                                selected: i == currentIndex,
                                onTap: () => onSelect(i),
                              ),
                      ),
                  ],
                ),
              ),
            ),
          ),

          // 2-QATLAM: markaziy tugma — clipdan tashqarida.
          //
          // Qator pilldagi bilan BIR XIL tuzilgan (teng `Expanded`
          // kataklar), shuning uchun tugma har qanday element sonida
          // ham aynan o'z katagining markazida turadi.
          Positioned(
            left: 0,
            right: 0,
            top: -kNavCenterLift,
            child: Row(
              children: [
                for (var i = 0; i < items.length; i++)
                  Expanded(
                    child: i == centerIndex
                        ? Center(
                            child: _CenterNavButton(
                              item: items[i],
                              selected: i == currentIndex,
                              onTap: () => onSelect(i),
                            ),
                          )
                        : const SizedBox(height: kNavCenterSize),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Markaziy NFC tugmasi — mukammal doira, hech qayerdan kesilmaydi.
class _CenterNavButton extends StatelessWidget {
  const _CenterNavButton({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final NavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;

    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: PressableScale(
        onTap: onTap,
        scale: .9,
        child: AnimatedContainer(
          duration: Motion.theme,
          curve: Motion.smooth,
          width: kNavCenterSize,
          height: kNavCenterSize,
          decoration: BoxDecoration(
            gradient: t.accentGradient,
            shape: BoxShape.circle,
            boxShadow: [
              // Ikki qatlamli soya: biri tugmani sirtdan ko'taradi,
              // ikkinchisi atrofga mayin nur tarqatadi. Ikkalasi ham
              // yumshoq — qattiq qora soya yo'q.
              BoxShadow(
                color: t.glow,
                blurRadius: 28,
                spreadRadius: -2,
                offset: const Offset(0, 8),
              ),
              BoxShadow(
                color: t.glow.withValues(alpha: .35),
                blurRadius: 12,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          // Generic NFC ikonkasi EMAS, brend belgisi.
          //
          // Tugmaning oltin doirasi o'z holicha qoladi: ichiga na
          // plastina, na ikkinchi doira qo'yiladi — aks holda
          // "doira ichida doira" hosil bo'lardi. Belgi to'g'ridan
          // -to'g'ri oltin sirt ustida, `onAccent` siyohida turadi.
          //
          // Kenglik doiraning 60% i. Belgi 1.955:1 bo'lgani uchun
          // balandligi 30% bo'ladi va eng uzoq burchagi markazdan
          // 0.35 * diametr uzoqlikda — doira radiusi 0.5, ya'ni
          // atrofida ~30% zaxira qoladi.
          child: Center(
            child: BrandLogo(
              size: kNavCenterSize * .60,
              style: BrandLogoStyle.markOnly,
              tint: t.onAccent,
              semanticLabel: item.label,
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
    required this.onTap,
  });

  final NavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;

    final color = selected ? t.accent2 : t.text3;
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: PressableScale(
        onTap: onTap,
        child: SizedBox(
          height: kNavHeight,
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
