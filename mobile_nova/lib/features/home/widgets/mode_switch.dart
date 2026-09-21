import 'package:flutter/material.dart';

import '../../../app/providers.dart';
import '../../../design/motion/motion.dart';
import '../../../design/tokens/nfc_tokens.dart';
import '../../../design/tokens/shapes.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Shaxsiy ↔ Biznes almashtirgich.
///
/// Sirg'aluvchi indikator ikki holat orasida "oqib" o'tadi
/// (`AnimatedAlign`), shuning uchun almashuv keskin emas — bu
/// texnik topshiriqdagi "morphing transition" talabining
/// boshqaruv elementidagi ko'rinishi.
class ModeSwitch extends StatelessWidget {
  const ModeSwitch({super.key, required this.mode, required this.onChanged});

  final AppMode mode;
  final ValueChanged<AppMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final business = mode == AppMode.business;

    return Semantics(
      label: business ? l.modeBusiness : l.modePersonal,
      // MINIMAL SEGMENTED CONTROL.
      //
      // Ilgari faol tomon TO'LA aksent gradient bilan bo'yalardi
      // va butun kenglikni egallagan qalin pill bo'lib ko'rinardi
      // — sahifadagi eng og'ir element. `/c/nfcstoreuz` da esa
      // tablar yengil: faol bo'lim shampan TUSIDA, ingichka oltin
      // chegara bilan; matn oltin, fon esa qorong'i bo'lib
      // qolaveradi.
      child: Container(
        height: 38,
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: t.surface2,
          borderRadius: R.pill,
          border: Border.all(color: t.border2),
        ),
        child: LayoutBuilder(
          builder: (context, c) {
            final w = (c.maxWidth - 7) / 2;
            return Stack(
              children: [
                AnimatedAlign(
                  duration: Motion.med,
                  curve: Motion.spring,
                  alignment:
                      business ? Alignment.centerRight : Alignment.centerLeft,
                  child: AnimatedContainer(
                    duration: Motion.med,
                    curve: Motion.smooth,
                    width: w,
                    height: 32,
                    decoration: BoxDecoration(
                      // TUS, TO'LDIRISH EMAS.
                      color: (business ? t.accentB : t.accent2)
                          .withValues(alpha: t.isDark ? .14 : .20),
                      borderRadius: R.pill,
                      border: Border.all(
                        color: (business ? t.accentB : t.accent2)
                            .withValues(alpha: .5),
                      ),
                    ),
                  ),
                ),
                Row(
                  children: [
                    _Label(
                      text: l.modePersonal,
                      selected: !business,
                      tone: t.accent2,
                      width: w,
                      onTap: () => onChanged(AppMode.personal),
                    ),
                    const SizedBox(width: 6),
                    _Label(
                      text: l.modeBusiness,
                      selected: business,
                      tone: t.accentB,
                      width: w,
                      onTap: () => onChanged(AppMode.business),
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

class _Label extends StatelessWidget {
  const _Label({
    required this.text,
    required this.selected,
    required this.tone,
    required this.width,
    required this.onTap,
  });

  final String text;
  final bool selected;

  /// Faol yorliq rangi — shaxsiyda shampan, bizneda platina-yashil.
  final Color tone;
  final double width;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: width,
        height: 32,
        child: Center(
          child: AnimatedDefaultTextStyle(
            duration: Motion.fast,
            style: TextStyle(
              fontFamily: 'Manrope',
              fontSize: 12.5,
              // Faol yorliq QALIN emas, RANGLI: qalinlik yozuvni
              // "sakrab" ko'rsatardi, chunki kenglik o'zgaradi.
              fontWeight: FontWeight.w600,
              color: selected ? tone : t.text2,
            ),
            child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ),
      ),
    );
  }
}
