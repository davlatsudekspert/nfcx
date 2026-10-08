import 'package:flutter/material.dart';

import '../../design/motion/motion.dart';
import '../../design/tokens/shapes.dart';
import '../../l10n/gen/app_localizations.dart';
import 'media_frame.dart' show mediaImage;

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

/// LENTA / POST KARUSELI — 2 tadan ko'p rasm (faqat rasm).
///
/// Gorizontal surish, ostida nuqtalar; rasm bosilsa [onTap] (odatda
/// butun ekranda ko'rish). Quti 4:5 — rasm kesilmaydi (`contain`), bo'sh
/// joy mavzu foni bilan.
class MediaCarousel extends StatefulWidget {
  const MediaCarousel({
    super.key,
    required this.urls,
    this.onTap,
    this.borderRadius = BorderRadius.zero,
    this.background = Colors.black,
    this.aspectRatio = 4 / 5,
    this.keyPrefix = 'carousel',
  });

  final List<String> urls;
  final void Function(int index)? onTap;
  final BorderRadius borderRadius;
  final Color background;
  final double aspectRatio;

  /// Sinov kalitlari: `<prefix>-pages`, `<prefix>-image-<i>`, `<prefix>-dots`.
  final String keyPrefix;

  @override
  State<MediaCarousel> createState() => _MediaCarouselState();
}

class _MediaCarouselState extends State<MediaCarousel> {
  final _page = PageController();
  int _index = 0;

  @override
  void didUpdateWidget(MediaCarousel old) {
    super.didUpdateWidget(old);
    if (_index >= widget.urls.length) _index = 0;
  }

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final urls = widget.urls;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ClipRRect(
          borderRadius: widget.borderRadius,
          child: AspectRatio(
            aspectRatio: widget.aspectRatio,
            child: ColoredBox(
              color: widget.background,
              child: PageView.builder(
                key: ValueKey('${widget.keyPrefix}-pages'),
                controller: _page,
                itemCount: urls.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) => GestureDetector(
                  key: ValueKey('${widget.keyPrefix}-image-$i'),
                  behavior: HitTestBehavior.opaque,
                  onTap: widget.onTap == null ? null : () => widget.onTap!(i),
                  child: mediaImage(context, urls[i], fit: BoxFit.contain),
                ),
              ),
            ),
          ),
        ),
        if (urls.length > 1) ...[
          const SizedBox(height: 8),
          CarouselDots(
            key: ValueKey('${widget.keyPrefix}-dots'),
            count: urls.length,
            index: _index,
            color: Theme.of(context).colorScheme.onSurface,
          ),
        ],
      ],
    );
  }
}
