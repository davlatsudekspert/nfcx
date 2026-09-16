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
                  left: -width * .22,
                  bottom: -height * .48,
                  child: Container(
                    width: width * 1.14,
                    height: width * 1.14,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: C.accent.withValues(alpha: .12), width: 1.2),
                    ),
                  ),
                ),
                Positioned(
                  left: width * .10,
                  top: height * .16,
                  child: Container(
                    width: width * .80,
                    height: height * .72,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(width * .42),
                        topRight: Radius.circular(width * .42),
                      ),
                      gradient: RadialGradient(
                        center: const Alignment(0, -.4),
                        colors: [C.accent.withValues(alpha: .12), const Color(0x00000000)],
                      ),
                      border: Border.all(color: C.accent.withValues(alpha: .10)),
                    ),
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
