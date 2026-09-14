import 'package:flutter/widgets.dart';

import '../tokens.dart';
import '../type.dart';
import 'icons.dart';
import 'press.dart';
import 'sweep.dart';

/// TUGMALAR — uch o'lcham, bitta asosiy urg'u.
///
/// EKRANDA BITTA `PrimaryButton`. Qolgan amallar `SecondaryButton`
/// yoki `GhostButton`. Ikkita oltin tugma yonma-yon turganda
/// foydalanuvchi qaysi biri asosiy ekanini bilmaydi.
///
/// BOSISH MAYDONI hamma o'lchamda kamida 48 dp: kichik tugmaning
/// KO'RINADIGAN balandligi 38 dp, lekin `Press` uni 48 gacha
/// kengaytiradi.

enum BtnSize { l, m, s }

double _height(BtnSize s) => switch (s) {
      BtnSize.l => 54,
      BtnSize.m => 46,
      BtnSize.s => 38,
    };

TextStyle _labelStyle(BtnSize s) =>
    s == BtnSize.l ? T.button : T.buttonSm.copyWith(
          fontSize: s == BtnSize.m ? 15 : 13.5,
        );

double _pad(BtnSize s) => switch (s) {
      BtnSize.l => S.x24,
      BtnSize.m => S.x20,
      BtnSize.s => S.x16,
    };

// ─────────────────────────────────────────────────────────────
// ASOSIY
// ─────────────────────────────────────────────────────────────

/// Asosiy amal — metall oltin yuza.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton(
    this.label, {
    super.key,
    this.onTap,
    this.loading = false,
    this.icon,
    this.size = BtnSize.l,
    this.expand = true,
    this.sweep = true,
  });

  final String label;
  final VoidCallback? onTap;

  /// Yuklanish — tugma o'lchamini SAQLAB qoladi, matn o'rniga
  /// aylana chiqadi. Aks holda tartib sakraydi.
  final bool loading;

  final Ico? icon;
  final BtnSize size;

  /// `false` — kontent kengligicha (chip kabi).
  final bool expand;

  /// Yorug'lik chizig'i. Ro'yxat ichidagi ko'p tugmada o'chiriladi.
  final bool sweep;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null && !loading;
    final h = _height(size);

    Widget face = Container(
      height: h,
      // DIQQAT: `alignment` QO'YILMAYDI. `Container` ga alignment
      // berilsa u mavjud bo'sh joyni TO'LIQ egallaydi — `Wrap`
      // yoki `Row` ichida tugma butun kenglikka cho'zilib ketardi.
      // O'rtaga tekislash `Align(widthFactor)` bilan qilinadi:
      // `expand: false` da u bolasining kengligini oladi.
      padding: EdgeInsets.symmetric(horizontal: _pad(size)),
      decoration: BoxDecoration(
        gradient: enabled ? C.actionFace : null,
        color: enabled ? null : C.surfaceHigh,
        borderRadius: BorderRadius.circular(R.button),
        boxShadow: enabled ? C.actionGlow : null,
      ),
      child: Align(
        alignment: Alignment.center,
        widthFactor: expand ? null : 1,
        child: loading
            ? Spinner(size: size == BtnSize.l ? 20 : 16, color: C.onAccent)
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    NIcon(
                      icon!,
                      size: size == BtnSize.l ? 19 : 16,
                      color: enabled ? C.onAccent : C.ink3,
                    ),
                    const SizedBox(width: S.x8),
                  ],
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _labelStyle(size).copyWith(
                        color: enabled ? C.onAccent : C.ink3,
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );

    if (enabled) {
      // Yuqori qirradagi yorug' chiziq — metall yuzaning "qirrasi".
      face = Stack(
        children: [
          face,
          Positioned(
            left: S.x16,
            right: S.x16,
            top: 0,
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color(0x00FFFFFF),
                    const Color(0xFFFFFFFF).withValues(alpha: .55),
                    const Color(0x00FFFFFF),
                  ],
                ),
              ),
            ),
          ),
        ],
      );

      if (sweep) {
        face = LightSweep(radius: R.button, opacity: .5, child: face);
      }
    }

    final button = Press(
      onTap: enabled ? onTap : null,
      haptic: true,
      minSize: S.tap,
      scale: .975,
      child: face,
    );

    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

// ─────────────────────────────────────────────────────────────
// IKKILAMCHI VA GHOST
// ─────────────────────────────────────────────────────────────

/// Ikkilamchi amal — ko'tarilgan yuza, oltin emas.
class SecondaryButton extends StatelessWidget {
  const SecondaryButton(
    this.label, {
    super.key,
    this.onTap,
    this.icon,
    this.size = BtnSize.l,
    this.expand = true,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onTap;
  final Ico? icon;
  final BtnSize size;
  final bool expand;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null && !loading;
    final button = Press(
      onTap: enabled ? onTap : null,
      minSize: S.tap,
      scale: .975,
      child: Container(
        height: _height(size),
        padding: EdgeInsets.symmetric(horizontal: _pad(size)),
        decoration: BoxDecoration(
          gradient: C.raisedSurface,
          borderRadius: BorderRadius.circular(R.button),
          border: Border.all(color: enabled ? C.line : C.lineCool),
        ),
        child: Align(
          alignment: Alignment.center,
          widthFactor: expand ? null : 1,
          child: loading
            ? Spinner(size: size == BtnSize.l ? 20 : 16, color: C.ink)
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    NIcon(
                      icon!,
                      size: size == BtnSize.l ? 19 : 16,
                      color: enabled ? C.ink : C.ink3,
                    ),
                    const SizedBox(width: S.x8),
                  ],
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _labelStyle(size).copyWith(
                        color: enabled ? C.ink : C.ink3,
                      ),
                    ),
                  ),
                ],
              ),
        ),
      ),
    );
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// Uchinchi darajali amal — faqat chegara.
class GhostButton extends StatelessWidget {
  const GhostButton(
    this.label, {
    super.key,
    this.onTap,
    this.icon,
    this.size = BtnSize.m,
    this.expand = false,
    this.color,
  });

  final String label;
  final VoidCallback? onTap;
  final Ico? icon;
  final BtnSize size;
  final bool expand;

  /// Matn rangi — standart urg'u.
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final tint = color ?? C.accent;
    final enabled = onTap != null;
    final button = Press(
      onTap: onTap,
      minSize: S.tap,
      scale: .97,
      child: Container(
        height: _height(size),
        padding: EdgeInsets.symmetric(horizontal: _pad(size)),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(R.button),
          border: Border.all(
            color: enabled ? tint.withValues(alpha: .35) : C.lineCool,
          ),
        ),
        child: Align(
          alignment: Alignment.center,
          widthFactor: expand ? null : 1,
          child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              NIcon(icon!, size: 16, color: enabled ? tint : C.ink3),
              const SizedBox(width: S.x8),
            ],
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: _labelStyle(size).copyWith(
                  color: enabled ? tint : C.ink3,
                ),
              ),
            ),
          ],
          ),
        ),
      ),
    );
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// Xavfli amal — o'chirish, chiqish.
///
/// Qizil, lekin to'ldirilgan emas: to'ldirilgan qizil tugma
/// tasodifan bosilishga chaqiradi. Tasdiq oynasida esa
/// to'ldirilgan bo'ladi (`filled: true`).
class DangerButton extends StatelessWidget {
  const DangerButton(
    this.label, {
    super.key,
    this.onTap,
    this.loading = false,
    this.filled = false,
    this.size = BtnSize.l,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onTap;
  final bool loading;
  final bool filled;
  final BtnSize size;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null && !loading;
    final button = Press(
      onTap: enabled ? onTap : null,
      haptic: true,
      minSize: S.tap,
      scale: .975,
      child: Container(
        height: _height(size),
        padding: EdgeInsets.symmetric(horizontal: _pad(size)),
        decoration: BoxDecoration(
          color: filled
              ? C.fail.withValues(alpha: enabled ? .92 : .3)
              : C.fail.withValues(alpha: .10),
          borderRadius: BorderRadius.circular(R.button),
          border: Border.all(color: C.fail.withValues(alpha: filled ? 0 : .4)),
        ),
        child: Align(
          alignment: Alignment.center,
          widthFactor: expand ? null : 1,
          child: loading
              ? Spinner(size: 20, color: filled ? C.ink : C.fail)
              : Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _labelStyle(size).copyWith(
                    color: filled ? const Color(0xFF1A0A08) : C.fail,
                  ),
                ),
        ),
      ),
    );
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

// ─────────────────────────────────────────────────────────────
// IKONKA TUGMASI
// ─────────────────────────────────────────────────────────────

/// Dumaloq ikonka tugmasi — top bar, media boshqaruvi.
class RoundButton extends StatelessWidget {
  const RoundButton(
    this.icon, {
    super.key,
    this.onTap,
    this.size = 44,
    this.iconSize = 18,
    this.color,
    this.glass = false,
    this.accent = false,
    this.badge = 0,
  });

  final Ico icon;
  final VoidCallback? onTap;
  final double size;
  final double iconSize;
  final Color? color;

  /// Media ustida turganda shisha yuza kerak.
  final bool glass;

  /// Oltin to'ldirilgan holat.
  final bool accent;

  /// O'qilmagan soni — 0 bo'lsa ko'rsatilmaydi.
  final int badge;

  @override
  Widget build(BuildContext context) {
    Widget circle = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: accent ? C.actionFace : (glass ? null : C.raisedSurface),
        color: glass ? const Color(0x3D000000) : null,
        shape: BoxShape.circle,
        border: Border.all(color: accent ? const Color(0x00000000) : C.line),
      ),
      alignment: Alignment.center,
      child: NIcon(
        icon,
        size: iconSize,
        color: color ?? (accent ? C.onAccent : C.ink),
      ),
    );

    if (badge > 0) {
      circle = Stack(
        clipBehavior: Clip.none,
        children: [
          circle,
          Positioned(
            right: -1,
            top: -1,
            child: Container(
              constraints: const BoxConstraints(minWidth: 17, minHeight: 17),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                color: C.fail,
                shape: BoxShape.rectangle,
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: C.bg, width: 1.5),
              ),
              alignment: Alignment.center,
              child: Text(
                badge > 99 ? '99+' : '$badge',
                style: T.meta.copyWith(
                  fontSize: 9.5,
                  color: C.ink,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      );
    }

    return Press(onTap: onTap, minSize: S.tap, scale: .92, child: circle);
  }
}

// ─────────────────────────────────────────────────────────────
// YUKLANISH AYLANASI
// ─────────────────────────────────────────────────────────────

/// Aylanuvchi yoy.
///
/// Material'ning `CircularProgressIndicator` i o'rniga o'zimizniki:
/// u qalinroq va boshqa tezlikda aylanadi, dizaynga mos kelmaydi.
class Spinner extends StatefulWidget {
  const Spinner({super.key, this.size = 18, this.color, this.stroke = 2});

  final double size;
  final Color? color;
  final double stroke;

  @override
  State<Spinner> createState() => _SpinnerState();
}

class _SpinnerState extends State<Spinner> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
        width: widget.size,
        height: widget.size,
        child: AnimatedBuilder(
          animation: _c,
          builder: (context, _) => CustomPaint(
            painter: _SpinnerPainter(
              _c.value,
              widget.color ?? C.accent,
              widget.stroke,
            ),
          ),
        ),
      );
}

class _SpinnerPainter extends CustomPainter {
  _SpinnerPainter(this.t, this.color, this.stroke);

  final double t;
  final Color color;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final center = rect.center;
    final radius = (size.shortestSide - stroke) / 2;

    // Orqa halqa — aylana qayerda ekani ko'rinib tursin.
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = color.withValues(alpha: .18),
    );

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      t * 6.2831853 - 1.5708,
      1.9,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_SpinnerPainter old) =>
      old.t != t || old.color != color || old.stroke != stroke;
}
