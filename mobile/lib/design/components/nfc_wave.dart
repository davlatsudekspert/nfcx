import 'package:flutter/widgets.dart';

import '../tokens.dart';
import 'logo.dart';

/// NFC TO'LQINI — brend medalyonidan tarqaladigan halqalar.
///
/// Bu NFC markazining va skanerlash ekranining vizual o'zagi: odam
/// telefonni kartaga tegizishi kerakligini so'zsiz tushunadi.
///
/// UCH HALQA KETMA-KET tarqaladi (1.6 s siklda, har biri 1/3 ga
/// kechikadi). Halqa markazdan uzoqlashgan sari so'nadi — bu
/// haqiqiy signal tarqalishiga o'xshaydi.
///
/// Harakatni kamaytirish rejimida halqalar QOTIB qoladi (uchtasi
/// ham ko'rinadi, lekin qimirlamaydi) — ma'no saqlanadi, harakat
/// yo'qoladi.
class NfcWave extends StatefulWidget {
  const NfcWave({
    super.key,
    this.size = 104,
    this.spread = 2.1,
    this.active = true,
    this.color,
  });

  /// Markazdagi medalyon o'lchami.
  final double size;

  /// Eng tashqi halqa markazdan necha barobar uzoqqa chiqadi.
  final double spread;

  /// Skanerlash ketyaptimi. `false` — halqalar tinch turadi.
  final bool active;

  final Color? color;

  @override
  State<NfcWave> createState() => _NfcWaveState();
}

class _NfcWaveState extends State<NfcWave> with SingleTickerProviderStateMixin {
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
  void didUpdateWidget(NfcWave old) {
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
      _c.value = .55;
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final box = widget.size * widget.spread;
    return SizedBox(
      width: box,
      height: box,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: _c,
            builder: (context, _) => CustomPaint(
              size: Size(box, box),
              painter: _WavePainter(
                progress: _c.value,
                color: widget.color ?? C.accent,
                inner: widget.size / 2,
                outer: box / 2,
                still: !_running,
              ),
            ),
          ),
          BrandMark(size: widget.size, glow: true),
        ],
      ),
    );
  }
}

class _WavePainter extends CustomPainter {
  _WavePainter({
    required this.progress,
    required this.color,
    required this.inner,
    required this.outer,
    required this.still,
  });

  final double progress;
  final Color color;
  final double inner;
  final double outer;
  final bool still;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);

    for (var i = 0; i < 3; i++) {
      // Har halqa siklning 1/3 qismiga kechikadi.
      final t = still ? (i + 1) / 4 : (progress + i / 3) % 1;
      final radius = inner + (outer - inner) * Curves.easeOut.transform(t);
      // Chekkaga yetganda so'nadi; boshida ham yumshoq paydo
      // bo'ladi — keskin "chiqib kelish" bo'lmasin.
      final fade = (1 - t) * (t < .12 ? t / .12 : 1);

      canvas.drawCircle(
        center,
        radius,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4
          ..color = color.withValues(alpha: .42 * fade.clamp(0, 1)),
      );
    }
  }

  @override
  bool shouldRepaint(_WavePainter old) =>
      old.progress != progress || old.color != color || old.still != still;
}
