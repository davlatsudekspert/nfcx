import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../../design/tokens.dart';

/// Grafikdagi nuqta holati. Ma'no faqat rangda emas, shaklda ham:
/// oddiy — doira, ogohlantirish — uchburchak, rad — kvadrat.
enum LjMark { ok, warning, reject }

class LjPoint {
  const LjPoint(this.value, this.mark);
  final double value;
  final LjMark mark;
}

/// Levey–Jennings grafigi: o'rtacha chiziq va ±1, ±2, ±3 SD chegaralari,
/// nuqtalar vaqt tartibida. ±4 SD dan tashqaridagi nuqta chetda strelka
/// bilan ko'rsatiladi (yo'qolib qolmaydi).
class LeveyJenningsChart extends StatelessWidget {
  const LeveyJenningsChart({
    super.key,
    required this.mean,
    required this.sd,
    required this.points,
    required this.semanticLabel,
    this.height = 220,
  });

  final double mean;
  final double sd;
  final List<LjPoint> points;
  final String semanticLabel;
  final double height;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    return Semantics(
      label: semanticLabel,
      image: true,
      child: ExcludeSemantics(
        child: SizedBox(
          height: height,
          width: double.infinity,
          child: CustomPaint(
            painter: _LjPainter(
              mean: mean,
              sd: sd,
              points: points,
              palette: p,
              labelStyle: text.labelSmall!.copyWith(color: p.sub, fontSize: 10),
              textScaler: MediaQuery.textScalerOf(context)
                  .clamp(maxScaleFactor: 1.3),
            ),
          ),
        ),
      ),
    );
  }
}

class _LjPainter extends CustomPainter {
  _LjPainter({
    required this.mean,
    required this.sd,
    required this.points,
    required this.palette,
    required this.labelStyle,
    required this.textScaler,
  });

  final double mean;
  final double sd;
  final List<LjPoint> points;
  final LgPalette palette;
  final TextStyle labelStyle;
  final TextScaler textScaler;

  static const _range = 4.0; // ±4 SD ko'rinadi

  @override
  void paint(Canvas canvas, Size size) {
    TextPainter label(String s) => TextPainter(
      text: TextSpan(text: s, style: labelStyle),
      textDirection: TextDirection.ltr,
      textScaler: textScaler,
    )..layout();

    final labels = {
      for (final k in [-3, -2, -1, 0, 1, 2, 3])
        k: label(k == 0 ? 'x̄' : '${k > 0 ? '+' : '−'}${k.abs()}s'),
    };
    final gutter = labels.values.map((t) => t.width).reduce(math.max) + 8;
    const top = 6.0;
    const bottom = 6.0;
    final plot = Rect.fromLTRB(
      gutter,
      top,
      size.width - 6,
      size.height - bottom,
    );
    double yOf(double z) =>
        plot.center.dy - (z.clamp(-_range, _range) / _range) * plot.height / 2;

    // Chegara chiziqlari: x̄ — qalin, ±1s — nozik, ±2s — o'rta, ±3s — qalin.
    for (final k in [-3, -2, -1, 0, 1, 2, 3]) {
      final y = yOf(k.toDouble());
      final paint = Paint()
        ..strokeWidth = switch (k.abs()) {
          0 => 1.6,
          1 => 0.8,
          2 => 1.1,
          _ => 1.4,
        }
        ..color = switch (k.abs()) {
          0 => palette.ink.withValues(alpha: 0.75),
          1 => palette.line,
          2 => palette.amber.withValues(alpha: 0.8),
          _ => palette.danger.withValues(alpha: 0.85),
        };
      if (k.abs() == 1 || k.abs() == 2) {
        _dashed(
          canvas,
          Offset(plot.left, y),
          Offset(plot.right, y),
          paint,
          dash: k.abs() == 1 ? 3 : 6,
        );
      } else {
        canvas.drawLine(Offset(plot.left, y), Offset(plot.right, y), paint);
      }
      final t = labels[k]!;
      t.paint(canvas, Offset(gutter - t.width - 6, y - t.height / 2));
    }

    if (points.isEmpty || !(sd > 0)) return;
    final n = points.length;
    final step = n == 1 ? 0.0 : (plot.width - 16) / (n - 1);
    Offset at(int i) => Offset(
      n == 1 ? plot.center.dx : plot.left + 8 + i * step,
      yOf((points[i].value - mean) / sd),
    );

    final line = Paint()
      ..color = palette.brand.withValues(alpha: 0.55)
      ..strokeWidth = 1.4
      ..style = PaintingStyle.stroke;
    final path = Path()..moveTo(at(0).dx, at(0).dy);
    for (var i = 1; i < n; i++) {
      path.lineTo(at(i).dx, at(i).dy);
    }
    canvas.drawPath(path, line);

    for (var i = 0; i < n; i++) {
      final c = at(i);
      final z = (points[i].value - mean) / sd;
      final mark = points[i].mark;
      final fill = Paint()
        ..color = switch (mark) {
          LjMark.ok => palette.brand,
          LjMark.warning => palette.amber,
          LjMark.reject => palette.danger,
        };
      final ring = Paint()
        ..color = palette.paper
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5;
      switch (mark) {
        case LjMark.ok:
          canvas
            ..drawCircle(c, 4.2, fill)
            ..drawCircle(c, 4.2, ring);
        case LjMark.warning:
          final tri = Path()
            ..moveTo(c.dx, c.dy - 6)
            ..lineTo(c.dx + 5.5, c.dy + 4.5)
            ..lineTo(c.dx - 5.5, c.dy + 4.5)
            ..close();
          canvas
            ..drawPath(tri, fill)
            ..drawPath(tri, ring);
        case LjMark.reject:
          final sq = Rect.fromCenter(center: c, width: 10, height: 10);
          canvas
            ..drawRect(sq, fill)
            ..drawRect(sq, ring);
      }
      // ±4 SD dan tashqarida — chetga strelka.
      if (z.abs() > _range) {
        final dir = z > 0 ? -1.0 : 1.0;
        final tip = Offset(c.dx, c.dy + dir * 12);
        canvas.drawLine(
          c + Offset(0, dir * 6),
          tip,
          Paint()
            ..color = fill.color
            ..strokeWidth = 1.6,
        );
      }
    }
  }

  void _dashed(
    Canvas canvas,
    Offset a,
    Offset b,
    Paint paint, {
    required double dash,
  }) {
    var x = a.dx;
    while (x < b.dx) {
      final end = math.min(x + dash, b.dx);
      canvas.drawLine(Offset(x, a.dy), Offset(end, b.dy), paint);
      x += dash * 2;
    }
  }

  @override
  bool shouldRepaint(_LjPainter old) =>
      old.mean != mean ||
      old.sd != sd ||
      old.points != points ||
      old.palette != palette ||
      old.labelStyle != labelStyle;
}
