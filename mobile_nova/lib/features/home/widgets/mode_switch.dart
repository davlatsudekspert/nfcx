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
      child: Container(
        height: 40,
        padding: const EdgeInsets.all(3.5),
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
                    height: 33,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: business
                            ? [t.accentB, t.accentBDark]
                            : [t.accent1, t.accent2],
                      ),
                      borderRadius: R.pill,
                      boxShadow: t.shadowTiny,
                    ),
                  ),
                ),
                Row(
                  children: [
                    _Label(
                      text: l.modePersonal,
                      selected: !business,
                      width: w,
                      onTap: () => onChanged(AppMode.personal),
                    ),
                    const SizedBox(width: 7),
                    _Label(
                      text: l.modeBusiness,
                      selected: business,
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
    required this.width,
    required this.onTap,
  });

  final String text;
  final bool selected;
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
        height: 33,
        child: Center(
          child: AnimatedDefaultTextStyle(
            duration: Motion.fast,
            style: TextStyle(
              fontFamily: 'Manrope',
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: selected ? const Color(0xFF1A1A1F) : t.text2,
            ),
            child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ),
      ),
    );
  }
}
