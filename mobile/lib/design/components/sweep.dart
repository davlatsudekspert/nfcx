import 'package:flutter/widgets.dart';

import '../tokens.dart';

/// YORUG'LIK CHIZIG'I — metall yuzadan o'tuvchi aks.
///
/// Bu dizaynning imzo effekti: oltin tugma va NFC kartadan har 4.2
/// sekundda bir marta yorug'lik o'tadi. Effekt kartani "bo'yalgan
/// to'rtburchak" emas, "yaltiroq metall" qilib ko'rsatadi.
///
/// SIKL: chiziq siklning birinchi ~40% ida o'tadi, qolgan vaqt
/// TINCHLIK. Uzluksiz harakat ko'zni charchatadi va dizayn buni
/// aniq taqiqlaydi: "Har bir karta va tugmada doimiy harakat
/// ishlatma".
///
/// Harakatni kamaytirish rejimida chiziq umuman chizilmaydi.
class LightSweep extends StatefulWidget {
  const LightSweep({
    super.key,
    required this.child,
    this.radius = 0,
    this.enabled = true,
    this.opacity = .62,
    this.period = M.sweep,
    this.travel = .40,
    this.width = .34,
    this.skew = -.32,
  });

  final Widget child;

  /// Chiziq yuzadan chiqib ketmasligi uchun burchak radiusi.
  final double radius;

  final bool enabled;

  /// Chiziqning eng yorug' nuqtasi.
  final double opacity;

  /// To'liq sikl.
  final Duration period;

  /// Siklning qancha qismida chiziq harakatlanadi.
  final double travel;

  /// Chiziq kengligi — yuza kengligiga nisbatan.
  final double width;

  /// Qiyalik (radian). Tik chiziq sun'iy ko'rinadi.
  final double skew;

  @override
  State<LightSweep> createState() => _LightSweepState();
}

class _LightSweepState extends State<LightSweep>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: widget.period,
  );

  bool _running = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(LightSweep old) {
    super.didUpdateWidget(old);
    if (old.period != widget.period) _c.duration = widget.period;
    _sync();
  }

  void _sync() {
    final should = widget.enabled && !reduceMotion(context);
    if (should == _running) return;
    _running = should;
    if (should) {
      _c.repeat();
    } else {
      _c.stop();
      _c.value = 0;
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_running) return widget.child;

    return Stack(
      children: [
        widget.child,
        // Chiziq bosishni tutmasligi kerak — ostidagi tugma
        // ishlashda davom etadi.
        Positioned.fill(
          child: IgnorePointer(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(widget.radius),
              child: AnimatedBuilder(
                animation: _c,
                builder: (context, _) => CustomPaint(
                  painter: _SweepPainter(
                    progress: _c.value,
                    travel: widget.travel,
                    width: widget.width,
                    skew: widget.skew,
                    opacity: widget.opacity,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _SweepPainter extends CustomPainter {
  _SweepPainter({
    required this.progress,
    required this.travel,
    required this.width,
    required this.skew,
    required this.opacity,
  });

  final double progress;
  final double travel;
  final double width;
  final double skew;
  final double opacity;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress > travel) return;

    // Harakat qismini 0..1 ga qayta o'lchaymiz va yumshoq egri
    // qo'llaymiz: chiziq boshida sekin, o'rtada tez o'tadi —
    // haqiqiy aks shunday harakatlanadi.
    final t = M.curve.transform((progress / travel).clamp(0, 1));

    final bandWidth = size.width * width;
    // Chekkadan chekkaga: chapdan tashqarida boshlanib, o'ngdan
    // tashqarida tugaydi.
    final x = -bandWidth + t * (size.width + bandWidth * 2);

    // Qiyalik hisobiga chiziq balandligi bo'ylab siljiydi, shuning
    // uchun uni kengroq chizamiz.
    final dx = size.height * -skew;

    final path = Path()
      ..moveTo(x, 0)
      ..lineTo(x + bandWidth, 0)
      ..lineTo(x + bandWidth + dx, size.height)
      ..lineTo(x + dx, size.height)
      ..close();

    // Chekkada so'nadi — keskin kirib-chiqish bo'lmasin.
    final edge = 1 - (t * 2 - 1).abs();
    final alpha = opacity * Curves.easeInOut.transform(edge.clamp(0, 1));

    final paint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [
          const Color(0xFFFFFFFF).withValues(alpha: 0),
          const Color(0xFFFFFFFF).withValues(alpha: alpha),
          const Color(0xFFFFFFFF).withValues(alpha: 0),
        ],
        stops: const [0, .5, 1],
      ).createShader(
        Rect.fromLTWH(x + (dx < 0 ? dx : 0), 0, bandWidth + dx.abs(), size.height),
      );

    canvas.drawPath(path, paint);
  }

  /// TINCHLIK PAYTIDA QAYTA CHIZILMAYDI.
  ///
  /// Sikl uzunligining ~60% ida chiziq umuman yo'q (`paint` darhol
  /// qaytadi). Agar shu paytda ham har kadrda qayta chizsak,
  /// ekranda o'nlab tugma bo'lganda bekorga ish bajarilardi.
  /// Ikkala kadr ham tinchlik zonasida bo'lsa — chizish shart emas.
  @override
  bool shouldRepaint(_SweepPainter old) {
    if (old.opacity != opacity) return true;
    if (old.progress > old.travel && progress > travel) return false;
    return old.progress != progress;
  }
}
