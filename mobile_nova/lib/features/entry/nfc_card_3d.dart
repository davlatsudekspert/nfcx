import 'dart:math' as math;

import 'package:flutter/material.dart';

/// KIRISH EKRANIDAGI AYLANADIGAN NFCSTORE KARTASI (egasi, 2026-09-28:
/// "rasm GIF'ga o'xshagan bo'lishi kerak — NFC karta NFCSTORE aylanib
/// tursin, 3D"; "kartani yanada chiroyli qilish kerak"; "N logo
/// atrofidagini chiroyliroq qilish kerak").
///
/// GIF emas — jonli Flutter: ikki tomon (old — egasining Registonli
/// kartasi, orqa — o'rtada N logotipli metall dizayn; ~160 KB WebP) perspektiva bilan Y o'qi atrofida
/// buriladi. GIF'dan farqi: har qanday ekranda tiniq, 60 kadr, fon
/// shaffof (qora va och mavzuda bir xil), hajmi bir necha barobar kichik.
///
/// ## HARAKAT (bitta [progress] 0..1 — halqa)
///
///   * Old tomon turadi va sekin tebranadi → yarim aylanib orqa
///     tomon → turadi → yana yarim aylanib old tomon. Aylanish BIR
///     yo'nalishda davom etadi (orqaga qaytmaydi).
///   * NFC BELGISI JONLI: orqa tomondagi N logotipidan chapga-o'ngga
///     oltin signal yoylari tarqaladi, orqasida oltin nur nafas oladi;
///     old tomonda (Registon) NFC belgisidan o'ngga tarqaladi.
///   * Karta yuzasidan metall YALTIROG'I o'tadi — burchakka bog'langan,
///     ya'ni karta burilganda nur ham siljiydi.
///   * Kartaning QALINLIGI bor: yonboshga kelganda oltin qirra ko'rinadi.
///   * Ostida — yaltiroq poldagi kabi xira AKS, orqada oltin uchqunlar.
///
/// [still] — tizimda "animatsiyani kamaytirish" yoqilgan: karta
/// harakatsiz, old tomoni biroz qiya (3D ko'rinishi saqlanadi).
class NfcCard3D extends StatelessWidget {
  const NfcCard3D({
    super.key,
    required this.progress,
    required this.glow,
    this.still = false,
  });

  static const front = 'assets/welcome/card_front.webp';
  static const back = 'assets/welcome/card_back.webp';

  /// ISO/IEC 7810 ID-1 (bank kartasi) nisbati.
  static const aspect = 85.6 / 53.98;

  /// NFC signali qayerdan tarqaladi — rasmlardan o'lchangan.
  ///
  ///   * OLD tomon (Registon, egasining kartasi): o'ng tepadagi `)))`
  ///     belgisi — yoylar faqat O'NGGA tarqaladi;
  ///   * ORQA tomon: o'rtadagi `(( N ))` logotipi — ikki tomonga,
  ///     orqasida oltin nur nafas oladi.
  static const frontSignal = _Signal(
      center: Offset(.858, .23), r0: .086, r1: .122, sweep: 1.1, both: false);
  static const backSignal = _Signal(
      center: Offset(.5, .453), r0: .08, r1: .2, sweep: 1.05, both: true);

  /// Halqa ichidagi o'rin, 0..1.
  final double progress;

  /// Mavzuning oltin nuri (`t.glow`) — fon nuri va uchqunlar rangi.
  final Color glow;

  final bool still;

  /// Y o'qi bo'yicha burchak: turish — aylanish — turish — aylanish.
  @visibleForTesting
  static double yaw(double p) {
    const hold = .36; // har bir tomonda turish ulushi
    const turn = .5 - hold;
    final half = (p % 1) * 2; // 0..2
    final k = half.floor(); // 0 — old, 1 — orqa
    final f = half - k; // 0..1 shu yarim ichida
    final t = f < hold / .5 ? 0.0 : (f - hold / .5) / (turn / .5);
    final base = k * math.pi + Curves.easeInOutCubic.transform(t) * math.pi;
    // Turgan paytdagi yengil tebranish — aylanishga silliq ulanadi.
    final sway = .22 * math.sin(p * 4 * math.pi);
    return base + sway;
  }

  @override
  Widget build(BuildContext context) {
    final p = still ? 0.0 : progress;
    final a = still ? -.32 : yaw(p);
    final pitch = still ? .08 : .09 * math.sin(p * 2 * math.pi + .6);
    final lift = still ? 0.0 : 5 * math.sin(p * 2 * math.pi);
    final showFront = math.cos(a) >= 0;

    return LayoutBuilder(builder: (context, box) {
      // Karta + ostidagi aks balandlikka sig'sin.
      final w = math.min(box.maxWidth * .92, box.maxHeight * .6 * aspect);
      final h = w / aspect;
      final thick = w * .013;
      final gap = w * .07;

      Matrix4 at(double z) => Matrix4.identity()
        ..setEntry(3, 2, .0011)
        ..translateByDouble(0.0, lift, 0.0, 1.0)
        ..rotateX(pitch)
        ..rotateY(a)
        ..translateByDouble(0.0, 0.0, z, 1.0);

      // Qirra: ko'rinmaydigan yuzadan ko'rinadiganiga qarab chiziladi
      // (Flutter chuqurlik bo'yicha saralamaydi — tartib o'zimizdan).
      final dir = showFront ? -1.0 : 1.0;
      Widget card() => SizedBox(
            width: w,
            height: h,
            child: Stack(clipBehavior: Clip.none, children: [
              for (var i = 5; i >= 0; i--)
                Transform(
                  alignment: Alignment.center,
                  transform: at(dir * (thick * (i / 5 - .5))),
                  child: _Slab(w: w, h: h, shade: i / 5),
                ),
              Transform(
                alignment: Alignment.center,
                transform: at(dir * thick * .5)
                  ..rotateY(showFront ? 0 : math.pi),
                child: _Face(
                  w: w,
                  h: h,
                  front: showFront,
                  angle: a,
                  p: p,
                  still: still,
                ),
              ),
            ]),
          );

      // Karta markazi tepaga suriladi — pastda aks uchun joy.
      final up = (h + gap) * .28;

      return Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          // Orqa fon: iliq oltin nur va sekin miltillaydigan uchqunlar.
          Positioned.fill(
            child: IgnorePointer(
              child: CustomPaint(
                painter: _AuraPainter(
                  p: p,
                  color: glow,
                  w: w,
                  center: Offset(0, -up),
                ),
              ),
            ),
          ),
          Transform.translate(offset: Offset(0, -up), child: card()),
          // Aks — yaltiroq poldagi kabi, pastga qarab so'nadi.
          Transform.translate(
            offset: Offset(0, -up + h + gap),
            child: IgnorePointer(
              child: ShaderMask(
                blendMode: BlendMode.dstIn,
                shaderCallback: (r) => const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x38FFFFFF), Color(0x00FFFFFF)],
                  stops: [0, .62],
                ).createShader(r),
                // Chegaradan chiqqan qism ham niqoblansin — keng quti.
                child: SizedBox(
                  width: w * 1.2,
                  height: h * 1.2,
                  child: Center(
                    child: Transform.flip(flipY: true, child: card()),
                  ),
                ),
              ),
            ),
          ),
        ],
      );
    });
  }
}

/// Kartaning yuzasi: rasm + N atrofidagi jonli signal + metall nuri.
class _Face extends StatelessWidget {
  const _Face({
    required this.w,
    required this.h,
    required this.front,
    required this.angle,
    required this.p,
    required this.still,
  });

  final double w;
  final double h;
  final bool front;
  final double angle;
  final double p;
  final bool still;

  @override
  Widget build(BuildContext context) {
    final s = math.sin(angle) * 2.6;
    Widget band(double width, Color c) => DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment(-2.2 + s, -1),
              end: Alignment(2.2 + s, 1),
              colors: [const Color(0x00FFFFFF), c, const Color(0x00FFFFFF)],
              stops: [.5 - width, .5, .5 + width],
            ),
          ),
        );

    return SizedBox(
      width: w,
      height: h,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(w * .045),
        child: Stack(fit: StackFit.expand, children: [
          Image.asset(
            front ? NfcCard3D.front : NfcCard3D.back,
            fit: BoxFit.contain,
            gaplessPlayback: true,
            filterQuality: FilterQuality.medium,
            errorBuilder: (_, __, ___) => _Slab(w: w, h: h, shade: 0),
          ),
          IgnorePointer(
            child: CustomPaint(
              painter: _SignalPainter(
                signal: front ? NfcCard3D.frontSignal : NfcCard3D.backSignal,
                phase: still ? .3 : (p * 5) % 1,
              ),
            ),
          ),
          // Metall yaltirog'i: keng iliq tasma + ingichka yorqin chiziq.
          IgnorePointer(child: band(.16, const Color(0x1AFFE2A8))),
          IgnorePointer(child: band(.03, const Color(0x33FFF6E0))),
        ]),
      ),
    );
  }
}

/// NFC signali qayerdan va qanday tarqaladi (karta ulushlarida).
class _Signal {
  const _Signal({
    required this.center,
    required this.r0,
    required this.r1,
    required this.sweep,
    required this.both,
  });

  /// Yoylar markazi (eni/bo'yi ulushida).
  final Offset center;

  /// Yoy radiusi: bosilgan to'lqinlar tashqarisidan [r1] gacha (eni ulushi).
  final double r0;
  final double r1;

  /// Yoy burchagi (radian).
  final double sweep;

  /// Ikki tomonga (`(( N ))`) yoki faqat o'ngga (`)))`).
  final bool both;
}

/// NFC belgisi atrofidagi jonli signal.
///
///   * belgi orqasida oltin nur nafas oladi (`BlendMode.plus` — oltin
///     yanada yorishadi, qora fon deyarli o'zgarmaydi);
///   * bosilgan to'lqinlardan tashqariga oltin yoylar tarqalib so'nadi —
///     kartadagi belgining davomi.
class _SignalPainter extends CustomPainter {
  _SignalPainter({required this.signal, required this.phase});

  final _Signal signal;
  final double phase;

  static const _gold = Color(0xFFF1D08A);

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final sg = signal;
    final c = Offset(sg.center.dx * w, sg.center.dy * size.height);

    // 1. Nafas oladigan nur (faqat o'rtadagi logotipda).
    if (sg.both) {
      final breath = .5 + .5 * math.sin(phase * 2 * math.pi);
      final gr = w * .09;
      canvas.drawCircle(
        c,
        gr,
        Paint()
          ..blendMode = BlendMode.plus
          ..shader = RadialGradient(colors: [
            _gold.withValues(alpha: .10 + .12 * breath),
            _gold.withValues(alpha: 0),
          ]).createShader(Rect.fromCircle(center: c, radius: gr)),
      );
    }

    // 2. Tarqaladigan yoylar.
    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 3; i++) {
      final f = (phase + i / 3) % 1;
      final r = w * (sg.r0 + (sg.r1 - sg.r0) * f);
      // Paydo bo'ladi → so'nadi (boshida keskin chiqmaydi).
      final alpha = math.sin(f * math.pi) * (1 - f) * .95;
      arc
        ..strokeWidth = w * (.011 - .005 * f)
        ..color = _gold.withValues(alpha: alpha);
      final rect = Rect.fromCircle(center: c, radius: r);
      canvas.drawArc(rect, -sg.sweep / 2, sg.sweep, false, arc);
      if (sg.both) {
        canvas.drawArc(rect, math.pi - sg.sweep / 2, sg.sweep, false, arc);
      }
    }
  }

  @override
  bool shouldRepaint(_SignalPainter old) =>
      old.phase != phase || old.signal != signal;
}

/// Kartaning qalinligi — oltin qirra qatlami (ichkarisi to'qroq).
class _Slab extends StatelessWidget {
  const _Slab({required this.w, required this.h, required this.shade});

  final double w;
  final double h;

  /// 0 — yuzaga yaqin (yorqin oltin), 1 — o'rtasi (to'q bronza).
  final double shade;

  @override
  Widget build(BuildContext context) {
    final t = (shade - .5).abs() * 2; // chetlari yorqinroq
    return Container(
      width: w,
      height: h,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(w * .045),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.lerp(const Color(0xFF5A4726), const Color(0xFFE6C98C), t)!,
            Color.lerp(const Color(0xFF2A2114), const Color(0xFF9C7C45), t)!,
          ],
        ),
      ),
    );
  }
}

/// Karta orqasidagi iliq nur va sekin miltillaydigan oltin uchqunlar.
class _AuraPainter extends CustomPainter {
  _AuraPainter({
    required this.p,
    required this.color,
    required this.w,
    required this.center,
  });

  final double p;
  final Color color;
  final double w;

  /// Markazdan siljish (karta tepaga surilgan).
  final Offset center;

  // Uchqunlar joyi — qat'iy (har kadrda bir xil), faqat yorqinligi o'zgaradi.
  static const _dust = [
    Offset(-.62, -.52), Offset(.58, -.6), Offset(-.7, .1), Offset(.72, .02),
    Offset(-.38, -.78), Offset(.34, -.84), Offset(-.55, .46), Offset(.6, .42),
    Offset(-.15, -.9), Offset(.12, .66), Offset(-.82, -.28), Offset(.86, -.3),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero) + center;
    final r = w * .75;
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = RadialGradient(colors: [
          color.withValues(alpha: .20),
          color.withValues(alpha: .06),
          color.withValues(alpha: 0),
        ], stops: const [0, .55, 1])
            .createShader(Rect.fromCircle(center: c, radius: r)),
    );

    final dot = Paint();
    for (var i = 0; i < _dust.length; i++) {
      final d = _dust[i];
      final tw = .5 + .5 * math.sin((p * 3 + i * .37) * 2 * math.pi);
      final pos = c + Offset(d.dx * w * .62, d.dy * w * .5 + -6 * p);
      final rad = w * (.004 + .003 * (i % 3) / 2);
      dot
        ..color = const Color(0xFFF1D08A).withValues(alpha: .15 + .55 * tw)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, rad * .8);
      canvas.drawCircle(pos, rad, dot);
    }
  }

  @override
  bool shouldRepaint(_AuraPainter old) =>
      old.p != p || old.color != color || old.w != w || old.center != center;
}
