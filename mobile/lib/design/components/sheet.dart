import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart'
    show AnimationStyle, showModalBottomSheet;
import 'package:flutter/widgets.dart';

import '../feedback.dart';
import '../tokens.dart';
import '../type.dart';
import 'buttons.dart';
import 'icons.dart';
import 'press.dart';

/// PASTKI OYNA (SHEET) — shisha, radius 30, 280 ms.
///
/// Ilovadagi barcha qo'shimcha oqimlar shu yerda ochiladi: "⋯"
/// menyusi, tanlov ro'yxati, tasdiq, xato. Dialog QUTISI
/// ishlatilmaydi — mobil ekranda pastki oyna barmoqqa yaqinroq.
///
/// ORQA FON XIRALASHADI (blur 22) — dizayn qoidasi. Bu shunchaki
/// bezak emas: ortidagi kontent o'qilmay qolsa, diqqat oynaga
/// to'planadi.

Future<Tr?> showSheet<Tr>(
  BuildContext context, {
  required String title,
  String? subtitle,
  required Widget child,
  /// YOPISHGAN PASTKI QISM — surilma ICHIDA emas, ostida.
  /// Izoh maydoni va yuborish tugmasi shu yerga qo'yiladi:
  /// ro'yxat uzun bo'lsa ham ular doim ko'rinib turadi.
  Widget? footer,
  bool dismissible = true,
}) =>
    showModalBottomSheet<Tr>(
      context: context,
      // ILDIZ NAVIGATORDA OCHILADI.
      //
      // Aks holda varaqa QOBIQ navigatori ichida chiziladi va
      // pastki panel (NFC orbi bilan) uning USTIGA tushadi:
      // izoh maydoni ko'rinardi, YUBORISH tugmasi esa panel
      // ostida qolib ketardi — odam yozgan gapini yubora olmasdi.
      useRootNavigator: true,
      isScrollControlled: true,
      isDismissible: dismissible,
      enableDrag: dismissible,
      backgroundColor: const Color(0x00000000),
      barrierColor: C.backdrop.withValues(alpha: .72),
      useSafeArea: true,
      sheetAnimationStyle: AnimationStyle(
        duration: M.sheet,
        reverseDuration: M.fade,
        curve: M.curve,
        reverseCurve: Curves.easeIn,
      ),
      builder: (context) => SheetBody(
        title: title,
        subtitle: subtitle,
        footer: footer,
        child: child,
      ),
    );

/// XATO OYNASI — bitta joyda, bitta ko'rinishda.
///
/// Xato har doim TEBRANISH bilan keladi: foydalanuvchi ekranga
/// qaramayotgan bo'lsa ham nimadir bo'lganini sezadi.
Future<void> showError(BuildContext context, String message) async {
  await errorHaptic();
  if (!context.mounted) return;
  await showSheet<void>(
    context,
    title: 'Bajarilmadi',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: C.fail.withValues(alpha: .13),
                shape: BoxShape.circle,
                border: Border.all(color: C.fail.withValues(alpha: .35)),
              ),
              alignment: Alignment.center,
              child: NIcon(Ico.warning, size: 18, color: C.fail),
            ),
            const SizedBox(width: S.x12),
            Expanded(child: Text(message, style: T.body)),
          ],
        ),
        const SizedBox(height: S.x24),
        SecondaryButton(
          'Tushundim',
          onTap: () => Navigator.of(context).pop(),
        ),
      ],
    ),
  );
}

/// TASDIQ OYNASI — oqibati aniq yozilgan.
///
/// Xavfli amallarda (post o'chirish, hisobni o'chirish) dizayn
/// oqibatni ANIQ yozishni talab qiladi: "Post, uning 248 layki va
/// 32 izohi olib tashlanadi. Bu amalni qaytarib bo'lmaydi."
Future<bool> confirmSheet(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Ha',
  String cancelLabel = 'Bekor qilish',
  bool danger = true,
}) async {
  final result = await showSheet<bool>(
    context,
    title: title,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(message, style: T.body),
        const SizedBox(height: S.x24),
        if (danger)
          DangerButton(
            confirmLabel,
            filled: true,
            onTap: () => Navigator.of(context).pop(true),
          )
        else
          PrimaryButton(
            confirmLabel,
            onTap: () => Navigator.of(context).pop(true),
          ),
        const SizedBox(height: S.x8),
        GhostButton(
          cancelLabel,
          expand: true,
          color: C.ink2,
          onTap: () => Navigator.of(context).pop(false),
        ),
      ],
    ),
  );
  return result ?? false;
}

// ─────────────────────────────────────────────────────────────

/// Oynaning korpusi — shisha, tutqich, sarlavha.
class SheetBody extends StatelessWidget {
  const SheetBody({
    super.key,
    required this.title,
    this.subtitle,
    this.footer,
    required this.child,
  });

  final String title;
  final String? subtitle;
  final Widget child;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    // Klaviatura ochilganda oyna uning ustiga ko'tariladi —
    // tugma klaviatura ostida qolmasin (dizayn talabi).
    final keyboard = media.viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: keyboard),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: media.size.height * .86),
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(R.sheet),
          ),
          child: BackdropFilter(
            filter: ImageFilter.blur(
              sigmaX: C.blurSheet,
              sigmaY: C.blurSheet,
            ),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: C.surface.withValues(alpha: .92),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(R.sheet),
                ),
                border: Border(
                  top: BorderSide(color: C.line),
                ),
                boxShadow: C.sheetShadow,
              ),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Tutqich — 40×4.
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        margin: const EdgeInsets.only(top: 10, bottom: S.x16),
                        decoration: BoxDecoration(
                          color: C.ink3.withValues(alpha: .55),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: S.gutter,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: T.h2),
                          if ((subtitle ?? '').isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(subtitle!, style: T.caption),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: S.x20),
                    Flexible(
                      child: SingleChildScrollView(
                        padding: EdgeInsets.only(
                          left: S.gutter,
                          right: S.gutter,
                          bottom: S.x16 + media.padding.bottom,
                        ),
                        child: child,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// MENYU QATORI
// ─────────────────────────────────────────────────────────────

/// "⋯" menyusidagi bitta amal.
class SheetAction extends StatelessWidget {
  const SheetAction({
    super.key,
    required this.label,
    required this.icon,
    this.onTap,
    this.danger = false,
    this.subtitle,
  });

  final String label;
  final Ico icon;
  final VoidCallback? onTap;
  final bool danger;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final tint = danger ? C.fail : C.ink;
    return Press(
      onTap: onTap,
      minSize: 0,
      scale: .99,
      child: Container(
        constraints: const BoxConstraints(minHeight: S.tap + 6),
        padding: const EdgeInsets.symmetric(vertical: S.x12),
        child: Row(
          children: [
            NIcon(icon, size: 20, color: tint),
            const SizedBox(width: S.x16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(label, style: T.cardTitle.copyWith(color: tint)),
                  if ((subtitle ?? '').isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(subtitle!, style: T.caption.copyWith(fontSize: 12.5)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
