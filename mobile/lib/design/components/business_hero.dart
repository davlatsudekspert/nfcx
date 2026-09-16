import 'package:flutter/widgets.dart';

import '../tokens.dart';
import 'icons.dart';
import 'logo.dart';
import 'media.dart';

/// BUSINESS HERO — kompaniyaning backend cover rasmini birinchi o'ringa
/// qo'yadi. Cover hali yuklanmagan bo'lsa, bo'sh media slot o'rniga
/// NFCSTORE vizual tizimiga mos, ma'lumot o'ylab topmaydigan kompozitsiya
/// chizadi. Bu faqat dekor: ism, logo, holat va katalog qiymatlari tashqi
/// widgetlarda real API'dan olinadi.
class BusinessHero extends StatelessWidget {
  const BusinessHero({
    super.key,
    required this.imageUrl,
    this.compact = false,
    this.radius = 0,
  });

  final String? imageUrl;
  final bool compact;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final url = imageUrl?.trim() ?? '';
    if (url.isNotEmpty) return NetImage(url, radius: radius, slotIcon: Ico.building);
    return _BusinessHeroFallback(compact: compact);
  }
}

class _BusinessHeroFallback extends StatelessWidget {
  const _BusinessHeroFallback({required this.compact});

  final bool compact;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, box) {
          final width = box.hasBoundedWidth ? box.maxWidth : 280.0;
          final height = box.hasBoundedHeight ? box.maxHeight : width * .62;
          final scale = compact ? .72 : 1.0;
          final cardWidth = width * (compact ? .61 : .58);
          final cardHeight = height * (compact ? .54 : .58);

          Widget card({required double turns, required double opacity}) => Transform.rotate(
                angle: turns,
                child: Container(
                  width: cardWidth,
                  height: cardHeight,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(compact ? 12 : 18),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        C.surfaceHigh.withValues(alpha: opacity),
                        C.surface.withValues(alpha: opacity),
                        const Color(0xFF060606).withValues(alpha: opacity),
                      ],
                    ),
                    border: Border.all(color: C.accent.withValues(alpha: .16 + opacity * .22)),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF000000).withValues(alpha: .42),
                        blurRadius: 24 * scale,
                        offset: Offset(0, 12 * scale),
                      ),
                    ],
                  ),
                ),
              );

          return DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [C.surfaceHigh, C.surface, C.bg],
                stops: const [0, .55, 1],
              ),
            ),
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                Positioned(
                  top: -height * .44,
                  right: -width * .18,
                  child: Container(
                    width: width * .90,
                    height: width * .90,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: C.accent.withValues(alpha: .11)),
                      gradient: RadialGradient(
                        colors: [C.accent.withValues(alpha: .16), const Color(0x00000000)],
                        stops: const [0, 1],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: height * .10,
                  child: Opacity(opacity: .42, child: card(turns: -.22, opacity: .38)),
                ),
                Positioned(
                  top: height * .16,
                  child: Opacity(opacity: .82, child: card(turns: .11, opacity: .76)),
                ),
                Container(
                  width: compact ? 44 : 70,
                  height: compact ? 44 : 70,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xD9080808),
                    border: Border.all(color: C.accent.withValues(alpha: .62)),
                    boxShadow: [
                      BoxShadow(
                        color: C.accent.withValues(alpha: .24),
                        blurRadius: compact ? 18 : 30,
                        spreadRadius: compact ? -3 : -5,
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: BrandMark(size: compact ? 38 : 62, glow: true),
                ),
                Positioned(
                  right: compact ? 10 : 18,
                  bottom: compact ? 9 : 16,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      NIcon(Ico.nfc, size: compact ? 12 : 15, color: C.accent.withValues(alpha: .82)),
                      SizedBox(width: compact ? 4 : 6),
                      Wordmark(size: compact ? 6 : 7, color: C.accent.withValues(alpha: .74)),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      );
}
