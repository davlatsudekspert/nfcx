import 'package:flutter/material.dart';

import '../../design/motion/motion.dart';
import '../../design/tokens/shapes.dart';
import '../../l10n/gen/app_localizations.dart';

/// Karusel nuqtalari — faol rasm cho'ziq, qolganlari kichik doira
/// (katalog tovari galereyasi bilan bir xil uslub).
class CarouselDots extends StatelessWidget {
  const CarouselDots({
    super.key,
    required this.count,
    required this.index,
    this.color = Colors.white,
  });

  final int count;
  final int index;
  final Color color;

  @override
  Widget build(BuildContext context) {
    if (count < 2) return const SizedBox.shrink();
    return Semantics(
      label: L.of(context).showcaseImageN(index + 1, count),
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < count; i++)
            AnimatedContainer(
              duration: Motion.fast,
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: i == index ? 16 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: color.withValues(alpha: i == index ? .95 : .5),
                borderRadius: R.pill,
                boxShadow: const [
                  BoxShadow(color: Colors.black26, blurRadius: 4),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
