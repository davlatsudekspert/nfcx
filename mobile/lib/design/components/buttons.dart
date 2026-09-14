import 'dart:async';

import 'package:flutter/widgets.dart';
import '../tokens.dart';
import '../type.dart';
import 'press.dart';

/// Asosiy tugma — METALL OLTIN to'ldirma, EKRANDA BITTA.
///
/// Balandlik 52, radius R.button. `loading` holatida yozuv o'rnini
/// kichik aylana egallaydi, LEKIN tugma o'lchami o'zgarmaydi — aks holda
/// bosilgan payt maket sakrab ketardi.
///
/// 2026-09 — TEKIS RANGDAN METALLGA.
///
/// Ilgari tugma bir tekis `C.champagne` edi. Saytdagi "Kontaktni
/// saqlash" bilan yonma-yon qo'yilganda u yassi va o'chiq
/// ko'rinardi. Endi uch qatlam:
///   1. gradient to'ldirma (`C.metalFace`) — yorug'lik yuqori-chapdan;
///   2. tepadagi oq aks — qavariq yuza tuyg'usi;
///   3. ustidan sekin o'tadigan yorug'lik (`M.sweep`).
///
/// Yorug'lik CHEKSIZ TAKRORLANMAYDI: u bir marta o'tadi, keyin
/// kontroller TO'XTAYDI va taymer uni bir necha soniyadan keyin
/// qaytadan yoqadi. Ikki sabab bor:
///
///   1. BATAREYA. Pauza vaqtida kadr umuman rejalashtirilmaydi —
///      `repeat()` bo'lsa ekran har kadrda qayta chizilardi.
///   2. TESTLAR. `repeat()` bilan `pumpAndSettle()` hech qachon
///      qaytmaydi ("animatsiya tugashini kut" — u tugamaydi) va
///      ilovaning sakkizta testi shu sababdan yiqildi. Pauza esa
///      "kadr rejalashtirilmagan" holat, ya'ni testlar tinch
///      yakunlanadi.
///
/// O'chiq tugmada animatsiya UMUMAN yaratilmaydi.
class PrimaryButton extends StatefulWidget {
  const PrimaryButton(this.label, {super.key, this.onTap, this.loading = false, this.icon});

  final String label;
  final VoidCallback? onTap;
  final bool loading;
  final Widget? icon;

  @override
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton>
    with SingleTickerProviderStateMixin {
  AnimationController? _sweep;
  Timer? _idle;

  /// Yorug'lik yuzani kesib o'tish vaqti.
  static const _travel = Duration(milliseconds: 1500);

  /// Ikki o'tish orasidagi tinchlik. `_travel + _pause == M.sweep`.
  static const _pause = Duration(milliseconds: 2700);

  bool get _enabled => widget.onTap != null && !widget.loading;

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(PrimaryButton old) {
    super.didUpdateWidget(old);
    _sync();
  }

  /// Kontroller FAQAT yoqilgan tugmada yashaydi. O'chiq tugma
  /// e'tiborni tortmasligi kerak, ya'ni unda yorug'lik ham
  /// bo'lmaydi — va batareya behuda sarflanmaydi.
  ///
  /// `AnimationBehavior.preserve` — istorya halqasidagi bilan bir xil
  /// sabab: Android'da tizim animatsiyalari o'chirilgan bo'lsa
  /// Flutter animatsiyani darhol oxiriga tashlaydi va yorug'lik
  /// umuman ko'rinmay qolardi.
  void _sync() {
    if (!_enabled) {
      _idle?.cancel();
      _idle = null;
      _sweep?.dispose();
      _sweep = null;
      return;
    }
    if (_sweep != null) return;
    _sweep = AnimationController(
      vsync: this,
      duration: _travel,
      animationBehavior: AnimationBehavior.preserve,
    )..addStatusListener(_rearm);
    _sweep!.forward();
  }

  /// O'tish tugadi — pauza, keyin yana boshidan.
  void _rearm(AnimationStatus status) {
    if (status != AnimationStatus.completed) return;
    _idle?.cancel();
    _idle = Timer(_pause, () {
      if (!mounted) return;
      _sweep?.forward(from: 0);
    });
  }

  @override
  void dispose() {
    // Taymer AVVAL to'xtatiladi: aks holda u tarqatilgan
    // kontrollerni yoqmoqchi bo'lardi.
    _idle?.cancel();
    _sweep?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final content = widget.loading
        ? SizedBox(
            width: 18, height: 18,
            child: _Spinner(color: C.ink),
          )
        : Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.icon != null) ...[widget.icon!, const SizedBox(width: S.x8)],
              // YOZUV QISQARA OLISHI KERAK. Aks holda uzun matn
              // yoki katta tizim shrifti tugmani chetdan chiqarib
              // yuboradi (test aynan shuni ushladi).
              Flexible(
                child: Text(
                  widget.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.button.copyWith(color: C.ink),
                ),
              ),
            ],
          );

    return Press(
      haptic: true,
      onTap: _enabled ? widget.onTap : null,
      child: Opacity(
        opacity: _enabled ? 1 : .5,
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            gradient: C.metalFace,
            borderRadius: BorderRadius.circular(R.button),
            boxShadow: _enabled
                ? [
                    BoxShadow(color: C.champagne.withValues(alpha: .26), blurRadius: 22, spreadRadius: -6),
                    ...E.e2,
                  ]
                : null,
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(R.button),
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Tepadagi oq aks — metall yuzaning qavariqligi.
                const Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0x66FFFFFF), Color(0x00FFFFFF)],
                        stops: [0, .55],
                      ),
                    ),
                  ),
                ),
                if (_sweep != null)
                  Positioned.fill(
                    child: IgnorePointer(
                      child: RepaintBoundary(
                        child: AnimatedBuilder(
                          animation: _sweep!,
                          builder: (_, __) => CustomPaint(painter: _SweepPainter(_sweep!.value)),
                        ),
                      ),
                    ),
                  ),
                content,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Tugma ustidan o'tadigan yorug'lik chizig'i.
///
/// `t` 0 dan 1 gacha — yorug'lik chap chetdan o'ng chetga o'tadi.
/// Pauza kontroller darajasida (u shunchaki to'xtab turadi), shuning
/// uchun bu yerda vaqtni bo'lish shart emas.
class _SweepPainter extends CustomPainter {
  _SweepPainter(this.t);
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final p = t.clamp(0.0, 1.0);
    final bandW = size.width * .34;
    // Chapdagi kadr tashqarisidan o'ngdagi kadr tashqarisiga.
    final x = -bandW + p * (size.width + bandW * 2);
    final rect = Rect.fromLTWH(x, -size.height, bandW, size.height * 3);
    canvas.save();
    // Qiyalik — to'g'ri burchakli chiziq "qog'oz chetiga" o'xshardi.
    canvas.transform(Matrix4.skewX(-0.32).storage);
    canvas.drawRect(
      rect,
      Paint()
        ..shader = const LinearGradient(
          colors: [Color(0x00FFFFFF), Color(0x73FFFFFF), Color(0x00FFFFFF)],
        ).createShader(rect),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SweepPainter old) => old.t != t;
}

/// Ikkilamchi — bir xil o'lcham, to'q to'ldirma, iliq chegara.
class SecondaryButton extends StatelessWidget {
  const SecondaryButton(this.label, {super.key, this.onTap, this.icon, this.height = 52});

  final String label;
  final VoidCallback? onTap;
  final Widget? icon;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Press(
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? .5 : 1,
        child: Container(
          height: height,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: C.slate,
            borderRadius: BorderRadius.circular(R.button),
            border: Border.all(color: C.warmHairline),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[icon!, const SizedBox(width: S.x8)],
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.button.copyWith(color: C.offWhite),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Ghost — balandlik 44, to'ldirmasiz.
class GhostButton extends StatelessWidget {
  const GhostButton(this.label, {super.key, this.onTap, this.icon, this.color});

  final String label;
  final VoidCallback? onTap;
  final Widget? icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Press(
      onTap: onTap,
      child: Container(
        height: 44,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: S.x16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(R.button),
          border: Border.all(color: C.hairline),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[icon!, const SizedBox(width: S.x8)],
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: T.button.copyWith(fontSize: 13.5, color: color ?? C.offWhite),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Yagona spinner. Material'niki emas: u o'z rang sxemasini oladi va
/// bu yerda noto'g'ri rangda chiqadi.
class _Spinner extends StatefulWidget {
  const _Spinner({required this.color});
  final Color color;

  @override
  State<_Spinner> createState() => _SpinnerState();
}

class _SpinnerState extends State<_Spinner> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this, duration: const Duration(milliseconds: 700),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(
        turns: _c,
        child: CustomPaint(painter: _ArcPainter(widget.color)),
      );
}

class _ArcPainter extends CustomPainter {
  _ArcPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      Offset.zero & size, -1.57, 4.2, false, p,
    );
  }

  @override
  bool shouldRepaint(_ArcPainter old) => old.color != color;
}

/// Ochiq spinner — yuklanish holatlarida kerak bo'lganda.
class Spinner extends StatelessWidget {
  // Rang MAVZUGA bog'liq, ya'ni `const` standart qiymat bo'la
  // olmaydi. `null` -> build ichida joriy urg'u olinadi.
  const Spinner({super.key, this.size = 18, this.color});
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) =>
      SizedBox(
        width: size,
        height: size,
        child: _Spinner(color: color ?? C.champagne),
      );
}
