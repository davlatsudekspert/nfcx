import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter/widgets.dart';

import '../tokens.dart';

/// BOSISH — 120 ms masshtab.
///
/// Material'ning to'lqin (ripple) effekti o'rniga butun ilovada shu
/// ishlatiladi. Sabab: to'lqin metall yuzada "suv" bo'lib ko'rinadi
/// va dizayn tilini buzadi. Masshtab esa har qanday yuzada tabiiy —
/// element barmoq ostida bir oz "bosiladi".
///
/// BOSISH MAYDONI: `minSize` standart 48 dp. Kichik ikonka
/// tugmalarida ham bosish maydoni shundan kichik bo'lmaydi —
/// dizayn talabi. Ko'rinadigan o'lcham kichik qolaveradi.
class Press extends StatefulWidget {
  const Press({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.haptic = false,
    this.scale = .97,
    this.minSize = S.tap,
    this.behavior = HitTestBehavior.opaque,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  /// Muhim amallarda (layk, tasdiq, NFC) yengil tebranish.
  final bool haptic;

  /// Katta yuzalar kamroq bosiladi — aks holda butun karta
  /// "sakraydi".
  final double scale;

  /// Eng kichik bosish maydoni. `0` — o'lchov qo'llanmaydi (ro'yxat
  /// qatori kabi allaqachon katta elementlarda).
  final double minSize;

  final HitTestBehavior behavior;

  @override
  State<Press> createState() => _PressState();
}

class _PressState extends State<Press> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: M.press,
    reverseDuration: M.press,
  );

  late final Animation<double> _scale = Tween<double>(
    begin: 1,
    end: widget.scale,
  ).animate(CurvedAnimation(parent: _c, curve: M.curve));

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  bool get _enabled => widget.onTap != null || widget.onLongPress != null;

  void _down(_) {
    if (_enabled) _c.forward();
  }

  void _up([_]) {
    if (_c.status != AnimationStatus.dismissed) _c.reverse();
  }

  @override
  Widget build(BuildContext context) {
    Widget child = ScaleTransition(scale: _scale, child: widget.child);

    if (widget.minSize > 0) {
      child = ConstrainedBox(
        constraints: BoxConstraints(
          minWidth: widget.minSize,
          minHeight: widget.minSize,
        ),
        child: Center(widthFactor: 1, heightFactor: 1, child: child),
      );
    }

    return GestureDetector(
      behavior: widget.behavior,
      onTapDown: _enabled ? _down : null,
      onTapUp: _enabled ? _up : null,
      onTapCancel: _enabled ? _up : null,
      onTap: widget.onTap == null
          ? null
          : () {
              if (widget.haptic) HapticFeedback.lightImpact();
              widget.onTap!();
            },
      onLongPress: widget.onLongPress == null
          ? null
          : () {
              HapticFeedback.mediumImpact();
              widget.onLongPress!();
            },
      child: child,
    );
  }
}
