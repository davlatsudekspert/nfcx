import 'package:flutter/widgets.dart';

import '../../l10n/strings.dart';
import '../tokens.dart';
import '../type.dart';
import 'dart:ui' show ImageFilter;

import 'icons.dart';
import 'logo.dart';
import 'press.dart';

/// TAB BAR — 5 tab, NFC markazda va ko'tarilgan (prototip: V2).
///
/// Beshta tab: Bosh sahifa · Qidiruv · **NFC** · Do'kon · Profil.
/// NFC markazda va BOSHQACHA ko'rinadi — u mahsulotning o'zagi,
/// qolgan to'rttasi esa uning atrofi.
///
/// DO'KON — TO'RTINCHI TAB. Prototipda shunday: ID sotib olish
/// ilovaning asosiy savdo yo'li va u bitta bosishda turishi kerak.
/// Reels esa lentadan ochiladi (bosh sahifadagi "Lenta" sarlavhasi
/// yonidagi tugma) — u kontent ko'rinishi, alohida bo'lim emas.
///
/// MARKAZIY TUGMA — 56 dp li urg'u rangli doira, panel ustiga 16 dp
/// ko'tarilgan, ichida NFC to'lqini va ustidan o'tuvchi yorug'lik
/// chizig'i. Atrofida 6 dp fon halqasi: panelning chizig'i doirani
/// kesib o'tmasligi kerak.
///
/// PANEL — SHISHA: prototipdagi `backdrop-filter: blur(24px)` va
/// `--glass` to'ldirishi. Ostidan o'tayotgan kontent sezilib
/// turadi, lekin matn baribir o'qiladi.
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
        // REELS — DO'KON O'RNIGA. Do'kon kunda bir marta
        // ochiladigan joy; Reels esa har kuni qaytiladigan
        // lenta. Pastki qator eng tez-tez ishlatiladigan
        // beshta joy uchun. Do'kon Bosh sahifadagi tezkor
        // amaldan va NFC markazidan ochiladi.
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
            child: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: C.blurSheet, sigmaY: C.blurSheet),
                child: Container(
              height: 68 + bottom,
              decoration: BoxDecoration(
                color: C.glass,
                border: Border(top: BorderSide(color: C.lineCool)),
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

/// Markaziy tugma — NFCSTORE orbi.
///
/// BU YERDA RASMIY LOGOTIP TURADI, umumiy NFC ikonkasi emas.
/// Markaziy tugma ilovaning eng ko'rinadigan elementi: u brendni
/// ham, asosiy amalni ham bildiradi. Umumiy ikonka esa ilovani
/// har qanday boshqa NFC ilovasiga o'xshatib qo'yardi.
///
/// LOGOTIP O'Z RANGIDA QOLADI (oltin) va CHO'ZILMAYDI:
/// `BoxFit.contain` nisbatni saqlaydi, atrofida esa nafas uchun
/// joy bor — belgi doiraning gardishiga tegmaydi.
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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: M.fade,
              curve: M.curve,
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                // QUYUQ DISK + OLTIN GARDISH. Disk logotip rasmi
                // yuklanguncha ham tugmani ko'rsatib turadi —
                // sekin tarmoqda yoki birinchi kadrda markaz
                // bo'sh qolmasin.
                gradient: LinearGradient(
                  begin: const Alignment(-.7, -1),
                  end: const Alignment(.7, 1),
                  colors: [C.orbHigh, C.orbDeep],
                ),
                border: Border.all(
                  color: C.orbGlow.withValues(alpha: active ? .9 : .55),
                  width: 1.2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: C.orbGlow.withValues(alpha: active ? .38 : .22),
                    blurRadius: active ? 28 : 22,
                    spreadRadius: -4,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              alignment: Alignment.center,
              // RASMIY NFCSTORE BELGISI — o'z oltinida, kesilmasdan
              // va cho'zilmasdan (`BoxFit.contain`). 58 dp disk
              // ichida 30 dp belgi: atrofida nafas qoladi.
              child: const LogoMark(size: 30),
            ),
            const SizedBox(height: 4),
            Text(
              'NFC',
              style: T.navLabel.copyWith(
                color: active ? C.accent : C.ink2,
                fontWeight: active ? FontWeight.w700 : FontWeight.w600,
              ),
            ),
          ],
        ),
      );
}
