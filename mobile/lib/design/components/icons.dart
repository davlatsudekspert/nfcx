import 'package:flutter/widgets.dart';

import '../tokens.dart';

/// IKONKALAR — 24×24, 1.5 dp chiziq, yumaloq uchlar.
///
/// NIMA UCHUN O'Z TO'PLAMI: Material ikonkalari boshqa og'irlikda
/// (qalinroq, to'ldirilgan) va bu dizaynda begona ko'rinadi. Dizayn
/// aniq talab qiladi: "bitta uslub, ingichka chiziqli (1.5px),
/// oltin holatda to'ldirilgan".
///
/// `filled` — faol holat (nav tabi, bosilgan layk). Faqat shakli
/// yopiq ikonkalarda ma'noga ega.
enum Ico {
  // Navigatsiya
  home, search, nfc, user, users, play,
  chevronRight, chevronLeft, chevronDown, chevronUp,
  arrowRight, arrowUp, arrowDown, back,
  // Amal
  plus, minus, check, close, more, edit, trash, refresh, send, reply,
  copy, link, share, download, filter, sort, grid, menu,
  // NFC va ID
  qr, scan, write, card, wallet, gift, key,
  // Kontent
  heart, comment, eye, image, video, camera, music, text, sticker, mic,
  // Aloqa
  phone, mail, telegram, instagram, whatsapp, globe, pin, truck,
  // Holat va tizim
  bell, settings, clock, calendar, lock, unlock, fingerprint, faceId,
  pattern, shield, doc, info, warning, ban, star, chart, bag, building,
  logout, backspace, palette, language, help, sparkle, moon,
}

class NIcon extends StatelessWidget {
  const NIcon(
    this.icon, {
    super.key,
    this.size = 24,
    this.color,
    this.filled = false,
  });

  final Ico icon;
  final double size;

  /// RANG IXTIYORIY. Berilmasa mavzuning asosiy matn rangi
  /// ishlatiladi — u `const` bo'la olmaydi (yorug' va to'q
  /// mavzuda boshqa-boshqa), shuning uchun standart qiymat shu
  /// yerda, konstruktorda emas, hal qilinadi.
  final Color? color;
  final bool filled;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: CustomPaint(painter: _IconPainter(icon, color ?? C.ink, filled)),
      );
}

class _IconPainter extends CustomPainter {
  _IconPainter(this.icon, this.color, this.filled);

  final Ico icon;
  final Color color;
  final bool filled;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 24);

    final s = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final f = Paint()..color = color;
    final p = Path();

    // Yopiq shakl: `filled` bo'lsa to'ldiriladi, aks holda chiziq.
    Paint body() => filled ? f : s;

    switch (icon) {
      // ── Navigatsiya ─────────────────────────────────────────
      case Ico.home:
        p.moveTo(3.6, 10.2);
        p.lineTo(12, 3.6);
        p.lineTo(20.4, 10.2);
        p.lineTo(20.4, 19.8);
        p.lineTo(3.6, 19.8);
        p.close();
        canvas.drawPath(p, body());
        if (!filled) {
          canvas.drawLine(const Offset(9.6, 19.8), const Offset(9.6, 14.2), s);
          canvas.drawLine(const Offset(14.4, 19.8), const Offset(14.4, 14.2), s);
          canvas.drawLine(const Offset(9.6, 14.2), const Offset(14.4, 14.2), s);
        }
        return;

      case Ico.search:
        canvas.drawCircle(const Offset(10.6, 10.6), 6.4, s);
        canvas.drawLine(const Offset(15.4, 15.4), const Offset(20.4, 20.4), s);
        return;

      // NFC — markaziy nuqta va uchta tarqaluvchi yoy.
      case Ico.nfc:
        canvas.drawCircle(const Offset(7.2, 12), 1.8, f);
        for (var i = 0; i < 3; i++) {
          canvas.drawArc(
            Rect.fromCircle(center: const Offset(7.2, 12), radius: 4.3 + i * 3.5),
            -.95,
            1.9,
            false,
            s,
          );
        }
        return;

      case Ico.user:
        canvas.drawCircle(const Offset(12, 8.4), 3.8, body());
        p.moveTo(4.9, 20.2);
        p.cubicTo(4.9, 16, 8.1, 14.2, 12, 14.2);
        p.cubicTo(15.9, 14.2, 19.1, 16, 19.1, 20.2);
        canvas.drawPath(p, body());
        return;

      case Ico.users:
        canvas.drawCircle(const Offset(9.4, 8.6), 3.4, s);
        p.moveTo(3.4, 19.6);
        p.cubicTo(3.4, 15.9, 6.1, 14.2, 9.4, 14.2);
        p.cubicTo(12.7, 14.2, 15.4, 15.9, 15.4, 19.6);
        canvas.drawPath(p, s);
        canvas.drawArc(
          Rect.fromCircle(center: const Offset(16.6, 8.6), radius: 3),
          -1.3,
          2.7,
          false,
          s,
        );
        p.reset();
        p.moveTo(17.4, 14.4);
        p.cubicTo(19.6, 14.9, 21, 16.5, 21, 19.2);
        canvas.drawPath(p, s);
        return;

      case Ico.play:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3.4, 3.4, 17.2, 17.2),
            const Radius.circular(4.6),
          ),
          s,
        );
        p.moveTo(10, 8.6);
        p.lineTo(16, 12);
        p.lineTo(10, 15.4);
        p.close();
        canvas.drawPath(p, filled ? f : s);
        return;

      case Ico.chevronRight:
        p.moveTo(9.6, 5.2);
        p.lineTo(16, 12);
        p.lineTo(9.6, 18.8);
        canvas.drawPath(p, s);
        return;

      case Ico.chevronLeft:
      case Ico.back:
        p.moveTo(14.4, 5.2);
        p.lineTo(8, 12);
        p.lineTo(14.4, 18.8);
        canvas.drawPath(p, s);
        return;

      case Ico.chevronDown:
        p.moveTo(5.2, 9.6);
        p.lineTo(12, 16);
        p.lineTo(18.8, 9.6);
        canvas.drawPath(p, s);
        return;

      case Ico.chevronUp:
        p.moveTo(5.2, 14.4);
        p.lineTo(12, 8);
        p.lineTo(18.8, 14.4);
        canvas.drawPath(p, s);
        return;

      case Ico.arrowRight:
        canvas.drawLine(const Offset(4.5, 12), const Offset(19, 12), s);
        p.moveTo(13.5, 6.5);
        p.lineTo(19, 12);
        p.lineTo(13.5, 17.5);
        canvas.drawPath(p, s);
        return;

      case Ico.arrowUp:
        canvas.drawLine(const Offset(12, 19), const Offset(12, 5.4), s);
        p.moveTo(6.6, 10.8);
        p.lineTo(12, 5.4);
        p.lineTo(17.4, 10.8);
        canvas.drawPath(p, s);
        return;

      case Ico.arrowDown:
        canvas.drawLine(const Offset(12, 5), const Offset(12, 18.6), s);
        p.moveTo(6.6, 13.2);
        p.lineTo(12, 18.6);
        p.lineTo(17.4, 13.2);
        canvas.drawPath(p, s);
        return;

      // ── Amal ────────────────────────────────────────────────
      case Ico.plus:
        canvas.drawLine(const Offset(12, 5), const Offset(12, 19), s);
        canvas.drawLine(const Offset(5, 12), const Offset(19, 12), s);
        return;

      case Ico.minus:
        canvas.drawLine(const Offset(5, 12), const Offset(19, 12), s);
        return;

      case Ico.check:
        p.moveTo(5, 12.8);
        p.lineTo(9.8, 17.4);
        p.lineTo(19, 6.8);
        canvas.drawPath(p, s);
        return;

      case Ico.close:
        canvas.drawLine(const Offset(6.2, 6.2), const Offset(17.8, 17.8), s);
        canvas.drawLine(const Offset(17.8, 6.2), const Offset(6.2, 17.8), s);
        return;

      // Uchta nuqta — "yana amallar". Shikoyat shu menyu ichida
      // (Google Play talabi), bayroq ikonkasi ekranda yo'q.
      case Ico.more:
        for (final dy in [-5.4, 0.0, 5.4]) {
          canvas.drawCircle(Offset(12, 12 + dy), 1.55, f);
        }
        return;

      case Ico.menu:
        for (final dy in [-5.0, 0.0, 5.0]) {
          canvas.drawLine(Offset(4.5, 12 + dy), Offset(19.5, 12 + dy), s);
        }
        return;

      case Ico.edit:
        p.moveTo(4.6, 19.4);
        p.lineTo(5.4, 15.4);
        p.lineTo(16.1, 4.7);
        p.lineTo(19.3, 7.9);
        p.lineTo(8.6, 18.6);
        p.close();
        canvas.drawPath(p, s);
        canvas.drawLine(const Offset(14.1, 6.7), const Offset(17.3, 9.9), s);
        return;

      case Ico.trash:
        canvas.drawLine(const Offset(4, 6.6), const Offset(20, 6.6), s);
        p.moveTo(9.5, 6.6);
        p.lineTo(9.5, 4.3);
        p.lineTo(14.5, 4.3);
        p.lineTo(14.5, 6.6);
        canvas.drawPath(p, s);
        final bin = Path()
          ..moveTo(6.1, 6.6)
          ..lineTo(7.2, 19.5)
          ..lineTo(16.8, 19.5)
          ..lineTo(17.9, 6.6);
        canvas.drawPath(bin, s);
        canvas.drawLine(const Offset(10.4, 9.8), const Offset(10.7, 16.3), s);
        canvas.drawLine(const Offset(13.6, 9.8), const Offset(13.3, 16.3), s);
        return;

      case Ico.refresh:
        canvas.drawArc(
          Rect.fromCircle(center: const Offset(12, 12), radius: 7.3),
          -1.15,
          4.7,
          false,
          s,
        );
        p.moveTo(15.2, 2.8);
        p.lineTo(17.6, 6.4);
        p.lineTo(13.3, 6.8);
        canvas.drawPath(p, s);
        return;

      case Ico.send:
        p.moveTo(3.6, 11.6);
        p.lineTo(20.4, 5);
        p.lineTo(13.8, 19.4);
        p.lineTo(11.4, 13.4);
        p.close();
        canvas.drawPath(p, filled ? f : s);
        canvas.drawLine(const Offset(11.4, 13.4), const Offset(20.4, 5), s);
        return;

      case Ico.reply:
        p.moveTo(9, 6.4);
        p.lineTo(3.6, 11.2);
        p.lineTo(9, 16);
        canvas.drawPath(p, s);
        p.reset();
        p.moveTo(3.6, 11.2);
        p.lineTo(14, 11.2);
        p.cubicTo(18.4, 11.2, 20.4, 13.6, 20.4, 18.6);
        canvas.drawPath(p, s);
        return;

      case Ico.copy:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(8.4, 8.4, 11.6, 11.6),
            const Radius.circular(2.6),
          ),
          s,
        );
        p.moveTo(15.6, 5.4);
        p.lineTo(6.6, 5.4);
        p.cubicTo(5.2, 5.4, 4, 6.6, 4, 8);
        p.lineTo(4, 15.6);
        canvas.drawPath(p, s);
        return;

      case Ico.link:
        canvas.drawArc(
          Rect.fromCircle(center: const Offset(8.6, 15.4), radius: 4.4),
          .8,
          3.9,
          false,
          s,
        );
        canvas.drawArc(
          Rect.fromCircle(center: const Offset(15.4, 8.6), radius: 4.4),
          -2.35,
          3.9,
          false,
          s,
        );
        canvas.drawLine(const Offset(9.4, 14.6), const Offset(14.6, 9.4), s);
        return;

      case Ico.share:
        canvas.drawCircle(const Offset(17.4, 6), 2.5, s);
        canvas.drawCircle(const Offset(17.4, 18), 2.5, s);
        canvas.drawCircle(const Offset(6.6, 12), 2.5, s);
        canvas.drawLine(const Offset(8.8, 10.9), const Offset(15.2, 7.1), s);
        canvas.drawLine(const Offset(8.8, 13.1), const Offset(15.2, 16.9), s);
        return;

      case Ico.download:
        canvas.drawLine(const Offset(12, 4), const Offset(12, 15.4), s);
        p.moveTo(7.2, 10.6);
        p.lineTo(12, 15.4);
        p.lineTo(16.8, 10.6);
        canvas.drawPath(p, s);
        p.reset();
        p.moveTo(4.6, 15);
        p.lineTo(4.6, 19.4);
        p.lineTo(19.4, 19.4);
        p.lineTo(19.4, 15);
        canvas.drawPath(p, s);
        return;

      case Ico.filter:
        p.moveTo(3.6, 5.4);
        p.lineTo(20.4, 5.4);
        p.lineTo(14.2, 12.6);
        p.lineTo(14.2, 19.2);
        p.lineTo(9.8, 16.8);
        p.lineTo(9.8, 12.6);
        p.close();
        canvas.drawPath(p, s);
        return;

      case Ico.sort:
        canvas.drawLine(const Offset(4.5, 7), const Offset(19.5, 7), s);
        canvas.drawLine(const Offset(6.5, 12), const Offset(17.5, 12), s);
        canvas.drawLine(const Offset(9.5, 17), const Offset(14.5, 17), s);
        return;

      case Ico.grid:
        for (final o in [
          const Offset(4, 4),
          const Offset(13.4, 4),
          const Offset(4, 13.4),
          const Offset(13.4, 13.4),
        ]) {
          canvas.drawRRect(
            RRect.fromRectAndRadius(
              Rect.fromLTWH(o.dx, o.dy, 6.6, 6.6),
              const Radius.circular(1.8),
            ),
            filled ? f : s,
          );
        }
        return;

      // ── NFC va ID ───────────────────────────────────────────
      case Ico.qr:
        for (final o in [
          const Offset(4, 4),
          const Offset(14, 4),
          const Offset(4, 14),
        ]) {
          canvas.drawRRect(
            RRect.fromRectAndRadius(
              Rect.fromLTWH(o.dx, o.dy, 6, 6),
              const Radius.circular(1.5),
            ),
            s,
          );
        }
        canvas.drawRect(const Rect.fromLTWH(14, 14, 2.6, 2.6), f);
        canvas.drawRect(const Rect.fromLTWH(17.4, 17.4, 2.6, 2.6), f);
        return;

      // Skanerlash — ramka burchaklari va o'rtadagi chiziq.
      case Ico.scan:
        for (final c in [
          [4.0, 8.4, 4.0, 4.0, 8.4, 4.0],
          [15.6, 4.0, 20.0, 4.0, 20.0, 8.4],
          [20.0, 15.6, 20.0, 20.0, 15.6, 20.0],
          [8.4, 20.0, 4.0, 20.0, 4.0, 15.6],
        ]) {
          final corner = Path()
            ..moveTo(c[0], c[1])
            ..lineTo(c[2], c[3])
            ..lineTo(c[4], c[5]);
          canvas.drawPath(corner, s);
        }
        canvas.drawLine(const Offset(6.4, 12), const Offset(17.6, 12), s);
        return;

      // Kartaga yozish — karta + qalam uchi.
      case Ico.write:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3, 6, 14.4, 11),
            const Radius.circular(2.4),
          ),
          s,
        );
        canvas.drawLine(const Offset(3, 9.6), const Offset(17.4, 9.6), s);
        p.moveTo(13.6, 20.4);
        p.lineTo(14.2, 17.6);
        p.lineTo(20, 11.8);
        p.lineTo(21.8, 13.6);
        p.lineTo(16, 19.4);
        p.close();
        canvas.drawPath(p, f);
        return;

      case Ico.card:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3, 5.6, 18, 12.8),
            const Radius.circular(2.6),
          ),
          s,
        );
        canvas.drawLine(const Offset(3, 10), const Offset(21, 10), s);
        canvas.drawLine(const Offset(6.4, 14.4), const Offset(11, 14.4), s);
        return;

      case Ico.wallet:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3.2, 6, 17.6, 13),
            const Radius.circular(3),
          ),
          s,
        );
        canvas.drawLine(const Offset(3.2, 10.4), const Offset(20.8, 10.4), s);
        canvas.drawCircle(const Offset(16.6, 14.8), 1.4, f);
        return;

      case Ico.gift:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(4.2, 9.6, 15.6, 10.2),
            const Radius.circular(1.8),
          ),
          s,
        );
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3, 6.2, 18, 3.4),
            const Radius.circular(1.4),
          ),
          s,
        );
        canvas.drawLine(const Offset(12, 6.2), const Offset(12, 19.8), s);
        canvas.drawArc(
          Rect.fromCircle(center: const Offset(9.4, 5), radius: 2.6),
          0,
          3.14159,
          false,
          s,
        );
        canvas.drawArc(
          Rect.fromCircle(center: const Offset(14.6, 5), radius: 2.6),
          0,
          3.14159,
          false,
          s,
        );
        return;

      case Ico.key:
        canvas.drawCircle(const Offset(8.2, 15.8), 4.2, s);
        canvas.drawLine(const Offset(11.2, 12.8), const Offset(19.6, 4.4), s);
        canvas.drawLine(const Offset(16.6, 7.4), const Offset(18.6, 9.4), s);
        canvas.drawLine(const Offset(14.4, 9.6), const Offset(16.2, 11.4), s);
        return;

      // ── Kontent ─────────────────────────────────────────────
      case Ico.heart:
        p.moveTo(12, 19.6);
        p.cubicTo(3.4, 14.4, 3.4, 8.4, 7.4, 6.4);
        p.cubicTo(9.8, 5.2, 11.4, 6.6, 12, 8);
        p.cubicTo(12.6, 6.6, 14.2, 5.2, 16.6, 6.4);
        p.cubicTo(20.6, 8.4, 20.6, 14.4, 12, 19.6);
        p.close();
        canvas.drawPath(p, body());
        return;

      // IZOH — gap pufagi.
      //
      // `reply` (strelka) IZOH uchun ishlatilmaydi: strelka
      // "javob berish" degani va lentada u yoqtirish yuragining
      // yonida chalkashtiradi. Pufak esa hamma ilovada bir xil
      // ma'noni bildiradi — "bu yerda yozishmalar bor".
      case Ico.comment:
        p.moveTo(4.4, 9.2);
        p.cubicTo(4.4, 6.1, 6.6, 4.4, 12, 4.4);
        p.cubicTo(17.4, 4.4, 19.6, 6.1, 19.6, 9.2);
        p.cubicTo(19.6, 12.3, 17.4, 14.6, 12, 14.6);
        p.lineTo(8.8, 14.6);
        p.lineTo(5.6, 18.4);
        p.lineTo(5.6, 14.1);
        p.cubicTo(4.8, 13.2, 4.4, 11.4, 4.4, 9.2);
        p.close();
        canvas.drawPath(p, body());
        return;

      case Ico.eye:
        p.moveTo(2.8, 12);
        p.cubicTo(6.2, 6.8, 17.8, 6.8, 21.2, 12);
        p.cubicTo(17.8, 17.2, 6.2, 17.2, 2.8, 12);
        canvas.drawPath(p, s);
        canvas.drawCircle(const Offset(12, 12), 2.9, filled ? f : s);
        return;

      case Ico.image:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3.4, 5, 17.2, 14),
            const Radius.circular(2.6),
          ),
          s,
        );
        canvas.drawCircle(const Offset(8.8, 10), 1.7, s);
        p.moveTo(5, 17.4);
        p.lineTo(10.4, 12.4);
        p.lineTo(19, 19);
        canvas.drawPath(p, s);
        return;

      case Ico.video:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3, 6.4, 13.4, 11.2),
            const Radius.circular(2.6),
          ),
          s,
        );
        p.moveTo(16.4, 10.6);
        p.lineTo(21, 7.8);
        p.lineTo(21, 16.2);
        p.lineTo(16.4, 13.4);
        p.close();
        canvas.drawPath(p, s);
        return;

      case Ico.camera:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3, 7.4, 18, 12),
            const Radius.circular(2.8),
          ),
          s,
        );
        canvas.drawCircle(const Offset(12, 13.4), 3.5, s);
        p.moveTo(8.4, 7.4);
        p.lineTo(9.8, 4.8);
        p.lineTo(14.2, 4.8);
        p.lineTo(15.6, 7.4);
        canvas.drawPath(p, s);
        return;

      case Ico.music:
        canvas.drawCircle(const Offset(7.4, 17.4), 2.8, s);
        canvas.drawCircle(const Offset(17.6, 15.4), 2.8, s);
        canvas.drawLine(const Offset(10.2, 17.4), const Offset(10.2, 7), s);
        canvas.drawLine(const Offset(20.4, 15.4), const Offset(20.4, 5), s);
        p.moveTo(10.2, 7);
        p.lineTo(20.4, 5);
        canvas.drawPath(p, s);
        return;

      case Ico.text:
        canvas.drawLine(const Offset(5, 6.4), const Offset(19, 6.4), s);
        canvas.drawLine(const Offset(12, 6.4), const Offset(12, 18.6), s);
        canvas.drawLine(const Offset(8.6, 18.6), const Offset(15.4, 18.6), s);
        return;

      case Ico.sticker:
        p.moveTo(14, 3.6);
        p.cubicTo(19, 4.4, 20.4, 8, 20.4, 11.4);
        p.lineTo(13.4, 20.4);
        p.cubicTo(7, 20.4, 3.6, 16.6, 3.6, 12);
        p.cubicTo(3.6, 6.6, 8.2, 3.2, 14, 3.6);
        p.close();
        canvas.drawPath(p, s);
        p.reset();
        p.moveTo(20.4, 11.4);
        p.lineTo(14.4, 11.8);
        p.lineTo(13.4, 20.4);
        canvas.drawPath(p, s);
        return;

      case Ico.mic:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(9.2, 3.4, 5.6, 11),
            const Radius.circular(2.8),
          ),
          s,
        );
        canvas.drawArc(
          Rect.fromCircle(center: const Offset(12, 12.6), radius: 5.6),
          0,
          3.14159,
          false,
          s,
        );
        canvas.drawLine(const Offset(12, 18.2), const Offset(12, 20.6), s);
        return;

      // ── Aloqa ───────────────────────────────────────────────
      case Ico.phone:
        p.moveTo(5.2, 4.6);
        p.lineTo(9, 4.6);
        p.lineTo(10.6, 8.6);
        p.lineTo(8.4, 10.4);
        p.cubicTo(9.6, 13, 11, 14.4, 13.6, 15.6);
        p.lineTo(15.4, 13.4);
        p.lineTo(19.4, 15);
        p.lineTo(19.4, 18.8);
        p.cubicTo(12, 19.6, 4.4, 12, 5.2, 4.6);
        canvas.drawPath(p, body());
        return;

      case Ico.mail:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3, 5.6, 18, 12.8),
            const Radius.circular(2.6),
          ),
          s,
        );
        p.moveTo(3.8, 7);
        p.lineTo(12, 13);
        p.lineTo(20.2, 7);
        canvas.drawPath(p, s);
        return;

      case Ico.telegram:
        p.moveTo(3.4, 11.6);
        p.lineTo(20.4, 4.8);
        p.lineTo(17.4, 19.4);
        p.lineTo(11.6, 15.2);
        p.lineTo(9.4, 19.4);
        p.lineTo(9.4, 14.6);
        p.lineTo(18.2, 7.4);
        p.lineTo(8, 13.4);
        p.close();
        canvas.drawPath(p, body());
        return;

      case Ico.instagram:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3.8, 3.8, 16.4, 16.4),
            const Radius.circular(5),
          ),
          s,
        );
        canvas.drawCircle(const Offset(12, 12), 4.1, s);
        canvas.drawCircle(const Offset(16.8, 7.2), 1.2, f);
        return;

      case Ico.whatsapp:
        p.moveTo(4.2, 20.2);
        p.lineTo(5.6, 15.8);
        p.cubicTo(3.2, 11.8, 4.8, 6.4, 9.4, 4.6);
        p.cubicTo(14.4, 2.7, 19.8, 6.2, 19.8, 11.6);
        p.cubicTo(19.8, 17, 14.2, 20.6, 8.9, 18.6);
        p.close();
        canvas.drawPath(p, s);
        canvas.drawCircle(const Offset(12, 11.8), 2.4, f);
        return;

      case Ico.globe:
        canvas.drawCircle(const Offset(12, 12), 8, s);
        canvas.drawLine(const Offset(4, 12), const Offset(20, 12), s);
        canvas.drawOval(const Rect.fromLTWH(7.6, 4, 8.8, 16), s);
        return;

      case Ico.pin:
        p.moveTo(12, 20.8);
        p.cubicTo(6.2, 14.6, 5, 12, 5, 9.6);
        p.cubicTo(5, 5.9, 8.1, 3.2, 12, 3.2);
        p.cubicTo(15.9, 3.2, 19, 5.9, 19, 9.6);
        p.cubicTo(19, 12, 17.8, 14.6, 12, 20.8);
        p.close();
        canvas.drawPath(p, s);
        canvas.drawCircle(const Offset(12, 9.6), 2.5, s);
        return;

      case Ico.truck:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(2.6, 7, 11.4, 9),
            const Radius.circular(1.8),
          ),
          s,
        );
        p.moveTo(14, 10);
        p.lineTo(17.8, 10);
        p.lineTo(21.4, 13.4);
        p.lineTo(21.4, 16);
        p.lineTo(14, 16);
        p.close();
        canvas.drawPath(p, s);
        canvas.drawCircle(const Offset(7.4, 18), 1.9, s);
        canvas.drawCircle(const Offset(17.4, 18), 1.9, s);
        return;

      // ── Holat va tizim ──────────────────────────────────────
      case Ico.bell:
        p.moveTo(6.2, 16.8);
        p.lineTo(6.2, 11);
        p.cubicTo(6.2, 7.5, 8.8, 5.1, 12, 5.1);
        p.cubicTo(15.2, 5.1, 17.8, 7.5, 17.8, 11);
        p.lineTo(17.8, 16.8);
        p.close();
        canvas.drawPath(p, body());
        canvas.drawLine(const Offset(4.5, 16.8), const Offset(19.5, 16.8), s);
        canvas.drawArc(
          Rect.fromCircle(center: const Offset(12, 18.2), radius: 2.1),
          0,
          3.14159,
          false,
          s,
        );
        return;

      case Ico.settings:
        canvas.drawCircle(const Offset(12, 12), 3.1, s);
        canvas.drawCircle(const Offset(12, 12), 7.5, s);
        canvas.drawLine(const Offset(12, 4.5), const Offset(12, 2.6), s);
        canvas.drawLine(const Offset(12, 19.5), const Offset(12, 21.4), s);
        return;

      case Ico.clock:
        canvas.drawCircle(const Offset(12, 12), 8, s);
        p.moveTo(12, 7.2);
        p.lineTo(12, 12.4);
        p.lineTo(15.8, 14.2);
        canvas.drawPath(p, s);
        return;

      case Ico.calendar:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3.6, 5.4, 16.8, 15),
            const Radius.circular(2.6),
          ),
          s,
        );
        canvas.drawLine(const Offset(3.6, 10), const Offset(20.4, 10), s);
        canvas.drawLine(const Offset(8.2, 3.4), const Offset(8.2, 7), s);
        canvas.drawLine(const Offset(15.8, 3.4), const Offset(15.8, 7), s);
        return;

      case Ico.lock:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(4.6, 10.4, 14.8, 9.6),
            const Radius.circular(2.4),
          ),
          s,
        );
        canvas.drawArc(
          Rect.fromCircle(center: const Offset(12, 10.4), radius: 4.1),
          3.14159,
          3.14159,
          false,
          s,
        );
        canvas.drawCircle(const Offset(12, 15.1), 1.3, f);
        return;

      case Ico.unlock:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(4.6, 10.4, 14.8, 9.6),
            const Radius.circular(2.4),
          ),
          s,
        );
        canvas.drawArc(
          Rect.fromCircle(center: const Offset(16.4, 10.4), radius: 4.1),
          3.14159,
          2.2,
          false,
          s,
        );
        canvas.drawCircle(const Offset(12, 15.1), 1.3, f);
        return;

      case Ico.fingerprint:
        for (var i = 0; i < 3; i++) {
          canvas.drawArc(
            Rect.fromCircle(center: const Offset(12, 13), radius: 3.3 + i * 3.1),
            3.34,
            2.6,
            false,
            s,
          );
        }
        canvas.drawCircle(const Offset(12, 13), 1.2, f);
        return;

      case Ico.faceId:
        for (final c in [
          [4.0, 8.6, 4.0, 4.0, 8.6, 4.0],
          [15.4, 4.0, 20.0, 4.0, 20.0, 8.6],
          [20.0, 15.4, 20.0, 20.0, 15.4, 20.0],
          [8.6, 20.0, 4.0, 20.0, 4.0, 15.4],
        ]) {
          final corner = Path()
            ..moveTo(c[0], c[1])
            ..lineTo(c[2], c[3])
            ..lineTo(c[4], c[5]);
          canvas.drawPath(corner, s);
        }
        canvas.drawCircle(const Offset(9.4, 10.6), .9, f);
        canvas.drawCircle(const Offset(14.6, 10.6), .9, f);
        canvas.drawArc(
          Rect.fromCircle(center: const Offset(12, 13.4), radius: 3.2),
          .5,
          2.14,
          false,
          s,
        );
        return;

      // Grafik kalit — to'qqiz nuqta.
      case Ico.pattern:
        for (var r = 0; r < 3; r++) {
          for (var c = 0; c < 3; c++) {
            canvas.drawCircle(Offset(6.4 + c * 5.6, 6.4 + r * 5.6), 1.4, f);
          }
        }
        return;

      case Ico.shield:
        p.moveTo(12, 3.4);
        p.lineTo(19.4, 6.2);
        p.lineTo(19.4, 11.6);
        p.cubicTo(19.4, 16.4, 16, 19.4, 12, 20.6);
        p.cubicTo(8, 19.4, 4.6, 16.4, 4.6, 11.6);
        p.lineTo(4.6, 6.2);
        p.close();
        canvas.drawPath(p, body());
        return;

      case Ico.doc:
        p.moveTo(5.6, 3.6);
        p.lineTo(14.2, 3.6);
        p.lineTo(18.8, 8.2);
        p.lineTo(18.8, 20.4);
        p.lineTo(5.6, 20.4);
        p.close();
        canvas.drawPath(p, s);
        p.reset();
        p.moveTo(14.2, 3.6);
        p.lineTo(14.2, 8.2);
        p.lineTo(18.8, 8.2);
        canvas.drawPath(p, s);
        canvas.drawLine(const Offset(8.6, 13), const Offset(15.4, 13), s);
        canvas.drawLine(const Offset(8.6, 16.4), const Offset(13.4, 16.4), s);
        return;

      case Ico.info:
        canvas.drawCircle(const Offset(12, 12), 8, s);
        canvas.drawCircle(const Offset(12, 7.9), 1.15, f);
        canvas.drawLine(const Offset(12, 11.2), const Offset(12, 16.6), s);
        return;

      case Ico.warning:
        p.moveTo(12, 3.6);
        p.lineTo(21.4, 19.8);
        p.lineTo(2.6, 19.8);
        p.close();
        canvas.drawPath(p, s);
        canvas.drawLine(const Offset(12, 9.6), const Offset(12, 14.4), s);
        canvas.drawCircle(const Offset(12, 17.1), 1.15, f);
        return;

      case Ico.ban:
        canvas.drawCircle(const Offset(12, 12), 8, s);
        canvas.drawLine(const Offset(6.4, 6.4), const Offset(17.6, 17.6), s);
        return;

      case Ico.star:
        p.moveTo(12, 3.8);
        p.lineTo(14.6, 9.5);
        p.lineTo(20.8, 10.4);
        p.lineTo(16.4, 14.7);
        p.lineTo(17.4, 20.8);
        p.lineTo(12, 17.9);
        p.lineTo(6.6, 20.8);
        p.lineTo(7.6, 14.7);
        p.lineTo(3.2, 10.4);
        p.lineTo(9.4, 9.5);
        p.close();
        canvas.drawPath(p, body());
        return;

      case Ico.chart:
        canvas.drawLine(const Offset(4, 19.6), const Offset(20, 19.6), s);
        for (final b in [
          [6.8, 13.4],
          [11.2, 8.8],
          [15.6, 11.2],
          [19.0, 5.6],
        ]) {
          canvas.drawLine(Offset(b[0], 19.6), Offset(b[0], b[1]), s);
        }
        return;

      case Ico.bag:
        p.moveTo(5.2, 8.2);
        p.lineTo(18.8, 8.2);
        p.lineTo(19.8, 19.8);
        p.lineTo(4.2, 19.8);
        p.close();
        canvas.drawPath(p, s);
        canvas.drawArc(
          Rect.fromCircle(center: const Offset(12, 8.2), radius: 3.5),
          3.14159,
          3.14159,
          false,
          s,
        );
        return;

      case Ico.building:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(4.4, 4, 10.4, 16),
            const Radius.circular(1.8),
          ),
          s,
        );
        p.moveTo(14.8, 9.6);
        p.lineTo(19.6, 9.6);
        p.lineTo(19.6, 20);
        canvas.drawPath(p, s);
        for (var r = 0; r < 3; r++) {
          for (var c = 0; c < 2; c++) {
            canvas.drawCircle(Offset(7.6 + c * 4, 7.8 + r * 3.8), .95, f);
          }
        }
        return;

      case Ico.logout:
        p.moveTo(13.6, 4.8);
        p.lineTo(5.4, 4.8);
        p.lineTo(5.4, 19.2);
        p.lineTo(13.6, 19.2);
        canvas.drawPath(p, s);
        canvas.drawLine(const Offset(10.4, 12), const Offset(20.2, 12), s);
        p.reset();
        p.moveTo(16.6, 8.4);
        p.lineTo(20.2, 12);
        p.lineTo(16.6, 15.6);
        canvas.drawPath(p, s);
        return;

      case Ico.backspace:
        p.moveTo(8.6, 5.2);
        p.lineTo(20, 5.2);
        p.lineTo(20, 18.8);
        p.lineTo(8.6, 18.8);
        p.lineTo(3.4, 12);
        p.close();
        canvas.drawPath(p, s);
        canvas.drawLine(const Offset(11.8, 9.6), const Offset(16.4, 14.4), s);
        canvas.drawLine(const Offset(16.4, 9.6), const Offset(11.8, 14.4), s);
        return;

      case Ico.palette:
        p.moveTo(12, 3.6);
        p.cubicTo(16.6, 3.6, 20.4, 7.2, 20.4, 11.6);
        p.cubicTo(20.4, 14.6, 18, 15.4, 16, 15.4);
        p.cubicTo(14.4, 15.4, 13.4, 16.2, 13.4, 17.4);
        p.cubicTo(13.4, 19, 14.4, 19.2, 14.4, 20);
        p.cubicTo(14.4, 20.4, 13.4, 20.4, 12, 20.4);
        p.cubicTo(7.2, 20.4, 3.6, 16.6, 3.6, 12);
        p.cubicTo(3.6, 7.4, 7.2, 3.6, 12, 3.6);
        p.close();
        canvas.drawPath(p, s);
        canvas.drawCircle(const Offset(8.2, 9.4), 1.25, f);
        canvas.drawCircle(const Offset(12.4, 7.6), 1.25, f);
        canvas.drawCircle(const Offset(16.2, 10.4), 1.25, f);
        return;

      case Ico.language:
        canvas.drawCircle(const Offset(12, 12), 8, s);
        canvas.drawLine(const Offset(4.2, 12), const Offset(19.8, 12), s);
        canvas.drawOval(const Rect.fromLTWH(8, 4, 8, 16), s);
        return;

      case Ico.help:
        canvas.drawCircle(const Offset(12, 12), 8, s);
        p.moveTo(9.6, 9.6);
        p.cubicTo(9.6, 7.8, 10.8, 7, 12, 7);
        p.cubicTo(13.4, 7, 14.6, 7.9, 14.6, 9.4);
        p.cubicTo(14.6, 11.4, 12, 11.6, 12, 14);
        canvas.drawPath(p, s);
        canvas.drawCircle(const Offset(12, 17), 1.15, f);
        return;

      case Ico.sparkle:
        p.moveTo(12, 3.4);
        p.cubicTo(12.8, 8.6, 15.4, 11.2, 20.6, 12);
        p.cubicTo(15.4, 12.8, 12.8, 15.4, 12, 20.6);
        p.cubicTo(11.2, 15.4, 8.6, 12.8, 3.4, 12);
        p.cubicTo(8.6, 11.2, 11.2, 8.6, 12, 3.4);
        p.close();
        canvas.drawPath(p, body());
        return;

      case Ico.moon:
        p.moveTo(19.4, 14.6);
        p.cubicTo(14, 16.8, 7.2, 13.4, 7.2, 7.6);
        p.cubicTo(7.2, 6.2, 7.6, 5.2, 8, 4.4);
        p.cubicTo(3.6, 6.2, 2.4, 12.4, 5.8, 16.6);
        p.cubicTo(9.2, 20.8, 16.2, 20.4, 19.4, 14.6);
        p.close();
        canvas.drawPath(p, body());
        return;
    }
  }

  @override
  bool shouldRepaint(_IconPainter old) =>
      old.icon != icon || old.color != color || old.filled != filled;
}
