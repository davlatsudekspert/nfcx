import 'package:flutter/widgets.dart';

import '../../app.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/press.dart';
import '../../design/components/surface.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../common/top_bar.dart';

/// KO'RINISH — rang mavzusi va til.
///
/// NIMA UCHUN NAMUNA KARTA BOR: rang nomi ("Emerald Luxury") hech
/// narsa aytmaydi. Odam tanlashdan OLDIN mavzu ilovada qanday
/// ko'rinishini ko'rishi kerak — shuning uchun ro'yxat tepasida
/// haqiqiy ID kartasi turadi va tanlov bilan darhol o'zgaradi.
class AppearanceScreen extends StatelessWidget {
  const AppearanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prefs = AppPrefsScope.of(context);

    return ColoredBox(
      color: C.obsidian,
      child: SafeArea(
        child: Column(
          children: [
            TopBar(title: tr('Ko‘rinish')),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                children: [
                  // TIRIK NAMUNA — tanlov darhol shu yerda ko'rinadi.
                  IdentityCard(
                    code: 'NFC',
                    holder: tr('Namuna'),
                    subtitle: prefs.palette.label,
                    tier: Tier.exclusive,
                    dense: true,
                  ),
                  const SizedBox(height: S.x24),
                  Eyebrow(tr('Rang mavzusi')),
                  const SizedBox(height: S.x12),
                  for (final p in Palette.all) ...[
                    _ThemeRow(
                      palette: p,
                      selected: p.id == prefs.palette.id,
                      onTap: () {
                        successHaptic();
                        prefs.setPalette(p);
                      },
                    ),
                    const SizedBox(height: S.x8),
                  ],
                  const SizedBox(height: S.x16),
                  Eyebrow(tr('Til')),
                  const SizedBox(height: S.x12),
                  Surface(
                    padding: EdgeInsets.zero,
                    shadow: E.e1,
                    child: Column(
                      children: [
                        for (var i = 0; i < AppLocale.values.length; i++)
                          _LocaleRow(
                            locale: AppLocale.values[i],
                            selected: AppLocale.values[i] == prefs.locale,
                            last: i == AppLocale.values.length - 1,
                            onTap: () {
                              successHaptic();
                              prefs.setLocale(AppLocale.values[i]);
                            },
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: S.x16),
                  Text(
                    tr('Tanlov darhol butun ilovaga qo‘llanadi va '
                        'qurilmada saqlanadi.'),
                    textAlign: TextAlign.center,
                    style: T.caption.copyWith(fontSize: 12.5),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Mavzu qatori — nomi va uchta rang namunasi.
///
/// Namunalar ASOSIY, CHUQUR va SOVUQ urg'u: mavzuning butun
/// "oilasi" shu uchtasidan quriladi, ya'ni qatorning o'zi
/// mavzuni to'liq ko'rsatadi.
class _ThemeRow extends StatelessWidget {
  const _ThemeRow({
    required this.palette,
    required this.selected,
    required this.onTap,
  });

  final Palette palette;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onTap,
        child: Surface(
          padding: const EdgeInsets.all(S.x12),
          border: selected ? C.champagne.withValues(alpha: .35) : null,
          shadow: E.e1,
          child: Row(
            children: [
              // Namuna — mavzuning O'Z ranglaridan, joriy mavzuniki
              // emas. Aks holda hamma qator bir xil ko'rinardi.
              _Swatch(palette),
              const SizedBox(width: S.x12),
              Expanded(
                child: Text(
                  palette.id == 'original' ? tr('Asl') : palette.label,
                  style: T.cardTitle.copyWith(fontSize: 15),
                ),
              ),
              if (selected) NIcon(Ico.check, size: 16, color: C.champagne),
            ],
          ),
        ),
      );
}

class _Swatch extends StatelessWidget {
  const _Swatch(this.palette);
  final Palette palette;

  @override
  Widget build(BuildContext context) => Container(
        width: 54,
        height: 30,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: palette.obsidian,
          border: Border.all(color: palette.hairline),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (final c in [palette.accent, palette.accentDeep, palette.accentCool])
              Container(
                width: 10,
                height: 10,
                margin: const EdgeInsets.symmetric(horizontal: 2),
                decoration: BoxDecoration(shape: BoxShape.circle, color: c),
              ),
          ],
        ),
      );
}

class _LocaleRow extends StatelessWidget {
  const _LocaleRow({
    required this.locale,
    required this.selected,
    required this.last,
    required this.onTap,
  });

  final AppLocale locale;
  final bool selected;
  final bool last;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: S.x16, vertical: S.x12),
          decoration: BoxDecoration(
            border: last ? null : Border(bottom: BorderSide(color: C.hairline)),
          ),
          child: Row(
            children: [
              // Har til O'Z NOMINI o'z tilida ko'rsatadi — aks holda
              // rus tilidagi odam ro'yxatdan o'z tilini topa olmasdi.
              Expanded(
                child: Text(locale.label, style: T.cardTitle.copyWith(fontSize: 15)),
              ),
              if (selected) NIcon(Ico.check, size: 16, color: C.champagne),
            ],
          ),
        ),
      );
}
