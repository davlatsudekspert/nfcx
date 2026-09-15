import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../tokens.dart';

/// KARTA TELEFONGA TEGADI — NFC MARKAZINING TUSHUNTIRUVCHI RASMI.
///
/// NIMA UCHUN QO'SHILDI. Egasi: "NFC bo'limining pastlari bo'sh
/// qolyapti, o'sha yerga biron vizual narsa qo'y — NFC kartani
/// ulanishimi, shunaqa vizual". Ekranning yuqorisida to'lqin bor
/// (`NfcWave`), lekin u ABSTRAKT: nima nimaga tegishini
/// ko'rsatmaydi. Bu rasm esa aynan harakatni ko'rsatadi —
/// KARTA va TELEFON, orasida signal yoyi.
///
/// NIMA UCHUN CHIZMA, RASM EMAS. Bitmap rasm har ekran zichligida
/// boshqacha ko'rinadi va mavzu rangi bilan bog'lanmaydi. Bu yerda
/// esa karta yuzasi HAQIQIY tarif gradiyenti bilan chiziladi
/// (`TierStyle`), ya'ni ilovadagi metall bilan bir xil.
///
/// Harakatni kamaytirish rejimida yoylar QOTIB qoladi: ma'no
/// saqlanadi, harakat yo'qoladi.
class CardTapArt extends StatefulWidget {
  const CardTapArt({super.key, this.height = 164, this.active = true});

  final double height;

  /// Yoylar harakatlanadimi.
  final bool active;

  @override
  State<CardTapArt> createState() => _CardTapArtState();
}

class _CardTapArtState extends State<CardTapArt>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: M.wave,
  );

  bool _running = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(CardTapArt old) {
    super.didUpdateWidget(old);
    _sync();
  }

  void _sync() {
    final should = widget.active && !reduceMotion(context);
    if (should == _running) return;
    _running = should;
    if (should) {
      _c.repeat();
    } else {
      _c.stop();
      _c.value = .5;
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
        height: widget.height,
        // Kenglik ota-widgetdan olinadi; chizma o'z nisbatini
        // saqlagan holda markazga joylashadi.
        child: AnimatedBuilder(
          animation: _c,
          builder: (context, _) => CustomPaint(
            size: Size.infinite,
            painter: _TapPainter(progress: _c.value, still: !_running),
          ),
        ),
      );
}

/// Chizma o'z koordinata tizimida ishlanadi va keyin ekranga
/// moslanadi — shunda har o'lchamda nisbatlar bir xil qoladi.
const double _w = 280;
const double _h = 164;

class _TapPainter extends CustomPainter {
  _TapPainter({required this.progress, required this.still});

  final double progress;
  final bool still;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = math.min(size.width / _w, size.height / _h);
    canvas.save();
    canvas.translate(
      (size.width - _w * scale) / 2,
      (size.height - _h * scale) / 2,
    );
    canvas.scale(scale);

    _phone(canvas);
    _arcs(canvas);
    _card(canvas);

    canvas.restore();
  }

  /// TELEFON — o'ngda, tinch turadi.
  void _phone(Canvas canvas) {
    final body = RRect.fromRectAndRadius(
      const Rect.fromLTWH(176, 12, 76, 140),
      const Radius.circular(16),
    );
    canvas.drawRRect(
      body,
      Paint()..color = const Color(0xFF15120C),
    );
    canvas.drawRRect(
      body,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..color = C.ink3.withValues(alpha: .5),
    );

    // Ekran — ichkarida, biroz yorug'roq: telefon "yoniq".
    final screen = RRect.fromRectAndRadius(
      const Rect.fromLTWH(182, 18, 64, 128),
      const Radius.circular(12),
    );
    canvas.drawRRect(
      screen,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            C.accent.withValues(alpha: .10),
            C.accent.withValues(alpha: .02),
          ],
        ).createShader(const Rect.fromLTWH(182, 18, 64, 128)),
    );

    // Tepadagi nutq — telefonni tanitadigan eng kichik detal.
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(202, 25, 24, 4),
        const Radius.circular(2),
      ),
      Paint()..color = C.ink3.withValues(alpha: .45),
    );

    // Ochilgan profil — ekranda avatar va ikki satr.
    canvas.drawCircle(
      const Offset(214, 62),
      13,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.3
        ..color = C.accent.withValues(alpha: .65),
    );
    for (final line in const [
      Rect.fromLTWH(196, 88, 36, 4),
      Rect.fromLTWH(202, 99, 24, 4),
    ]) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(line, const Radius.circular(2)),
        Paint()..color = C.ink3.withValues(alpha: .4),
      );
    }
  }

  /// SIGNAL YOYLARI — kartadan telefonga.
  ///
  /// Uchta yoy ketma-ket (har biri siklning 1/3 qismiga kechikadi)
  /// tarqaladi va uzoqlashgan sari so'nadi.
  void _arcs(Canvas canvas) {
    const origin = Offset(150, 84);
    for (var i = 0; i < 3; i++) {
      final t = still ? (i + 1) / 4 : (progress + i / 3) % 1;
      final radius = 14 + 26 * Curves.easeOut.transform(t);
      final fade = (1 - t) * (t < .12 ? t / .12 : 1);
      canvas.drawArc(
        Rect.fromCircle(center: origin, radius: radius),
        -math.pi / 4.4,
        math.pi / 2.2,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round
          ..color = C.accent.withValues(alpha: .55 * fade.clamp(0, 1)),
      );
    }
  }

  /// KARTA — chapda, biroz burilgan. Yuzasi haqiqiy tarif metalli.
  void _card(Canvas canvas) {
    canvas.save();
    canvas.translate(84, 84);
    canvas.rotate(-.13);

    const face = Rect.fromLTWH(-66, -42, 132, 84);
    final rr = RRect.fromRectAndRadius(face, const Radius.circular(12));

    // Ostidagi soya — karta telefondan oldinda turishi sezilsin.
    canvas.drawRRect(
      rr.shift(const Offset(0, 6)),
      Paint()
        ..color = const Color(0xFF000000).withValues(alpha: .45)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10),
    );

    canvas.drawRRect(
      rr,
      Paint()..shader = TierStyle.of(Tier.gold).swatch.createShader(face),
    );
    canvas.drawRRect(
      rr,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = TierStyle.of(Tier.gold).edge,
    );

    // Kartadagi NFC belgisi — uch yoy, o'ng yuqori burchakda.
    for (var i = 0; i < 3; i++) {
      canvas.drawArc(
        Rect.fromCircle(center: const Offset(38, -22), radius: 5.0 + i * 4.5),
        -math.pi / 3.6,
        math.pi / 1.8,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..strokeCap = StrokeCap.round
          ..color = const Color(0xFF3A2C08).withValues(alpha: .75),
      );
    }

    // Kod satri — kartada nima yozilishini ko'rsatadi. Haqiqiy kod
    // emas, faqat shakl: matn tarjima qilinmasin va namuna kod
    // ilovaga sizib kirmasin.
    for (final bar in const [
      Rect.fromLTWH(-46, 10, 54, 8),
      Rect.fromLTWH(-46, 24, 34, 5),
    ]) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(bar, const Radius.circular(3)),
        Paint()..color = const Color(0xFF3A2C08).withValues(alpha: .55),
      );
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(_TapPainter old) =>
      old.progress != progress || old.still != still;
}
