import 'package:flutter/widgets.dart';

import '../../app.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/logo.dart';
import '../../design/components/palette_card.dart';
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
                    // UCHTA KARTA YONMA-YON (prototip: `.palettes`).
                    //
                    // Ro'yxat emas, NAMUNA: har karta o'z mavzusining
                    // FONI bilan chiziladi va tanlov ranglarni ko'rib
                    // qilinadi. Bir xil fondagi uch qator esa faqat
                    // nomni ko'rsatardi.
                    Row(
                      children: [
                        for (final p in Palette.all) ...[
                          Expanded(
                            child: PaletteCard(
                              palette: p,
                              selected: p.id == prefs.palette.id,
                              onTap: () {
                                successHaptic();
                                prefs.setPalette(p);
                              },
                            ),
                          ),
                          if (p != Palette.all.last) const SizedBox(width: S.x8),
                        ],
                      ],
                    ),
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
/// PALITRA NAMUNASI — prototipdagi `.palettes button`.
///
/// Karta o'z mavzusining foni bilan chiziladi, ostida esa urg'u
/// rangining chizig'i. Tanlangani urg'u rangli chegara oladi.

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
