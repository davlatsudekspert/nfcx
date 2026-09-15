import 'package:flutter/widgets.dart';

import '../tokens.dart';
import '../type.dart';
import 'buttons.dart';
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
                onTap: onBack ?? () => Navigator.of(context).maybePop(),
              )
            else
              const SizedBox(width: 42),
            Expanded(
              child: center != null
                  ? Center(child: center!)
                  : (title ?? '').isEmpty
                      ? const SizedBox.shrink()
                      : Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: S.x12,
                          ),
                          child: Text(
                            title!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: T.titleSm.copyWith(fontSize: 24),
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
    this.subtitle,
    this.eyebrow,
    this.trailing,
  });

  final String title;
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

/// TAB PANELI USTIMDA TURIBDIMI VA U QANCHA JOY EGALLAYDI.
///
/// HAQIQIY XATO, EGASI IKKI SURAT BILAN KO'RSATDI: "Sotib olish"
/// va "Buyurtma berish" tugmalari ko'rinmay qolgan.
///
/// SABABI. Pastki tab paneli dizayn bo'yicha kontent USTIDA
/// suzadi (Shell'dagi `Stack`). Tab ichidan ochilgan ekran ham
/// o'sha stekda, ya'ni uning eng pastki qismi — aynan asosiy
/// amal tugmasi turadigan joy — panel ostida qoladi.
///
/// Ilovada bu 12 ta ekranga tegishli edi va har birida alohida
/// hisoblash qo'shish kerak bo'lardi. Shuning uchun o'lchov
/// YUQORIDAN beriladi: qobiq "mening ustimda shuncha panel bor"
/// deydi, `StickyBar` esa uni o'zi hisobga oladi.
class ShellChrome extends InheritedWidget {
  const ShellChrome({super.key, required this.bottom, required super.child});

  /// Kontent ustida suzib turgan panelning balandligi.
  final double bottom;

  static double of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<ShellChrome>()?.bottom ?? 0;

  @override
  bool updateShouldNotify(ShellChrome old) => old.bottom != bottom;
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

  /// Ro'yxat oxiriga qo'shiladigan bo'sh joy.
  static double inset(BuildContext context) =>
      MediaQuery.of(context).padding.bottom + 96 + ShellChrome.of(context);

  @override
  Widget build(BuildContext context) {
    // Tizim paneli (jest chizig'i) VA tab paneli — ikkalasi ham
    // hisobga olinadi. Tab ichida bo'lmasa ikkinchisi nol.
    final safe = MediaQuery.of(context).padding.bottom;
    final chrome = ShellChrome.of(context);
    return Container(
      padding: padding ??
          EdgeInsets.fromLTRB(
            S.gutter,
            S.x20,
            S.gutter,
            // Tab paneli safe-area'ni O'ZI ichiga oladi, shuning
            // uchun u bor bo'lganda pastdagi joy ikki marta
            // qo'shilmaydi.
            (chrome > 0 ? chrome : safe) + S.x16,
          ),
      decoration: BoxDecoration(gradient: C.bottomScrim),
      child: child,
    );
  }
}
