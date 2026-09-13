import 'package:flutter/widgets.dart';
import '../tokens.dart';
import '../type.dart';
import 'press.dart';
import '../../l10n/strings.dart';

/// Metall ID kartasi — ilovaning eng "jismoniy" elementi.
///
/// Nisbat 16:10, metall gradient, ichki yorug'lik chizig'i va ID serif
/// champagne bilan. Bu YAGONA joyda gold og'irroq ishlatiladi, chunki
/// karta mahsulotning o'zi.
class IdentityCard extends StatefulWidget {
  const IdentityCard({
    super.key,
    required this.code,
    required this.holder,
    this.subtitle,
    this.taps,
    this.tier = Tier.free,
    this.url,
    this.onTap,
    this.active = false,
    this.dense = false,
  });

  final String code;
  final String holder;
  final String? subtitle;
  final int? taps;
  final Tier tier;

  /// Ommaviy havola — kartaning "jismoniy" hissini kuchaytiradi
  /// (handoff: kod ostida `nfcstore.uz/id/vip001`). Ixcham
  /// ko'rinishda ko'rsatilmaydi: u yerda joy yo'q.
  final String? url;
  final VoidCallback? onTap;

  /// Faol ID — o'ng yuqorida "FAOL" belgisi.
  final bool active;

  /// Ixcham ko‘rinish — Home ekrani uchun.
  ///
  /// To'liq o'lchamdagi karta (16:10) Home'ning yarmini egallab
  /// olardi va ostidagi tezkor amallar bilan story qatori ekrandan
  /// chiqib ketardi. Ixcham variantda nisbat 2:1 va yozuvlar
  /// kichikroq — karta baribir "jismoniy" ko'rinadi, lekin ekranni
  /// bosib qolmaydi.
  final bool dense;

  @override
  State<IdentityCard> createState() => _IdentityCardState();
}

class _IdentityCardState extends State<IdentityCard>
    with SingleTickerProviderStateMixin {
  /// METALL YALTIRASHI — BIR MARTALIK, TAKRORLANMAYDI.
  ///
  /// Karta ekranda paydo bo'lganda yuzasidan bir marta nozik
  /// yorug'lik o'tadi — xuddi haqiqiy metall kartani qo'lda
  /// burgandek. Bu YAGONA joyda va FAQAT bir marta: uzluksiz
  /// yaltirash qorong'i interfeysni "kazino"ga aylantiradi va
  /// batareyani behuda yeydi.
  late final AnimationController _sheen = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );

  @override
  void initState() {
    super.initState();
    // Ekran o'tishi tugagach boshlanadi — ikkala animatsiya bir
    // vaqtda ketsa, ikkalasi ham silliq ko'rinmaydi.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        Future<void>.delayed(M.push, () {
          if (mounted) _sheen.forward();
        });
      }
    });
  }

  @override
  void dispose() {
    _sheen.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tier = widget.tier;
    final code = widget.code;
    final holder = widget.holder;
    final subtitle = widget.subtitle;
    final taps = widget.taps;
    final dense = widget.dense;
    final active = widget.active;
    final url = widget.url;
    final t = TierStyle.of(tier);
    return Press(
      onTap: widget.onTap,
      haptic: true,
      child: AspectRatio(
        aspectRatio: dense ? 2 : 16 / 10,
        child: Container(
          padding: EdgeInsets.all(dense ? S.x12 : S.x16),
          decoration: BoxDecoration(
            // TARIF MATERIALI. Yuza, qirra va yaltirash tarifdan
            // keladi — ekranning qolgan rangi TEGILMAYDI.
            gradient: t.surface,
            borderRadius: BorderRadius.circular(R.hero),
            border: Border.all(color: t.edge),
            boxShadow: E.e3,
          ),
          child: Stack(
            children: [
              // ICHKI QIRRA — faqat Premium va Exclusive'da.
              // Ikki qavatli chegara qimmat buyumlarning belgisi:
              // rang emas, ISHLOV farqi.
              if (t.innerRule)
                Positioned.fill(
                  child: IgnorePointer(
                    child: Container(
                      margin: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(R.hero - 3),
                        border: Border.all(
                          color: t.accent.withValues(alpha: .16),
                        ),
                      ),
                    ),
                  ),
                ),
              // Yuqoridagi ichki yorug'lik — metallga "qirra" beradi.
              // Rangi tarifning urg'usidan: bronzada issiq, kumushda
              // sovuq, Exclusive'da oltin.
              Positioned(
                top: 0, left: 0, right: 0,
                child: Container(
                  height: 1,
                  color: t.accent.withValues(alpha: .14),
                ),
              ),
              // Bir martalik yaltirash. `IgnorePointer` — bosishga
              // to'sqinlik qilmasin.
              Positioned.fill(
                child: IgnorePointer(
                  child: AnimatedBuilder(
                    animation: _sheen,
                    builder: (context, _) {
                      if (_sheen.isDismissed) return const SizedBox.shrink();
                      final v = Curves.easeInOut.transform(_sheen.value);
                      return ClipRRect(
                        borderRadius: BorderRadius.circular(R.hero),
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment(-1.8 + v * 3.6, -1),
                              end: Alignment(-1.2 + v * 3.6, 1),
                              colors: [
                                const Color(0x00FFFFFF),
                                Color(t.sheen << 24 | 0xFFFFFF),
                                const Color(0x00FFFFFF),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      // Tarif medali.
                      Container(
                        width: dense ? 17 : 22, height: dense ? 17 : 22,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: t.gradient,
                          boxShadow: const [
                            BoxShadow(color: Color(0x80FFFFFF), blurRadius: 5, offset: Offset(0, 3), blurStyle: BlurStyle.inner),
                            BoxShadow(color: Color(0x8C000000), blurRadius: 7, offset: Offset(0, -4), blurStyle: BlurStyle.inner),
                          ],
                        ),
                      ),
                      const SizedBox(width: S.x8),
                      Text(t.label.toUpperCase(),
                          style: T.eyebrow.copyWith(color: t.accent)),
                      const Spacer(),
                      if (active)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                          decoration: BoxDecoration(
                            color: C.champagne.withValues(alpha: .14),
                            borderRadius: BorderRadius.circular(R.status),
                            border: Border.all(color: C.champagne.withValues(alpha: .32)),
                          ),
                          child: Text(tr('Faol').toUpperCase(), style: T.statusLabel.copyWith(color: C.champagne)),
                        ),
                    ],
                  ),
                  const Spacer(),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    // KOD — tarif urg'usi bilan. Bu kartadagi eng
                    // katta element, ya'ni tarif farqi shu yerda
                    // birinchi bo'lib ko'zga tashlanadi.
                    child: Text(
                      code.toUpperCase(),
                      style: T.nfcId(dense ? 28 : 38).copyWith(color: t.accent),
                    ),
                  ),
                  if (!dense && url != null && url.isNotEmpty) ...[
                    const SizedBox(height: 5),
                    Text(
                      url,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.meta.copyWith(fontSize: 11, color: C.muted),
                    ),
                  ],
                  const SizedBox(height: S.x4),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(holder, maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: T.cardTitle.copyWith(fontSize: 13.5)),
                            if (subtitle != null)
                              Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis,
                                  style: T.caption.copyWith(fontSize: 11)),
                          ],
                        ),
                      ),
                      if (taps != null) ...[
                        const SizedBox(width: S.x12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(tr('Tegishlar').toUpperCase(), style: T.eyebrow),
                            const SizedBox(height: 2),
                            Text(compact(taps), style: T.price.copyWith(fontSize: 14)),
                          ],
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tarif medali — ro'yxat qatorlarida yolg'iz ishlatiladi.
class TierDot extends StatelessWidget {
  const TierDot(this.tier, {super.key, this.size = 16});
  final Tier tier;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size, height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: TierStyle.of(tier).gradient,
        ),
      );
}
