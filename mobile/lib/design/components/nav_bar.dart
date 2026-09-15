import 'package:flutter/widgets.dart';

import '../../l10n/strings.dart';
import '../tokens.dart';
import '../type.dart';
import 'icons.dart';
import 'logo.dart';
import 'press.dart';

/// TAB BAR — 5 tab, NFC markazda va ko'tarilgan.
///
/// Beshta tab: Bosh sahifa · Qidiruv · NFC · Do'kon · Profil. NFC
/// markazda va BOSHQACHA ko'rinadi — u mahsulotning o'zagi, qolgan
/// to'rttasi esa uning atrofi.
///
/// TO'RTINCHI TABDA "REELS" TURARDI. Egasi uni olib tashlashni
/// so'radi: ilova ijtimoiy lenta emas. O'rniga DO'KON — ID kod,
/// NFC karta, Premium va to'lovlar. Ya'ni tab endi mahsulotning
/// o'zi haqida, boshqalarning postlari haqida emas.
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

  /// Panelning o'z balandligi (tizim navigatsiyasisiz).
  static const double barHeight = 68;

  /// AYLANTIRILADIGAN KONTENT OXIRIGA QO'SHILADIGAN JOY.
  ///
  /// Panel kontent USTIDA suzadi (dizaynda uning ostidan kontent
  /// o'tib ketadi va gradientga singiydi), shuning uchun ro'yxatning
  /// oxirgi elementi panel ostida qolib ketmasligi uchun shuncha
  /// bo'sh joy qo'shiladi.
  static double inset(BuildContext context) =>
      barHeight + MediaQuery.of(context).padding.bottom + S.x16;

  static List<({Ico icon, String label})> get tabs => [
        (icon: Ico.home, label: tr('Bosh sahifa')),
        (icon: Ico.search, label: tr('Qidiruv')),
        (icon: Ico.nfc, label: 'NFC'),
        (icon: Ico.bag, label: tr('Do‘kon')),
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
          // PANEL USTIDAGI SCRIM.
          //
          // Kontent panel ostidan o'tib ketadi, shuning uchun
          // panelning yuqori qirrasi keskin kesim bo'lib
          // ko'rinmasligi kerak: matn unga yetganda asta so'nadi.
          Positioned(
            left: 0,
            right: 0,
            bottom: 68 + bottom,
            height: 28,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      C.bg.withValues(alpha: 0),
                      C.bg.withValues(alpha: .92),
                    ],
                  ),
                ),
              ),
            ),
          ),

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

/// MARKAZIY TUGMA — TO'LDIRILGAN OLTIN DOIRA.
///
/// EGASI: "pastdagi NFC logoni qara, o'shani bizga ol — chiroyli
/// ko'rinar ekan".
///
/// Ilgari bu yerda quyuq doira va uning ichida medalyon rasmi
/// turardi: qora fon qora panel ustida "o'yiq" bo'lib ko'rinardi
/// va tugma panelning o'zidan ajralib turmasdi.
///
/// Endi doiraning O'ZI oltin yuza (tugmalardagi bilan bir xil
/// gradiyent), belgi esa quyuq rangda — ya'ni u ilovadagi asosiy
/// amal tugmasi bilan bir tilda gapiradi va uzoqdan ko'rinadi.
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
          width: 62,
          height: 62,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: C.actionFace,
            // Panel bilan tutashmasin — quyuq halqa doirani
            // panelning o'zidan ajratadi.
            border: Border.all(color: C.bg, width: 3),
            // Faol holatda nur kuchayadi.
            boxShadow: [
              BoxShadow(
                color: C.accent.withValues(alpha: active ? .5 : .3),
                blurRadius: active ? 28 : 20,
                spreadRadius: active ? -2 : -6,
              ),
            ],
          ),
          child: LogoMark(size: 32, color: C.onAccent),
        ),
      );
}
