import 'package:flutter/widgets.dart';

import '../tokens.dart';
import '../type.dart';

/// NAFIS GRAFIK — statistika uchun.
///
/// Kutubxona QO'SHILMAYDI: bizga kerak bo'lgan ikki shakl
/// (ustunlar va halqa) bir necha o'nlab qator kod, `fl_chart` esa
/// ilovaga ~300 KB va o'z dizayn tilini olib keladi.
///
/// USTUNLAR — eng baland qiymat oltin gradient bilan to'ldiriladi,
/// qolganlari so'nggan. Shunda ko'z eng muhim kunni darhol topadi.
/// Qiymat 0 bo'lsa ham ustun ko'rinadi (nozik chiziq) — aks holda
/// "ma'lumot yo'q" bilan "0" farq qilmasdi.
class BarChart extends StatelessWidget {
  const BarChart({
    super.key,
    required this.values,
    required this.labels,
    this.height = 96,
  });

  final List<int> values;

  /// Ustun ostidagi qisqa yozuvlar (DUSH, SESH, ...). Bo'sh bo'lsa
  /// faqat birinchi va oxirgisi chiziladi.
  final List<String> labels;

  final double height;

  @override
  Widget build(BuildContext context) {
    if (values.isEmpty) return SizedBox(height: height);

    final max = values.reduce((a, b) => a > b ? a : b);
    final peak = values.indexOf(max);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: height,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (var i = 0; i < values.length; i++) ...[
                if (i > 0) const SizedBox(width: 6),
                Expanded(
                  child: _Bar(
                    // Eng baland ustun to'liq balandlikni oladi.
                    factor: max == 0 ? 0 : values[i] / max,
                    peak: i == peak && max > 0,
                    height: height,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 7),
        // ASOS CHIZIG'I — ustunlar "havoda osilib" qolmasin.
        Container(height: 1, color: C.line),
        if (labels.isNotEmpty) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              Text(labels.first.toUpperCase(), style: T.meta.copyWith(
                fontSize: 9.5,
              )),
              const Spacer(),
              Text(labels.last.toUpperCase(), style: T.meta.copyWith(
                fontSize: 9.5,
              )),
            ],
          ),
        ],
      ],
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({
    required this.factor,
    required this.peak,
    required this.height,
  });

  final double factor;
  final bool peak;
  final double height;

  @override
  Widget build(BuildContext context) {
    // Eng past ustun ham ko'rinib tursin: 3 dp — "nol" belgisi.
    final h = (height * factor).clamp(3.0, height);
    return Align(
      alignment: Alignment.bottomCenter,
      child: AnimatedContainer(
        duration: M.push,
        curve: M.curve,
        height: h,
        decoration: BoxDecoration(
          gradient: peak
              ? C.actionFace
              : LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    C.accent.withValues(alpha: .55),
                    C.accent.withValues(alpha: .16),
                  ],
                ),
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(4),
          ),
        ),
      ),
    );
  }
}

/// HALQA — nisbatni ko'rsatadi (masalan kontakt / ko'rish).
class RingChart extends StatelessWidget {
  const RingChart({
    super.key,
    required this.value,
    required this.total,
    this.size = 92,
    this.label = '',
  });

  final int value;
  final int total;
  final double size;
  final String label;

  @override
  Widget build(BuildContext context) {
    final fraction = total == 0 ? 0.0 : (value / total).clamp(0.0, 1.0);
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: Size(size, size),
            painter: _RingPainter(fraction: fraction),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${(fraction * 100).round()}%',
                style: T.statValue.copyWith(fontSize: size * .22),
              ),
              if (label.isNotEmpty)
                Text(label, style: T.statLabel),
            ],
          ),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.fraction});

  final double fraction;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 7.0;
    final center = size.center(Offset.zero);
    final radius = (size.shortestSide - stroke) / 2;

    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = C.line,
    );

    if (fraction <= 0) return;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -1.5708,
      fraction * 6.2831853,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..shader = C.actionFace.createShader(
          Rect.fromCircle(center: center, radius: radius),
        ),
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.fraction != fraction;
}
