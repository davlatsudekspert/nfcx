import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';

/// Har ekranning orqa foni: gradient + sekin suzuvchi ikkita ambient dog'.
///
/// Concept B'da fon statik emas — u juda sekin "nafas oladi". Bu ilovaga
/// chuqurlik beradi, lekin diqqatni tortmaydi: to'liq sikl 22 soniya.
class AmbientBackdrop extends StatefulWidget {
  const AmbientBackdrop({super.key, required this.child, this.animate = true});

  final Widget child;
  final bool animate;

  @override
  State<AmbientBackdrop> createState() => _AmbientBackdropState();
}

class _AmbientBackdropState extends State<AmbientBackdrop>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 22),
  );

  /// Ilova ekranda ko'rinib turibdimi.
  ///
  /// Fon animatsiyasi bezak: ilova fonga o'tganda uni davom ettirish
  /// batareyani bekorga yeydi va hech kim ko'rmaydi.
  bool _foreground = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _sync();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final next = state == AppLifecycleState.resumed;
    if (next == _foreground) return;
    _foreground = next;
    _sync();
  }

  @override
  void didUpdateWidget(covariant AmbientBackdrop old) {
    super.didUpdateWidget(old);
    _sync();
  }

  void _sync() {
    final shouldRun = widget.animate && _foreground;
    if (shouldRun && !_c.isAnimating) {
      _c.repeat();
    } else if (!shouldRun && _c.isAnimating) {
      _c.stop();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    // "Harakatni kamaytirish" yoqilgan bo'lsa dog'lar joyida qotadi.
    final still = reduceMotion(context) || !widget.animate;
    return AnimatedContainer(
      duration: Motion.theme,
      curve: Motion.smooth,
      decoration: BoxDecoration(gradient: t.backdrop),
      child: Stack(
        children: [
          Positioned.fill(
            child: IgnorePointer(
              child: still
                  ? CustomPaint(painter: _AmbientPainter(t, 0))
                  : AnimatedBuilder(
                      animation: _c,
                      builder: (_, __) =>
                          CustomPaint(painter: _AmbientPainter(t, _c.value)),
                    ),
            ),
          ),
          widget.child,
        ],
      ),
    );
  }
}

class _AmbientPainter extends CustomPainter {
  _AmbientPainter(this.t, this.phase);

  final NfcTokens t;
  final double phase;

  @override
  void paint(Canvas canvas, Size size) {
    void blob(Color color, Offset base, double r, double drift) {
      final a = (phase + drift) * 2 * math.pi;
      final c = base + Offset(math.cos(a) * size.width * .09,
          math.sin(a * .8) * size.height * .05);
      canvas.drawCircle(
        c,
        r,
        Paint()
          ..shader = RadialGradient(colors: [color, color.withValues(alpha: 0)])
              .createShader(Rect.fromCircle(center: c, radius: r))
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 40),
      );
    }

    blob(t.ambient1, Offset(size.width * .18, size.height * .16), size.width * .52, 0);
    blob(t.ambient2, Offset(size.width * .86, size.height * .34), size.width * .46, .45);
    // Pastki vinyetka — bottom nav ostidagi kontent yumshoq so'nadi.
    canvas.drawRect(
      Rect.fromLTWH(0, size.height * .6, size.width, size.height * .4),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [t.bgVignette.withValues(alpha: 0), t.bgVignette],
        ).createShader(Rect.fromLTWH(0, size.height * .6, size.width, size.height * .4)),
    );
  }

  @override
  bool shouldRepaint(_AmbientPainter old) =>
      old.phase != phase || old.t.id != t.id;
}
