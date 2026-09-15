import 'package:flutter/widgets.dart';

import '../tokens.dart';
import '../type.dart';
import 'icons.dart';
import 'media.dart';
import 'press.dart';

/// STORY HALQASI — avatar atrofidagi aylanuvchi oltin halqa.
///
/// HALQA RANGI MA'NO TASHIYDI (dizayn qoidasi):
/// • oltin halqa — ko'rilmagan story bor;
/// • yashil-oltin halqa — Reels bor;
/// • tekis kulrang halqa — hammasi ko'rilgan;
/// • punktir + "+" — o'zingizning story qo'shish tugmangiz.
///
/// Halqa 9 sekundda bir marta aylanadi — sezilar-sezilmas. Tez
/// aylanish e'tiborni kontentdan tortib oladi. Harakatni
/// kamaytirish rejimida halqa qotib qoladi, rangi qoladi.
class StoryRing extends StatefulWidget {
  const StoryRing({
    super.key,
    this.avatarUrl,
    this.name = '',
    this.size = 58,
    this.seen = false,
    this.reels = false,
    this.addButton = false,
    this.showLabel = true,
    this.onTap,
  });

  final String? avatarUrl;
  final String name;
  final double size;

  /// Hammasi ko'rilgan — halqa so'nadi.
  final bool seen;

  /// Reels bor — yashil-oltin halqa.
  final bool reels;

  /// "+" tugmasi — o'z storyingizni qo'shish.
  final bool addButton;

  final bool showLabel;
  final VoidCallback? onTap;

  @override
  State<StoryRing> createState() => _StoryRingState();
}

class _StoryRingState extends State<StoryRing>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: M.ring,
  );

  bool _spinning = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(StoryRing old) {
    super.didUpdateWidget(old);
    _sync();
  }

  void _sync() {
    final should =
        !widget.seen && !widget.addButton && !reduceMotion(context);
    if (should == _spinning) return;
    _spinning = should;
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
    final size = widget.size;

    Widget ring;
    if (widget.addButton) {
      ring = _AddRing(size: size);
    } else {
      final gradient = widget.reels ? C.reelsRing : C.storyRing;
      final inner = Container(
        margin: const EdgeInsets.all(2.4),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          // Fon rangidagi ingichka halqa — gradient bilan avatar
          // orasidagi nafas.
          border: Border.all(color: C.bg, width: 2),
        ),
        child: ClipOval(
          child: Avatar(
            url: widget.avatarUrl,
            name: widget.name,
            size: size,
          ),
        ),
      );

      ring = SizedBox(
        width: size,
        height: size,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (widget.seen)
              DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: C.ink3.withValues(alpha: .55),
                    width: 1.6,
                  ),
                ),
              )
            else
              // `RotationTransition` — burilishni o'lchash mumkin
              // bo'lgan standart widget. `Transform.rotate` bilan
              // ham bo'lardi, lekin unda tashqaridan (masalan
              // testdan) burilish qiymatini o'qib bo'lmaydi.
              RotationTransition(
                turns: _c,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: gradient,
                  ),
                ),
              ),
            inner,
          ],
        ),
      );
    }

    if (!widget.showLabel) {
      return Press(onTap: widget.onTap, minSize: 0, scale: .93, child: ring);
    }

    return Press(
      onTap: widget.onTap,
      minSize: 0,
      scale: .95,
      child: SizedBox(
        width: size + 12,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ring,
            const SizedBox(height: 7),
            Text(
              widget.addButton ? 'Story' : widget.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: T.navLabel.copyWith(
                color: widget.seen ? C.ink3 : C.ink2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// "+" halqasi — o'z story'ingizni qo'shish.
class _AddRing extends StatelessWidget {
  const _AddRing({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: C.raisedSurface,
          border: Border.all(
            color: C.accent.withValues(alpha: .55),
            width: 1.4,
          ),
        ),
        alignment: Alignment.center,
        child: NIcon(Ico.plus, size: size * .34, color: C.accent),
      );
}
