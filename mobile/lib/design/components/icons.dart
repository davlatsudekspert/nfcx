import 'package:flutter/widgets.dart';
import '../tokens.dart';

/// Ikonkalar — 24×24 viewBox, 1.65 chiziq, yumaloq uchlar.
///
/// NIMA UCHUN O'Z TO'PLAMI: Material ikonkalari boshqa og'irlikda
/// (to'ldirilgan, qalinroq) va bu dizaynda ular begona ko'rinadi.
/// Handoff aniq aytadi: kodbazaning ikonka to'plamini faqat OG'IRLIGI
/// mos kelsa ishlating.
enum Ico {
  home, search, nfc, user, qr, share, phone, chart, chevronRight, chevronLeft,
  plus, check, close, heart, eye, bell, settings, gift, card, bag, star, image,
  telegram, edit, logout, globe, clock, pin, refresh, camera, arrowUp,
}

class NIcon extends StatelessWidget {
  const NIcon(this.icon, {super.key, this.size = 24, this.color = C.offWhite, this.filled = false});

  final Ico icon;
  final double size;
  final Color color;

  /// Faol nav tabi uchun — ichi to'ldiriladi.
  final bool filled;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: size, height: size,
        child: CustomPaint(painter: _IconPainter(icon, color, filled)),
      );
}

class _IconPainter extends CustomPainter {
  _IconPainter(this.icon, this.color, this.filled);
  final Ico icon;
  final Color color;
  final bool filled;

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.width / 24;
    canvas.scale(k);
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.65
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final fill = Paint()..color = color;
    final p = Path();

    switch (icon) {
      case Ico.home:
        p.moveTo(3.5, 10); p.lineTo(12, 3.5); p.lineTo(20.5, 10);
        p.lineTo(20.5, 20); p.lineTo(3.5, 20); p.close();
        if (filled) { canvas.drawPath(p, fill); } else { canvas.drawPath(p, stroke); }
        return;
      case Ico.search:
        canvas.drawCircle(const Offset(10.5, 10.5), 6.5, stroke);
        canvas.drawLine(const Offset(15.3, 15.3), const Offset(20.5, 20.5), stroke);
        return;
      case Ico.nfc:
        // Markaziy nuqta + uchta kengayuvchi yoy — "to'lqin".
        canvas.drawCircle(const Offset(7, 12), 1.9, fill);
        for (var i = 0; i < 3; i++) {
          canvas.drawArc(
            Rect.fromCircle(center: const Offset(7, 12), radius: 4.4 + i * 3.6),
            -0.95, 1.9, false, stroke,
          );
        }
        return;
      case Ico.user:
        canvas.drawCircle(const Offset(12, 8.6), 3.9, filled ? fill : stroke);
        p.moveTo(4.8, 20.2); p.cubicTo(4.8, 16, 8, 14.2, 12, 14.2);
        p.cubicTo(16, 14.2, 19.2, 16, 19.2, 20.2);
        canvas.drawPath(p, filled ? fill : stroke);
        return;
      case Ico.qr:
        for (final o in [const Offset(4, 4), const Offset(14, 4), const Offset(4, 14)]) {
          canvas.drawRRect(
            RRect.fromRectAndRadius(Rect.fromLTWH(o.dx, o.dy, 6, 6), const Radius.circular(1.5)),
            stroke,
          );
        }
        canvas.drawRect(const Rect.fromLTWH(14, 14, 2.6, 2.6), fill);
        canvas.drawRect(const Rect.fromLTWH(17.6, 17.6, 2.6, 2.6), fill);
        return;
      case Ico.share:
        canvas.drawCircle(const Offset(17.5, 6), 2.6, stroke);
        canvas.drawCircle(const Offset(17.5, 18), 2.6, stroke);
        canvas.drawCircle(const Offset(6.5, 12), 2.6, stroke);
        canvas.drawLine(const Offset(8.8, 10.8), const Offset(15.2, 7.2), stroke);
        canvas.drawLine(const Offset(8.8, 13.2), const Offset(15.2, 16.8), stroke);
        return;
      case Ico.phone:
        p.moveTo(5.2, 4.4); p.lineTo(9, 4.4); p.lineTo(10.6, 8.6); p.lineTo(8.4, 10.4);
        p.cubicTo(9.6, 13, 11, 14.4, 13.6, 15.6); p.lineTo(15.4, 13.4);
        p.lineTo(19.6, 15); p.lineTo(19.6, 18.8);
        p.cubicTo(12, 19.6, 4.4, 12, 5.2, 4.4);
        canvas.drawPath(p, stroke);
        return;
      case Ico.chart:
        canvas.drawLine(const Offset(4, 20), const Offset(20, 20), stroke);
        for (final b in [[6.5, 13.0], [11.0, 8.5], [15.5, 11.0], [19.0, 5.5]]) {
          canvas.drawLine(Offset(b[0], 20), Offset(b[0], b[1]), stroke);
        }
        return;
      case Ico.chevronRight:
        p.moveTo(9.5, 5); p.lineTo(16, 12); p.lineTo(9.5, 19);
        canvas.drawPath(p, stroke);
        return;
      case Ico.chevronLeft:
        p.moveTo(14.5, 5); p.lineTo(8, 12); p.lineTo(14.5, 19);
        canvas.drawPath(p, stroke);
        return;
      case Ico.arrowUp:
        canvas.drawLine(const Offset(12, 19), const Offset(12, 5.5), stroke);
        p.moveTo(6.5, 11); p.lineTo(12, 5.5); p.lineTo(17.5, 11);
        canvas.drawPath(p, stroke);
        return;
      case Ico.plus:
        canvas.drawLine(const Offset(12, 5), const Offset(12, 19), stroke);
        canvas.drawLine(const Offset(5, 12), const Offset(19, 12), stroke);
        return;
      case Ico.check:
        p.moveTo(5, 12.8); p.lineTo(9.8, 17.5); p.lineTo(19, 6.8);
        canvas.drawPath(p, stroke);
        return;
      case Ico.close:
        canvas.drawLine(const Offset(6, 6), const Offset(18, 18), stroke);
        canvas.drawLine(const Offset(18, 6), const Offset(6, 18), stroke);
        return;
      case Ico.heart:
        p.moveTo(12, 19.6);
        p.cubicTo(3.4, 14.4, 3.4, 8.4, 7.4, 6.4);
        p.cubicTo(9.8, 5.2, 11.4, 6.6, 12, 8);
        p.cubicTo(12.6, 6.6, 14.2, 5.2, 16.6, 6.4);
        p.cubicTo(20.6, 8.4, 20.6, 14.4, 12, 19.6);
        p.close();
        canvas.drawPath(p, filled ? fill : stroke);
        return;
      case Ico.eye:
        p.moveTo(2.6, 12); p.cubicTo(6, 6.6, 18, 6.6, 21.4, 12);
        p.cubicTo(18, 17.4, 6, 17.4, 2.6, 12);
        canvas.drawPath(p, stroke);
        canvas.drawCircle(const Offset(12, 12), 3, stroke);
        return;
      case Ico.bell:
        p.moveTo(6, 17); p.lineTo(6, 11);
        p.cubicTo(6, 7.4, 8.6, 5, 12, 5);
        p.cubicTo(15.4, 5, 18, 7.4, 18, 11); p.lineTo(18, 17); p.close();
        canvas.drawPath(p, stroke);
        canvas.drawLine(const Offset(4.4, 17), const Offset(19.6, 17), stroke);
        canvas.drawArc(Rect.fromCircle(center: const Offset(12, 18.4), radius: 2.2), 0, 3.14, false, stroke);
        return;
      case Ico.settings:
        canvas.drawCircle(const Offset(12, 12), 3.2, stroke);
        canvas.drawCircle(const Offset(12, 12), 7.6, stroke);
        return;
      case Ico.gift:
        canvas.drawRect(const Rect.fromLTWH(4, 9.5, 16, 10.5), stroke);
        canvas.drawRect(const Rect.fromLTWH(3, 6, 18, 3.5), stroke);
        canvas.drawLine(const Offset(12, 6), const Offset(12, 20), stroke);
        canvas.drawArc(Rect.fromCircle(center: const Offset(9.4, 5), radius: 2.6), 0, 3.14, false, stroke);
        canvas.drawArc(Rect.fromCircle(center: const Offset(14.6, 5), radius: 2.6), 0, 3.14, false, stroke);
        return;
      case Ico.card:
        canvas.drawRRect(
          RRect.fromRectAndRadius(const Rect.fromLTWH(3, 5.5, 18, 13), const Radius.circular(2.4)),
          stroke,
        );
        canvas.drawLine(const Offset(3, 10), const Offset(21, 10), stroke);
        return;
      case Ico.bag:
        p.moveTo(5, 8); p.lineTo(19, 8); p.lineTo(20, 20); p.lineTo(4, 20); p.close();
        canvas.drawPath(p, stroke);
        canvas.drawArc(Rect.fromCircle(center: const Offset(12, 8), radius: 3.6), 3.14, 3.14, false, stroke);
        return;
      case Ico.star:
        p.moveTo(12, 4); p.lineTo(14.6, 9.6); p.lineTo(20.6, 10.4);
        p.lineTo(16.2, 14.6); p.lineTo(17.3, 20.5); p.lineTo(12, 17.6);
        p.lineTo(6.7, 20.5); p.lineTo(7.8, 14.6); p.lineTo(3.4, 10.4);
        p.lineTo(9.4, 9.6); p.close();
        canvas.drawPath(p, filled ? fill : stroke);
        return;
      case Ico.image:
        canvas.drawRRect(
          RRect.fromRectAndRadius(const Rect.fromLTWH(3.5, 5, 17, 14), const Radius.circular(2.4)),
          stroke,
        );
        canvas.drawCircle(const Offset(9, 10), 1.8, stroke);
        p.moveTo(5, 17.5); p.lineTo(10.5, 12.5); p.lineTo(19, 19);
        canvas.drawPath(p, stroke);
        return;
      case Ico.camera:
        canvas.drawRRect(
          RRect.fromRectAndRadius(const Rect.fromLTWH(3, 7.5, 18, 12), const Radius.circular(2.6)),
          stroke,
        );
        canvas.drawCircle(const Offset(12, 13.5), 3.6, stroke);
        canvas.drawLine(const Offset(8.5, 7.5), const Offset(10, 5), stroke);
        return;
      case Ico.telegram:
        p.moveTo(3.4, 11.6); p.lineTo(20.4, 4.8); p.lineTo(17.4, 19.4);
        p.lineTo(11.6, 15.2); p.lineTo(9.4, 19.4); p.lineTo(9.4, 14.6);
        p.lineTo(18.2, 7.4); p.lineTo(8, 13.4); p.close();
        canvas.drawPath(p, filled ? fill : stroke);
        return;
      case Ico.edit:
        p.moveTo(4.5, 19.5); p.lineTo(5.3, 15.4); p.lineTo(16.2, 4.5);
        p.lineTo(19.5, 7.8); p.lineTo(8.6, 18.7); p.close();
        canvas.drawPath(p, stroke);
        return;
      case Ico.logout:
        p.moveTo(14, 5); p.lineTo(5.5, 5); p.lineTo(5.5, 19); p.lineTo(14, 19);
        canvas.drawPath(p, stroke);
        canvas.drawLine(const Offset(10.5, 12), const Offset(20, 12), stroke);
        p.reset(); p.moveTo(16.5, 8.4); p.lineTo(20.2, 12); p.lineTo(16.5, 15.6);
        canvas.drawPath(p, stroke);
        return;
      case Ico.globe:
        canvas.drawCircle(const Offset(12, 12), 8, stroke);
        canvas.drawLine(const Offset(4, 12), const Offset(20, 12), stroke);
        canvas.drawOval(const Rect.fromLTWH(7.6, 4, 8.8, 16), stroke);
        return;
      case Ico.clock:
        canvas.drawCircle(const Offset(12, 12), 8, stroke);
        p.moveTo(12, 7.4); p.lineTo(12, 12.4); p.lineTo(15.6, 14.2);
        canvas.drawPath(p, stroke);
        return;
      case Ico.pin:
        p.moveTo(12, 21); p.cubicTo(6, 14.6, 4.8, 12, 4.8, 9.6);
        p.cubicTo(4.8, 5.8, 8, 3, 12, 3);
        p.cubicTo(16, 3, 19.2, 5.8, 19.2, 9.6);
        p.cubicTo(19.2, 12, 18, 14.6, 12, 21); p.close();
        canvas.drawPath(p, stroke);
        canvas.drawCircle(const Offset(12, 9.6), 2.6, stroke);
        return;
      case Ico.refresh:
        canvas.drawArc(Rect.fromCircle(center: const Offset(12, 12), radius: 7.4), -1.2, 4.6, false, stroke);
        p.moveTo(15.4, 2.6); p.lineTo(17.6, 6.4); p.lineTo(13.4, 6.6);
        canvas.drawPath(p, stroke);
        return;
    }
  }

  @override
  bool shouldRepaint(_IconPainter old) =>
      old.icon != icon || old.color != color || old.filled != filled;
}
