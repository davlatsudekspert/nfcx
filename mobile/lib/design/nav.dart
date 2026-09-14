import 'package:flutter/widgets.dart';

import 'tokens.dart';

/// EKRAN O'TISHI — 280 ms xiralik + 8 dp siljish.
///
/// Dizayn spetsifikatsiyasi aynan shuni belgilaydi va bu butun
/// ilovadagi YAGONA o'tish. Nima uchun bunchalik kichik siljish:
/// katta siljish (Material'ning standart yarim ekrani) mobil
/// ekranda "sakrash" bo'lib ko'rinadi. 8 dp — ko'z yo'nalishni
/// sezadi, lekin harakat oqib o'tadi.
///
/// Orqaga qaytishda ham xuddi shu o'tish teskari yo'nalishda
/// ishlaydi (`curve.flipped`), shuning uchun oldinga va orqaga
/// harakat bir xil his beradi.
class SlidePage<Tr> extends PageRoute<Tr> {
  SlidePage({required this.builder, this.fullscreen = false});

  final WidgetBuilder builder;

  /// To'liq ekran (Reels, story ko'ruvchi, media tanlash) — ostidagi
  /// ekran ko'rinmaydi.
  final bool fullscreen;

  @override
  Duration get transitionDuration => M.push;

  @override
  Duration get reverseTransitionDuration => M.push;

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
  Widget buildPage(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
  ) =>
      builder(context);

  @override
  Widget buildTransitions(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: M.curve,
      reverseCurve: M.curve.flipped,
    );
    return FadeTransition(
      opacity: curved,
      child: AnimatedBuilder(
        animation: curved,
        builder: (context, inner) => Transform.translate(
          // 8 dp o'ngdan chapga. `Transform` ishlatiladi, chunki
          // `SlideTransition` foizda o'lchaydi — ekran kengligiga
          // bog'liq bo'lib qoladi, bizga esa aniq dp kerak.
          offset: Offset((1 - curved.value) * M.shift, 0),
          child: inner,
        ),
        child: child,
      ),
    );
  }
}

/// Ekran ochish. Butun ilovada `Navigator.push(MaterialPageRoute(...))`
/// o'rniga SHU ishlatiladi — shunda o'tish hamma joyda bir xil.
Future<Tr?> push<Tr>(
  BuildContext context,
  WidgetBuilder builder, {
  bool fullscreen = false,
}) =>
    Navigator.of(context).push<Tr>(
      SlidePage<Tr>(builder: builder, fullscreen: fullscreen),
    );
