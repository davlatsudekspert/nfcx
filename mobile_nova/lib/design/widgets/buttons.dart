import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';
import 'surfaces.dart';

enum ButtonTone { accent, quiet, outline, danger }

/// Ilovaning yagona tugmasi.
///
/// `ElevatedButton`/`TextButton` ishlatilmaydi: ularning holat ranglari,
/// to'lqin effekti va balandligi Material'dan keladi va mavzu bilan
/// to'liq moslashmaydi.
class NovaButton extends StatelessWidget {
  const NovaButton({
    super.key,
    required this.label,
    this.onPressed,
    this.tone = ButtonTone.accent,
    this.icon,
    this.busy = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final ButtonTone tone;
  final IconData? icon;

  /// Yuklanayotganda tugma yozuvi joyida qoladi, ustiga aylanma chiqadi:
  /// matnni olib tashlash tugma kengligini sakratardi.
  final bool busy;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final disabled = onPressed == null || busy;

    final (bg, fg, border, gradient) = switch (tone) {
      ButtonTone.accent => (null, t.onAccent, null, t.accentGradient),
      ButtonTone.quiet => (t.surface2, t.text1, t.border2, null),
      ButtonTone.outline => (Colors.transparent, t.accent2, t.accent2, null),
      ButtonTone.danger => (t.error.withValues(alpha: .14), t.error, t.error.withValues(alpha: .4), null),
    };

    return Semantics(
      button: true,
      enabled: !disabled,
      label: label,
      child: PressableScale(
        onTap: disabled ? null : onPressed,
        child: AnimatedOpacity(
          opacity: disabled && !busy ? .45 : 1,
          duration: Motion.fast,
          child: AnimatedContainer(
            duration: Motion.theme,
            curve: Motion.smooth,
            width: expand ? double.infinity : null,
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
            decoration: BoxDecoration(
              color: bg,
              gradient: gradient,
              borderRadius: R.pill,
              border: border == null ? null : Border.all(color: border, width: 1.4),
              boxShadow: tone == ButtonTone.accent ? t.shadowSoft : null,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (busy) ...[
                  SizedBox(
                    width: 15,
                    height: 15,
                    child: CircularProgressIndicator(strokeWidth: 2, color: fg),
                  ),
                  const SizedBox(width: 10),
                ] else if (icon != null) ...[
                  Icon(icon, size: 17, color: fg),
                  const SizedBox(width: 9),
                ],
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'Manrope',
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: .2,
                      color: fg,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Dumaloq ikonka tugmasi — sarlavha qatori va suzuvchi boshqaruvlar.
class NovaIconButton extends StatelessWidget {
  const NovaIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.tooltip,
    this.size = 42,
    this.filled = false,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final String? tooltip;
  final double size;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Tooltip(
      message: tooltip ?? '',
      child: Semantics(
        button: true,
        label: tooltip,
        child: PressableScale(
          onTap: onPressed,
          child: AnimatedContainer(
            duration: Motion.theme,
            width: size,
            height: size,
            decoration: BoxDecoration(
              color: filled ? null : t.surface2,
              gradient: filled ? t.accentGradient : null,
              shape: BoxShape.circle,
              border: Border.all(color: t.border2),
              boxShadow: filled ? t.shadowTiny : null,
            ),
            child: Icon(
              icon,
              size: size * .44,
              color: filled ? t.onAccent : t.text1,
            ),
          ),
        ),
      ),
    );
  }
}
