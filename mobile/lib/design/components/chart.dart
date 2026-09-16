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

/// CHIZIQLI GRAFIK — prototipdagi "Statistika".
///
/// NIMA UCHUN USTUN EMAS: ustunlar kunlarni SOLISHTIRISH uchun
/// yaxshi ("qaysi kun ko'proq?"), chiziq esa YO'NALISH uchun
/// ("o'syaptimi?"). Profil egasiga aynan ikkinchisi kerak: u har
/// kunni alohida emas, umumiy o'sishni ko'rmoqchi.
///
/// Ostida yumshoq to'ldirish bor — chiziqning o'zi yupqa va oq
/// fonda yo'qolib ketardi.
class LineChart extends StatelessWidget {
  const LineChart({
    super.key,
    required this.values,
    this.height = 132,
  });

  final List<int> values;
  final double height;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: height,
        width: double.infinity,
        child: CustomPaint(
          painter: _LinePainter(
            values: values,
            line: C.accent,
            fill: C.accent.withValues(alpha: .14),
            grid: C.line,
            dot: C.accent,
          ),
        ),
      );
}

class _LinePainter extends CustomPainter {
  _LinePainter({
    required this.values,
    required this.line,
    required this.fill,
    required this.grid,
    required this.dot,
  });

  final List<int> values;
  final Color line;
  final Color fill;
  final Color grid;
  final Color dot;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;

    const pad = 6.0;
    final w = size.width;
    final h = size.height;
    final maxV = values.reduce((a, b) => a > b ? a : b);

    // HAMMASI 0 BO'LSA — chiziq pastda tekis turadi, "yo'q"
    // degani ham ma'lumot.
    final top = maxV <= 0 ? h - pad : pad;
    double x(int i) => w * i / (values.length - 1);
    double y(int i) => maxV <= 0
        ? h - pad
        : h - pad - (h - pad - top) * (values[i] / maxV);

    // Yordamchi chiziqlar — uchta gorizontal.
    final g = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (var i = 0; i < 3; i++) {
      final gy = pad + (h - pad * 2) * i / 2;
      canvas.drawLine(Offset(0, gy), Offset(w, gy), g);
    }

    // SILLIQ EGRI — to'g'ri chiziqlar "sinuvchan" ko'rinadi.
    final path = Path()..moveTo(x(0), y(0));
    for (var i = 1; i < values.length; i++) {
      final px = x(i - 1);
      final py = y(i - 1);
      final cx = x(i);
      final cy = y(i);
      final mid = (px + cx) / 2;
      path.cubicTo(mid, py, mid, cy, cx, cy);
    }

    final area = Path.from(path)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(area, Paint()..color = fill);

    canvas.drawPath(
      path,
      Paint()
        ..color = line
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );

    // OXIRGI NUQTA — "bugun" shu yerda.
    final lx = x(values.length - 1);
    final ly = y(values.length - 1);
    canvas.drawCircle(Offset(lx, ly), 5.5, Paint()..color = fill);
    canvas.drawCircle(Offset(lx, ly), 3.5, Paint()..color = dot);
  }

  @override
  bool shouldRepaint(_LinePainter old) =>
      old.values.length != values.length ||
      old.line != line ||
      !_same(old.values, values);

  static bool _same(List<int> a, List<int> b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}
