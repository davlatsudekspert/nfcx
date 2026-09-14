import 'package:flutter/widgets.dart';
import '../../design/components/icons.dart';
import '../../design/components/press.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';

/// Ichki ekranlarning sarlavha qatori: orqaga, sarlavha, o'ngdagi amal.
///
/// Balandlik QAT'IY 52 — ekrandan ekranga o'tganda sarlavha "sakramaydi".
class TopBar extends StatelessWidget {
  const TopBar({
    super.key,
    this.title,
    this.subtitle,
    this.trailing,
    this.showBack = true,
  });

  final String? title;
  final String? subtitle;
  final Widget? trailing;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    // ORQAGA TUGMASI FAQAT QAYTADIGAN JOY BO'LSA.
    //
    // Ilgari u HAR DOIM chizilardi. Tab ildizida (profil tabi,
    // Discover) esa qaytadigan ekran yo'q — `maybePop()` hech narsa
    // qilmasdi va tugma BOSILGANDA JAVOB BERMASDI. Qurilmada
    // sinovda aynan shu "nazad ishlamayapti" deb xabar qilindi.
    //
    // `canPop()` — Navigator'ning o'z javobi: bu ekran stekda
    // yolg'izmi yoki ostida boshqasi bormi.
    final canBack = showBack && Navigator.of(context).canPop();

    return SizedBox(
        height: 52,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: S.x12),
          child: Row(
            children: [
              if (canBack)
                Press(
                  onTap: () => Navigator.of(context).maybePop(),
                  child: const Padding(
                    padding: EdgeInsets.all(S.x8),
                    child: NIcon(Ico.chevronLeft, size: 22, color: C.offWhite),
                  ),
                )
              else
                const SizedBox(width: S.x8),
              const SizedBox(width: 2),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (title != null)
                      Text(title!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: T.section.copyWith(fontSize: 15.5)),
                    if (subtitle != null)
                      Text(subtitle!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: T.caption.copyWith(fontSize: 11)),
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
        ),
      );
  }
}

/// Ekran sarlavhasi — tab ildizlarida (Discover, NFC) ishlatiladi.
class ScreenTitle extends StatelessWidget {
  const ScreenTitle(this.title, {super.key, this.subtitle, this.trailing});

  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x12, S.gutter, S.x20),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: T.screenTitle),
                  if (subtitle != null) ...[
                    const SizedBox(height: 3),
                    Text(subtitle!, style: T.screenSub),
                  ],
                ],
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: S.x12), trailing!],
          ],
        ),
      );
}
