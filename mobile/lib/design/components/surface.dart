import 'dart:ui' show ImageFilter;

import 'package:flutter/widgets.dart';

import '../tokens.dart';
import '../type.dart';
import 'icons.dart';
import 'press.dart';

/// YUZALAR — chuqurlik qatlamlardan keladi, yorqinlikdan emas.
///
/// Uch xil yuza bor va ular ARALASHTIRILMAYDI:
///
/// • `Surface` — fondan ko'tarilgan qattiq yuza (karta, tile).
///   Gradient + nozik qirra + soya.
/// • `GlassPanel` — shisha (sheet, yopishgan panel, top bar).
///   Orqasi xiralashadi, ustida oq 6–7% yorug'lik.
/// • `Hairline` — shunchaki chiziq bilan ajratish (ro'yxat).

// ─────────────────────────────────────────────────────────────
// KO'TARILGAN YUZA
// ─────────────────────────────────────────────────────────────

class Surface extends StatelessWidget {
  const Surface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(S.x16),
    this.radius = R.card,
    this.gradient,
    this.color,
    this.border,
    this.shadow,
    this.glow = false,
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;

  /// Standart — `C.raisedSurface`. Boshqa gradient faqat maxsus
  /// holatda (metall karta, holat kartasi).
  final Gradient? gradient;

  /// Gradient o'rniga tekis rang.
  final Color? color;

  final BoxBorder? border;
  final List<BoxShadow>? shadow;

  /// Oltin rim-glow — faqat URG'U kartalarida. Har kartada bo'lsa,
  /// ekran charchatadi.
  final bool glow;

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final box = DecoratedBox(
      decoration: BoxDecoration(
        gradient: color == null ? (gradient ?? C.raisedSurface) : null,
        color: color,
        borderRadius: BorderRadius.circular(radius),
        border: border ?? Border.all(color: C.line, width: 1),
        boxShadow: [
          ...(shadow ?? C.e2),
          if (glow) ...C.rimGlow,
        ],
      ),
      child: Padding(padding: padding, child: child),
    );

    if (onTap == null) return box;
    return Press(onTap: onTap, scale: .985, minSize: 0, child: box);
  }
}

// ─────────────────────────────────────────────────────────────
// SHISHA
// ─────────────────────────────────────────────────────────────

/// Shisha panel — orqa fon xiralashadi.
///
/// `BackdropFilter` qimmat, shuning uchun u FAQAT ustma-ust
/// turadigan yuzalarda ishlatiladi: sheet, yopishgan pastki panel,
/// top bar. Oddiy kartalarda `Surface` yetarli.
class GlassPanel extends StatelessWidget {
  const GlassPanel({
    super.key,
    required this.child,
    this.radius = R.card,
    this.blur = C.blurPanel,
    this.padding = EdgeInsets.zero,
    this.border = true,
    this.borderColor,
    this.tint,
  });

  final Widget child;
  final double radius;
  final double blur;
  final EdgeInsetsGeometry padding;
  final bool border;

  /// Chegara rangi. Standart — neytral `C.lineCool`, chunki shisha
  /// odatda SOVUQ yuzalarda (sheet, top bar) turadi.
  ///
  /// Iliq ekranda (Bosh sahifadagi tezkor amallar paneli) qirra
  /// oltin bo'ladi: neytral oq chiziq u yerda kulrang bo'lib
  /// ajralib qoladi.
  final Color? borderColor;

  /// Qo'shimcha rang (masalan xato holatida qizg'ish).
  final Color? tint;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: tint == null ? C.glassSurface : null,
            color: tint,
            borderRadius: BorderRadius.circular(radius),
            border: border
                ? Border.all(color: borderColor ?? C.lineCool, width: 1)
                : null,
          ),
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// SARLAVHA ELEMENTLARI
// ─────────────────────────────────────────────────────────────

/// Bo'lim ustidagi kichik oltin yozuv — "TOSHKENT · 14 SENTABR".
class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key, this.color});

  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) => Text(
        text.toUpperCase(),
        style: color == null ? T.eyebrow : T.eyebrow.copyWith(color: color),
      );
}

/// Bo'lim sarlavhasi + o'ngda ixtiyoriy amal.
class SectionHeader extends StatelessWidget {
  const SectionHeader(
    this.title, {
    super.key,
    this.actionLabel,
    this.onAction,
    this.trailing,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// Amal o'rniga ixtiyoriy widget (masalan son).
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Expanded(child: Text(title, style: T.section)),
          if (actionLabel != null && onAction != null)
            Press(
              onTap: onAction,
              minSize: 0,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: S.x8,
                  vertical: S.x12,
                ),
                child: Text(
                  actionLabel!,
                  style: T.buttonSm.copyWith(color: C.accent),
                ),
              ),
            )
          else if (trailing != null)
            trailing!,
        ],
      );
}

// ─────────────────────────────────────────────────────────────
// CHIP · BADGE
// ─────────────────────────────────────────────────────────────

/// Filtr chipi — kategoriya, saralash.
class FilterChip extends StatelessWidget {
  const FilterChip(
    this.label, {
    super.key,
    this.active = false,
    this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: 0,
        scale: .95,
        child: AnimatedContainer(
          duration: M.fade,
          curve: M.curve,
          height: 38,
          padding: const EdgeInsets.symmetric(horizontal: S.x16),
          decoration: BoxDecoration(
            gradient: active ? C.actionFace : null,
            color: active ? null : C.surface,
            borderRadius: BorderRadius.circular(R.chip),
            border: Border.all(
              color: active ? const Color(0x00000000) : C.line,
            ),
          ),
          // `alignment` o'rniga `Align(widthFactor: 1)` — aks holda
          // chip `Wrap`/`Row` ichida butun kenglikka cho'zilardi.
          child: Align(
            widthFactor: 1,
            child: Text(
              label,
              style: T.buttonSm.copyWith(
                color: active ? C.onAccent : C.ink2,
              ),
            ),
          ),
        ),
      );
}

/// Holat ohangi.
enum StatusTone { ok, pending, fail, neutral, accent }

/// HOLAT CHIPI — rang + BELGI + matn.
///
/// Dizayn qoidasi: "Holatni faqat rang bilan bildirma". Rang
/// ko'rmaydigan foydalanuvchi uchun har holatning o'z belgisi bor
/// va matn har doim yoziladi.
class StatusChip extends StatelessWidget {
  const StatusChip(this.label, {super.key, this.tone = StatusTone.neutral});

  final String label;
  final StatusTone tone;

  Color get _color => switch (tone) {
        StatusTone.ok => C.ok,
        StatusTone.pending => C.warn,
        StatusTone.fail => C.fail,
        StatusTone.accent => C.accent,
        StatusTone.neutral => C.ink2,
      };

  Ico? get _icon => switch (tone) {
        StatusTone.ok => Ico.check,
        StatusTone.pending => Ico.clock,
        StatusTone.fail => Ico.close,
        _ => null,
      };

  @override
  Widget build(BuildContext context) {
    final c = _color;
    final icon = _icon;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: S.x12, vertical: 7),
      decoration: BoxDecoration(
        color: c.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(R.status),
        border: Border.all(color: c.withValues(alpha: .38)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            NIcon(icon, size: 12, color: c),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: T.buttonSm.copyWith(color: c, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

/// Tasdiqlangan belgi — oltin doira ichida chek.
class VerifiedBadge extends StatelessWidget {
  const VerifiedBadge({super.key, this.size = 16});

  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          gradient: C.actionFace,
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: NIcon(Ico.check, size: size * .66, color: C.onAccent),
      );
}

// ─────────────────────────────────────────────────────────────
// STATISTIKA
// ─────────────────────────────────────────────────────────────

/// Bitta statistika katakchasi — "4 812 / Ko'rish".
///
/// Qiymat MONO shriftda: uchta katakcha yonma-yon turganda
/// raqamlar bir xil kenglikda bo'lsin va ustunlar tekis ko'rinsin.
class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.value,
    required this.label,
    this.onTap,
    this.accent = false,
  });

  final String value;
  final String label;
  final VoidCallback? onTap;

  /// Asosiy ko'rsatkich — oltin rangda.
  final bool accent;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: 0,
        scale: .97,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: S.x12,
            vertical: S.x12,
          ),
          decoration: BoxDecoration(
            gradient: C.raisedSurface,
            borderRadius: BorderRadius.circular(R.tile),
            border: Border.all(color: C.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: accent
                    ? T.statValue.copyWith(color: C.accent)
                    : T.statValue,
              ),
              const SizedBox(height: 3),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: T.statLabel,
              ),
            ],
          ),
        ),
      );
}

/// Uchta statistika bir qatorda.
class StatRow extends StatelessWidget {
  const StatRow({super.key, required this.tiles});

  final List<Widget> tiles;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          for (var i = 0; i < tiles.length; i++) ...[
            if (i > 0) const SizedBox(width: S.x8),
            Expanded(child: tiles[i]),
          ],
        ],
      );
}

// ─────────────────────────────────────────────────────────────
// RO'YXAT QATORI
// ─────────────────────────────────────────────────────────────

/// Sozlamalar va ro'yxatlar uchun qator.
///
/// Balandligi kamida 56 dp — 48 dp bosish talabidan kattaroq,
/// chunki ikki qatorli matn joylashadi.
class ListRow extends StatelessWidget {
  const ListRow({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.onTap,
    this.chevron = true,
    this.danger = false,
  });

  final String title;
  final String? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool chevron;

  /// Xavfli amal — qizil matn (hisobni o'chirish, chiqish).
  final bool danger;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: 0,
        scale: .99,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: S.x16,
              vertical: S.x12,
            ),
            child: Row(
              children: [
                if (leading != null) ...[
                  leading!,
                  const SizedBox(width: S.x12),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title,
                        style: danger
                            ? T.cardTitle.copyWith(color: C.fail)
                            : T.cardTitle,
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          subtitle!,
                          style: T.caption.copyWith(color: C.ink3),
                        ),
                      ],
                    ],
                  ),
                ),
                if (trailing != null) ...[
                  const SizedBox(width: S.x12),
                  trailing!,
                ] else if (chevron && onTap != null) ...[
                  const SizedBox(width: S.x8),
                  NIcon(Ico.chevronRight, size: 18, color: C.ink3),
                ],
              ],
            ),
          ),
        ),
      );
}

/// Ro'yxat qatorlari orasidagi chiziq — faqat ichkarida, chetlarida
/// emas.
class RowDivider extends StatelessWidget {
  const RowDivider({super.key, this.indent = S.x16});

  final double indent;

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(left: indent),
        child: Container(height: 1, color: C.line),
      );
}

/// Bir nechta `ListRow` ni bitta kartaga yig'adi.
class RowGroup extends StatelessWidget {
  const RowGroup({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(R.card),
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: C.raisedSurface,
            borderRadius: BorderRadius.circular(R.card),
            border: Border.all(color: C.line),
          ),
          child: Column(
            children: [
              for (var i = 0; i < children.length; i++) ...[
                if (i > 0) const RowDivider(),
                children[i],
              ],
            ],
          ),
        ),
      );
}

// ─────────────────────────────────────────────────────────────
// AJRATGICHLAR
// ─────────────────────────────────────────────────────────────

/// Sarlavha ostidagi qisqa oltin chiziq — saytdan kelgan imzo.
class AccentRule extends StatelessWidget {
  const AccentRule({super.key, this.width = 56});

  final double width;

  @override
  Widget build(BuildContext context) => Container(
        width: width,
        height: 2,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [C.accent, C.accent.withValues(alpha: 0)],
          ),
          borderRadius: BorderRadius.circular(1),
        ),
      );
}
