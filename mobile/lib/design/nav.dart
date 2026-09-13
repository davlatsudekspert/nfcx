import 'package:flutter/widgets.dart';
import 'tokens.dart';

/// Ekran o'tishi — 24px siljish + xiralik, 280ms.
///
/// Material'ning standart o'tishi (pastdan yuqoriga, uzunroq) bu
/// dizaynga mos emas. Orqaga qaytish shu animatsiyani teskari o'ynaydi.
class SlidePage<Tr> extends PageRoute<Tr> {
  SlidePage({required this.builder, this.fullscreen = false});

  final WidgetBuilder builder;
  final bool fullscreen;

  @override
  Duration get transitionDuration => M.push;

  @override
  bool get opaque => true;

  @override
  bool get barrierDismissible => false;

  @override
  Color? get barrierColor => null;

  @override
  String? get barrierLabel => null;

  @override
  bool get maintainState => true;

  @override
  bool get fullscreenDialog => fullscreen;

  @override
  Widget buildPage(BuildContext c, Animation<double> a, Animation<double> s) => builder(c);

  @override
  Widget buildTransitions(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curved = CurvedAnimation(parent: animation, curve: M.curve, reverseCurve: M.curve.flipped);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween(begin: const Offset(.062, 0), end: Offset.zero).animate(curved),
        child: child,
      ),
    );
  }
}

/// Qisqa yordamchi — `Navigator.of(c).push(SlidePage(...))` ni qisqartiradi.
Future<Tr?> push<Tr>(BuildContext context, WidgetBuilder builder, {bool fullscreen = false}) =>
    Navigator.of(context).push<Tr>(SlidePage<Tr>(builder: builder, fullscreen: fullscreen));
