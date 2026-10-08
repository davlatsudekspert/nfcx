import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../tokens.dart';

/// Bosilganda 160 ms ichida biroz kichrayadigan (0.975) yuzani beradi.
/// Klaviatura fokusi uchun aniq halqa chiziladi. Reduced motion yoqilgan
/// bo'lsa kichrayish o'chadi.
class LgPressable extends StatefulWidget {
  const LgPressable({
    super.key,
    required this.child,
    required this.onTap,
    this.borderRadius = const BorderRadius.all(
      Radius.circular(LgRadius.button),
    ),
    this.color,
    this.semanticLabel,
    this.selected,
    this.isButton = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final BorderRadius borderRadius;
  final Color? color;
  final String? semanticLabel;
  final bool? selected;
  final bool isButton;

  @override
  State<LgPressable> createState() => _LgPressableState();
}

class _LgPressableState extends State<LgPressable> {
  bool _pressed = false;
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final enabled = widget.onTap != null;
    final reduce = LgMotion.reduced(context);
    Widget body = Material(
      color: widget.color ?? Colors.transparent,
      borderRadius: widget.borderRadius,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: widget.onTap,
        onHighlightChanged: (v) => setState(() => _pressed = v),
        onFocusChange: (v) => setState(() => _focused = v),
        borderRadius: widget.borderRadius,
        child: widget.child,
      ),
    );
    if (_focused) {
      body = DecoratedBox(
        position: DecorationPosition.foreground,
        decoration: BoxDecoration(
          borderRadius: widget.borderRadius,
          border: Border.all(color: p.brand, width: 3),
        ),
        child: body,
      );
    }
    return Semantics(
      button: widget.isButton,
      enabled: enabled,
      selected: widget.selected,
      label: widget.semanticLabel,
      child: AnimatedScale(
        scale: _pressed && enabled && !reduce ? 0.975 : 1,
        duration: reduce ? Duration.zero : LgMotion.press,
        curve: Curves.easeOut,
        child: body,
      ),
    );
  }
}

enum LgButtonKind { primary, secondary, link }

class LgButton extends StatelessWidget {
  const LgButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.kind = LgButtonKind.primary,
    this.icon,
    this.busy = false,
    this.expand = true,
  });

  const LgButton.secondary({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.busy = false,
    this.expand = true,
  }) : kind = LgButtonKind.secondary;

  const LgButton.link({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.expand = true,
  }) : kind = LgButtonKind.link,
       busy = false;

  final String label;
  final VoidCallback? onPressed;
  final LgButtonKind kind;
  final IconData? icon;
  final bool busy;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    final enabled = onPressed != null && !busy;
    final (Color bg, Color fg) = switch (kind) {
      LgButtonKind.primary => (p.brand, p.onBrand),
      LgButtonKind.secondary => (p.paper, p.ink),
      LgButtonKind.link => (Colors.transparent, p.brand),
    };
    final style =
        (kind == LgButtonKind.link ? text.titleSmall : text.labelLarge)!
            .copyWith(color: fg);
    final content = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (busy)
          Padding(
            padding: const EdgeInsets.only(right: 10),
            child: SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(strokeWidth: 2, color: fg),
            ),
          )
        else if (icon != null)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Icon(icon, size: 20, color: fg),
          ),
        Flexible(
          child: Text(label, textAlign: TextAlign.center, style: style),
        ),
      ],
    );
    final padding = switch (kind) {
      LgButtonKind.primary => const EdgeInsets.symmetric(
        horizontal: 19,
        vertical: 16,
      ),
      LgButtonKind.secondary => const EdgeInsets.symmetric(
        horizontal: 18,
        vertical: 14,
      ),
      LgButtonKind.link => const EdgeInsets.symmetric(
        horizontal: 12,
        vertical: 10,
      ),
    };
    Widget button = LgPressable(
      onTap: enabled ? onPressed : null,
      color: bg,
      borderRadius: BorderRadius.circular(LgRadius.button),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: kMinTap),
        child: Padding(
          padding: padding,
          child: Center(child: content),
        ),
      ),
    );
    if (kind == LgButtonKind.secondary) {
      button = DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(LgRadius.button),
          border: Border.all(color: p.line),
        ),
        child: button,
      );
    } else if (kind == LgButtonKind.primary && enabled) {
      button = DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(LgRadius.button),
          boxShadow: [
            BoxShadow(
              color: p.shadow.withValues(alpha: 0.10),
              blurRadius: 15,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: button,
      );
    }
    return Opacity(opacity: enabled || busy ? 1 : 0.5, child: button);
  }
}

/// Karta/panel: paper fon, 23 px radius, chiziqsiz.
class LgPanel extends StatelessWidget {
  const LgPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.soft = false,
    this.margin = const EdgeInsets.symmetric(vertical: 6),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final bool soft;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    return Padding(
      padding: margin,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: soft ? p.soft : p.paper,
          borderRadius: BorderRadius.circular(LgRadius.card),
        ),
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

/// Hero karta: soft → paper gradient, 27 px radius, yumshoq soya.
/// [image] faqat dekorativ — screen reader uchun yashiriladi.
class LgHeroCard extends StatelessWidget {
  const LgHeroCard({
    super.key,
    required this.title,
    this.eyebrow,
    this.tag,
    this.body,
    this.action,
    this.image,
  });

  final String title;
  final String? eyebrow;
  final String? tag;
  final String? body;
  final Widget? action;
  final ImageProvider? image;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(LgRadius.hero),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [p.soft, p.paper],
          ),
          boxShadow: [
            BoxShadow(
              color: p.shadow.withValues(alpha: 0.05),
              blurRadius: 24,
              offset: const Offset(0, 7),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (image != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 18),
                  child: LgDecorativeImage(
                    image: image!,
                    height: 150,
                    radius: 18,
                  ),
                ),
              if (eyebrow != null) LgEyebrow(eyebrow!),
              if (tag != null) LgTag(tag!),
              const SizedBox(height: 10),
              Semantics(
                header: true,
                child: Text(title, style: text.headlineMedium),
              ),
              if (body != null) ...[
                const SizedBox(height: 8),
                Text(body!, style: text.bodyMedium),
              ],
              if (action != null) ...[const SizedBox(height: 16), action!],
            ],
          ),
        ),
      ),
    );
  }
}

/// Dekorativ rasm: semantik daraxtdan chiqariladi, kontentga aralashmaydi.
class LgDecorativeImage extends StatelessWidget {
  const LgDecorativeImage({
    super.key,
    required this.image,
    required this.height,
    this.radius = LgRadius.hero,
  });

  final ImageProvider image;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Container(
          height: height,
          width: double.infinity,
          color: p.soft,
          child: Image(
            image: image,
            fit: BoxFit.cover,
            alignment: const Alignment(0.35, 0),
            errorBuilder: (_, _, _) => const SizedBox.shrink(),
          ),
        ),
      ),
    );
  }
}

class LgEyebrow extends StatelessWidget {
  const LgEyebrow(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Text(
        text.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall!
            .copyWith(color: p.brand, letterSpacing: 1.6),
      ),
    );
  }
}

/// Kichik "pill" belgi. [tone] — status rangi (rangsiz holatda ham matn
/// ma'noni beradi: rangga tayanmaymiz).
enum LgTone { brand, warning, neutral }

class LgTag extends StatelessWidget {
  const LgTag(this.text, {super.key, this.tone = LgTone.brand, this.icon});

  final String text;
  final LgTone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final (Color bg, Color fg) = switch (tone) {
      LgTone.brand => (p.soft, p.brand),
      LgTone.warning => (p.amberBg, p.amber),
      LgTone.neutral => (p.bg, p.sub),
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(LgRadius.tag),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 14, color: fg),
              const SizedBox(width: 5),
            ],
            Flexible(
              child: Text(
                text,
                style: Theme.of(context).textTheme.labelMedium!
                    .copyWith(color: fg),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum NoticeKind { warning, info, error }

/// Ogohlantirish/ma'lumot bloki. Ikonka ma'noni rangsiz ham yetkazadi.
class LgNotice extends StatelessWidget {
  const LgNotice(
    this.text, {
    super.key,
    this.kind = NoticeKind.warning,
    this.title,
  });

  final String text;
  final String? title;
  final NoticeKind kind;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    final (Color bg, Color fg, IconData icon) = switch (kind) {
      NoticeKind.warning => (p.amberBg, p.amber, Icons.info_outline_rounded),
      NoticeKind.info => (p.soft, p.brand, Icons.verified_outlined),
      NoticeKind.error => (p.amberBg, p.danger, Icons.error_outline_rounded),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Semantics(
        container: true,
        liveRegion: kind == NoticeKind.error,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 16, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: Icon(icon, size: 18, color: fg),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (title != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 2),
                          child: Text(
                            title!,
                            style: textTheme.titleMedium!.copyWith(
                              color: fg,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      Text(
                        text,
                        style: textTheme.bodyMedium!.copyWith(
                          color: fg,
                          fontSize: 13,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Ro'yxat qatori: doira ikonka, sarlavha, izoh, o'q.
class LgRow extends StatelessWidget {
  const LgRow({
    super.key,
    required this.title,
    required this.icon,
    this.subtitle,
    this.onTap,
    this.trailing,
    this.divider = true,
  });

  final String title;
  final String? subtitle;
  final IconData icon;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool divider;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          ExcludeSemantics(
            child: Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(color: p.soft, shape: BoxShape.circle),
              child: Icon(icon, size: 21, color: p.brand),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: text.titleSmall),
                if (subtitle != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle!,
                    style: text.bodySmall!.copyWith(fontSize: 13),
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 8), trailing!],
          if (onTap != null) ...[
            const SizedBox(width: 6),
            ExcludeSemantics(
              child: Icon(Icons.chevron_right_rounded, color: p.sub, size: 22),
            ),
          ],
        ],
      ),
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        border: divider
            ? Border(bottom: BorderSide(color: p.line.withValues(alpha: 0.7)))
            : null,
      ),
      child: onTap == null
          ? Semantics(container: true, child: row)
          : LgPressable(
              onTap: onTap,
              borderRadius: BorderRadius.circular(14),
              child: row,
            ),
    );
  }
}

/// Bosh sahifadagi tezkor amal kartasi.
class LgTile extends StatelessWidget {
  const LgTile({
    super.key,
    required this.title,
    required this.caption,
    required this.icon,
    required this.onTap,
    this.highlighted = false,
  });

  final String title;
  final String caption;
  final IconData icon;
  final VoidCallback onTap;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(LgRadius.card),
        boxShadow: [
          BoxShadow(
            color: p.shadow.withValues(alpha: 0.04),
            blurRadius: 15,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: LgPressable(
        onTap: onTap,
        color: highlighted ? p.soft : p.paper,
        borderRadius: BorderRadius.circular(LgRadius.card),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 120),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                ExcludeSemantics(child: Icon(icon, color: p.brand, size: 24)),
                const SizedBox(height: 18),
                Text(title, style: text.titleMedium),
                const SizedBox(height: 4),
                Text(caption, style: text.bodySmall),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Ikki ustunli to'r: balandlik kontentga qarab o'sadi (katta shriftda
/// kesilmaydi). Juda tor/katta shriftli ekranda bitta ustunga o'tadi.
class LgTwoColumnGrid extends StatelessWidget {
  const LgTwoColumnGrid({super.key, required this.children, this.gap = 10});

  final List<Widget> children;
  final double gap;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final scale = MediaQuery.textScalerOf(context).scale(16) / 16;
        final columns = constraints.maxWidth / scale < 280 ? 1 : 2;
        final rows = <Widget>[];
        for (var i = 0; i < children.length; i += columns) {
          final slice = children.skip(i).take(columns).toList();
          rows.add(
            Padding(
              padding: EdgeInsets.only(bottom: gap),
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var j = 0; j < columns; j++) ...[
                      if (j > 0) SizedBox(width: gap),
                      Expanded(
                        child: j < slice.length ? slice[j] : const SizedBox(),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        }
        return Column(children: rows);
      },
    );
  }
}

class LgSectionTitle extends StatelessWidget {
  const LgSectionTitle(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 22, bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Semantics(
              header: true,
              child: Text(text, style: Theme.of(context).textTheme.titleLarge),
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// Filtr chipi: kamida 44 px balandlik, tanlangan holat rang + belgi bilan.
class LgChoiceChip extends StatelessWidget {
  const LgChoiceChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final style = Theme.of(context).textTheme.labelMedium!.copyWith(
      fontSize: 13,
      color: selected ? p.onBrand : p.ink,
      fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
    );
    return LgPressable(
      onTap: onTap,
      selected: selected,
      color: selected ? p.brand : p.paper,
      borderRadius: BorderRadius.circular(LgRadius.chip),
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          minHeight: kMinTap,
          minWidth: kMinTap,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (selected) ...[
                Icon(Icons.check_rounded, size: 16, color: p.onBrand),
                const SizedBox(width: 4),
              ],
              Flexible(child: Text(label, style: style)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Raqamlangan qadamlar ro'yxati.
class LgSteps extends StatelessWidget {
  const LgSteps(this.steps, {super.key});

  final List<String> steps;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    return Column(
      children: [
        for (var i = 0; i < steps.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: p.soft,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${i + 1}',
                    style: text.labelMedium!.copyWith(
                      color: p.brand,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(steps[i], style: text.bodyLarge),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// "Yorliq — qiymat" qatori (metrikalar, metadata).
class LgMetric extends StatelessWidget {
  const LgMetric({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: p.line.withValues(alpha: 0.7)),
        ),
      ),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        spacing: 12,
        runSpacing: 2,
        children: [
          Text(label, style: text.bodyMedium),
          Text(value, style: text.titleSmall),
        ],
      ),
    );
  }
}

enum StateKind { loading, empty, offline, error, unavailable, success }

/// Bir xil ko'rinishdagi holat bloki: loading / empty / offline / error /
/// unavailable / success. Ishlamaydigan amal muvaffaqiyat ko'rsatmaydi —
/// buning uchun [StateKind.unavailable] bor.
class LgStateView extends StatelessWidget {
  const LgStateView({
    super.key,
    required this.kind,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
    this.secondary,
  });

  final StateKind kind;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Widget? secondary;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    final IconData icon = switch (kind) {
      StateKind.loading => Icons.hourglass_top_rounded,
      StateKind.empty => Icons.inbox_outlined,
      StateKind.offline => Icons.cloud_off_rounded,
      StateKind.error => Icons.error_outline_rounded,
      StateKind.unavailable => Icons.link_off_rounded,
      StateKind.success => Icons.check_circle_outline_rounded,
    };
    final color = kind == StateKind.error ? p.danger : p.brand;
    return Semantics(
      container: true,
      liveRegion: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Column(
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: p.soft,
                borderRadius: BorderRadius.circular(25),
              ),
              alignment: Alignment.center,
              child: kind == StateKind.loading
                  ? SizedBox.square(
                      dimension: 28,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: color,
                      ),
                    )
                  : ExcludeSemantics(child: Icon(icon, size: 34, color: color)),
            ),
            const SizedBox(height: 18),
            Text(title, textAlign: TextAlign.center, style: text.titleLarge),
            if (message != null) ...[
              const SizedBox(height: 8),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: text.bodyMedium,
              ),
            ],
            if (actionLabel != null) ...[
              const SizedBox(height: 18),
              LgButton(label: actionLabel!, onPressed: onAction),
            ],
            if (secondary != null) ...[const SizedBox(height: 10), secondary!],
          ],
        ),
      ),
    );
  }
}

/// Matn maydoni: tepasida yorliq, 16 px kirish matni.
class LgField extends StatelessWidget {
  const LgField({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.keyboardType,
    this.textInputAction,
    this.onSubmitted,
    this.onChanged,
    this.errorText,
    this.autofillHints,
    this.maxLines = 1,
    this.maxLength,
    this.focusNode,
    this.inputFormatters,
  });

  final String label;
  final TextEditingController? controller;
  final String? hint;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onChanged;
  final String? errorText;
  final Iterable<String>? autofillHints;
  final int maxLines;
  final int? maxLength;
  final FocusNode? focusNode;
  final List<TextInputFormatter>? inputFormatters;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    // MergeSemantics: screen reader maydonni tepadagi yorliq nomi bilan
    // o'qiydi (yorliq vizual ravishda maydon ustida turadi).
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: MergeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Text(
                label,
                style: text.titleSmall!.copyWith(fontSize: 14),
              ),
            ),
            TextField(
              controller: controller,
              focusNode: focusNode,
              keyboardType: keyboardType,
              textInputAction: textInputAction,
              onSubmitted: onSubmitted,
              onChanged: onChanged,
              autofillHints: autofillHints,
              maxLines: maxLines,
              maxLength: maxLength,
              inputFormatters: inputFormatters,
              style: text.bodyLarge,
              decoration: InputDecoration(
                hintText: hint,
                errorText: errorText,
                errorMaxLines: 3,
                counterText: '',
                semanticCounterText: '',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
