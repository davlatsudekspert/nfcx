import 'package:flutter/widgets.dart';
import '../tokens.dart';
import '../type.dart';
import 'press.dart';

/// Metall ID kartasi — ilovaning eng "jismoniy" elementi.
///
/// Nisbat 16:10, metall gradient, ichki yorug'lik chizig'i va ID serif
/// champagne bilan. Bu YAGONA joyda gold og'irroq ishlatiladi, chunki
/// karta mahsulotning o'zi.
class IdentityCard extends StatelessWidget {
  const IdentityCard({
    super.key,
    required this.code,
    required this.holder,
    this.subtitle,
    this.taps,
    this.tier = Tier.free,
    this.onTap,
    this.active = false,
  });

  final String code;
  final String holder;
  final String? subtitle;
  final int? taps;
  final Tier tier;
  final VoidCallback? onTap;

  /// Faol ID — o'ng yuqorida "FAOL" belgisi.
  final bool active;

  @override
  Widget build(BuildContext context) {
    final t = TierStyle.of(tier);
    return Press(
      onTap: onTap,
      haptic: true,
      child: AspectRatio(
        aspectRatio: 16 / 10,
        child: Container(
          padding: const EdgeInsets.all(S.x16),
          decoration: BoxDecoration(
            gradient: C.metalSurface,
            borderRadius: BorderRadius.circular(R.hero),
            border: Border.all(color: C.metalBorder),
            boxShadow: E.e3,
          ),
          child: Stack(
            children: [
              // Yuqoridagi ichki yorug'lik — metallga "qirra" beradi.
              Positioned(
                top: 0, left: 0, right: 0,
                child: Container(height: 1, color: const Color(0x14FFFFFF)),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      // Tarif medali.
                      Container(
                        width: 22, height: 22,
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
                      Text(t.label.toUpperCase(), style: T.eyebrow),
                      const Spacer(),
                      if (active)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                          decoration: BoxDecoration(
                            color: C.champagne.withValues(alpha: .14),
                            borderRadius: BorderRadius.circular(R.status),
                            border: Border.all(color: C.champagne.withValues(alpha: .32)),
                          ),
                          child: Text('FAOL', style: T.statusLabel.copyWith(color: C.champagne)),
                        ),
                    ],
                  ),
                  const Spacer(),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(code.toUpperCase(), style: T.nfcId(38)),
                  ),
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
                              Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis,
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
                            const Text('TEGISHLAR', style: T.eyebrow),
                            const SizedBox(height: 2),
                            Text(compact(taps!), style: T.price.copyWith(fontSize: 14)),
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
