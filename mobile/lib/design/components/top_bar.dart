import 'package:flutter/widgets.dart';

import '../tokens.dart';
import '../type.dart';
import '../../screens/shell.dart';
import 'buttons.dart';
import 'nav_bar.dart';
import 'icons.dart';

/// EKRAN TEPASI — orqaga tugmasi, sarlavha, o'ng amal.
///
/// Balandligi 56 dp va status bar ostida turadi. Sarlavha ikki xil
/// bo'ladi:
///
/// • **Ixcham** (`compact: true`) — sarlavha tepa qatorida, o'rtada
///   yoki chapda. Forma va ichki ekranlarda.
/// • **Katta** — tepa qatorida faqat tugmalar, sarlavha esa ostida
///   katta serif bilan. Bosh ekranlarda.
///
/// ORQAGA TUGMASI faqat qaytadigan joy bo'lsa chiziladi
/// (`Navigator.canPop`). Tab ildizida u yo'q — bosilganda hech
/// nima bo'lmasligi foydalanuvchini adashtiradi.
class TopBar extends StatelessWidget {
  const TopBar({
    super.key,
    this.title,
    this.center,
    this.trailing,
    this.leading,
    this.showBack = true,
    this.onBack,
    this.glass = false,
  });

  /// Tepa qatoridagi ixcham sarlavha.
  final String? title;

  /// Sarlavha o'rniga widget (masalan "NFC TEGIZISHDAN" chipi).
  final Widget? center;

  final Widget? trailing;

  /// Orqaga tugmasi o'rniga boshqa element.
  final Widget? leading;

  final bool showBack;
  final VoidCallback? onBack;

  /// Qator MEDIA USTIDA suzadi (profil coveri). Shunda tugmalar
  /// shisha bo'lishi kerak — to'ldirilgan doira rasmni "teshib"
  /// turadi va prototipdagi suzuvchi ko'rinish yo'qoladi.
  final bool glass;

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.of(context).canPop();
    final back = showBack && (canPop || onBack != null);

    return Padding(
      padding: const EdgeInsets.fromLTRB(S.x16, S.x8, S.x16, S.x8),
      child: SizedBox(
        height: S.tap,
        child: Row(
          children: [
            if (leading != null)
              leading!
            else if (back)
              RoundButton(
                Ico.back,
                size: 42,
                iconSize: 17,
                glass: glass,
                onTap: onBack ?? () => Navigator.of(context).maybePop(),
              )
            else
              const SizedBox(width: 42),
            Expanded(
              child: center != null
                  ? Center(child: center!)
                  : (title ?? '').isEmpty
                      ? const SizedBox.shrink()
                      // ICHKI EKRAN SARLAVHASI — MONO, KATTA HARF,
                      // MARKAZDA (prototip: `.topbar` ustidagi
                      // "ID TAFSILOTI", "TEG MA'LUMOTI", ...).
                      //
                      // Katta serif sarlavha faqat TAB ILDIZLARIDA
                      // qoladi: ichki ekranda u qaytish tugmasi bilan
                      // bir qatorda turolmaydi va ikki qatorga
                      // tushib ketardi.
                      : Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: S.x8,
                          ),
                          child: Text(
                            title!.toUpperCase(),
                            maxLines: 1,
                            textAlign: TextAlign.center,
                            overflow: TextOverflow.ellipsis,
                            style: T.eyebrow.copyWith(color: C.ink2),
                          ),
                        ),
            ),
            if (trailing != null) trailing! else const SizedBox(width: 42),
          ],
        ),
      ),
    );
  }
}

/// Katta ekran sarlavhasi — tepa qatoridan alohida, serif bilan.
class ScreenTitle extends StatelessWidget {
  const ScreenTitle(
    this.title, {
    super.key,
    this.accent,
    this.subtitle,
    this.eyebrow,
    this.trailing,
  });

  final String title;

  /// Sarlavhaning kursiv, urg'u rangidagi ikkinchi qismi.
  final String? accent;
  final String? subtitle;
  final String? eyebrow;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, S.x16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if ((eyebrow ?? '').isNotEmpty) ...[
                    Text(eyebrow!.toUpperCase(), style: T.eyebrow),
                    const SizedBox(height: 6),
                  ],
                  // HERO SARLAVHA — ikkinchi qismi KURSIV va URG'U
                  // RANGIDA (prototip: `h1.hero em`). Matn "Kimni
                  // topamiz?" kabi ikki qismdan iborat bo'lsa, urg'u
                  // ikkinchisiga tushadi.
                  if (accent != null && accent!.isNotEmpty)
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: '$title ', style: T.title),
                          TextSpan(
                            text: accent,
                            style: T.title.copyWith(
                              color: C.accent,
                              fontStyle: FontStyle.italic,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    Text(title, style: T.title),
                  if ((subtitle ?? '').isNotEmpty) ...[
                    const SizedBox(height: S.x8),
                    Text(subtitle!, style: T.caption),
                  ],
                ],
              ),
            ),
            if (trailing != null) ...[
              const SizedBox(width: S.x12),
              trailing!,
            ],
          ],
        ),
      );
}

/// Yopishgan pastki panel — "Kontaktni saqlash" kabi asosiy amal.
///
/// Kontent panel ostida qolmasligi uchun ro'yxatga `bottomInset`
/// qadar bo'sh joy qo'shiladi. Panel ostida yumshoq scrim bor:
/// kontent panel chekkasida keskin kesilmasin.
class StickyBar extends StatelessWidget {
  const StickyBar({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  /// QOBIQNING PASTKI PANELI USTIGA TUSHMASLIK UCHUN QO'SHIMCHA.
  ///
  /// Tab ichidan ochilgan ekran QOBIQ navigatorida chiziladi va
  /// pastki panel (NFC orbi bilan) uning USTIGA tushadi. Shu
  /// sababli "To'lov usuli" dagi Payme/Click tugmalari panel
  /// ostida qolib ketardi — ekranda ko'rinardi, lekin bosib
  /// bo'lmasdi. Ildizdagi ekranlarda (kirish, splash) panel yo'q,
  /// shuning uchun bu joy ham qo'shilmaydi.
  static double _shellBar(BuildContext context) =>
      ShellScope.maybeOf(context) == null ? 0 : NavBar.barHeight;

  /// Ro'yxat oxiriga qo'shiladigan bo'sh joy.
  static double inset(BuildContext context) =>
      MediaQuery.of(context).padding.bottom + 96 + _shellBar(context);

  @override
  Widget build(BuildContext context) => Container(
        padding: padding ??
            EdgeInsets.fromLTRB(
              S.gutter,
              S.x20,
              S.gutter,
              MediaQuery.of(context).padding.bottom + S.x16 + _shellBar(context),
            ),
        decoration: BoxDecoration(gradient: C.bottomScrim),
        child: child,
      );
}
