import 'dart:ui';

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';

/// Suzuvchi sirt — Concept B'dagi asosiy konteyner.
///
/// Orqa fon YARIM SHAFFOF va orqasidagi ambient dog'lar bulut kabi
/// ko'rinib turadi (`BackdropFilter`). Shuning uchun bir xil kartalar
/// ham har ekranda biroz boshqacha ko'rinadi — maket "yopishqoq"
/// bo'lib qolmaydi.
class FloatingSurface extends StatelessWidget {
  const FloatingSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(Gap.xl),
    this.borderRadius = R.soft,
    this.elevated = false,
    this.solid = false,
    this.onTap,
    this.border = true,
  });

  final Widget child;
  final EdgeInsets padding;
  final BorderRadius borderRadius;

  /// Kuchliroq soya — modal va hero obyektlar uchun.
  final bool elevated;

  /// Shaffoflikni o'chiradi: ro'yxat ichidagi ko'p elementda `BackdropFilter`
  /// qimmatga tushadi, shuning uchun uzun ro'yxatlarda `solid: true`.
  final bool solid;
  final bool border;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final body = AnimatedContainer(
      duration: Motion.theme,
      curve: Motion.smooth,
      padding: padding,
      decoration: BoxDecoration(
        color: solid ? t.surfaceSolid : t.surface,
        borderRadius: borderRadius,
        border: border ? Border.all(color: t.border2, width: 1) : null,
        boxShadow: elevated ? t.shadowFloat : t.shadowSoft,
      ),
      child: child,
    );

    final clipped = solid
        ? body
        : ClipRRect(
            borderRadius: borderRadius,
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
              child: body,
            ),
          );

    if (onTap == null) return clipped;
    return PressableScale(onTap: onTap!, child: clipped);
  }
}

/// Kapsula — Concept B'ning "chip" i: yorliq, filtr, statistika, harakat.
class Capsule extends StatelessWidget {
  const Capsule({
    super.key,
    required this.label,
    this.icon,
    this.selected = false,
    this.onTap,
    this.tone,
    this.dense = false,
  });

  final String label;
  final IconData? icon;
  final bool selected;
  final VoidCallback? onTap;

  /// Aksent rangi — `null` bo'lsa mavzuning asosiy aksenti.
  final Color? tone;
  final bool dense;

  /// Kapsulalar qatorining (gorizontal ro'yxat) balandligi.
  ///
  /// QATOR SHRIFT BILAN O'SADI, KICHRAYMAYDI.
  ///
  /// Qator balandligi qattiq yozilganda (`40`) telefonda shrift
  /// kattalashtirilsa (ilova 1.3 gacha ruxsat beradi) yorliq pastdan
  /// kesilardi: "People" → "Peoole", "Katalog" → "Kataloa". Yorliq
  /// qator balandligini mavzudan meros oladi (`bodyMedium`, 1.55),
  /// shuning uchun o'sish `1.6` ga ko'paytiriladi.
  ///
  /// 1.0 va undan kichik masshtabda [base] aynan o'zi qaytadi — oddiy
  /// shriftda ko'rinish avvalgidek, hech narsa surilmaydi.
  static double rowHeight(BuildContext context,
      {double base = 40, bool dense = false}) {
    final size = dense ? 11.5 : 12.5;
    final grow = MediaQuery.textScalerOf(context).scale(size) - size;
    return grow > 0 ? base + grow * 1.6 : base;
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final accent = tone ?? t.accent2;
    // TANLANGAN CHIP — TUS, TO'LDIRISH EMAS.
    //
    // Ilgari tanlangan kapsula butunlay aksent rangda bo'yalar va
    // matn uning ustida qorong'i yozilardi. Qora mavzuda u qattiq
    // oltin tabletka bo'lib ko'rinardi — ekrandagi eng og'ir
    // element, holbuki bu shunchaki filtr.
    //
    // `nfcstore.uz/c/...` dagi til: fon qorong'i qolaveradi,
    // tanlov esa nozik tus + ingichka oltin chiziq + oltin matn
    // bilan ko'rsatiladi.
    //
    // PREMIUM OQ-QORA (2026-09-24): yorug' mavzuda ODDIY filtr chipi
    // (rangsiz, `tone` berilmagan) — faol bo'lsa QORA SIYOH, yozuvi oq;
    // faol bo'lmasa oq sirt + nozik chegara, yozuv to'q. Holat
    // yorliqlari (`tone`: ogohlantirish, xato) o'z rangidagi tusda
    // qoladi. Qorong'i mavzularda — avvalgidek.
    final ink = tone == null;
    final fg = ink
        ? (selected ? t.surfaceSolid : t.text1)
        : (selected ? accent : t.text2);

    return PressableScale(
      onTap: onTap,
      child: AnimatedContainer(
        duration: Motion.fast,
        curve: Motion.smooth,
        padding: EdgeInsets.symmetric(
          horizontal: dense ? 12 : 15,
          vertical: dense ? 7 : 9.5,
        ),
        decoration: ink
            ? BoxDecoration(
                color: selected ? t.text1 : t.surfaceSolid,
                borderRadius: R.pill,
                border: Border.all(color: selected ? t.text1 : t.border1),
                boxShadow: selected ? null : t.shadowTiny,
              )
            : BoxDecoration(
                color: selected
                    ? accent.withValues(alpha: t.isDark ? .13 : .18)
                    : t.surface2,
                borderRadius: R.pill,
                border: Border.all(
                  color: selected ? accent.withValues(alpha: .55) : t.border2,
                ),
              ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: dense ? 13 : 15, color: fg),
              const SizedBox(width: 6),
            ],
            // UZUN YORLIQ EKRANDAN CHIQMAYDI.
            //
            // Shikoyat sabablari ("Diniy haqorat, ekstremizm...") tor
            // ekranda kapsulani ekrandan tashqariga itarardi (RenderFlex
            // overflow). `Flexible` bu yerda ishlatib bo'lmaydi — kapsula
            // gorizontal ro'yxatlarda ham turadi (cheksiz kenglik). Shuning
            // uchun matnga ekran kengligidan kelib chiqqan chegara
            // beriladi: sig'masa ikki qatorga o'tadi.
            ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.sizeOf(context).width - 140,
              ),
              child: Text(
                label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontFamily: 'Manrope',
                  fontSize: dense ? 11.5 : 12.5,
                  fontWeight: FontWeight.w600,
                  color: fg,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bosilganda yengil kichrayadigan o'ram.
///
/// NIMA UCHUN `InkWell` EMAS: Material to'lqini bu dizayn tiliga begona.
/// Bu yerda javob "spring" — jismoniy tugmaga o'xshaydi.
class PressableScale extends StatefulWidget {
  const PressableScale({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.scale = .965,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double scale;

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    if (widget.onTap == null && widget.onLongPress == null) return widget.child;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      onLongPress: widget.onLongPress,
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: Motion.fast,
        curve: Motion.spring,
        child: widget.child,
      ),
    );
  }
}

/// Bo'lim sarlavhasi: kichik katta-harfli yorliq + ixtiyoriy "Hammasi".
class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.action, this.onAction});

  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screenX, Gap.xxl, Gap.screenX, Gap.md),
      // O'NG TOMONDAGI YOZUV YARIMDAN OSHMAYDI.
      //
      // Ilgari u oddiy (flex bo'lmagan) bola edi: Flutter uni AVVAL
      // tabiiy kengligida joylashtirib, qolganini sarlavhaga
      // berardi. Yozuv uzun bo'lsa (masalan "NFC Mobile nima?"
      // degan savol) 320dp li ekranda qatorga sig'masdi va
      // `RenderFlex overflowed` chiqardi — sariq-qora chiziqlar
      // bilan. Telefonda bu 360dp dan tor qurilmalarda ko'rinardi.
      //
      // `LayoutBuilder` + 50% cheklov: qisqa yozuvlar uchun hech
      // narsa o'zgarmaydi (ular yarmidan kichik), uzunlari esa
      // qisqartiriladi.
      child: LayoutBuilder(
        builder: (context, box) => Row(
          children: [
            Expanded(
              child: Text(
                title.toUpperCase(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(color: t.text3),
              ),
            ),
            if (action != null)
              ConstrainedBox(
                constraints: BoxConstraints(maxWidth: box.maxWidth * .5),
                child: PressableScale(
                  onTap: onAction,
                  child: Padding(
                    // Barmoq uchun 44px minimal nishon: matnning o'zi juda kichik.
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
                    child: Text(
                      action!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.end,
                      style: TextStyle(
                        fontFamily: 'Manrope',
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: t.accent2,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
