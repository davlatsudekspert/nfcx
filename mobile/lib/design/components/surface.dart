import 'package:flutter/widgets.dart';
import '../tokens.dart';
import '../type.dart';

/// Standart karta yuzasi: gradient + 1px hairline + e2.
///
/// Chuqurlik SOYA va CHEGARADAN keladi, yorqinlikdan emas — handoff
/// buni ikki marta ta'kidlaydi ("gold rim-glow deliberately removed").
class Surface extends StatelessWidget {
  const Surface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(S.x16),
    this.radius = R.card,
    this.border,
    this.gradient,
    this.color,
    this.shadow = E.e2,
  });

  final Widget child;
  final EdgeInsets padding;
  final double radius;
  final Color? border;
  final Gradient? gradient;
  final Color? color;
  final List<BoxShadow>? shadow;

  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        decoration: BoxDecoration(
          gradient: color == null ? (gradient ?? C.cardSurface) : null,
          color: color,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: border ?? C.hairline),
          boxShadow: shadow,
        ),
        child: child,
      );
}

/// Bo'lim sarlavhasi + o'ngdagi ixtiyoriy amal ("Barchasi").
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.actionLabel, this.onAction});

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x12),
        child: Row(
          children: [
            Expanded(child: Text(title, style: T.section)),
            if (actionLabel != null)
              GestureDetector(
                onTap: onAction,
                behavior: HitTestBehavior.opaque,
                child: Text(actionLabel!, style: T.caption.copyWith(color: C.champagne)),
              ),
          ],
        ),
      );
}

/// Eyebrow — bo'lim ustidagi mono yozuv. Har doim KATTA HARFDA.
class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key, this.color});
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) => Text(
        text.toUpperCase(),
        style: color == null ? T.eyebrow : T.eyebrow.copyWith(color: color),
      );
}

/// Chip — balandlik 32, radius 9. Faol: champagne to'ldirma + siyoh.
class Chip extends StatelessWidget {
  const Chip(this.label, {super.key, this.active = false, this.onTap});

  final String label;
  final bool active;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: M.fade,
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: S.x12),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: active ? null : C.cardSurface,
            color: active ? C.champagne : null,
            borderRadius: BorderRadius.circular(R.chip),
            border: Border.all(color: active ? C.champagne : C.hairline),
          ),
          child: Text(
            label,
            style: T.caption.copyWith(
              fontSize: 11.5,
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              color: active ? C.ink : C.ash,
            ),
          ),
        ),
      );
}

/// Holat chipi — balandlik 24, mono 9.5, harflar orasi ochiq.
///
/// Rang MA'NOGA bog'langan: yashil = tugallangan/ochiq/to'langan,
/// champagne = yangi/kutilmoqda, kulrang = yo'lda/yopiq, qizil = xato.
/// Ranglarni ekranga qarab tanlamang — holatga qarab tanlang.
enum StatusTone { ok, pending, neutral, fail }

class StatusChip extends StatelessWidget {
  const StatusChip(this.label, {super.key, this.tone = StatusTone.neutral});

  final String label;
  final StatusTone tone;

  Color get _c => switch (tone) {
        StatusTone.ok => C.verdant,
        StatusTone.pending => C.champagne,
        StatusTone.neutral => C.ash,
        StatusTone.fail => C.signal,
      };

  @override
  Widget build(BuildContext context) => Container(
        height: 24,
        padding: const EdgeInsets.symmetric(horizontal: S.x8),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: _c.withValues(alpha: .12),
          borderRadius: BorderRadius.circular(R.status),
          border: Border.all(color: _c.withValues(alpha: .3)),
        ),
        child: Text(label.toUpperCase(), style: T.statusLabel.copyWith(color: _c)),
      );
}

/// Tasdiqlangan nishon — PLATINA, champagne emas.
///
/// Holati HAR DOIM backend'dan keladi. Bu widget'ni "shunchaki
/// chiroyli bo'lsin" deb qo'shmang: handoff buni alohida taqiqlaydi.
class VerifiedBadge extends StatelessWidget {
  const VerifiedBadge({super.key, this.size = 15});
  final double size;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: size, height: size,
        child: CustomPaint(painter: _VerifiedPainter()),
      );
}

class _VerifiedPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final r = size.width / 2;
    canvas.drawCircle(Offset(r, r), r, Paint()..color = C.platinum);
    final p = Paint()
      ..color = C.obsidian
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * .13
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final path = Path()
      ..moveTo(size.width * .28, size.height * .52)
      ..lineTo(size.width * .44, size.height * .68)
      ..lineTo(size.width * .73, size.height * .34);
    canvas.drawPath(path, p);
  }

  @override
  bool shouldRepaint(_VerifiedPainter old) => false;
}
