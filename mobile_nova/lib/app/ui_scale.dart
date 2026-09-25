import 'package:flutter/widgets.dart';

/// KATTA TELEFONDA HAMMA NARSA MUTANOSIB KATTALASHADI.
///
/// Egasi (2026-09-25): "Katta ekranli telefonlarda ikonkalar kichkina,
/// hammasi kichkina ko'rinyapti; kichik ekranlilarda hammasi yaxshi".
///
/// Flutter o'lchamlari mantiqiy pikselda: 44 dp tugma 360 dp telefonda
/// ham, 430 dp telefonda ham 44 dp. Keng ekranda u ekranning kichikroq
/// ulushini egallaydi — ilova "maydalashib" qoladi. Dizayn 390 dp ga
/// chizilgan; undan KENG telefonlarda butun ilova (matn, belgi, bo'shliq,
/// dialog, klaviatura bilan birga) shu nisbatda kattalashadi.
///
///   • 390 dp va kichik — o'zgarishsiz (kichik telefonlar "yaxshi");
///   • 412 dp ≈ ×1.06, 430 dp ≈ ×1.10;
///   • ko'pi bilan ×1.15; planshet (≥600 dp) — o'zgarishsiz.
///
/// Usul: ichkaridagi hamma narsa ekranni `kenglik / f` o'lchamda deb
/// ko'radi va natija `f` marta kattalashtirib chiziladi. Bosish, surish
/// va klaviatura ham shu nisbatda o'giriladi (Flutter transform orqali
/// hit-test qiladi).
class UiScale extends StatelessWidget {
  const UiScale({super.key, required this.child});

  final Widget child;

  static const double designWidth = 390;
  static const double maxFactor = 1.15;

  static double factorFor(Size size) {
    final w = size.shortestSide;
    if (w <= designWidth || w >= 600) return 1;
    return (w / designWidth).clamp(1.0, maxFactor);
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final f = factorFor(mq.size);
    if (f == 1) return child;
    EdgeInsets s(EdgeInsets e) => e / f;
    final inner = mq.copyWith(
      size: mq.size / f,
      devicePixelRatio: mq.devicePixelRatio * f,
      padding: s(mq.padding),
      viewPadding: s(mq.viewPadding),
      viewInsets: s(mq.viewInsets),
      systemGestureInsets: s(mq.systemGestureInsets),
    );
    return SizedBox.expand(
      child: FittedBox(
        fit: BoxFit.fill,
        alignment: Alignment.topLeft,
        child: SizedBox(
          width: inner.size.width,
          height: inner.size.height,
          child: MediaQuery(data: inner, child: child),
        ),
      ),
    );
  }
}
