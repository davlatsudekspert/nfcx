import 'package:flutter/widgets.dart';
import '../tokens.dart';
import '../type.dart';
import 'icons.dart';
import 'press.dart';
import '../../l10n/strings.dart';

/// Pastki navigatsiya.
///
/// TO'RT TAB, BESH EMAS. Handoff besh tabni ko'rsatadi, lekin aniq
/// shart qo'yadi: "Activity tab faqat REAL backend ma'lumotlari mavjud
/// bo'lsa ishlatiladi". Repository auditida birlashgan activity oqimi
/// (obuna + like + ko'rish + buyurtma + to'lov, vaqt bo'yicha tartibda)
/// uchun endpoint TOPILMADI — bo'laklar bor, feed yo'q. Soxta ekran
/// yasash o'rniga handoff ko'rsatgan yo'l tanlandi: "Drop Activity and
/// this becomes a clean 4-tab bar; nothing else moves."
///
/// Backend'ga `GET /api/activity` qo'shilganda: `tabs` ro'yxatiga
/// Activity qatorini qaytarish va `unread` ni ulash kifoya — qolgan
/// hech narsa o'zgarmaydi.
class NavBar extends StatelessWidget {
  const NavBar({super.key, required this.active, required this.onSelect, this.unread = 0});

  final int active;
  final ValueChanged<int> onSelect;
  final int unread;

  /// FUNKSIYA, `static final` EMAS.
  ///
  /// `static final` bir MARTA hisoblanadi va natija abadiy
  /// saqlanib qoladi. Tarjima esa joriy tilga qarab o'zgaradi:
  /// til almashtirilganda pastki panel o'zbekcha qolib, qolgan
  /// hamma narsa ruschaga o'tardi — ya'ni ilovaning eng ko'p
  /// ko'rinadigan joyi yarim tarjima bo'lib turardi.
  static List<({Ico icon, String label})> get tabs => [
        (icon: Ico.home, label: tr('Home')),
        (icon: Ico.search, label: tr('Discover')),
        // "NFC" uch tilda ham shunday.
        (icon: Ico.nfc, label: 'NFC'),
        (icon: Ico.user, label: tr('Profile')),
      ];

  /// NFC tabining indeksi — u markaziy va boshqacha ko'rinadi.
  static const nfcIndex = 2;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter, end: Alignment.bottomCenter,
          colors: [Color(0xEB141318), Color(0xFA0A0805)],
        ),
        border: Border(top: BorderSide(color: C.hairline)),
      ),
      padding: EdgeInsets.only(bottom: bottom),
      child: SizedBox(
        height: 58,
        child: LayoutBuilder(
          builder: (context, box) {
            final w = box.maxWidth / tabs.length;
            return Stack(
              children: [
                // Faol tabni ko'rsatuvchi 24×2 tayoqcha. `AnimatedPositioned`
                // — butun panelni qayta chizmasdan faqat shu element siljiydi.
                AnimatedPositioned(
                  duration: M.push,
                  curve: M.curve,
                  left: active * w + (w - 24) / 2,
                  top: 0,
                  child: Container(
                    width: 24, height: 2,
                    decoration: BoxDecoration(
                      color: active == nfcIndex ? C.platinum : C.champagne,
                      borderRadius: BorderRadius.circular(1),
                    ),
                  ),
                ),
                Row(
                  children: [
                    for (var i = 0; i < tabs.length; i++)
                      Expanded(
                        child: _Tab(
                          data: tabs[i],
                          active: i == active,
                          isNfc: i == nfcIndex,
                          unread: 0,
                          onTap: () => onSelect(i),
                        ),
                      ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({
    required this.data,
    required this.active,
    required this.isNfc,
    required this.unread,
    required this.onTap,
  });

  final ({Ico icon, String label}) data;
  final bool active;
  final bool isNfc;
  final int unread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // NFC — mahsulotning o'zagi: platina urg'u, biroz kattaroq glif va
    // orqasida yumshoq plastinka. Suzuvchi tugma (FAB) EMAS.
    final accent = isNfc ? C.platinum : C.champagne;
    final color = active ? accent : C.muted;
    final size = isNfc ? 26.0 : 23.0;

    return Press(
      onTap: onTap,
      scale: .93,
      child: SizedBox(
        height: 58,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: isNfc ? const EdgeInsets.symmetric(horizontal: 12, vertical: 3) : null,
              decoration: isNfc && active
                  ? BoxDecoration(
                      color: C.platinum.withValues(alpha: .08),
                      borderRadius: BorderRadius.circular(R.tile),
                    )
                  : null,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  NIcon(data.icon, size: size, color: color, filled: active && !isNfc),
                  if (unread > 0)
                    Positioned(
                      right: -3, top: -2,
                      child: Container(
                        width: 7, height: 7,
                        decoration: BoxDecoration(
                          color: C.signal,
                          shape: BoxShape.circle,
                          border: Border.all(color: C.obsidian, width: 1.5),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              data.label,
              style: T.navLabel.copyWith(
                color: color,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
