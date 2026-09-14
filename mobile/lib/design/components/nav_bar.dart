import 'package:flutter/widgets.dart';

import '../../l10n/strings.dart';
import '../tokens.dart';
import '../type.dart';
import 'icons.dart';
import 'logo.dart';
import 'press.dart';

/// TAB BAR — 5 tab, NFC markazda va ko'tarilgan.
///
/// Beshta tabning ma'nosi o'zgarmaydi: Bosh sahifa · Qidiruv · NFC ·
/// Reels · Profil. NFC markazda va BOSHQACHA ko'rinadi — u
/// mahsulotning o'zagi, qolgan to'rttasi esa uning atrofi.
///
/// MARKAZIY TUGMA — brend medalyoni 62 dp, panel ustiga 24 dp
/// ko'tarilgan. Ikonka emas, LOGOTIP: bu ilovaning imzosi va
/// foydalanuvchi uni uzoqdan taniydi.
///
/// TILGA E'TIBOR: `tabs` — GETTER, `static final` EMAS. `static
/// final` bir marta hisoblanadi va til almashganda eski tilda
/// muzlab qoladi (bu xato ilgari relizga chiqqan).
class NavBar extends StatelessWidget {
  const NavBar({
    super.key,
    required this.active,
    required this.onSelect,
    this.unread = 0,
  });

  final int active;
  final ValueChanged<int> onSelect;

  /// Profil tabidagi o'qilmagan belgisi (sovg'a taklifi, buyurtma).
  final int unread;

  /// Markazdagi NFC tabining indeksi.
  static const int nfcIndex = 2;

  static List<({Ico icon, String label})> get tabs => [
        (icon: Ico.home, label: tr('Bosh sahifa')),
        (icon: Ico.search, label: tr('Qidiruv')),
        (icon: Ico.nfc, label: 'NFC'),
        (icon: Ico.play, label: 'Reels'),
        (icon: Ico.user, label: tr('Profil')),
      ];

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    final items = tabs;

    return SizedBox(
      // Ko'tarilgan tugma panel chegarasidan chiqadi, shuning uchun
      // `Stack` kesilmasligi kerak.
      height: 68 + bottom + 24,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.bottomCenter,
        children: [
          // Panel.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              height: 68 + bottom,
              decoration: BoxDecoration(
                gradient: C.navBar,
                border: Border(top: BorderSide(color: C.line)),
              ),
              padding: EdgeInsets.only(bottom: bottom),
              child: Row(
                children: [
                  for (var i = 0; i < items.length; i++)
                    Expanded(
                      child: i == nfcIndex
                          // Markaziy joy bo'sh qoladi — medalyon
                          // uning ustida turadi.
                          ? const SizedBox.shrink()
                          : _Tab(
                              icon: items[i].icon,
                              label: items[i].label,
                              active: active == i,
                              badge: i == items.length - 1 ? unread : 0,
                              onTap: () => onSelect(i),
                            ),
                    ),
                ],
              ),
            ),
          ),

          // Markaziy NFC tugmasi.
          Positioned(
            bottom: bottom + 18,
            child: _NfcTab(
              active: active == nfcIndex,
              onTap: () => onSelect(nfcIndex),
            ),
          ),
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
    this.badge = 0,
  });

  final Ico icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final color = active ? C.accent : C.ink3;
    return Press(
      onTap: onTap,
      minSize: 0,
      scale: .92,
      child: SizedBox(
        height: 68,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                // Faol holat rang BILAN BIRGA to'ldirish orqali ham
                // ko'rsatiladi — faqat rangga tayanmaslik qoidasi.
                NIcon(icon, size: 23, color: color, filled: active),
                if (badge > 0)
                  Positioned(
                    right: -5,
                    top: -3,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: C.fail,
                        shape: BoxShape.circle,
                        border: Border.all(color: C.bg, width: 1.5),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: T.navLabel.copyWith(
                color: color,
                fontWeight: active ? FontWeight.w700 : FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Markaziy tugma — brend medalyoni.
class _NfcTab extends StatelessWidget {
  const _NfcTab({required this.active, required this.onTap});

  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        haptic: true,
        minSize: 0,
        scale: .93,
        child: AnimatedContainer(
          duration: M.fade,
          curve: M.curve,
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            // Faol holatda halqa qalinlashadi va nur kuchayadi.
            color: C.bg,
            border: Border.all(
              color: C.accent.withValues(alpha: active ? .95 : .5),
              width: active ? 2 : 1.4,
            ),
            boxShadow: [
              BoxShadow(
                color: C.accent.withValues(alpha: active ? .55 : .3),
                blurRadius: active ? 26 : 18,
                spreadRadius: active ? -4 : -6,
              ),
            ],
          ),
          child: const BrandMark(size: 56, ring: false),
        ),
      );
}
