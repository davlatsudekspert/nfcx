import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import '../tokens.dart';

/// Bosish javobi — scale(.97), 120ms.
///
/// NIMA UCHUN ALOHIDA WIDGET: Material'ning ripple effekti bu dizaynga
/// mos kelmaydi (och dog' qorong'i yuzada iflos ko'rinadi). Handoff
/// aniq aytadi: bosishda element kichrayadi, asosiy amallarda yengil
/// haptika qo'shiladi.
///
/// TEZLIK: `AnimatedScale` faqat shu shoxchani qayta chizadi —
/// `setState` bilan butun ekranni qayta qurmaydi.
class Press extends StatefulWidget {
  const Press({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.haptic = false,
    this.scale = .97,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  /// Asosiy amallar va shaxs almashtirishda `true`.
  final bool haptic;
  final double scale;

  @override
  State<Press> createState() => _PressState();
}

class _PressState extends State<Press> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null || widget.onLongPress != null;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: enabled ? (_) => _set(true) : null,
      onTapUp: enabled ? (_) => _set(false) : null,
      onTapCancel: enabled ? () => _set(false) : null,
      onTap: enabled
          ? () {
              if (widget.haptic) HapticFeedback.lightImpact();
              widget.onTap?.call();
            }
          : null,
      onLongPress: widget.onLongPress,
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: M.press,
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}
