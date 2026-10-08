import 'package:cupertino_ui/cupertino_ui.dart'
    show CupertinoPageTransitionsBuilder;
import 'package:material_ui/material_ui.dart';

import 'tokens.dart';

/// Android: 200 ms yumshoq fade + kichik siljish. Reduced motion yoqilgan
/// bo'lsa animatsiyasiz.
class LgPageTransitionsBuilder extends PageTransitionsBuilder {
  const LgPageTransitionsBuilder();

  @override
  Duration get transitionDuration => LgMotion.page;

  @override
  Duration get reverseTransitionDuration => LgMotion.page;

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (LgMotion.reduced(context)) return child;
    final curved = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween(
          begin: const Offset(0.04, 0),
          end: Offset.zero,
        ).animate(curved),
        child: child,
      ),
    );
  }
}

/// iOS'da tizimning chetdan surib orqaga qaytish imo-ishorasi saqlanadi
/// (Cupertino o'tishi), Android'da 200 ms o'tish.
const lgPageTransitions = PageTransitionsTheme(
  builders: {
    TargetPlatform.android: LgPageTransitionsBuilder(),
    TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
    TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
    TargetPlatform.linux: LgPageTransitionsBuilder(),
    TargetPlatform.windows: LgPageTransitionsBuilder(),
    TargetPlatform.fuchsia: LgPageTransitionsBuilder(),
  },
);
