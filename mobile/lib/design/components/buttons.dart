import 'package:flutter/widgets.dart';
import '../tokens.dart';
import '../type.dart';
import 'press.dart';

/// Asosiy tugma — champagne to'ldirma, EKRANDA BITTA.
///
/// Balandlik 52, radius 14, e2 soya. `loading` holatida yozuv o'rnini
/// kichik aylana egallaydi, LEKIN tugma o'lchami o'zgarmaydi — aks holda
/// bosilgan payt maket sakrab ketardi.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton(this.label, {super.key, this.onTap, this.loading = false, this.icon});

  final String label;
  final VoidCallback? onTap;
  final bool loading;
  final Widget? icon;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null && !loading;
    return Press(
      haptic: true,
      onTap: enabled ? onTap : null,
      child: Opacity(
        opacity: enabled ? 1 : .5,
        child: Container(
          height: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: C.champagne,
            borderRadius: BorderRadius.circular(R.button),
            boxShadow: enabled ? E.e2 : null,
          ),
          child: loading
              ? const SizedBox(
                  width: 18, height: 18,
                  child: _Spinner(color: C.ink),
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (icon != null) ...[icon!, const SizedBox(width: S.x8)],
                    // YOZUV QISQARA OLISHI KERAK. Aks holda uzun matn
                    // yoki katta tizim shrifti tugmani chetdan chiqarib
                    // yuboradi (test aynan shuni ushladi).
                    Flexible(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.button.copyWith(color: C.ink),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
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
  const Spinner({super.key, this.size = 18, this.color = C.champagne});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) =>
      SizedBox(width: size, height: size, child: _Spinner(color: color));
}
