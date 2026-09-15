import 'package:flutter/widgets.dart';

import '../../app.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/logo.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';

/// KO'RINISH — urg'u oilasi va til.
///
/// NIMA UCHUN TIRIK NAMUNA BOR: rang nomi ("Emerald Luxury") hech
/// narsa aytmaydi. Tanlov darhol qo'llanadi va ostidagi NAMUNA
/// bloki JORIY tokenlar bilan chiziladi — ya'ni odam mavzuni
/// tanlagan zahoti uni haqiqiy yuzada ko'radi.
///
/// NIMA ALMASHADI: urg'u rangi, fon gradienti va ambient nur.
/// NIMA ALMASHMAYDI: tarif materiallari (Gold doim Gold),
/// muvaffaqiyat/xato ranglari va to'lov brendlari.
class AppearanceScreen extends StatelessWidget {
  const AppearanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prefs = AppPrefsScope.of(context);

    return ScreenBackdrop(
      aura: Aura.none,
      child: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            const SliverToBoxAdapter(child: TopBar()),
            SliverToBoxAdapter(child: ScreenTitle(tr('Ko‘rinish'))),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, 0),
                child: Text(
                  tr('Mavzu urg‘u oilasi va fon yorug‘ligini almashtiradi. '
                      'Tarif materiallari o‘zgarmaydi.'),
                  style: T.caption,
                ),
              ),
            ),

            // ── MAVZULAR ──────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  S.x24,
                  S.gutter,
                  0,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Eyebrow(tr('Mavzu')),
                    const SizedBox(height: S.x12),
                    for (final p in Palette.all) ...[
                      _PaletteRow(
                        palette: p,
                        selected: p.id == prefs.palette.id,
                        onTap: () {
                          successHaptic();
                          prefs.setPalette(p);
                        },
                      ),
                      if (p != Palette.all.last) const SizedBox(height: S.x8),
                    ],
                  ],
                ),
              ),
            ),

            // ── NAMUNA — JORIY TOKENLAR BILAN ─────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  S.x24,
                  S.gutter,
                  0,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Eyebrow(tr('Namuna')),
                    const SizedBox(height: S.x12),
                    Surface(
                      padding: const EdgeInsets.all(S.x20),
                      glow: true,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const BrandMark(size: 44),
                              const SizedBox(width: S.x12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      prefs.palette.label,
                                      style: T.cardTitle,
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      tr('Urg‘u, holat va fon yorug‘ligi'),
                                      style: T.caption.copyWith(color: C.ink3),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: S.x16),
                          Row(
                            children: [
                              StatusChip(tr('Yoqilgan'), tone: StatusTone.ok),
                              const SizedBox(width: S.x8),
                              StatusChip(
                                tr('Kutilmoqda'),
                                tone: StatusTone.pending,
                              ),
                            ],
                          ),
                          const SizedBox(height: S.x16),
                          PrimaryButton(
                            tr('Asosiy tugma'),
                            onTap: successHaptic,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // ── TIL ───────────────────────────────────────────
            //
            // Har til O'Z NOMINI o'z tilida ko'rsatadi — aks holda
            // rus tilidagi odam ro'yxatdan o'z tilini topa olmasdi.
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  S.x24,
                  S.gutter,
                  0,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Eyebrow(tr('Til')),
                    const SizedBox(height: S.x12),
                    RowGroup(
                      children: [
                        for (final l in AppLocale.values)
                          ListRow(
                            title: l.label,
                            chevron: false,
                            trailing: l == prefs.locale
                                ? _Check(size: 22)
                                : null,
                            onTap: () {
                              successHaptic();
                              prefs.setLocale(l);
                            },
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  S.x16,
                  S.gutter,
                  S.x32,
                ),
                child: Text(
                  tr('Tanlov darhol butun ilovaga qo‘llanadi va '
                      'qurilmada saqlanadi.'),
                  textAlign: TextAlign.center,
                  style: T.caption.copyWith(color: C.ink3),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Mavzu qatori — namuna, nom, HEX va tanlov halqasi.
///
/// TANLOV FAQAT RANG BILAN BILDIRILMAYDI: qirra kuchayadi VA
/// o'ngda belgi paydo bo'ladi.
class _PaletteRow extends StatelessWidget {
  const _PaletteRow({
    required this.palette,
    required this.selected,
    required this.onTap,
  });

  final Palette palette;
  final bool selected;
  final VoidCallback onTap;

  /// Namuna — mavzuning O'Z ranglaridan, joriy mavzuniki emas.
  /// Aks holda hamma qator bir xil ko'rinardi. Gradient
  /// `C.actionFace` bilan bir xil naqsh: yorug' → to'yingan →
  /// quyuq.
  LinearGradient get _face => LinearGradient(
        begin: const Alignment(-.7, -1),
        end: const Alignment(.7, 1),
        colors: [palette.accentHigh, palette.accent, palette.accentDeep],
        stops: const [0, .4, 1],
      );

  String get _hex {
    final v = palette.accent.toARGB32() & 0xFFFFFF;
    return '#${v.toRadixString(16).toUpperCase().padLeft(6, '0')}';
  }

  @override
  Widget build(BuildContext context) => Surface(
        onTap: onTap,
        padding: const EdgeInsets.all(S.x12),
        border: Border.all(
          color: selected ? C.lineStrong : C.line,
          width: selected ? 1.4 : 1,
        ),
        shadow: C.e1,
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: _face,
                shape: BoxShape.circle,
                border: Border.all(color: C.lineCool),
              ),
            ),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(palette.label, style: T.cardTitle),
                  const SizedBox(height: 3),
                  Text(_hex, style: T.code(12, color: C.ink3)),
                ],
              ),
            ),
            if (selected) ...[
              const SizedBox(width: S.x12),
              _Check(size: 24),
            ],
          ],
        ),
      );
}

/// Tanlangan qatordagi belgi.
class _Check extends StatelessWidget {
  const _Check({required this.size});
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          gradient: C.actionFace,
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: NIcon(Ico.check, size: size * .6, color: C.onAccent),
      );
}
