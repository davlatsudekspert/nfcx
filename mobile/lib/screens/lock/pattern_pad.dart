import 'package:flutter/widgets.dart';

import 'package:flutter/services.dart';

import '../../design/tokens.dart';

/// GRAFIK KALIT MAYDONI — 3×3 nuqta.
///
/// NIMA UCHUN QO'SHILDI: dizaynda (14a) "Grafik kalit" bor edi,
/// ilovada esa faqat PIN va barmoq izi bor edi. Egasi buni
/// suratlar bilan ko'rsatdi.
///
/// QANDAY ISHLAYDI: barmoq nuqtalar ustidan sudraladi, tegilgan
/// nuqtalar ketma-ketligi maxfiy satrga aylanadi ("0"–"8"). Uni
/// `AppLock` PIN bilan BIR XIL yo'lda saqlaydi — tasodifiy tuz va
/// SHA-256. Ya'ni naqshning o'zi hech qayerda saqlanmaydi.
///
/// IKKI QOIDA, IKKALASI HAM XAVFSIZLIK UCHUN:
///   1. Bir nuqta bir marta ishlatiladi — orqaga qaytib uni qayta
///      bosish naqshni uzaytirmaydi.
///   2. Ikki nuqta orasidagi O'RTADAGI nuqta ham avtomatik
///      qo'shiladi (0→2 bo'lsa 1 ham kiradi) — Android'dagi bilan
///      bir xil xulq, aks holda odam "chizdim, lekin boshqa naqsh
///      chiqdi" holatiga tushardi.
class PatternPad extends StatefulWidget {
  const PatternPad({
    super.key,
    required this.onDone,
    this.error = false,
    this.enabled = true,
    this.size = 264,
  });

  /// Barmoq uzilganda chaqiriladi — tegilgan nuqtalar ketma-ketligi.
  final ValueChanged<String> onDone;

  /// Xato holat — chiziq qizil bo'ladi.
  final bool error;

  final bool enabled;
  final double size;

  @override
  State<PatternPad> createState() => _PatternPadState();
}

class _PatternPadState extends State<PatternPad> {
  final List<int> _picked = [];
  Offset? _cursor;

  double get _cell => widget.size / 3;

  Offset _center(int i) => Offset(
        _cell * (i % 3) + _cell / 2,
        _cell * (i ~/ 3) + _cell / 2,
      );

  /// Barmoq ostidagi nuqta — faqat nuqtaning O'RTASIGA yaqin
  /// joyda. Butun katak hisoblansa, yonidan o'tib ketganda ham
  /// nuqta qo'shilib, naqsh o'zgarib ketardi.
  int? _hit(Offset p) {
    for (var i = 0; i < 9; i++) {
      if ((p - _center(i)).distance <= _cell * .34) return i;
    }
    return null;
  }

  /// Ikki nuqta orasidagi o'rtadagi nuqta (bo'lsa).
  int? _between(int a, int b) {
    final ax = a % 3, ay = a ~/ 3, bx = b % 3, by = b ~/ 3;
    if ((ax - bx).abs() == 2 && ay == by) return ay * 3 + 1;
    if ((ay - by).abs() == 2 && ax == bx) return 1 * 3 + ax;
    if ((ax - bx).abs() == 2 && (ay - by).abs() == 2) return 4;
    return null;
  }

  void _add(int i) {
    if (_picked.contains(i)) return;
    if (_picked.isNotEmpty) {
      final mid = _between(_picked.last, i);
      if (mid != null && !_picked.contains(mid)) _picked.add(mid);
    }
    _picked.add(i);
    HapticFeedback.selectionClick();
    setState(() {});
  }

  void _move(Offset p) {
    if (!widget.enabled) return;
    final i = _hit(p);
    if (i != null) _add(i);
    setState(() => _cursor = p);
  }

  void _end() {
    if (!widget.enabled || _picked.isEmpty) return;
    final dots = _picked.join();
    setState(() {
      _picked.clear();
      _cursor = null;
    });
    widget.onDone(dots);
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
        onPanStart: (d) => _move(d.localPosition),
        onPanUpdate: (d) => _move(d.localPosition),
        onPanEnd: (_) => _end(),
        // Nuqtaga bir marta bosish ham ishlasin: qisqa tegish
        // `onPan` ni umuman ishga tushirmasligi mumkin.
        onTapDown: (d) => _move(d.localPosition),
        onTapUp: (_) => _end(),
        child: SizedBox(
          width: widget.size,
          height: widget.size,
          child: CustomPaint(
            painter: _PatternPainter(
              picked: List.of(_picked),
              cursor: _cursor,
              cell: _cell,
              error: widget.error,
            ),
          ),
        ),
      );
}

class _PatternPainter extends CustomPainter {
  _PatternPainter({
    required this.picked,
    required this.cursor,
    required this.cell,
    required this.error,
  });

  final List<int> picked;
  final Offset? cursor;
  final double cell;
  final bool error;

  Offset _center(int i) =>
      Offset(cell * (i % 3) + cell / 2, cell * (i ~/ 3) + cell / 2);

  @override
  void paint(Canvas canvas, Size size) {
    final active = error ? C.fail : C.accent;

    // Chiziq AVVAL chiziladi — nuqtalar uning ustida qoladi.
    if (picked.isNotEmpty) {
      final line = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = active.withValues(alpha: .75);
      final path = Path()..moveTo(_center(picked.first).dx, _center(picked.first).dy);
      for (final i in picked.skip(1)) {
        path.lineTo(_center(i).dx, _center(i).dy);
      }
      if (cursor != null) path.lineTo(cursor!.dx, cursor!.dy);
      canvas.drawPath(path, line);
    }

    for (var i = 0; i < 9; i++) {
      final on = picked.contains(i);
      final c = _center(i);
      if (on) {
        // Tanlangan nuqta atrofida yumshoq nur — barmoq ostida
        // nima bo'layotgani ko'rinib tursin.
        canvas.drawCircle(
          c,
          cell * .30,
          Paint()..color = active.withValues(alpha: .12),
        );
      }
      canvas.drawCircle(
        c,
        on ? 9 : 7,
        Paint()..color = on ? active : C.ink3.withValues(alpha: .45),
      );
      canvas.drawCircle(
        c,
        cell * .22,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4
          ..color = on ? active.withValues(alpha: .6) : C.line,
      );
    }
  }

  @override
  bool shouldRepaint(_PatternPainter old) =>
      old.picked.length != picked.length ||
      old.cursor != cursor ||
      old.error != error;
}
